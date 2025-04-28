import { getMessageType } from '@/helper';
import ConversationSchema from '@/models/conversation.model';
import MessageSchema from '@/models/message.model';
import { AuthRequest } from '@/types/auth-request';
import { Status } from '@/types/response';
import { successResponse, errorResponse } from '@/utils/response';
import { Types } from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import ws from '@/configs/ws';
import CustomWebSocket from '@/types/web-socket';

class MessageController {
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;
            const { replyTo, content, attachments, isGroup } = req.body;

            if (!meId) {
                res.status(Status.UNAUTHORIZED).json(errorResponse(Status.UNAUTHORIZED, 'User not authenticated'));
                return;
            }
            const meIdObjectId = new Types.ObjectId(meId);

            const isExistConversation = await ConversationSchema.findOne({ id: conversationId, isGroup });

            const messageType = getMessageType({ content: !!content, attachments: attachments?.length > 0 });

            console.log(messageType);

            if (isExistConversation) {
                // if user is not in conversation
                const isUserInConversation = isExistConversation.participants.includes(meIdObjectId);

                if (!isUserInConversation) {
                    res.status(Status.BAD_REQUEST).json(
                        errorResponse(Status.BAD_REQUEST, 'You are not member of this conversation'),
                    );
                    return;
                }
                // create message in group conversation
                const newMessage = await MessageSchema.create({
                    conversationId,
                    sender: meIdObjectId,
                    replyTo,
                    content,
                    attachments,
                    messageType,
                });

                const populatedMessage = await newMessage.populate('sender', '_id fullName avatar username');

                // ws send message to all members in group
                const socket = ws.getWSS();
                if (socket) {
                    socket.clients.forEach((client) => {
                        const customClient = client as CustomWebSocket;
                        if (
                            customClient.isAuthenticated &&
                            isExistConversation.participants.includes(new Types.ObjectId(customClient.userId)) &&
                            customClient.userId !== meId
                        ) {
                            customClient.send(
                                JSON.stringify({
                                    type: 'message',
                                    data: {
                                        message: populatedMessage,
                                        conversationId,
                                    },
                                }),
                            );
                        }
                    });
                }

                res.status(Status.OK).json(successResponse(Status.OK, 'Create message successfully', populatedMessage));
                return;
            } else {
                if (!isGroup) {
                }
            }

            res.status(Status.OK).json(successResponse(Status.OK, 'Create message successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getMessageByConversationId(req: AuthRequest, res: Response, next: NextFunction) {
        const me = req.payload?.userId;

        // logic create message

        try {
            console.log('create message');
        } catch (error) {
            next(error);
        }
    }
}
export default new MessageController();
