import db from '../config/db.js';

// ============================================
// @desc    Get Tenant Dashboard Data
// @route   GET /api/tenant-dashboard
// @access  Private (Tenant only)
// ============================================
export const getTenantDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.role !== 'tenant') {
      return res.status(403).json({ success: false, message: 'Access denied. Tenant only.' });
    }

// 1. Get Core Tenant Info + Live Balance + Real Due Date + Payment Count
    const tenantQuery = `
      SELECT 
        t.id as tenant_id,
        t.status as tenant_status,
        p.name as property_name,
        u.unit_number,
        tc.agreed_rent,
        tc.deposit_amount,
        (
          COALESCE((SELECT SUM(amount_due) FROM rent_periods rp WHERE rp.tenant_id = t.id), 0) -
          COALESCE((SELECT SUM(amount) FROM payments py WHERE py.tenant_id = t.id AND py.status = 'confirmed'), 0)
        ) as balance,
        (SELECT COUNT(*) FROM maintenance_requests mr WHERE mr.tenant_id = t.id AND mr.status IN ('open', 'in_progress')) as maintenance_count,
        
        -- ✅ FIXED: Grab the MAXIMUM (latest) due date generated for this tenant
        (SELECT TO_CHAR(MAX(rp.due_date), 'DD Mon YYYY') FROM rent_periods rp WHERE rp.tenant_id = t.id) as next_due_date,
        
        (SELECT COUNT(*) FROM payments py WHERE py.tenant_id = t.id AND py.status = 'confirmed') as confirmed_payments_count
      FROM tenants t
      JOIN properties p ON t.property_id = p.id
      JOIN units u ON t.unit_id = u.id
      LEFT JOIN tenancies tc ON tc.tenant_id = t.id AND tc.status = 'active'
      WHERE t.user_id = $1
    `;

    const tenantResult = await db.query(tenantQuery, [userId]);

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tenant profile not found' });
    }

    const tInfo = tenantResult.rows[0];
    const balance = parseFloat(tInfo.balance) || 0;
    const agreedRent = parseFloat(tInfo.agreed_rent) || 0;
    const depositAmount = parseFloat(tInfo.deposit_amount) || 0;

    // ✅ FIXED: If they have NEVER made a successful payment, lock them in the Move-In Gateway
    const requiresMoveInPayment = parseInt(tInfo.confirmed_payments_count) === 0;

    // ✅ FIXED: Get the REAL due date from the bulk rent invoices
    const nextDueDate = tInfo.next_due_date || 'No pending invoice';

    const info = {
      unitId: tInfo.unit_number,
      propertyName: tInfo.property_name,
      balance: balance,
      nextDueDate: nextDueDate,
      monthlyRent: `Ksh ${agreedRent.toLocaleString()}`,
      maintenanceCount: parseInt(tInfo.maintenance_count) || 0,
      status: tInfo.tenant_status,
      requiresMoveInPayment,
      moveInCharges: {
        deposit: depositAmount,
        rent: agreedRent,
        total: depositAmount + agreedRent
      }
    };

    // 2. Get Recent Payments
    const paymentsQuery = `
      SELECT id, amount, TO_CHAR(payment_date, 'DD Mon YYYY') as date, status, mpesa_ref as reference
      FROM payments
      WHERE tenant_id = $1
      ORDER BY payment_date DESC LIMIT 4
    `;
    const paymentsResult = await db.query(paymentsQuery, [tInfo.tenant_id]);

    // 3. Get Recent Maintenance Requests
    const maintQuery = `
      SELECT id, description, category, status, TO_CHAR(created_at, 'DD Mon YYYY') as "dateSubmitted"
      FROM maintenance_requests
      WHERE tenant_id = $1
      ORDER BY created_at DESC LIMIT 4
    `;
    const maintResult = await db.query(maintQuery, [tInfo.tenant_id]);

    res.json({
      success: true,
      data: {
        info,
        payments: paymentsResult.rows,
        requests: maintResult.rows
      }
    });

  } catch (error) {
    console.error('Tenant dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
};

// ============================================
// @desc    Get Tenant's Specific Unit Details
// @route   GET /api/tenant-dashboard/my-unit
// @access  Private (Tenant only)
// ============================================
export const getMyUnit = async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.role !== 'tenant') {
      return res.status(403).json({ success: false, message: 'Access denied. Tenant only.' });
    }

    const query = `
      SELECT 
        u.unit_number as "unitId",
        ut.name as "type",
        p.name as "propertyName",
        p.location,
        tc.agreed_rent as "rentAmount",
        TO_CHAR(tc.start_date, 'DD Mon YYYY') as "tenancyStart",
        TO_CHAR(tc.end_date, 'DD Mon YYYY') as "tenancyEnd",
        1 as "dueDayOfMonth", 
        'Occupied' as "status"
      FROM tenants t
      JOIN properties p ON t.property_id = p.id
      JOIN units u ON t.unit_id = u.id
      JOIN unit_types ut ON u.unit_type_id = ut.id
      JOIN tenancies tc ON tc.tenant_id = t.id AND tc.status = 'active'
      WHERE t.user_id = $1 AND t.status IN ('active', 'pending')
    `;
    
    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No active tenancy found.' });
    }

    res.json({ success: true, data: result.rows[0] });

  } catch (error) {
    console.error('Get my unit error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch unit details' });
  }
};

export default { 
  getTenantDashboardData, 
  getMyUnit 
};