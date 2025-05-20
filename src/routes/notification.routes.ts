import { Router } from 'express';
import notificationController from '@/controllers/notification.controller';
import { verifyAccessToken } from '@/helper/jwt';
const router = Router();

router.get('/', verifyAccessToken, notificationController.getAllNotificationsByUserId);
router.get('/read/:notificationId', verifyAccessToken, notificationController.readNotificationById);

export default router;
