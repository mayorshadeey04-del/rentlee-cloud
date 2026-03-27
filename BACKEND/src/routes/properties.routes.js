import express from 'express';
import {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty
} from '../controllers/properties.controller.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all properties (Landlord sees all, Caretaker sees assigned)
router.get('/', authorize('landlord', 'caretaker'), getProperties);

// Get single property
router.get('/:id', authorize('landlord', 'caretaker'), getProperty);

// Create property (Landlord only)
router.post('/', authorize('landlord'), createProperty);

// Update property
router.put('/:id', authorize('landlord', 'caretaker'), updateProperty);

// Delete property (Landlord only)
router.delete('/:id', authorize('landlord'), deleteProperty);

export default router;