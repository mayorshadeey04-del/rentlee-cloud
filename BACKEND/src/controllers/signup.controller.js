
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../config/db.js';
import { sendVerificationEmail } from '../utils/email.service.js';

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ============================================
// @desc    Register Landlord
// @route   POST /api/signup/landlord
// @access  Public
// ============================================
export const registerLandlord = async (req, res) => {
  const { firstName, lastName, email, phone, password } = req.body;

  try {
    // Validate input
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1', 
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification code
    const code = generateCode();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create user
    const userResult = await db.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, first_name, last_name, email, phone, role`,
      [firstName, lastName, email, phone, hashedPassword, 'landlord', false]
    );

    const user = userResult.rows[0];

   // Store verification code
await db.query(
  'INSERT INTO email_verification (user_id, code_hash, expires_at) VALUES ($1, $2, $3)',
  [user.id, codeHash, expiresAt]
);

// ✅ SEND VERIFICATION EMAIL ASYNCHRONOUSLY (don't wait for it)
sendVerificationEmail(email, code, firstName).catch(err => {
  console.error('❌ Background email send failed (non-blocking):', err);
  // Email failure won't block user signup
});

console.log(`📧 Verification email queued for ${email}`);

// ✅ RESPOND IMMEDIATELY (don't wait for email)
res.status(201).json({
  success: true,
  message: 'Registration successful. Please check your email for verification code.',
  user: {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone,
    role: user.role
  }
});

console.log(`✅ User ${email} registered successfully (email sending in background)`);

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Registration failed' 
    });
  }
};

// ============================================
// @desc    Verify Email
// @route   POST /api/signup/verify-email
// @access  Public
// ============================================
export const verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  try {
    // Get user
    const userResult = await db.query(
      'SELECT id, is_active FROM users WHERE email = $1', 
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const user = userResult.rows[0];

    if (user.is_active) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already verified' 
      });
    }

    // Hash the code
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Find verification record
    const verificationResult = await db.query(
      `SELECT * FROM email_verification 
       WHERE user_id = $1 AND code_hash = $2 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [user.id, codeHash]
    );

    if (verificationResult.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification code' 
      });
    }

    // Activate user
    await db.query(
      'UPDATE users SET is_active = true WHERE id = $1',
      [user.id]
    );

    // Mark verification as used
    await db.query(
      'UPDATE email_verification SET used = true WHERE user_id = $1',
      [user.id]
    );

    res.json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Verification failed' 
    });
  }
};

// ============================================
// @desc    Resend Verification Code
// @route   POST /api/signup/resend-verification
// @access  Public
// ============================================
export const resendVerification = async (req, res) => {
  const { email } = req.body;

  try {
    // Get user
    const userResult = await db.query(
      'SELECT id, first_name, is_active FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const user = userResult.rows[0];

    if (user.is_active) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already verified' 
      });
    }

    // Generate new code
    const code = generateCode();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Mark old codes as used
    await db.query(
      'UPDATE email_verification SET used = true WHERE user_id = $1',
      [user.id]
    );

    // Create new verification
    await db.query(
      'INSERT INTO email_verification (user_id, code_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, codeHash, expiresAt]
    );

   // ✅ SEND VERIFICATION EMAIL ASYNCHRONOUSLY
sendVerificationEmail(email, code, user.first_name).catch(err => {
  console.error('❌ Background email resend failed:', err);
});

// ✅ RESPOND IMMEDIATELY
res.json({
  success: true,
  message: 'Verification code resent successfully'
});

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to resend verification' 
    });
  }
};

// ============================================
// @desc    Setup Password (for caretakers/tenants)
// @route   POST /api/signup/setup-password
// @access  Public
// ============================================
export const setupPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token and password are required' 
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Hash the token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find token and get user role
    const tokenResult = await db.query(
      `SELECT pt.user_id, pt.expires_at, u.role 
       FROM password_tokens pt
       JOIN users u ON pt.user_id = u.id
       WHERE pt.token_hash = $1 AND pt.token_type = 'activation' AND pt.used = false`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }

    const tokenData = tokenResult.rows[0];

    // Check expiration
    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and activate user
    await db.query(
      'UPDATE users SET password_hash = $1, is_active = true WHERE id = $2',
      [hashedPassword, tokenData.user_id]
    );

    // ✅ NEW: If user is a tenant, update tenant status to 'active'
    if (tokenData.role === 'tenant') {
      await db.query(
        'UPDATE tenants SET status = $1 WHERE user_id = $2',
        ['active', tokenData.user_id]
      );
      console.log(`✅ Tenant ${tokenData.user_id} status updated to ACTIVE`);
    }

    // Mark token as used
    await db.query(
      'UPDATE password_tokens SET used = true WHERE user_id = $1 AND token_type = $2',
      [tokenData.user_id, 'activation']
    );

    res.json({
      success: true,
      message: 'Password set successfully. You can now log in.'
    });

  } catch (error) {
    console.error('Setup password error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to setup password' 
    });
  }
};

export default { 
  registerLandlord, 
  verifyEmail, 
  resendVerification, 
  setupPassword 
};