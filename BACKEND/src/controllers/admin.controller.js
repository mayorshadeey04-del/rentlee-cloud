import db from '../config/db.js';

// ============================================
// @desc    Get Platform Global Stats & Landlords
// @route   GET /api/admin/dashboard
// @access  Private (Platform Admin only)
// ============================================
export const getPlatformDashboard = async (req, res) => {
  try {
    if (req.user.role !== 'platform_admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
    }

    // 1. Get Global KPIs
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'landlord') as total_landlords,
        (SELECT COUNT(*) FROM properties) as total_properties,
        (SELECT COUNT(*) FROM tenants WHERE status = 'active') as total_tenants
    `;
    const statsRes = await db.query(statsQuery);

    // 2. Get All Landlords with their specific metrics
    const landlordsQuery = `
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.phone, 
        u.is_active, 
        u.created_at,
        (SELECT COUNT(*) FROM properties p WHERE p.landlord_id = u.id) as property_count,
        (SELECT COUNT(*) FROM tenants t JOIN properties p ON t.property_id = p.id WHERE p.landlord_id = u.id AND t.status = 'active') as tenant_count
      FROM users u
      WHERE u.role = 'landlord'
      ORDER BY u.created_at DESC
    `;
    const landlordsRes = await db.query(landlordsQuery);

    // 3. ✅ THE FIX: Dynamic Audit Logs using UNION ALL
    const logsQuery = `
      SELECT 'user' AS type, 'New ' || role || ' account registered: ' || first_name || ' ' || last_name AS text, created_at
      FROM users
      UNION ALL
      SELECT 'property' AS type, 'New property added to platform: ' || name AS text, created_at
      FROM properties
      UNION ALL
      SELECT 'payment' AS type, 'Rent payment processed via M-Pesa: Ksh ' || amount AS text, created_at
      FROM payments WHERE status = 'confirmed'
      ORDER BY created_at DESC
      LIMIT 15
    `;
    const logsRes = await db.query(logsQuery);

    res.json({
      success: true,
      data: {
        stats: statsRes.rows[0],
        landlords: landlordsRes.rows,
        logs: logsRes.rows // Send the logs to the frontend
      }
    });

  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    res.status(500).json({ success: false, message: 'Failed to load platform data.' });
  }
};

// ============================================
// @desc    Toggle Landlord Account Status
// @route   PATCH /api/admin/landlords/:id/toggle
// @access  Private (Platform Admin only)
// ============================================
export const toggleLandlordStatus = async (req, res) => {
  try {
    if (req.user.role !== 'platform_admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { id } = req.params;

    // First, find the current status
    const userRes = await db.query(`SELECT is_active, first_name FROM users WHERE id = $1 AND role = 'landlord'`, [id]);
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Landlord not found.' });
    }

    const currentStatus = userRes.rows[0].is_active;
    const newStatus = !currentStatus;

    // Update the status
    await db.query(`UPDATE users SET is_active = $1 WHERE id = $2`, [newStatus, id]);

    res.json({ 
      success: true, 
      message: `Landlord account has been ${newStatus ? 'activated' : 'suspended'}.`,
      is_active: newStatus 
    });

  } catch (error) {
    console.error('Toggle Landlord Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update landlord status.' });
  }
};

export default {
  getPlatformDashboard,
  toggleLandlordStatus
};