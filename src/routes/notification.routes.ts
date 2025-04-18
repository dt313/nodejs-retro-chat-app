import { Router } from 'express';
import notificationController from '@/controllers/notification.controller';
const router = Router();

router.get('/by-user/:userId', notificationController.getAllNotificationsById);

export default router;
