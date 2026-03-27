import db from '../config/db.js';

// Valid payment types and statuses from schema
const VALID_PAYMENT_TYPES  = ['rent', 'deposit', 'movein'];
const VALID_PAYMENT_STATUS = ['confirmed', 'failed'];

// ============================================
// @desc    Get All Payments
// @route   GET /api/payments
// @query   propertyId, status, from, to
// @access  Private (Landlord, Caretaker, Tenant)
// ============================================
export const getPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;
    const { propertyId, status, from, to } = req.query;

    const conditions = [];
    const params     = [];
    let   paramIndex = 1;

    // ✅ FIXED: Allow tenants to fetch their own payments
    if (role === 'landlord') {
      conditions.push(`p.landlord_id = $${paramIndex++}`);
      params.push(userId);
    } else if (role === 'caretaker') {
      conditions.push(`cp.caretaker_id = $${paramIndex++}`);
      conditions.push(`cp.status = 'active'`);
      params.push(userId);
    } else if (role === 'tenant') {
      conditions.push(`u.id = $${paramIndex++}`);
      params.push(userId);
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (propertyId) {
      conditions.push(`pay.property_id = $${paramIndex++}`);
      params.push(propertyId);
    }

    if (status) {
      if (!VALID_PAYMENT_STATUS.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid status.` });
      }
      conditions.push(`pay.status = $${paramIndex++}`);
      params.push(status);
    }

    if (from) {
      conditions.push(`pay.payment_date >= $${paramIndex++}`);
      params.push(from);
    }

    if (to) {
      conditions.push(`pay.payment_date <= $${paramIndex++}`);
      params.push(to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const caretakerJoin = role === 'caretaker' ? `INNER JOIN caretaker_properties cp ON p.id = cp.property_id` : '';

    const query = `
      SELECT
        pay.id,
        pay.amount,
        pay.payment_type,
        pay.mpesa_ref,
        pay.status,
        pay.payment_date,
        pay.created_at,
        u.first_name || ' ' || u.last_name   AS tenant_name,
        p.name                                AS property_name,
        un.unit_number                        AS unit_id,
        pay.tenant_id,
        pay.property_id,
        pay.unit_id                           AS unit_uuid
      FROM payments pay
      JOIN tenants  t  ON pay.tenant_id   = t.id
      JOIN users    u  ON t.user_id       = u.id
      JOIN properties p ON pay.property_id = p.id
      JOIN units    un ON pay.unit_id      = un.id
      ${caretakerJoin}
      ${whereClause}
      ORDER BY pay.payment_date DESC
    `;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch payments' });
  }
};

// ============================================
// @desc    Get Single Payment
// @route   GET /api/payments/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const getPayment = async (req, res) => {
  try {
    const { id }   = req.params;
    const userId   = req.user.id;
    const role     = req.user.role;

    const result = await db.query(
      `SELECT
         pay.id,
         pay.amount,
         pay.payment_type,
         pay.mpesa_ref,
         pay.status,
         pay.payment_date,
         pay.created_at,
         u.first_name || ' ' || u.last_name  AS tenant_name,
         u.phone                              AS tenant_phone,
         p.name                               AS property_name,
         p.landlord_id,
         p.id                                 AS property_id,
         un.unit_number                       AS unit_id,
         un.id                                AS unit_uuid,
         pay.tenant_id
       FROM payments pay
       JOIN tenants    t  ON pay.tenant_id    = t.id
       JOIN users      u  ON t.user_id        = u.id
       JOIN properties p  ON pay.property_id  = p.id
       JOIN units      un ON pay.unit_id      = un.id
       WHERE pay.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Payment not found' });
    const payment = result.rows[0];

    if (role === 'landlord' && payment.landlord_id !== userId) return res.status(403).json({ success: false, message: 'Access denied' });
    if (role === 'caretaker') {
      const accessCheck = await db.query(`SELECT id FROM caretaker_properties WHERE caretaker_id = $1 AND property_id = $2 AND status = 'active'`, [userId, payment.property_id]);
      if (accessCheck.rows.length === 0) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch payment' });
  }
};

// ============================================
// @desc    Get Payment Summary Stats
// @route   GET /api/payments/stats
// @access  Private (Landlord, Caretaker)
// ============================================
export const getPaymentStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;

    let landlordCondition;
    let params;

    if (role === 'landlord') {
      landlordCondition = `p.landlord_id = $1`;
      params = [userId];
    } else if (role === 'caretaker') {
      landlordCondition = `cp.caretaker_id = $1 AND cp.status = 'active'`;
      params = [userId];
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const caretakerJoin = role === 'caretaker' ? `INNER JOIN caretaker_properties cp ON p.id = cp.property_id` : '';

    const result = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN pay.status = 'confirmed' THEN pay.amount ELSE 0 END), 0) AS total_collected,
         COALESCE(SUM(CASE WHEN pay.status = 'confirmed' AND DATE_TRUNC('month', pay.payment_date) = DATE_TRUNC('month', NOW()) THEN pay.amount ELSE 0 END), 0) AS this_month,
         COUNT(CASE WHEN pay.status = 'failed' THEN 1 END) AS failed_count
       FROM payments pay
       JOIN properties p  ON pay.property_id = p.id
       ${caretakerJoin}
       WHERE ${landlordCondition}`,
      params
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch payment stats' });
  }
};

// ============================================
// @desc    Safaricom Daraja STK Push Callback
// @route   POST /api/payments/callback
// ============================================
export const mpesaCallback = async (req, res) => {
  try {
    const { Body } = req.body;
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

    const callback = Body?.stkCallback;
    if (!callback) return;

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;
    const isSuccess = ResultCode === 0;

    if (!isSuccess) {
      await db.query(`UPDATE payments SET status = 'failed' WHERE mpesa_checkout_request_id = $1`, [CheckoutRequestID]);
      return;
    }

    const meta = {};
    CallbackMetadata?.Item?.forEach(item => { meta[item.Name] = item.Value; });

    const mpesaRef  = meta['MpesaReceiptNumber']; 
    const amount    = meta['Amount'];
    const phone     = meta['PhoneNumber'];
    const paidAt    = meta['TransactionDate'];    

    await db.query(
      `UPDATE payments SET status = 'confirmed', mpesa_ref = $1, payment_date = $2 WHERE mpesa_checkout_request_id = $3`,
      [mpesaRef, paidAt, CheckoutRequestID]
    );
  } catch (error) {
    console.error('Mpesa callback error:', error);
  }
};

// ============================================
// @desc    Initiate STK Push (tenant pays)
// @route   POST /api/payments/initiate
// ============================================
export const initiatePayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;

    if (role !== 'tenant') return res.status(403).json({ success: false, message: 'Only tenants can initiate payments' });

    const { phone, amount, paymentType } = req.body;

    if (!phone || !amount || !paymentType) return res.status(400).json({ success: false, message: 'Phone number, amount, and payment type are required' });
    if (!VALID_PAYMENT_TYPES.includes(paymentType)) return res.status(400).json({ success: false, message: 'Invalid payment type' });
    if (Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });

    const tenantResult = await db.query(
      `SELECT t.id, t.unit_id, t.property_id, t.landlord_id, t.status
       FROM tenants t
       JOIN users u ON t.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (tenantResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Tenant record not found' });
    const tenant = tenantResult.rows[0];
    if (tenant.status !== 'active') return res.status(403).json({ success: false, message: 'Your account is not active' });

    const checkoutRequestId = `mock_${Date.now()}`;

    const paymentResult = await db.query(
      `INSERT INTO payments
         (landlord_id, tenant_id, property_id, unit_id, amount, payment_type, status, mpesa_checkout_request_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'failed', $7)
       RETURNING id`,
      [tenant.landlord_id, tenant.id, tenant.property_id, tenant.unit_id, amount, paymentType, checkoutRequestId]
    );

    res.status(201).json({
      success: true,
      message: 'Payment initiated. Please check your phone and enter your M-Pesa PIN.',
      data: { paymentId: paymentResult.rows[0].id, checkoutRequestId }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to initiate payment' });
  }
};

// ============================================
// @desc    Generate bulk rent invoices (NEW)
// @route   POST /api/payments/generate-rent
// @access  Private (Landlord)
// ============================================
export const generateRentInvoices = async (req, res) => {
  try {
    const { periodName, dueDate } = req.body;
    const userId = req.user.id;
    const role   = req.user.role;

    if (!periodName || !dueDate) {
      return res.status(400).json({ success: false, message: 'Period Name and Due Date are required.' });
    }

    if (role !== 'landlord') {
      return res.status(403).json({ success: false, message: 'Only landlords can generate bulk rent invoices.' });
    }

    // ✅ FIXED: Now pulls from the tenancies table instead of the removed unit rent_amount
    const query = `
      INSERT INTO rent_periods (tenancy_id, tenant_id, period_name, amount_due, due_date, status)
      SELECT 
        tc.id, 
        t.id, 
        $1, 
        tc.agreed_rent, 
        $2, 
        'unpaid'
      FROM tenants t
      JOIN tenancies tc ON tc.tenant_id = t.id AND tc.status = 'active'
      JOIN properties p ON t.property_id = p.id
      WHERE t.status = 'active' AND p.landlord_id = $3
      RETURNING id;
    `;

    const result = await db.query(query, [periodName, dueDate, userId]);

    res.status(201).json({
      success: true,
      message: `Generated ${result.rowCount} rent invoices for ${periodName}`,
      count: result.rowCount
    });

  } catch (error) {
    console.error('Generate rent error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate rent invoices' });
  }
};

export default {
  getPayments,
  getPayment,
  getPaymentStats,
  mpesaCallback,
  initiatePayment,
  generateRentInvoices
};