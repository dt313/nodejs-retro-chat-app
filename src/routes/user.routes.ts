import express from 'express';
import userController from '@/controllers/user.controller';
import { verifyAccessToken } from '@/helper/jwt';
import { userAvatarUpload } from '@/configs/multer';

const router = express.Router();

router.get('/', userController.getUsers);
router.get('/me', verifyAccessToken, userController.getInformation);
router.get('/friends', verifyAccessToken, userController.getFriends);
router.get('/:id', userController.getUserById);
router.get('/:userId/friends', userController.getFriendsByUserId);
router.get('/username/:username', userController.getUserByUsername);
router.post('/reset-password', userController.resetPassword);
router.put('/me', verifyAccessToken, userAvatarUpload.single('value'), userController.updateProfile);
export default router;
