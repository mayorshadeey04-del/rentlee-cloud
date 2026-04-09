import db from '../config/db.js';

// ============================================
// @desc    Get all properties
// @route   GET /api/properties
// @access  Private (Landlord, Caretaker)
// ============================================
export const getProperties = async (req, res) => {
  try {
    let query;
    let params;

    if (req.user.role === 'landlord') {
      //  Added subqueries to get occupied units and accurate monthly rent 
      query = `
        SELECT 
          p.id, 
          p.name, 
          p.location, 
          p.total_units,
          p.landlord_id,
          p.created_at,
          p.updated_at,
          (SELECT COUNT(id) FROM units WHERE property_id = p.id AND status = 'occupied') as occupied_units,
          (SELECT COALESCE(SUM(agreed_rent), 0) FROM tenancies tc JOIN units u ON tc.unit_id = u.id WHERE u.property_id = p.id AND tc.status = 'active') as monthly_rent
        FROM properties p
        WHERE p.landlord_id = $1
        ORDER BY p.created_at DESC
      `;
      params = [req.user.id];
      
    } else if (req.user.role === 'caretaker') {
      query = `
        SELECT 
          p.id, 
          p.name, 
          p.location, 
          p.total_units,
          p.landlord_id,
          p.created_at,
          p.updated_at,
          (SELECT COUNT(id) FROM units WHERE property_id = p.id AND status = 'occupied') as occupied_units,
          (SELECT COALESCE(SUM(agreed_rent), 0) FROM tenancies tc JOIN units u ON tc.unit_id = u.id WHERE u.property_id = p.id AND tc.status = 'active') as monthly_rent
        FROM properties p
        INNER JOIN caretaker_properties cp ON p.id = cp.property_id
        WHERE cp.caretaker_id = $1 AND cp.status = 'active'
        ORDER BY p.created_at DESC
      `;
      params = [req.user.id];
      
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch properties' });
  }
};

// ============================================
// @desc    Get Single Property
// @route   GET /api/properties/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const getProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const result = await db.query(
      `SELECT p.*, 
              COUNT(DISTINCT u.id) as physical_unit_count, --  FIXED: Renamed to prevent overwriting p.total_units
              COUNT(DISTINCT CASE WHEN u.status = 'occupied' THEN u.id END) as occupied_units,
              COUNT(DISTINCT CASE WHEN u.status = 'vacant' THEN u.id END) as vacant_units,
              COUNT(DISTINCT t.id) as total_tenants
       FROM properties p
       LEFT JOIN units u ON p.id = u.property_id
       LEFT JOIN tenants t ON p.id = t.property_id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Property not found' });

    const property = result.rows[0];

    // Check access
    if (role === 'landlord' && property.landlord_id !== userId) return res.status(403).json({ success: false, message: 'Access denied' });

    if (role === 'caretaker') {
      const accessCheck = await db.query('SELECT id FROM caretaker_properties WHERE caretaker_id = $1 AND property_id = $2 AND status IN ($3, $4)', [userId, id, 'active', 'pending']);
      if (accessCheck.rows.length === 0) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: property });

  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch property' });
  }
};

// ============================================
// @desc    Create Property
// @route   POST /api/properties
// @access  Private (Landlord only)
// ============================================
export const createProperty = async (req, res) => {
  const { name, location, totalUnits } = req.body;

  try {
    if (req.user.role !== 'landlord') return res.status(403).json({ success: false, message: 'Only landlords can create properties' });
    if (!name || !location || totalUnits === undefined) return res.status(400).json({ success: false, message: 'Name, location, and total units are required' });
    if (totalUnits < 0) return res.status(400).json({ success: false, message: 'Total units must be 0 or greater' });

    const result = await db.query(
      `INSERT INTO properties (landlord_id, name, location, total_units) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, name, location, totalUnits]
    );

    res.status(201).json({ success: true, message: 'Property created successfully', data: result.rows[0] });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create property' });
  }
};

// ============================================
// @desc    Update Property
// @route   PUT /api/properties/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const updateProperty = async (req, res) => {
  const { id } = req.params;
  const { name, location, totalUnits } = req.body;

  try {
    const userId = req.user.id;
    const role = req.user.role;

    const propertyCheck = await db.query('SELECT landlord_id FROM properties WHERE id = $1', [id]);
    if (propertyCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Property not found' });

    const property = propertyCheck.rows[0];

    if (role === 'landlord' && property.landlord_id !== userId) return res.status(403).json({ success: false, message: 'Access denied' });
    if (role === 'caretaker') {
      const accessCheck = await db.query('SELECT id FROM caretaker_properties WHERE caretaker_id = $1 AND property_id = $2 AND status IN ($3, $4)', [userId, id, 'active', 'pending']);
      if (accessCheck.rows.length === 0) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (totalUnits !== undefined && totalUnits < 0) return res.status(400).json({ success: false, message: 'Total units must be 0 or greater' });

    const result = await db.query(
      `UPDATE properties SET name = COALESCE($1, name), location = COALESCE($2, location), total_units = COALESCE($3, total_units) WHERE id = $4 RETURNING *`,
      [name, location, totalUnits, id]
    );

    res.json({ success: true, message: 'Property updated successfully', data: result.rows[0] });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update property' });
  }
};

// ============================================
// @desc    Delete Property
// @route   DELETE /api/properties/:id
// @access  Private (Landlord only)
// ============================================
export const deleteProperty = async (req, res) => {
  const { id } = req.params;

  try {
    if (req.user.role !== 'landlord') return res.status(403).json({ success: false, message: 'Only landlords can delete properties' });

    const result = await db.query('DELETE FROM properties WHERE id = $1 AND landlord_id = $2 RETURNING id', [id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Property not found' });

    res.json({ success: true, message: 'Property deleted successfully' });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete property' });
  }
};

export default { getProperties, getProperty, createProperty, updateProperty, deleteProperty };