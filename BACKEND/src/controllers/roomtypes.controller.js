import db from '../config/db.js';

const VALID_ROOM_TYPES = [
  "Single Room", 
  "Bedsitter", 
  "1 Bedroom", 
  "2 Bedroom", 
  "3 Bedroom", 
  "Commercial Shop"
];

// ============================================
// @desc    Get All Room Types for a Property
// @route   GET /api/roomtypes?propertyId=xxx
// @access  Private (Landlord, Caretaker)
// ============================================
export const getRoomTypes = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { propertyId } = req.query;

    if (!propertyId) {
      return res.status(400).json({ success: false, message: 'Property ID is required' });
    }

    let query;
    let params;

    // ✅ FIXED: Using unit_types and unit_type_id matching your schema.sql
    const selectClause = `
      SELECT ut.id, ut.property_id, ut.name, ut.default_rent,
             COUNT(u.id)::int AS units_count
      FROM unit_types ut
      JOIN properties p ON ut.property_id = p.id
      LEFT JOIN units u ON ut.id = u.unit_type_id
    `;

    if (role === 'landlord') {
      query = `
        ${selectClause}
        WHERE ut.property_id = $1 AND p.landlord_id = $2
        GROUP BY ut.id
        ORDER BY ut.default_rent ASC
      `;
      params = [propertyId, userId];
    } else if (role === 'caretaker') {
      query = `
        ${selectClause}
        INNER JOIN caretaker_properties cp ON p.id = cp.property_id
        WHERE ut.property_id = $1 AND cp.caretaker_id = $2 AND cp.status = 'active'
        GROUP BY ut.id
        ORDER BY ut.default_rent ASC
      `;
      params = [propertyId, userId];
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get room types error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch room types' });
  }
};

// ============================================
// @desc    Create Room Type (Pricing Tier)
// @route   POST /api/roomtypes
// @access  Private (Landlord, Caretaker)
// ============================================
export const createRoomType = async (req, res) => {
  const { propertyId, name, defaultRent } = req.body;

  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (!propertyId || !name || defaultRent === undefined) {
      return res.status(400).json({ success: false, message: 'Property ID, name, and default rent are required' });
    }

    if (!VALID_ROOM_TYPES.includes(name)) {
      return res.status(400).json({ success: false, message: `Invalid room type name.` });
    }

    // Check access
    if (role === 'landlord') {
      const propertyCheck = await db.query('SELECT id FROM properties WHERE id = $1 AND landlord_id = $2', [propertyId, userId]);
      if (propertyCheck.rows.length === 0) return res.status(403).json({ success: false, message: 'Access denied to this property' });
    }

    const duplicateCheck = await db.query('SELECT id FROM unit_types WHERE property_id = $1 AND name = $2', [propertyId, name]);
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: `A pricing tier for '${name}' already exists in this property.` });
    }

    const result = await db.query(
      `INSERT INTO unit_types (property_id, name, default_rent)
       VALUES ($1, $2, $3) RETURNING *`,
      [propertyId, name, defaultRent]
    );

    const newRoomType = { ...result.rows[0], units_count: 0 };
    res.status(201).json({ success: true, message: 'Room type created successfully', data: newRoomType });

  } catch (error) {
    console.error('Create room type error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create room type' });
  }
};

// ============================================
// @desc    Update Room Type (Pricing Tier)
// @route   PUT /api/roomtypes/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const updateRoomType = async (req, res) => {
  const { id } = req.params;
  const { name, defaultRent } = req.body;

  try {
    const userId = req.user.id;
    const role = req.user.role;

    const typeCheck = await db.query('SELECT ut.*, p.landlord_id FROM unit_types ut JOIN properties p ON ut.property_id = p.id WHERE ut.id = $1', [id]);
    if (typeCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Room type not found' });
    const roomType = typeCheck.rows[0];

    if (role === 'landlord' && roomType.landlord_id !== userId) return res.status(403).json({ success: false, message: 'Access denied' });

    if (name && name !== roomType.name) {
      const duplicateCheck = await db.query('SELECT id FROM unit_types WHERE property_id = $1 AND name = $2 AND id != $3', [roomType.property_id, name, id]);
      if (duplicateCheck.rows.length > 0) return res.status(400).json({ success: false, message: `A pricing tier for '${name}' already exists.` });
    }

    const result = await db.query(
      `UPDATE unit_types
       SET name = COALESCE($1, name),
           default_rent = COALESCE($2, default_rent),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [name, defaultRent, id]
    );

    res.json({ success: true, message: 'Room type updated successfully', data: result.rows[0] });

  } catch (error) {
    console.error('Update room type error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update room type' });
  }
};

// ============================================
// @desc    Delete Room Type
// @route   DELETE /api/roomtypes/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const deleteRoomType = async (req, res) => {
  const { id } = req.params;

  try {
    const userId = req.user.id;
    const role = req.user.role;

    const typeCheck = await db.query('SELECT ut.*, p.landlord_id FROM unit_types ut JOIN properties p ON ut.property_id = p.id WHERE ut.id = $1', [id]);
    if (typeCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Room type not found' });
    const roomType = typeCheck.rows[0];

    if (role === 'landlord' && roomType.landlord_id !== userId) return res.status(403).json({ success: false, message: 'Access denied' });

    // STRICT CHECK: Cannot delete a tier if physical units are attached to it
    const unitsCheck = await db.query('SELECT id FROM units WHERE unit_type_id = $1', [id]);
    if (unitsCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete pricing tier. It is assigned to ${unitsCheck.rows.length} units.` });
    }

    await db.query('DELETE FROM unit_types WHERE id = $1', [id]);
    res.json({ success: true, message: 'Room type deleted successfully' });

  } catch (error) {
    console.error('Delete room type error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete room type' });
  }
};

export default {
  getRoomTypes,
  createRoomType,
  updateRoomType,
  deleteRoomType
};