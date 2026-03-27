import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../config/db.js';
import { sendPasswordSetupEmail } from '../utils/email.service.js';

// ============================================
// @desc    Get All Caretakers
// @route   GET /api/caretakers
// @access  Private (Landlord only)
// ============================================
export const getCaretakers = async (req, res) => {
  try {
    const landlordId = req.user.id;

    const result = await db.query(
      `SELECT u.id, 
              u.email, 
              u.first_name, 
              u.last_name, 
              u.phone, 
              u.is_active, 
              u.deleted_at,
              u.created_at,
              -- Compute status for frontend display
              CASE 
                WHEN u.deleted_at IS NOT NULL THEN 'inactive'
                WHEN u.is_active = true THEN 'active'
                ELSE 'pending'
              END as status,
              COALESCE(
                json_agg(
                  json_build_object('propertyId', p.id, 'propertyName', p.name, 'status', cp.status)
                ) FILTER (WHERE p.id IS NOT NULL), '[]'
              ) as properties
       FROM users u
       LEFT JOIN caretaker_properties cp ON u.id = cp.caretaker_id
       LEFT JOIN properties p ON cp.property_id = p.id
       WHERE u.role = 'caretaker' 
         AND u.landlord_id = $1
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      [landlordId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get caretakers error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch caretakers'
    });
  }
};

// ============================================
// @desc    Get Single Caretaker
// @route   GET /api/caretakers/:id
// @access  Private (Landlord only)
// ============================================
export const getCaretaker = async (req, res) => {
  try {
    const { id } = req.params;
    const landlordId = req.user.id;

    const result = await db.query(
      `SELECT u.id, 
              u.email, 
              u.first_name, 
              u.last_name, 
              u.phone, 
              u.is_active, 
              u.deleted_at,
              u.created_at,
              -- Compute status
              CASE 
                WHEN u.deleted_at IS NOT NULL THEN 'inactive'
                WHEN u.is_active = true THEN 'active'
                ELSE 'pending'
              END as status,
              COALESCE(
                json_agg(
                  json_build_object('propertyId', p.id, 'propertyName', p.name, 'status', cp.status)
                ) FILTER (WHERE p.id IS NOT NULL), '[]'
              ) as properties
       FROM users u
       LEFT JOIN caretaker_properties cp ON u.id = cp.caretaker_id
       LEFT JOIN properties p ON cp.property_id = p.id
       WHERE u.id = $1 
         AND u.role = 'caretaker' 
         AND u.landlord_id = $2
       GROUP BY u.id`,
      [id, landlordId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Caretaker not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get caretaker error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch caretaker'
    });
  }
};

// ============================================
// @desc    Create Caretaker
// @route   POST /api/caretakers
// @access  Private (Landlord only)
// ============================================
export const createCaretaker = async (req, res) => {
  const { firstName, lastName, email, phone, propertyIds } = req.body;

  try {
    const landlordId = req.user.id;

    // Validate input
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and email are required'
      });
    }

    // Check if email already exists
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use'
      });
    }

    // Generate activation token
    const activationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(activationToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // 👇 NEW: Generate a random temporary password hash to keep the database happy
    const tempPassword = crypto.randomBytes(12).toString('hex');
    const tempHashedPassword = await bcrypt.hash(tempPassword, 10);

    // 👇 UPDATED: Added password_hash to the INSERT statement
    const userResult = await db.query(
      `INSERT INTO users (first_name, last_name, email, phone, role, landlord_id, is_active, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, first_name, last_name, email, phone, role, is_active`,
      [firstName, lastName, email, phone, 'caretaker', landlordId, false, tempHashedPassword]
    );

    const caretaker = userResult.rows[0];

    // Store activation token
    await db.query(
      'INSERT INTO password_tokens (user_id, token_hash, token_type, expires_at) VALUES ($1, $2, $3, $4)',
      [caretaker.id, tokenHash, 'activation', expiresAt]
    );

    // Assign properties if provided
    if (propertyIds && Array.isArray(propertyIds) && propertyIds.length > 0) {
      for (const propertyId of propertyIds) {
        // Verify property belongs to landlord
        const propertyCheck = await db.query(
          'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
          [propertyId, landlordId]
        );

        if (propertyCheck.rows.length > 0) {
          await db.query(
            'INSERT INTO caretaker_properties (caretaker_id, property_id, status) VALUES ($1, $2, $3)',
            [caretaker.id, propertyId, 'active']
          );
        }
      }
    }

    // SEND PASSWORD SETUP EMAIL
    await sendPasswordSetupEmail(email, activationToken, firstName, 'caretaker');

    res.status(201).json({
      success: true,
      message: 'Caretaker created successfully. Password setup email sent.',
      data: caretaker
    });

  } catch (error) {
    console.error('Create caretaker error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create caretaker'
    });
  }
};

// ============================================
// @desc    Update Caretaker
// @route   PUT /api/caretakers/:id
// @access  Private (Landlord only)
// ============================================
export const updateCaretaker = async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, phone } = req.body;

  try {
    const landlordId = req.user.id;

    // Verify caretaker belongs to landlord
    const caretakerCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND landlord_id = $3',
      [id, 'caretaker', landlordId]
    );

    if (caretakerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Caretaker not found'
      });
    }

    // If email is being changed, check if it's available
    if (email) {
      const emailCheck = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    // Update caretaker
    const result = await db.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone)
       WHERE id = $5
       RETURNING id, first_name, last_name, email, phone, role, is_active`,
      [firstName, lastName, email, phone, id]
    );

    res.json({
      success: true,
      message: 'Caretaker updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update caretaker error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update caretaker'
    });
  }
};

// ============================================
// @desc    Update Caretaker Properties
// @route   PUT /api/caretakers/:id/properties
// @access  Private (Landlord only)
// ============================================
export const updateCaretakerProperties = async (req, res) => {
  const { id } = req.params;
  const { propertyIds } = req.body;

  try {
    const landlordId = req.user.id;

    // Verify caretaker belongs to landlord
    const caretakerCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND landlord_id = $3',
      [id, 'caretaker', landlordId]
    );

    if (caretakerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Caretaker not found'
      });
    }

    if (!Array.isArray(propertyIds)) {
      return res.status(400).json({
        success: false,
        message: 'propertyIds must be an array'
      });
    }

    // Deactivate all current property assignments
    await db.query(
      'UPDATE caretaker_properties SET status = $1 WHERE caretaker_id = $2',
      ['inactive', id]
    );

    // Assign new properties
    for (const propertyId of propertyIds) {
      // Verify property belongs to landlord
      const propertyCheck = await db.query(
        'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
        [propertyId, landlordId]
      );

      if (propertyCheck.rows.length > 0) {
        // Check if assignment exists
        const assignmentCheck = await db.query(
          'SELECT id FROM caretaker_properties WHERE caretaker_id = $1 AND property_id = $2',
          [id, propertyId]
        );

        if (assignmentCheck.rows.length > 0) {
          // Reactivate existing assignment
          await db.query(
            'UPDATE caretaker_properties SET status = $1 WHERE caretaker_id = $2 AND property_id = $3',
            ['active', id, propertyId]
          );
        } else {
          // Create new assignment
          await db.query(
            'INSERT INTO caretaker_properties (caretaker_id, property_id, status) VALUES ($1, $2, $3)',
            [id, propertyId, 'active']
          );
        }
      }
    }

    res.json({
      success: true,
      message: 'Caretaker properties updated successfully'
    });

  } catch (error) {
    console.error('Update caretaker properties error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update caretaker properties'
    });
  }
};

// ============================================
// @desc    Delete Caretaker (SMART TWO-STAGE DELETE)
// @route   DELETE /api/caretakers/:id
// @access  Private (Landlord only)
// ============================================
export const deleteCaretaker = async (req, res) => {
  const { id } = req.params;

  try {
    const landlordId = req.user.id;

    // Get caretaker
    const caretakerResult = await db.query(
      'SELECT id, first_name, last_name, email, is_active, deleted_at FROM users WHERE id = $1 AND role = $2 AND landlord_id = $3',
      [id, 'caretaker', landlordId]
    );

    if (caretakerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Caretaker not found'
      });
    }

    const caretaker = caretakerResult.rows[0];

    // ── TWO-STAGE DELETE LOGIC ────────────────────────────────────────────────

    // ✅ STAGE 2: PERMANENT DELETE (If already soft deleted / inactive)
    if (caretaker.deleted_at !== null) {
      
      // Deleting the user triggers ON DELETE CASCADE for caretaker_properties
      await db.query('DELETE FROM users WHERE id = $1', [id]);

      console.log(`✅ Caretaker ${id} permanently erased.`);

      return res.json({
        success: true,
        message: 'Caretaker record permanently erased from the system.'
      });
    }

    // ✅ STAGE 1: SOFT DELETE (Deactivation)
    else {
      await db.query('BEGIN');

      // 1. Soft delete: Mark user as deleted and inactive
      await db.query(
        'UPDATE users SET is_active = $1, deleted_at = NOW() WHERE id = $2',
        [false, id]
      );

      // 2. Deactivate all property assignments so they lose access
      await db.query(
        'UPDATE caretaker_properties SET status = $1 WHERE caretaker_id = $2',
        ['inactive', id]
      );

      await db.query('COMMIT');

      console.log(`✅ Caretaker ${id} soft deleted (deactivated).`);

      return res.json({
        success: true,
        message: 'Caretaker deactivated successfully. All property access revoked.'
      });
    }

  } catch (error) {
    // Attempt rollback if the transaction failed
    await db.query('ROLLBACK').catch(() => {});
    
    console.error('Delete caretaker error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process deletion'
    });
  }
};

export default {
  getCaretakers,
  getCaretaker,
  createCaretaker,
  updateCaretaker,
  updateCaretakerProperties,
  deleteCaretaker
};