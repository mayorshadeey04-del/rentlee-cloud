import express from 'express';
import {
  getPayments,
  getPayment,
  getPaymentStats,
  mpesaCallback,
  initiatePayment,
  generateRentInvoices,
  reverseRentInvoices,
  getTenantLedger
} from '../controllers/payments.controller.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// ─── Public route (no auth — called by Safaricom servers) ────────────────────
// Must be registered BEFORE router.use(auth) so it is not intercepted
router.post('/callback', mpesaCallback);

// ─── All routes below require authentication ─────────────────────────────────
router.use(auth);

// Get payment summary stats
router.get('/stats', authorize('landlord', 'caretaker'), getPaymentStats);

// Get ALL payments
router.get('/', authorize('landlord', 'caretaker', 'tenant'), getPayments);

// ✅ MOVE THIS HERE: Specific text routes must go BEFORE dynamic /:id routes
router.get('/ledger', authorize('tenant'), getTenantLedger);

// Get single payment (dynamic ID goes AFTER specific routes)
router.get('/:id', authorize('landlord', 'caretaker'), getPayment);

// Initiate STK Push payment
router.post('/initiate', authorize('tenant'), initiatePayment);

// Generate bulk rent invoices
router.post('/generate-rent', authorize('landlord'), generateRentInvoices);

// Reverse rent
router.post('/reverse-rent', authorize('landlord', 'caretaker'), reverseRentInvoices);

export default router;