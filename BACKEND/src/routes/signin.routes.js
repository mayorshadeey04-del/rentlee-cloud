import express from 'express';
import {
  login,
  getMe,
  updateProfile,
  changePassword,
  changeEmail,
  verifyEmailChange,
  forgotPassword,
  resetPassword
} from '../controllers/signin.controller.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes (require authentication)
router.get('/me', auth, getMe);
router.put('/profile', auth, updateProfile);
router.put('/password', auth, changePassword);

// Landlord-only routes
router.post('/change-email', auth, authorize('landlord'), changeEmail);
router.post('/verify-email-change', auth, authorize('landlord'), verifyEmailChange);

export default router;