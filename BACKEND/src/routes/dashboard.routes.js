import express from 'express';
import {
  getDashboardStats,
  getRecentActivities
} from '../controllers/dashboard.controller.js';
import { auth } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get dashboard statistics (all roles)
router.get('/stats', getDashboardStats);

// Get recent activities (landlord & caretaker only)
router.get('/activities', getRecentActivities);

export default router;