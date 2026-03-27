import express from 'express';
import {
  getRoomTypes,
  createRoomType,
  updateRoomType,
  deleteRoomType
} from '../controllers/roomtypes.controller.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all room types (requires propertyId query parameter)
router.get('/', authorize('landlord', 'caretaker'), getRoomTypes);

// Create room type (pricing tier)
router.post('/', authorize('landlord', 'caretaker'), createRoomType);

// Update room type
router.put('/:id', authorize('landlord', 'caretaker'), updateRoomType);

// Delete room type
router.delete('/:id', authorize('landlord', 'caretaker'), deleteRoomType);

export default router;