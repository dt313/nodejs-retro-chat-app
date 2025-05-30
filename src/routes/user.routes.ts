import express from 'express';
import userController from '@/controllers/user.controller';
import { verifyAccessToken } from '@/helper/jwt';

const router = express.Router();

router.get('/', userController.getUsers);
router.get('/me', verifyAccessToken, userController.getInformation);
router.get('/friends', verifyAccessToken, userController.getFriends);
router.get('/:id', userController.getUserById);
router.get('/username/:username', userController.getUserByUsername);
router.post('/reset-password', userController.resetPassword);
export default router;
