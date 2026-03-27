import express from 'express';
import { getProfile, updateProfile, updatePassword } from '../controllers/profile.controller.js';
import { auth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(auth); // Protect all profile routes

router.get('/', getProfile);
router.put('/', updateProfile);
router.put('/password', updatePassword);

export default router;