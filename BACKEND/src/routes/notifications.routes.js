import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../controllers/notifications.controller.js';
import { auth } from '../middleware/auth.middleware.js';

const router = express.Router();

// All notification routes require basic authentication
router.use(auth);

router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;