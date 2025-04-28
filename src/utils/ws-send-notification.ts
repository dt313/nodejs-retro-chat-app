import NotificationSchema from '@/models/notification.model';
import ws from '@/configs/ws';
import CustomWebSocket from '@/types/web-socket';
import { Types } from 'mongoose';

const senJoinGroupNotification = async ({
    fromId,
    toId,
    type,
    groupId,
}: {
    fromId: string;
    toId: string;
    type: string;
    groupId: string;
}) => {
    const notification = await NotificationSchema.create({
        user: toId,
        type: type,
        sender: fromId,
        group: groupId,
    });

    const populatedNotification = await NotificationSchema.findOne({
        _id: notification._id,
    })
        .populate('sender', 'fullName avatar id username')
        .populate('user', 'fullName avatar id username')
        .populate('group', 'id name thumbnail');

    const socket = ws.getWSS();

    if (socket) {
        socket.clients.forEach((client) => {
            const customClient = client as CustomWebSocket;

            if (customClient.isAuthenticated && customClient.userId.toString() === toId.toString()) {
                customClient.send(
                    JSON.stringify({
                        type: 'notification',
                        data: {
                            notification: populatedNotification,
                        },
                    }),
                );
            }
        });
    }
};

export { senJoinGroupNotification };
