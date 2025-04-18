import { Request, Response, NextFunction } from 'express';
import { Status } from '@/types/response';
import { errorResponse, successResponse } from '@/utils/response';
import NotificationSchema from '@/models/notification.model';

class NotificationController {
    async getAllNotificationsById(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;

            if (!userId) {
                res.json(errorResponse(Status.BAD_REQUEST, 'User ID is not provided'));
                return;
            }

            const notifications = await NotificationSchema.find({ userId: userId })
                .populate('sender', 'fullName avatar id username')
                .populate('user', 'fullName avatar id username')
                .sort({ createdAt: -1 });

            res.json(successResponse(Status.OK, 'Get all notifications successfully', notifications));
        } catch (error) {
            next(error);
        }
    }
}
export default new NotificationController();
