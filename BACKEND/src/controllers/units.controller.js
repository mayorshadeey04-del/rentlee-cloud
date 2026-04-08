import db from '../config/db.js';

// ============================================
// @desc    Get All Units
// @route   GET /api/units?propertyId=xxx
// @access  Private (Landlord, Caretaker)
// ============================================
export const getUnits = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { propertyId } = req.query;

    let query;
    let params;

    // ✅ FIXED: Using unit_types and unit_type_id
    const selectClause = `
      SELECT u.id, u.unit_number, u.status, u.property_id, u.unit_type_id as room_type_id,
             ut.name as type_name, ut.default_rent as rent,
             p.name as property_name, p.location,
             t.id as tenant_id, users.first_name as tenant_first_name, 
             users.last_name as tenant_last_name
      FROM units u
      JOIN properties p ON u.property_id = p.id
      JOIN unit_types ut ON u.unit_type_id = ut.id
      LEFT JOIN tenants t ON u.id = t.unit_id AND t.status = 'active'
      LEFT JOIN users ON t.user_id = users.id
    `;

    if (role === 'landlord') {
      if (propertyId) {
        query = `${selectClause} WHERE u.property_id = $1 AND p.landlord_id = $2 ORDER BY u.unit_number`;
        params = [propertyId, userId];
      } else {
        query = `${selectClause} WHERE p.landlord_id = $1 ORDER BY p.name, u.unit_number`;
        params = [userId];
      }
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Get units error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch units' });
  }
};

// ============================================
// @desc    Get Single Unit
// @route   GET /api/units/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const getUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const result = await db.query(
      `SELECT u.id, u.unit_number, u.status, u.property_id, u.unit_type_id as room_type_id,
              ut.name as type_name, ut.default_rent as rent,
              p.name as property_name, p.location, p.landlord_id,
              t.id as tenant_id, t.balance, t.status as tenant_status,
              users.first_name as tenant_first_name, users.last_name as tenant_last_name,
              users.email as tenant_email, users.phone as tenant_phone
       FROM units u
       JOIN properties p ON u.property_id = p.id
       JOIN unit_types ut ON u.unit_type_id = ut.id
       LEFT JOIN tenants t ON u.id = t.unit_id AND t.status = 'active'
       LEFT JOIN users ON t.user_id = users.id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Unit not found' });
    const unit = result.rows[0];

    if (role === 'landlord' && unit.landlord_id !== userId) return res.status(403).json({ success: false, message: 'Access denied' });

    res.json({ success: true, data: unit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch unit' });
  }
};

// ============================================
// @desc    Create Unit
// @route   POST /api/units
// @access  Private (Landlord, Caretaker)
// ============================================
export const createUnit = async (req, res) => {
  const { propertyId, unitNumber, roomTypeId } = req.body;

  try {
    if (!propertyId || !unitNumber || !roomTypeId) {
      return res.status(400).json({ success: false, message: 'Property ID, unit number, and room type are required' });
    }

    // 👇 NEW LOGIC: Check if property has reached its maximum registered units
    const propertyCheck = await db.query('SELECT total_units FROM properties WHERE id = $1', [propertyId]);
    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    
    const maxUnits = propertyCheck.rows[0].total_units;

    const countCheck = await db.query('SELECT COUNT(*) FROM units WHERE property_id = $1', [propertyId]);
    const currentUnitCount = parseInt(countCheck.rows[0].count);

    if (currentUnitCount >= maxUnits) {
      return res.status(400).json({ 
        success: false, 
        message: `Limit reached! This property is only registered for a maximum of ${maxUnits} units.` 
      });
    }
    // 👆 END OF NEW LOGIC

    const typeCheck = await db.query('SELECT id FROM unit_types WHERE id = $1 AND property_id = $2', [roomTypeId, propertyId]);
    if (typeCheck.rows.length === 0) return res.status(400).json({ success: false, message: 'Invalid room type for this property' });

    const duplicateCheck = await db.query('SELECT id FROM units WHERE property_id = $1 AND unit_number = $2', [propertyId, unitNumber]);
    if (duplicateCheck.rows.length > 0) return res.status(400).json({ success: false, message: 'Unit number already exists in this property' });

    const result = await db.query(
      `INSERT INTO units (property_id, unit_number, unit_type_id, status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [propertyId, unitNumber, roomTypeId, 'vacant']
    );

    res.status(201).json({ success: true, message: 'Unit created successfully', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create unit' });
  }
};

// ============================================
// @desc    Update Unit
// @route   PUT /api/units/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const updateUnit = async (req, res) => {
  const { id } = req.params;
  const { unitNumber, roomTypeId, status } = req.body;

  try {
    const unitCheck = await db.query('SELECT u.*, p.landlord_id FROM units u JOIN properties p ON u.property_id = p.id WHERE u.id = $1', [id]);
    if (unitCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Unit not found' });
    const unit = unitCheck.rows[0];

    if (roomTypeId) {
      const typeCheck = await db.query('SELECT id FROM unit_types WHERE id = $1 AND property_id = $2', [roomTypeId, unit.property_id]);
      if (typeCheck.rows.length === 0) return res.status(400).json({ success: false, message: 'Invalid room type' });
    }

    if (unitNumber && unitNumber !== unit.unit_number) {
      const duplicateCheck = await db.query('SELECT id FROM units WHERE property_id = $1 AND unit_number = $2 AND id != $3', [unit.property_id, unitNumber, id]);
      if (duplicateCheck.rows.length > 0) return res.status(400).json({ success: false, message: 'Unit number exists' });
    }

    const result = await db.query(
      `UPDATE units
       SET unit_number = COALESCE($1, unit_number),
           unit_type_id = COALESCE($2, unit_type_id),
           status = COALESCE($3, status)
       WHERE id = $4 RETURNING *`,
      [unitNumber, roomTypeId, status, id]
    );

    res.json({ success: true, message: 'Unit updated successfully', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update unit' });
  }
};

// ============================================
// @desc    Delete Unit
// @route   DELETE /api/units/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const deleteUnit = async (req, res) => {
  const { id } = req.params;

  try {
    const tenantCheck = await db.query("SELECT id FROM tenants WHERE unit_id = $1 AND status = 'active'", [id]);
    if (tenantCheck.rows.length > 0) return res.status(400).json({ success: false, message: 'Cannot delete unit with active tenants' });

    await db.query('DELETE FROM units WHERE id = $1', [id]);
    res.json({ success: true, message: 'Unit deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete unit' });
  }
};

export default { getUnits, getUnit, createUnit, updateUnit, deleteUnit };