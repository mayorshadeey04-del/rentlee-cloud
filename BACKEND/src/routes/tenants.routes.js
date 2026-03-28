import express from 'express';
import {
  getTenants,
  getTenant,
  createTenant,
  updateTenant,
  deleteTenant,
  sendEmailNotice
} from '../controllers/tenants.controller.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all tenants (landlord sees all, caretaker sees assigned properties)
router.get('/', authorize('landlord', 'caretaker'), getTenants);

// Get single tenant
router.get('/:id', authorize('landlord', 'caretaker'), getTenant);

// Create tenant (sends password setup email)
router.post('/', authorize('landlord', 'caretaker'), createTenant);

// Update tenant info
router.put('/:id', authorize('landlord', 'caretaker'), updateTenant);

// Delete tenant
router.delete('/:id', authorize('landlord', 'caretaker'), deleteTenant);

router.post('/send-email', authorize('landlord', 'caretaker'), sendEmailNotice);

export default router;