import { Request, Response, NextFunction } from 'express';
import { Status } from '@/types/response';
import { errorResponse, successResponse } from '@/utils/response';
import NotificationSchema from '@/models/notification.model';
import { AuthRequest } from '@/types/auth-request';

class NotificationController {
    async getAllNotificationsByUserId(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId || null;

            const { before } = req.query;

            interface NotificationFilter {
                user: string | null;
                createdAt?: { $lt: Date };
            }

            const filter: NotificationFilter = { user: meId };

            if (before) {
                filter.createdAt = { $lt: new Date(before as string) };
            }

            const notifications = await NotificationSchema.find(filter)
                .populate('sender', 'fullName avatar _id username')
                .populate('user', 'fullName avatar _id username')
                .populate('group', '_id name thumbnail')
                .sort({ createdAt: -1 })
                .limit(10);

            res.json(successResponse(Status.OK, 'Get all notifications successfully', notifications));
        } catch (error) {
            next(error);
        }
    }
}
export default new NotificationController();
