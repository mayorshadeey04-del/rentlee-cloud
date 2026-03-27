import express from 'express';
import {
  getTenantStatement,
  getPropertyStatement,
  getUnitStatusReport,
  getTenantDirectory,
  getRevenueReport,
  getMaintenanceReport
} from '../controllers/reports.controller.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All reporting endpoints require authentication and Admin/Caretaker roles
router.use(auth);
router.use(authorize('landlord', 'caretaker'));

router.get('/tenant-statement', getTenantStatement);
router.get('/property-statement', getPropertyStatement);
router.get('/unit-status', getUnitStatusReport);
router.get('/tenant-directory', getTenantDirectory);
router.get('/revenue', getRevenueReport);
router.get('/maintenance', getMaintenanceReport);

export default router;