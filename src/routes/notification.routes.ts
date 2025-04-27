import { Router } from 'express';
import notificationController from '@/controllers/notification.controller';
import { verifyAccessToken } from '@/helper/jwt';
const router = Router();

router.get('/by-user/:userId', verifyAccessToken, notificationController.getAllNotificationsByUserId);

export default router;
