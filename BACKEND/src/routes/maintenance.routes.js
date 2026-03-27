import express from 'express';
import {
  getMaintenanceRequests,
  getMaintenanceRequest,
  createMaintenanceRequest,
  updateMaintenanceStatus,
  deleteMaintenanceRequest,
  getMyMaintenanceRequests,
  updateMyMaintenanceRequest,
  deleteMyMaintenanceRequest
} from '../controllers/maintenance.controller.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(auth);

// ==========================================
// TENANT ROUTES (Must come before /:id routes)
// ==========================================
router.get('/my-requests', authorize('tenant'), getMyMaintenanceRequests);
router.post('/', authorize('tenant'), createMaintenanceRequest);
router.put('/my-requests/:id', authorize('tenant'), updateMyMaintenanceRequest);
router.delete('/my-requests/:id', authorize('tenant'), deleteMyMaintenanceRequest);

// ==========================================
// ADMIN ROUTES (Landlord & Caretaker)
// ==========================================
router.get('/', authorize('landlord', 'caretaker'), getMaintenanceRequests);
router.get('/:id', authorize('landlord', 'caretaker'), getMaintenanceRequest);
router.patch('/:id/status', authorize('landlord', 'caretaker'), updateMaintenanceStatus);
router.delete('/:id', authorize('landlord', 'caretaker'), deleteMaintenanceRequest);

export default router;