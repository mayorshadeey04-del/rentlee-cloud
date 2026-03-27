import express from 'express';
import {
  getUnits,
  getUnit,
  createUnit,
  updateUnit,
  deleteUnit
} from '../controllers/units.controller.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all units (with optional propertyId filter)
router.get('/', authorize('landlord', 'caretaker'), getUnits);

// Get single unit
router.get('/:id', authorize('landlord', 'caretaker'), getUnit);

// Create unit
router.post('/', authorize('landlord', 'caretaker'), createUnit);

// Update unit
router.put('/:id', authorize('landlord', 'caretaker'), updateUnit);

// Delete unit
router.delete('/:id', authorize('landlord', 'caretaker'), deleteUnit);

export default router;