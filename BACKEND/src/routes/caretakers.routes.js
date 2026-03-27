import express from 'express';
import {
  getCaretakers,
  getCaretaker,
  createCaretaker,
  updateCaretaker,
  updateCaretakerProperties,
  deleteCaretaker
} from '../controllers/caretakers.controller.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication and landlord role
router.use(auth);
router.use(authorize('landlord'));

// Get all caretakers
router.get('/', getCaretakers);

// Get single caretaker
router.get('/:id', getCaretaker);

// Create caretaker (sends password setup email)
router.post('/', createCaretaker);

// Update caretaker info
router.put('/:id', updateCaretaker);

// Update caretaker's assigned properties
router.put('/:id/properties', updateCaretakerProperties);

// Delete caretaker
router.delete('/:id', deleteCaretaker);

export default router;