import db from '../config/db.js';
import bcrypt from 'bcryptjs';

// ============================================
// @desc    Get Current User Profile
// @route   GET /api/profile
// @access  Private (All Roles)
// ============================================
export const getProfile = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
         u.id, u.first_name, u.last_name, u.email, u.phone, u.role,
         t.id_number 
       FROM users u
       LEFT JOIN tenants t ON t.user_id = u.id
       WHERE u.id = $1`, 
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
};

// ============================================
// @desc    Update Email & Phone
// @route   PUT /api/profile
// @access  Private (All Roles)
// ============================================
export const updateProfile = async (req, res) => {
  try {
    const { email, phone } = req.body;

    // 1. Update the email and phone in the users table
    await db.query(
      `UPDATE users 
       SET email = $1, phone = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [email, phone, req.user.id]
    );

    // 2. Fetch the newly updated data along with the tenant id_number
    const finalProfile = await db.query(
      `SELECT 
         u.id, u.first_name, u.last_name, u.email, u.phone, u.role,
         t.id_number 
       FROM users u
       LEFT JOIN tenants t ON t.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    res.json({ success: true, message: 'Profile updated successfully', data: finalProfile.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// ============================================
// @desc    Update Password
// @route   PUT /api/profile/password
// @access  Private (All Roles)
// ============================================
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const userRes = await db.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    const user = userRes.rows[0];

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashedPassword, req.user.id]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ success: false, message: 'Failed to update password' });
  }
};

export default { getProfile, updateProfile, updatePassword };