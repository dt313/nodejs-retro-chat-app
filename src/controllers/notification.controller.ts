import { Request, Response, NextFunction } from 'express';
import { Status } from '@/types/response';
import { errorResponse, successResponse } from '@/utils/response';
import NotificationSchema from '@/models/notification.model';
import { AuthRequest } from '@/types/auth-request';
import mongoose from 'mongoose';
import { notificationValidate } from '@/validation';

class NotificationController {
    async getAllNotificationsByUserId(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId || null;

            if (!meId || !mongoose.isValidObjectId(meId)) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid user ID'));
                return;
            }

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

    async readNotificationById(req: AuthRequest, res: Response, next: NextFunction) {
        const meId = req.payload?.userId;
        const { notificationId } = req.params;

        const result = notificationValidate.readNotificationById.safeParse({ notificationId, userId: meId });

        if (!result.success) {
            res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error));
            return;
        }

        const notification = await NotificationSchema.findById(notificationId);

        if (!notification) {
            res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Không tìm thấy thông báo'));
            return;
        }

        if (notification?.user._id.toString() !== meId) {
            res.status(Status.BAD_REQUEST).json(
                errorResponse(Status.BAD_REQUEST, 'Bạn không có quyền đọc thông báo này'),
            );
            return;
        }

        notification.isRead = true;
        const newNotification = await notification.save();

        res.status(Status.OK).json(errorResponse(Status.OK, 'Read notification successfully', newNotification));
        return;
    }
}
export default new NotificationController();
