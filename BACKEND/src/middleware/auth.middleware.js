import jwt from 'jsonwebtoken';
import db from '../config/db.js';

// ============================================
// JWT AUTHENTICATION MIDDLEWARE
// ============================================
export const auth = async (req, res, next) => {
  try {
    // Get token from header
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    //  UPDATED: Get user with deleted_at field
    const result = await db.query(
      'SELECT id, email, first_name, last_name, phone, role, landlord_id, is_active, deleted_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Token invalid.'
      });
    }

    const user = result.rows[0];

    //  NEW: Check if user is soft deleted
    if (user.deleted_at) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated. Please contact support.'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is not active. Please verify your email or complete account setup.'
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

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      role: user.role,
      landlord_id: user.landlord_id
    };

    next();

  } catch (error) {
    // Handle JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// ============================================
// ROLE-BASED AUTHORIZATION MIDDLEWARE
// ============================================
export const authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user exists
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // Check if user's role is in allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this resource`
      });
    }

    next();
  };
};

export default { auth, authorize };