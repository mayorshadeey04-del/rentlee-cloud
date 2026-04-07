import express from 'express';
import { getPlatformDashboard, toggleLandlordStatus } from '../controllers/admin.controller.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(auth);

// Only platform_admin can access these routes
router.get('/dashboard', authorize('platform_admin'), getPlatformDashboard);
router.patch('/landlords/:id/toggle', authorize('platform_admin'), toggleLandlordStatus);

export default router;