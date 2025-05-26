import { z } from 'zod';

export const readNotificationById = z.object({
    notificationId: z.string().min(1, 'Notification ID is required'),
    userId: z.string().min(1, 'User ID is required'),
});
