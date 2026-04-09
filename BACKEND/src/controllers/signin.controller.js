import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../config/db.js';
import { 
  sendPasswordResetEmail, 
  sendEmailChangeVerification 
} from '../utils/email.service.js';

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ============================================
// @desc    Login
// @route   POST /api/signin/login
// @access  Public
// ============================================
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    // Find user with deleted_at field
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1', 
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const user = result.rows[0];

    //  NEW: Check if user is soft deleted
    if (user.deleted_at) {
      return res.status(401).json({ 
        success: false, 
        message: 'This account has been deactivated. Please contact support.' 
      });
    }

    // Check if active
    if (!user.is_active) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account not activated. Please verify your email or complete password setup.' 
      });
    }

    //  NEW: For tenants, check tenant status
    if (user.role === 'tenant') {
      const tenantResult = await db.query(
        'SELECT status FROM tenants WHERE user_id = $1',
        [user.id]
      );

      if (tenantResult.rows.length > 0) {
        const tenantStatus = tenantResult.rows[0].status;
        
        if (tenantStatus === 'inactive') {
          return res.status(401).json({
            success: false,
            message: 'Your tenant account has been deactivated. Please contact your landlord.'
          });
        }

        if (tenantStatus === 'pending') {
          return res.status(401).json({
            success: false,
            message: 'Please complete your account setup. Check your email for the activation link.'
          });
        }
      }
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Update last login
    await db.query(
      'UPDATE users SET updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role,
          landlordId: user.landlord_id
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Login failed' 
    });
  }
};

// ============================================
// @desc    Get Current User
// @route   GET /api/signin/me
// @access  Private
// ============================================
export const getMe = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, phone, role, landlord_id, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        landlordId: user.landlord_id,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch user data' 
    });
  }
};

// ============================================
// @desc    Update Profile
// @route   PUT /api/signin/profile
// @access  Private
// ============================================
export const updateProfile = async (req, res) => {
  const { firstName, lastName, phone } = req.body;

  try {
    const result = await db.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name), 
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone)
       WHERE id = $4 
       RETURNING id, email, first_name, last_name, phone, role`,
      [firstName, lastName, phone, req.user.id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to update profile' 
    });
  }
};

// ============================================
// @desc    Change Password
// @route   PUT /api/signin/password
// @access  Private
// ============================================
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password and new password are required' 
      });
    }

    // Get current password
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1', 
      [req.user.id]
    );
    
    const user = result.rows[0];

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2', 
      [hashedPassword, req.user.id]
    );

    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to change password' 
    });
  }
};

// ============================================
// @desc    Change Email (Landlord only)
// @route   POST /api/signin/change-email
// @access  Private (Landlord only)
// ============================================
export const changeEmail = async (req, res) => {
  const { currentEmail, newEmail } = req.body;

  try {
    if (req.user.role !== 'landlord') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only landlords can change their email address' 
      });
    }

    // Verify current email
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1', 
      [req.user.id]
    );
    
    if (userResult.rows[0].email !== currentEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current email is incorrect' 
      });
    }

    if (currentEmail === newEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'New email must be different' 
      });
    }

    // Check if new email exists
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2', 
      [newEmail, req.user.id]
    );
    
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already in use' 
      });
    }

    // Generate verification code
    const code = generateCode();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Mark old verifications as used
    await db.query(
      'UPDATE email_verification SET used = true WHERE user_id = $1 AND used = false',
      [req.user.id]
    );

    // Store new verification with email
    const verificationData = `${codeHash}|${newEmail}`;
    await db.query(
      'INSERT INTO email_verification (user_id, code_hash, expires_at) VALUES ($1, $2, $3)',
      [req.user.id, verificationData, expiresAt]
    );

   //  SEND EMAIL ASYNCHRONOUSLY (don't wait for it)
    sendEmailChangeVerification(newEmail, code, req.user.first_name).catch(err => {
      console.error('❌ Background email send failed:', err);
    });

    //  RESPOND IMMEDIATELY to pop open the modal
    res.json({ 
      success: true, 
      message: `Verification code queued for ${newEmail}` 
    });

  } catch (error) {
    console.error('Change email error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to change email' 
    });
  }
};

// ============================================
// @desc    Verify Email Change
// @route   POST /api/signin/verify-email-change
// @access  Private (Landlord only)
// ============================================
export const verifyEmailChange = async (req, res) => {
  const { code } = req.body;

  try {
    if (req.user.role !== 'landlord') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only landlords can change their email' 
      });
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Get verification record
    const result = await db.query(
      'SELECT code_hash, expires_at FROM email_verification WHERE user_id = $1 AND used = false ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No pending email change request' 
      });
    }

    const verification = result.rows[0];

    // Check expiration
    if (new Date() > new Date(verification.expires_at)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code expired' 
      });
    }

    // Extract code hash and new email
    const [storedCodeHash, newEmail] = verification.code_hash.split('|');

    // Verify code
    if (storedCodeHash !== codeHash) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid verification code' 
      });
    }

    // Check email still available
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2', 
      [newEmail, req.user.id]
    );
    
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is no longer available' 
      });
    }

    // Update email
    await db.query(
      'UPDATE users SET email = $1 WHERE id = $2', 
      [newEmail, req.user.id]
    );

    // Mark verification as used
    await db.query(
      'UPDATE email_verification SET used = true WHERE user_id = $1', 
      [req.user.id]
    );

    res.json({ 
      success: true, 
      message: 'Email changed successfully', 
      data: { newEmail } 
    });

  } catch (error) {
    console.error('Verify email change error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to verify email change' 
    });
  }
};

// ============================================
// @desc    Forgot Password
// @route   POST /api/signin/forgot-password
// @access  Public
// ============================================
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Get user
    const userResult = await db.query(
      'SELECT id, first_name, is_active FROM users WHERE email = $1', 
      [email]
    );

    // Don't reveal if user exists (security)
    if (userResult.rows.length === 0) {
      return res.json({ 
        success: true, 
        message: 'If an account exists, a password reset link has been sent.' 
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account is not activated' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Mark old tokens as used
    await db.query(
      'UPDATE password_tokens SET used = true WHERE user_id = $1 AND token_type = $2 AND used = false',
      [user.id, 'password_reset']
    );

    // Create new token
    await db.query(
      'INSERT INTO password_tokens (user_id, token_hash, token_type, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, tokenHash, 'password_reset', expiresAt]
    );

   //  SEND PASSWORD RESET EMAIL (Non-blocking)
    sendPasswordResetEmail(email, resetToken, user.first_name).catch(err => {
        console.error('Background password reset email failed:', err);
    });

    //  RESPOND IMMEDIATELY
    res.json({ 
      success: true, 
      message: 'If an account exists, a password reset link has been sent.' 
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to process password reset request' 
    });
  }
};

// ============================================
// @desc    Reset Password
// @route   POST /api/signin/reset-password
// @access  Public
// ============================================
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token and new password are required' 
      });
    }

    // Hash token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find token
    const tokenResult = await db.query(
      `SELECT pt.user_id, pt.expires_at, u.email
       FROM password_tokens pt
       JOIN users u ON pt.user_id = u.id
       WHERE pt.token_hash = $1 AND pt.token_type = 'password_reset' AND pt.used = false
       ORDER BY pt.created_at DESC LIMIT 1`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset link' 
      });
    }

    const tokenData = tokenResult.rows[0];

    // Check expiration
    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Reset link has expired' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2', 
      [hashedPassword, tokenData.user_id]
    );

    // Mark token as used
    await db.query(
      'UPDATE password_tokens SET used = true WHERE user_id = $1 AND token_type = $2 AND used = false',
      [tokenData.user_id, 'password_reset']
    );

    res.json({ 
      success: true, 
      message: 'Password reset successfully', 
      data: { email: tokenData.email } 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to reset password' 
    });
  }
};

export default { 
  login, 
  getMe, 
  updateProfile, 
  changePassword, 
  changeEmail, 
  verifyEmailChange,
  forgotPassword,
  resetPassword
};