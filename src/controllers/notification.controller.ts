import { Request, Response, NextFunction } from 'express';
import { Status } from '@/types/response';
import { errorResponse, successResponse } from '@/utils/response';
import NotificationSchema from '@/models/notification.model';
import { AuthRequest } from '@/types/auth-request';

class NotificationController {
    async getAllNotificationsByUserId(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const me = req.payload?.userId;

            if (me !== userId) {
                res.status(Status.UNAUTHORIZED).json(errorResponse(Status.UNAUTHORIZED, 'User ID and token not match'));
            }

            if (!userId) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'User ID is not provided'));
                return;
            }

            const notifications = await NotificationSchema.find({ user: userId })
                .populate('sender', 'fullName avatar _id username')
                .populate('user', 'fullName avatar _id username')
                .populate('group', '_id name thumbnail')
                .sort({ createdAt: -1 });

            res.json(successResponse(Status.OK, 'Get all notifications successfully', notifications));
        } catch (error) {
            next(error);
        }
    }
}
export default new NotificationController();
