import db from '../config/db.js';

// ============================================
// @desc    Get Dashboard Stats
// @route   GET /api/dashboard/stats
// @access  Private (All roles)
// ============================================
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let stats = {};

    if (role === 'landlord') {
      
      const propertiesResult = await db.query('SELECT COUNT(*) as total FROM properties WHERE landlord_id = $1', [userId]);

      const unitsResult = await db.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
                COUNT(CASE WHEN status = 'vacant' THEN 1 END) as vacant
         FROM units u
         JOIN properties p ON u.property_id = p.id
         WHERE p.landlord_id = $1`,
        [userId]
      );

      const tenantsResult = await db.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive
         FROM tenants
         WHERE landlord_id = $1`,
        [userId]
      );

      const caretakersResult = await db.query(
        `SELECT COUNT(DISTINCT u.id) as total
         FROM users u
         JOIN caretaker_properties cp ON u.id = cp.caretaker_id
         WHERE u.role = 'caretaker' AND u.landlord_id = $1 AND u.is_active = true`,
        [userId]
      );

      const maintenanceResult = await db.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN status = 'pending' OR status = 'open' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
         FROM maintenance_requests
         WHERE landlord_id = $1`,
        [userId]
      );

      // ✅ FIXED: Now calculates revenue from active tenancies instead of the dropped unit column
      const revenueResult = await db.query(
        `SELECT COALESCE(SUM(agreed_rent), 0) as monthly_revenue,
                0 as total_balance
         FROM tenancies
         WHERE landlord_id = $1 AND status = 'active'`,
        [userId]
      );

      const totalUnits = parseInt(unitsResult.rows[0].total) || 1;
      const occupiedUnits = parseInt(unitsResult.rows[0].occupied) || 0;
      const occupancyRate = ((occupiedUnits / totalUnits) * 100).toFixed(1);

      stats = {
        totalProperties: parseInt(propertiesResult.rows[0].total) || 0,
        monthlyRent: parseFloat(revenueResult.rows[0].monthly_revenue) || 0,
        activeTenants: parseInt(tenantsResult.rows[0].active) || 0,
        openRequests: parseInt(maintenanceResult.rows[0].pending) || 0,
        
        properties: { total: parseInt(propertiesResult.rows[0].total) || 0 },
        units: {
          total: parseInt(unitsResult.rows[0].total) || 0,
          occupied: parseInt(unitsResult.rows[0].occupied) || 0,
          vacant: parseInt(unitsResult.rows[0].vacant) || 0,
          occupancy_rate: parseFloat(occupancyRate)
        },
        tenants: {
          total: parseInt(tenantsResult.rows[0].total) || 0,
          active: parseInt(tenantsResult.rows[0].active) || 0,
          inactive: parseInt(tenantsResult.rows[0].inactive) || 0
        },
        caretakers: { total: parseInt(caretakersResult.rows[0].total) || 0 },
        maintenance: {
          total: parseInt(maintenanceResult.rows[0].total) || 0,
          pending: parseInt(maintenanceResult.rows[0].pending) || 0,
          in_progress: parseInt(maintenanceResult.rows[0].in_progress) || 0,
          completed: parseInt(maintenanceResult.rows[0].completed) || 0
        },
        revenue: {
          monthly_revenue: parseFloat(revenueResult.rows[0].monthly_revenue) || 0,
          total_balance: parseFloat(revenueResult.rows[0].total_balance) || 0
        }
      };

    } else if (role === 'caretaker') {
      const propertiesResult = await db.query(
        `SELECT COUNT(DISTINCT p.id) as total
         FROM properties p
         JOIN caretaker_properties cp ON p.id = cp.property_id
         WHERE cp.caretaker_id = $1 AND cp.status = 'active'`,
        [userId]
      );

      const unitsResult = await db.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN u.status = 'occupied' THEN 1 END) as occupied,
                COUNT(CASE WHEN u.status = 'vacant' THEN 1 END) as vacant
         FROM units u
         JOIN properties p ON u.property_id = p.id
         JOIN caretaker_properties cp ON p.id = cp.property_id
         WHERE cp.caretaker_id = $1 AND cp.status = 'active'`,
        [userId]
      );

      const tenantsResult = await db.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN t.status = 'active' THEN 1 END) as active
         FROM tenants t
         JOIN units u ON t.unit_id = u.id
         JOIN properties p ON u.property_id = p.id
         JOIN caretaker_properties cp ON p.id = cp.property_id
         WHERE cp.caretaker_id = $1 AND cp.status = 'active'`,
        [userId]
      );

      const maintenanceResult = await db.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN m.status = 'pending' OR m.status = 'open' THEN 1 END) as pending,
                COUNT(CASE WHEN m.status = 'in_progress' THEN 1 END) as in_progress,
                COUNT(CASE WHEN m.status = 'completed' THEN 1 END) as completed
         FROM maintenance_requests m
         JOIN properties p ON m.property_id = p.id
         JOIN caretaker_properties cp ON p.id = cp.property_id
         WHERE cp.caretaker_id = $1 AND cp.status = 'active'`,
        [userId]
      );

      // ✅ FIXED
      const revenueResult = await db.query(
        `SELECT COALESCE(SUM(tc.agreed_rent), 0) as monthly_revenue
         FROM tenancies tc
         JOIN units u ON tc.unit_id = u.id
         JOIN caretaker_properties cp ON u.property_id = cp.property_id
         WHERE cp.caretaker_id = $1 AND cp.status = 'active' AND tc.status = 'active'`,
        [userId]
      );

      stats = {
        totalProperties: parseInt(propertiesResult.rows[0].total) || 0,
        monthlyRent: parseFloat(revenueResult.rows[0].monthly_revenue) || 0,
        activeTenants: parseInt(tenantsResult.rows[0].active) || 0,
        openRequests: parseInt(maintenanceResult.rows[0].pending) || 0,
        
        properties: { total: parseInt(propertiesResult.rows[0].total) || 0 },
        units: {
          total: parseInt(unitsResult.rows[0].total) || 0,
          occupied: parseInt(unitsResult.rows[0].occupied) || 0,
          vacant: parseInt(unitsResult.rows[0].vacant) || 0
        },
        tenants: {
          total: parseInt(tenantsResult.rows[0].total) || 0,
          active: parseInt(tenantsResult.rows[0].active) || 0
        },
        maintenance: {
          total: parseInt(maintenanceResult.rows[0].total) || 0,
          pending: parseInt(maintenanceResult.rows[0].pending) || 0,
          in_progress: parseInt(maintenanceResult.rows[0].in_progress) || 0,
          completed: parseInt(maintenanceResult.rows[0].completed) || 0
        }
      };

    } else if (role === 'tenant') {
      
      // ✅ FIXED: Replaced u.rent_amount with tc.agreed_rent
      const tenantResult = await db.query(
        `SELECT t.*, 
                p.name as property_name, 
                p.location, 
                u.unit_number,
                tc.agreed_rent as rent_amount,
                0 as balance
         FROM tenants t
         JOIN properties p ON t.property_id = p.id
         JOIN units u ON t.unit_id = u.id
         JOIN tenancies tc ON tc.tenant_id = t.id AND tc.status = 'active'
         WHERE t.user_id = $1 AND t.status = 'active'`,
        [userId]
      );

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Active tenant profile not found' });
      }

      const tenant = tenantResult.rows[0];

      const maintenanceResult = await db.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN status = 'pending' OR status = 'open' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
         FROM maintenance_requests
         WHERE tenant_id = $1`,
        [tenant.id]
      );

      stats = {
        tenant_info: {
          property_name: tenant.property_name,
          location: tenant.location,
          unit_number: tenant.unit_number,
          rent_amount: parseFloat(tenant.rent_amount),
          balance: parseFloat(tenant.balance)
        },
        maintenance: {
          total: parseInt(maintenanceResult.rows[0].total) || 0,
          pending: parseInt(maintenanceResult.rows[0].pending) || 0,
          in_progress: parseInt(maintenanceResult.rows[0].in_progress) || 0,
          completed: parseInt(maintenanceResult.rows[0].completed) || 0
        }
      };
    } else {
      return res.status(403).json({ success: false, message: 'Invalid role' });
    }

    res.json({ success: true, data: stats });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch dashboard stats' });
  }
};

// ============================================
// @desc    Get Recent Activities
// @route   GET /api/dashboard/activities
// @access  Private (Landlord, Caretaker)
// ============================================
export const getRecentActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const limit = parseInt(req.query.limit) || 10;

    if (role === 'tenant') return res.status(403).json({ success: false, message: 'Access denied' });

    let query;
    let params;

    if (role === 'landlord') {
      query = `
        SELECT 'maintenance' as type, 
               m.id, m.title as description, m.status, m.created_at,
               p.name as property_name
        FROM maintenance_requests m
        JOIN properties p ON m.property_id = p.id
        WHERE m.landlord_id = $1
        
        UNION ALL
        
        SELECT 'tenant' as type,
               t.id, CONCAT(u.first_name, ' ', u.last_name, ' moved in') as description,
               t.status, t.created_at,
               p.name as property_name
        FROM tenants t
        JOIN properties p ON t.property_id = p.id
        JOIN users u ON t.user_id = u.id
        WHERE t.landlord_id = $1
        
        ORDER BY created_at DESC
        LIMIT $2
      `;
      params = [userId, limit];

    } else if (role === 'caretaker') {
      query = `
        SELECT 'maintenance' as type,
               m.id, m.title as description, m.status, m.created_at,
               p.name as property_name
        FROM maintenance_requests m
        JOIN properties p ON m.property_id = p.id
        JOIN caretaker_properties cp ON p.id = cp.property_id
        WHERE cp.caretaker_id = $1 AND cp.status = 'active'
        ORDER BY m.created_at DESC
        LIMIT $2
      `;
      params = [userId, limit];
    }

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Recent activities error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch recent activities' });
  }
};

export default { getDashboardStats, getRecentActivities };