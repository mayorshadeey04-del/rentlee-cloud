import express from 'express';
import { getTenantDashboardData, getMyUnit } from '../controllers/tenantdashboard.controller.js'; //  Import the new function
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(auth);

// Get main dashboard stats
router.get('/', authorize('tenant'), getTenantDashboardData);

//  Get specific unit details
router.get('/my-unit', authorize('tenant'), getMyUnit);

export default router;