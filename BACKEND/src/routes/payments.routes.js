import express from 'express';
import {
  getPayments,
  getPayment,
  getPaymentStats,
  mpesaCallback,
  initiatePayment,
  generateRentInvoices
} from '../controllers/payments.controller.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// ─── Public route (no auth — called by Safaricom servers) ────────────────────
// Must be registered BEFORE router.use(auth) so it is not intercepted
router.post('/callback', mpesaCallback);

// ─── All routes below require authentication ─────────────────────────────────
router.use(auth);

// Get payment summary stats (total collected, this month, failed count)
router.get('/stats', authorize('landlord', 'caretaker'), getPaymentStats);

// ✅ FIXED: Added 'tenant' so the Tenant Dashboard can fetch their own payment history!
router.get('/', authorize('landlord', 'caretaker', 'tenant'), getPayments);

// Get single payment
router.get('/:id', authorize('landlord', 'caretaker'), getPayment);

// Initiate STK Push payment (tenant only)
router.post('/initiate', authorize('tenant'), initiatePayment);

// Generate bulk rent invoices
router.post('/generate-rent', authorize('landlord'), generateRentInvoices);

export default router;