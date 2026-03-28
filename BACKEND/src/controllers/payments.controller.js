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

    const { CheckoutRequestID, ResultCode, CallbackMetadata } = callback;
    const isSuccess = ResultCode === 0;

    if (!isSuccess) {
      await db.query(`UPDATE payments SET status = 'failed' WHERE mpesa_checkout_request_id = $1`, [CheckoutRequestID]);
      return;
    }

    const meta = {};
    CallbackMetadata?.Item?.forEach(item => { meta[item.Name] = item.Value; });

    const mpesaRef  = meta['MpesaReceiptNumber']; 
    const rawDate   = meta['TransactionDate']?.toString();
    
    let formattedDate = new Date().toISOString();
    if (rawDate && rawDate.length === 14) {
      formattedDate = `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)} ${rawDate.slice(8,10)}:${rawDate.slice(10,12)}:${rawDate.slice(12,14)}`;
    }

    const paymentRes = await db.query(
      `UPDATE payments 
       SET status = 'confirmed', mpesa_ref = $1, payment_date = $2 
       WHERE mpesa_checkout_request_id = $3
       RETURNING landlord_id, tenant_id, amount`,
      [mpesaRef, formattedDate, CheckoutRequestID]
    );

    if (paymentRes.rows.length > 0) {
      const payInfo = paymentRes.rows[0];

      const detailsRes = await db.query(
        `SELECT u.id as tenant_user_id, u.first_name, u.last_name, un.unit_number, p.name as prop_name
         FROM tenants t
         JOIN users u ON t.user_id = u.id
         JOIN units un ON t.unit_id = un.id
         JOIN properties p ON t.property_id = p.id
         WHERE t.id = $1`,
        [payInfo.tenant_id]
      );

      if (detailsRes.rows.length > 0) {
        const d = detailsRes.rows[0];

        // 🔔 1. NOTIFY THE ADMIN/LANDLORD
        await db.query(
          `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, 'payment')`,
          [payInfo.landlord_id, 'New Payment Received', `${d.first_name} ${d.last_name} paid Ksh ${Number(payInfo.amount).toLocaleString()} for ${d.prop_name} (Unit ${d.unit_number}). Ref: ${mpesaRef}`]
        );

        // 🔔 2. NOTIFY THE TENANT
        await db.query(
          `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, 'payment')`,
          [d.tenant_user_id, 'Payment Successful', `Your payment of Ksh ${Number(payInfo.amount).toLocaleString()} was received successfully. Ref: ${mpesaRef}`]
        );
      }
    }
  } catch (error) {
    console.error('Mpesa callback error:', error);
  }
};

// ============================================
// @desc    Initiate STK Push (Real Daraja API)
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

    // 1. Get tenant details from DB
    const tenantResult = await db.query(
      `SELECT t.id, t.unit_id, t.property_id, t.landlord_id, t.status, un.unit_number
       FROM tenants t
       JOIN users u ON t.user_id = u.id
       JOIN units un ON t.unit_id = un.id
       WHERE u.id = $1`,
      [userId]
    );

    if (tenantResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Tenant record not found' });
    const tenant = tenantResult.rows[0];
    if (tenant.status !== 'active') return res.status(403).json({ success: false, message: 'Your account is not active' });

    // ─── DARAJA API INTEGRATION ─────────────────────────────────────────
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const shortCode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    // A. Generate Timestamp and Password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    // B. Get Auth Token from Safaricom
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` }
    });
    
    if (!tokenRes.ok) throw new Error('Failed to authenticate with Safaricom');
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // C. Send STK Push Request
    const stkRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.ceil(amount), // M-Pesa strictly requires integer amounts without decimals
        PartyA: phone, // Must be 2547XXXXXXXX
        PartyB: shortCode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: `Unit ${tenant.unit_number}`,
        TransactionDesc: "Rentlee Payment"
      })
    });

    const stkData = await stkRes.json();

    // Check if Safaricom rejected the prompt (e.g., invalid number)
    if (stkData.ResponseCode !== '0') {
      throw new Error(stkData.errorMessage || stkData.CustomerMessage || 'STK Push failed');
    }

    const checkoutRequestId = stkData.CheckoutRequestID;

    // 2. Save the pending transaction to the database
    const paymentResult = await db.query(
      `INSERT INTO payments
         (landlord_id, tenant_id, property_id, unit_id, amount, payment_type, status, mpesa_checkout_request_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'failed', $7)
       RETURNING id`,
      [tenant.landlord_id, tenant.id, tenant.property_id, tenant.unit_id, amount, paymentType, checkoutRequestId]
    );

    res.status(201).json({
      success: true,
      message: 'STK Push triggered successfully. Please enter your PIN.',
      data: { paymentId: paymentResult.rows[0].id, checkoutRequestId }
    });

  } catch (error) {
    console.error('M-Pesa STK Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to initiate payment' });
  }
};

// ============================================
// @desc    Generate bulk rent invoices
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

    const query = `
      INSERT INTO rent_periods (tenancy_id, tenant_id, period_name, amount_due, due_date, status)
      SELECT 
        tc.id, 
        t.id, 
        $1::VARCHAR, 
        tc.agreed_rent, 
        $2, 
        'unpaid'
      FROM tenants t
      JOIN tenancies tc ON tc.tenant_id = t.id AND tc.status = 'active'
      JOIN properties p ON t.property_id = p.id
      WHERE t.status = 'active' 
        AND p.landlord_id = $3
        AND NOT EXISTS (
          SELECT 1 FROM rent_periods rp 
          WHERE rp.tenant_id = t.id AND rp.period_name = $1::VARCHAR
        )
      RETURNING id, tenant_id;
    `;

    const result = await db.query(query, [periodName, dueDate, userId]);

    // 🔔 NOTIFY ALL AFFECTED TENANTS
    if (result.rows.length > 0) {
      try {
        const tenantIds = result.rows.map(r => r.tenant_id);
        await db.query(`
          INSERT INTO notifications (user_id, title, message, type)
          SELECT user_id, 'New Rent Invoice', 'Your rent invoice for ' || $1 || ' is now available and due soon.', 'payment'
          FROM tenants
          WHERE id = ANY($2::uuid[])
        `, [periodName, tenantIds]);
      } catch (notifErr) {
        console.error('Failed to notify tenants:', notifErr);
      }
    }

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

// ============================================
// @desc    Reverse (Undo) bulk rent invoices
// @route   POST /api/payments/reverse-rent
// @access  Private (Landlord)
// ============================================
export const reverseRentInvoices = async (req, res) => {
  try {
    const { periodName } = req.body;
    const userId = req.user.id;
    const role   = req.user.role;

    if (!periodName) return res.status(400).json({ success: false, message: 'Period Name is required.' });
    if (role !== 'landlord') return res.status(403).json({ success: false, message: 'Only landlords can reverse invoices.' });

    // ✅ Deletes ONLY 'unpaid' invoices for this specific period
    const query = `
      DELETE FROM rent_periods 
      WHERE period_name = $1 
        AND status = 'unpaid' 
        AND tenancy_id IN (
          SELECT tc.id FROM tenancies tc
          JOIN tenants t ON tc.tenant_id = t.id
          JOIN properties p ON t.property_id = p.id
          WHERE p.landlord_id = $2
        )
      RETURNING id;
    `;

    const result = await db.query(query, [periodName, userId]);

    if (result.rowCount === 0) {
       return res.status(404).json({ success: false, message: `No unpaid invoices found for "${periodName}". They may have already been paid or the name is incorrect.` });
    }

    res.status(200).json({
      success: true,
      message: `Successfully reversed ${result.rowCount} unpaid invoices for ${periodName}`,
      count: result.rowCount
    });

  } catch (error) {
    console.error('Reverse rent error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to reverse rent invoices' });
  }
};

// ============================================
// @desc    Get Tenant Ledger Statement
// @route   GET /api/payments/ledger
// @access  Private (Tenant)
// ============================================
export const getTenantLedger = async (req, res) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;

    if (role !== 'tenant') {
      return res.status(403).json({ success: false, message: 'Only tenants can view their personal ledger.' });
    }

    // 1. Get the Tenant ID AND their Unit/Property details!
    const tenantRes = await db.query(`
      SELECT t.id, u.first_name || ' ' || u.last_name as full_name, un.unit_number, p.name as property_name 
      FROM tenants t 
      JOIN users u ON t.user_id = u.id 
      JOIN units un ON t.unit_id = un.id 
      JOIN properties p ON t.property_id = p.id 
      WHERE t.user_id = $1
    `, [userId]);
    
    if (tenantRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Tenant record not found.' });
    
    const tenantInfo = tenantRes.rows[0];
    const tenantId = tenantInfo.id;

    // 2. The Master Union Query
    const ledgerQuery = `
      SELECT 
        'invoice' AS transaction_type,
        id AS ref_id,
        period_name AS description,
        amount_due AS charge,
        0 AS payment,
        due_date AS transaction_date,
        created_at
      FROM rent_periods
      WHERE tenant_id = $1

      UNION ALL

      SELECT 
        'payment' AS transaction_type,
        id AS ref_id,
        'M-Pesa Ref: ' || COALESCE(mpesa_ref, 'Pending') AS description,
        0 AS charge,
        amount AS payment,
        payment_date AS transaction_date,
        created_at
      FROM payments
      WHERE tenant_id = $1 AND status = 'confirmed'

      ORDER BY transaction_date ASC, created_at ASC;
    `;

    const result = await db.query(ledgerQuery, [tenantId]);

    // 3. Calculate the Running Balance
    let currentBalance = 0;
    const formattedLedger = result.rows.map(row => {
      currentBalance = currentBalance + Number(row.charge) - Number(row.payment);
      return {
        ...row,
        running_balance: currentBalance
      };
    });

    // Send both the ledger array AND the tenant info!
    res.json({ success: true, data: formattedLedger, tenantInfo: tenantInfo });

  } catch (error) {
    console.error('Ledger fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ledger statement' });
  }
};

export default {
  getPayments,
  getPayment,
  getPaymentStats,
  mpesaCallback,
  initiatePayment,
  generateRentInvoices,
  reverseRentInvoices,
  getTenantLedger
};