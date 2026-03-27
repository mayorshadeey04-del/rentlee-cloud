import crypto from 'crypto';
import db from '../config/db.js';
import { sendPasswordSetupEmail } from '../utils/email.service.js';

// ============================================
// @desc    Get All Tenants
// @route   GET /api/tenants
// @access  Private (Landlord, Caretaker)
// ============================================
export const getTenants = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const landlordId = role === 'landlord' ? userId : req.user.landlord_id;

    // Get property IDs based on role
    let propertyIds = [];
    if (role === 'landlord') {
      const propertiesResult = await db.query(
        'SELECT id FROM properties WHERE landlord_id = $1',
        [landlordId]
      );
      propertyIds = propertiesResult.rows.map(p => p.id);
    } else if (role === 'caretaker') {
      const propertiesResult = await db.query(
        'SELECT property_id FROM caretaker_properties WHERE caretaker_id = $1 AND status = $2',
        [userId, 'active']
      );
      propertyIds = propertiesResult.rows.map(p => p.property_id);
    }

    if (propertyIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // ✅ FIXED: Joins unit_types and tenancies to get correct rent, computes live balance
    const result = await db.query(
      `SELECT t.id, 
              u.first_name, 
              u.last_name, 
              u.email, 
              u.phone, 
              u.is_active,
              t.id_number,
              t.property_id, 
              p.name as property_name,
              t.unit_id, 
              un.unit_number, 
              ut.name as unit_type, 
              tc.agreed_rent as rent_amount,
              (COALESCE((SELECT SUM(amount_due) FROM rent_periods rp WHERE rp.tenant_id = t.id AND rp.status != 'paid'), 0) -
               COALESCE((SELECT SUM(amount) FROM payments py WHERE py.tenant_id = t.id AND py.payment_type = 'rent' AND py.status = 'confirmed'), 0)) as balance,
              t.status, 
              t.created_at
       FROM tenants t
       JOIN users u ON t.user_id = u.id
       JOIN properties p ON t.property_id = p.id
       JOIN units un ON t.unit_id = un.id
       JOIN unit_types ut ON un.unit_type_id = ut.id
       LEFT JOIN tenancies tc ON tc.tenant_id = t.id AND tc.status = 'active'
       WHERE t.property_id = ANY($1::uuid[])
       ORDER BY t.created_at DESC`,
      [propertyIds]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch tenants'
    });
  }
};

// ============================================
// @desc    Get Single Tenant
// @route   GET /api/tenants/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const getTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const result = await db.query(
      `SELECT t.id, 
              u.first_name, 
              u.last_name, 
              u.email, 
              u.phone, 
              u.is_active,
              t.id_number,
              t.property_id, 
              p.name as property_name,
              t.unit_id, 
              un.unit_number, 
              ut.name as unit_type, 
              tc.agreed_rent as rent_amount,
              (COALESCE((SELECT SUM(amount_due) FROM rent_periods rp WHERE rp.tenant_id = t.id AND rp.status != 'paid'), 0) -
               COALESCE((SELECT SUM(amount) FROM payments py WHERE py.tenant_id = t.id AND py.payment_type = 'rent' AND py.status = 'confirmed'), 0)) as balance,
              t.status, 
              t.created_at
       FROM tenants t
       JOIN users u ON t.user_id = u.id
       JOIN properties p ON t.property_id = p.id
       JOIN units un ON t.unit_id = un.id
       JOIN unit_types ut ON un.unit_type_id = ut.id
       LEFT JOIN tenancies tc ON tc.tenant_id = t.id AND tc.status = 'active'
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const tenant = result.rows[0];

    // Check access
    if (role === 'landlord') {
      const propertyCheck = await db.query(
        'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
        [tenant.property_id, userId]
      );
      if (propertyCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    } else if (role === 'caretaker') {
      const caretakerCheck = await db.query(
        'SELECT id FROM caretaker_properties WHERE caretaker_id = $1 AND property_id = $2 AND status = $3',
        [userId, tenant.property_id, 'active']
      );
      if (caretakerCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.json({
      success: true,
      data: tenant
    });

  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch tenant'
    });
  }
};

// ============================================
// @desc    Create Tenant
// @route   POST /api/tenants
// @access  Private (Landlord, Caretaker)
// ============================================
export const createTenant = async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    idNumber,
    propertyId,
    unitId,
    depositAmount
  } = req.body;

  try {
    const userId = req.user.id;
    const role = req.user.role;
    const landlordId = role === 'landlord' ? userId : req.user.landlord_id;

    // Validate input
    if (!firstName || !lastName || !email || !idNumber || !propertyId || !unitId) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, ID number, property ID, and unit ID are required'
      });
    }

    // Check access to property
    if (role === 'landlord') {
      const propertyCheck = await db.query(
        'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
        [propertyId, userId]
      );
      if (propertyCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied to this property' });
      }
    } else if (role === 'caretaker') {
      const caretakerCheck = await db.query(
        'SELECT id FROM caretaker_properties WHERE caretaker_id = $1 AND property_id = $2 AND status = $3',
        [userId, propertyId, 'active']
      );
      if (caretakerCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied to this property' });
      }
    }

    // Check if email already exists
    const emailCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    // Check if ID number already exists
    const idNumberCheck = await db.query('SELECT id FROM tenants WHERE id_number = $1', [idNumber]);
    if (idNumberCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'ID number already registered' });
    }

    // Check if unit exists and is vacant
    const unitCheck = await db.query(
      'SELECT status, unit_type_id FROM units WHERE id = $1 AND property_id = $2',
      [unitId, propertyId]
    );

    if (unitCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Unit not found in this property' });
    if (unitCheck.rows[0].status === 'occupied') return res.status(400).json({ success: false, message: 'Unit is already occupied' });

    // Get the default rent for this unit's tier
    const typeResult = await db.query('SELECT default_rent FROM unit_types WHERE id = $1', [unitCheck.rows[0].unit_type_id]);
    const defaultRent = typeResult.rows[0].default_rent;

    // Generate activation token
    const activationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(activationToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // ── START TRANSACTION ──
    await db.query('BEGIN');

    // 1. Create user account
    const userResult = await db.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, role, landlord_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, first_name, last_name, email, phone, role, is_active`,
      [firstName, lastName, email, phone, 'temp_password_hash', 'tenant', landlordId, false]
    );
    const newUser = userResult.rows[0];

    // 2. Store activation token
    await db.query(
      'INSERT INTO password_tokens (user_id, token_hash, token_type, expires_at) VALUES ($1, $2, $3, $4)',
      [newUser.id, tokenHash, 'activation', expiresAt]
    );

    // 3. Create tenant record
    const tenantResult = await db.query(
      `INSERT INTO tenants (user_id, id_number, landlord_id, property_id, unit_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [newUser.id, idNumber, landlordId, propertyId, unitId, 'pending']
    );
    const tenantId = tenantResult.rows[0].id;

    // 4. Create the official Tenancy Contract (Notice the RETURNING id)
    const tenancyResult = await db.query(
      `INSERT INTO tenancies (tenant_id, unit_id, landlord_id, agreed_rent, deposit_amount, start_date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
       RETURNING id`,
      [tenantId, unitId, landlordId, defaultRent, depositAmount || 0]
    );
    const tenancyId = tenancyResult.rows[0].id;

    // ✅ 5. CREATE INITIAL INVOICE (This fixes the Ksh 0 balance!)
    const totalMoveInCost = Number(defaultRent) + Number(depositAmount || 0);
    await db.query(
      `INSERT INTO rent_periods (tenancy_id, tenant_id, period_name, amount_due, due_date, status)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, 'unpaid')`,
      [tenancyId, tenantId, 'Move-in Charges', totalMoveInCost]
    );

    // ── COMMIT TRANSACTION ──
    await db.query('COMMIT');

    // ✅ FIRE AND FORGET EMAIL (This fixes the "Sending Invite..." hang!)
    // We removed the 'await' keyword so the server doesn't freeze waiting for the email.
    sendPasswordSetupEmail(email, activationToken, firstName, 'tenant').catch(err => {
      console.error('Background email failed to send:', err);
    });

    res.status(201).json({
      success: true,
      message: 'Tenant created successfully. Password setup email sent.',
      data: {
        tenantId: tenantId,
        userId: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        idNumber: idNumber
      }
    });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Create tenant error:', error);
    
    if (error.code === '23505' && error.constraint === 'tenants_id_number_unique') {
      return res.status(400).json({ success: false, message: 'ID number already registered' });
    }

    res.status(500).json({ success: false, message: error.message || 'Failed to create tenant' });
  }
};

// ============================================
// @desc    Update Tenant
// @route   PUT /api/tenants/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const updateTenant = async (req, res) => {
  const { id } = req.params;
  const {
    firstName,
    lastName,
    email,
    phone,
    idNumber,
    status
  } = req.body;

  try {
    const userId = req.user.id;
    const role = req.user.role;

    // Get tenant
    const tenantResult = await db.query(
      'SELECT t.*, u.id as user_id, u.email as old_email FROM tenants t JOIN users u ON t.user_id = u.id WHERE t.id = $1',
      [id]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const tenant = tenantResult.rows[0];

    // Check access
    if (role === 'landlord') {
      const propertyCheck = await db.query(
        'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
        [tenant.property_id, userId]
      );
      if (propertyCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    } else if (role === 'caretaker') {
      const caretakerCheck = await db.query(
        'SELECT id FROM caretaker_properties WHERE caretaker_id = $1 AND property_id = $2 AND status = $3',
        [userId, tenant.property_id, 'active']
      );
      if (caretakerCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // If email is being changed, check if it's available
    if (email && email !== tenant.old_email) {
      const emailCheck = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, tenant.user_id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    // If ID number is being changed, check if it's available
    if (idNumber && idNumber !== tenant.id_number) {
      const idNumberCheck = await db.query(
        'SELECT id FROM tenants WHERE id_number = $1 AND id != $2',
        [idNumber, id]
      );

      if (idNumberCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'ID number already registered'
        });
      }
    }

    // Validate status if provided
    if (status && !['pending', 'active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be pending, active, or inactive'
      });
    }

    // Update user info
    await db.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone)
       WHERE id = $5`,
      [firstName, lastName, email, phone, tenant.user_id]
    );

    // ✅ Update tenant info (balance removed)
    const result = await db.query(
      `UPDATE tenants
       SET id_number = COALESCE($1, id_number),
           status = COALESCE($2, status)
       WHERE id = $3
       RETURNING *`,
      [idNumber, status, id]
    );

    res.json({
      success: true,
      message: 'Tenant updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update tenant'
    });
  }
};

// ============================================
// @desc    Delete Tenant (SMART TWO-STAGE DELETE)
// @route   DELETE /api/tenants/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const deleteTenant = async (req, res) => {
  const { id } = req.params;

  try {
    const userId = req.user.id;
    const role = req.user.role;

    // Get tenant and their current status
    const tenantResult = await db.query(
      'SELECT t.*, u.id as user_id FROM tenants t JOIN users u ON t.user_id = u.id WHERE t.id = $1',
      [id]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const tenant = tenantResult.rows[0];

    // Check Authorization/Access rights
    if (role === 'landlord') {
      const propertyCheck = await db.query(
        'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
        [tenant.property_id, userId]
      );
      if (propertyCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    } else if (role === 'caretaker') {
      const caretakerCheck = await db.query(
        'SELECT id FROM caretaker_properties WHERE caretaker_id = $1 AND property_id = $2 AND status = $3',
        [userId, tenant.property_id, 'active']
      );
      if (caretakerCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // ── TWO-STAGE DELETE LOGIC ────────────────────────────────────────────────

    // ✅ STAGE 2: PERMANENT DELETE (If already inactive)
    if (tenant.status === 'inactive') {
      
      // Deleting the user triggers the ON DELETE CASCADE for the tenants table
      // which in turn fires the database trigger to ensure the unit is marked vacant.
      await db.query('DELETE FROM users WHERE id = $1', [tenant.user_id]);

      console.log(`✅ Tenant ${id} and User ${tenant.user_id} permanently erased.`);

      return res.json({
        success: true,
        message: 'Tenant record permanently erased from the system.'
      });
    } 
    
    // ✅ STAGE 1: SOFT DELETE (Deactivation)
    else {
      await db.query('BEGIN');

      // 1. Soft delete the tenant (Updates status)
      await db.query(
        "UPDATE tenants SET status = 'inactive' WHERE id = $1",
        [id]
      );

      // 2. Soft delete the user (Blocks login and sets timestamp)
      await db.query(
        "UPDATE users SET is_active = false, deleted_at = NOW() WHERE id = $1",
        [tenant.user_id]
      );

      await db.query('COMMIT');

      console.log(`✅ Tenant ${id} soft deleted (status set to inactive).`);

      return res.json({
        success: true,
        message: 'Tenant deactivated successfully. Unit is now marked as vacant.'
      });
    }

  } catch (error) {
    // Only rollback if we were in the middle of the Stage 1 transaction
    if (req.body?.status !== 'inactive') {
      try {
        await db.query('ROLLBACK');
      } catch(e) { /* ignore rollback errors if no transaction was active */ }
    }
    
    console.error('Delete tenant error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process deletion'
    });
  }
};

export default {
  getTenants,
  getTenant,
  createTenant,
  updateTenant,
  deleteTenant
};