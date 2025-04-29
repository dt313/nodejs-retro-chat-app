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
import ParticipantSchema from '@/models/participant.model';

class MessageController {
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;
            const { replyTo, content, attachments, isGroup } = req.body;

            if (isGroup === null) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'isGroup field must be boolean type'),
                );
            }

            if (!meId) {
                res.status(Status.UNAUTHORIZED).json(errorResponse(Status.UNAUTHORIZED, 'User not authenticated'));
                return;
            }
            const meIdObjectId = new Types.ObjectId(meId);

            console.log('isGroup', isGroup);
            const isExistConversation = await ConversationSchema.findOne({ _id: conversationId, isGroup });

            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            // if user is not in conversation
            const isParticipant = await ParticipantSchema.findOne({ user: meId, conversationId });

            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not member of this conversation'),
                );
                return;
            }

            const messageType = getMessageType({ content: !!content, attachments: attachments?.length > 0 });
            // create message in group conversation
            const newMessage = await MessageSchema.create({
                conversationId,
                sender: meIdObjectId,
                replyTo,
                content,
                attachments,
                messageType,
            });

            isExistConversation.lastMessage = newMessage._id;
            await isExistConversation.save();
            const populatedMessage = await newMessage.populate('sender', '_id fullName avatar username');

            const participants = await ParticipantSchema.find({ conversationId }).select('user');
            const participantUserIds = new Set(participants.map((p) => p.user.toString()));

            // ws send message to all members in group
            const socket = ws.getWSS();
            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (customClient.isAuthenticated && participantUserIds.has(meId) && customClient.userId !== meId) {
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
        } catch (error) {
            console.log(error);
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
