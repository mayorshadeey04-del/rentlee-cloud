import express from 'express';
import {
  registerLandlord,
  verifyEmail,
  resendVerification,
  setupPassword
} from '../controllers/signup.controller.js';

const router = express.Router();

// Register new landlord
router.post('/landlord', registerLandlord);

// Verify email with code
router.post('/verify-email', verifyEmail);

// Resend verification code
router.post('/resend-verification', resendVerification);

// Setup password (for caretakers/tenants)
router.post('/setup-password', setupPassword);

export default router;