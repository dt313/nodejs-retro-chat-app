import { getMessageType } from '@/helper';
import ConversationSchema from '@/models/conversation.model';
import AttachmentSchema from '@/models/attachment.model';
import ImageAttachmentSchema from '@/models/images-attachment.model';
import MessageSchema from '@/models/message.model';
import ReactionSchema from '@/models/reaction.model';

import { AuthRequest } from '@/types/auth-request';
import { Status } from '@/types/response';
import { successResponse, errorResponse } from '@/utils/response';
import { Model, Types } from 'mongoose';
import { Response, NextFunction } from 'express';
import ws from '@/configs/ws';
import CustomWebSocket from '@/types/web-socket';
import ParticipantSchema from '@/models/participant.model';
import { storeFileToCloudinary, storeImgToCloudinary } from '@/utils/cloudinary';
import { REACTION_MESSAGE } from '@/configs/types';
import { reactionValidate } from '@/validation';
import { ReactionMessageType, reactionModelMap } from '@/utils/model-map';

class MessageController {
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;
            const { replyTo, replyType, content, isGroup } = req.body;
            const attachments = req.files as Express.Multer.File[]; // Cast to the correct type
            console.log('attachments', attachments);

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

            let newImages = null;
            // if message has attachments
            const newAttachments = new Set();
            if (attachments && attachments.length > 0) {
                // get all image types
                const files = attachments.filter((attachment) => !attachment.mimetype.startsWith('image/'));
                const images = attachments.filter((attachment) => attachment.mimetype.startsWith('image/'));
                if (images.length > 0) {
                    const imageUrls = new Set();
                    // save image to cloud
                    for (const image of images) {
                        const stream = await storeImgToCloudinary(image, 'conversation-images');
                        const imageUrl = (stream as any).secure_url;
                        imageUrls.add({
                            url: imageUrl,
                            size: image.size,
                            name: image.originalname,
                        });
                    }

                    newImages = await ImageAttachmentSchema.create({
                        images: Array.from(imageUrls),
                        conversationId,
                        sender: meIdObjectId,
                    });
                }
                if (files.length > 0) {
                    console.log('SAVE FILE');
                    for (const file of files) {
                        const stream = await storeFileToCloudinary(file, 'conversation-files');
                        const fileUrl = (stream as any).secure_url;
                        const newAttachment = await AttachmentSchema.create({
                            url: fileUrl,
                            name: file.originalname,
                            type: 'file',
                            size: file.size,
                            conversationId,
                            sender: meIdObjectId,
                        });
                        newAttachments.add(newAttachment._id);
                    }
                }
            }

            const messageType = getMessageType({
                content: !!content,
                file: newAttachments?.size > 0,
                image: !!newImages,
            });

            if (!messageType) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Message type error'));
                return;
            }
            // create message in group conversation

            const newMessage = await MessageSchema.create({
                conversationId,
                sender: meIdObjectId,
                replyTo,
                replyType,
                content,
                messageType,
                attachments: Array.from(newAttachments),
                images: newImages,
            });

            isExistConversation.lastMessage = {
                content: newMessage.content || '',
                type: messageType || 'text',
                sender: meIdObjectId,
                sentAt: new Date(),
                readedBy: [new Types.ObjectId(meId)],
            };

            const savedConversation = await isExistConversation.save();

            const populatedConversation = await savedConversation.populate([
                {
                    path: 'createdBy',
                    select: '_id avatar username fullName',
                },
                {
                    path: 'participants',
                    populate: {
                        path: 'user',
                        select: '_id avatar username fullName',
                    },
                },
                {
                    path: 'lastMessage.sender',
                    select: '_id avatar username fullName',
                },
            ]);
            const populatedMessage = await newMessage.populate([
                { path: 'sender', select: 'fullName avatar username' },
                { path: 'attachments', select: 'url name type size' },
                { path: 'images', select: 'images' },
                {
                    path: 'replyTo',
                    select: 'content',
                    populate: {
                        path: 'sender',
                        select: 'fullName firstName avatar username',
                    },
                },
            ]);

            const participants = await ParticipantSchema.find({ conversationId }).select('user');
            const participantUserIds = new Set(participants.map((p) => p.user.toString()));

            // ws send message to all members in group
            const socket = ws.getWSS();
            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (
                        customClient.isAuthenticated &&
                        customClient.userId !== meId &&
                        participantUserIds.has(customClient.userId)
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

            // ws send last message to all members in group
            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (customClient.isAuthenticated && participantUserIds.has(customClient.userId)) {
                        customClient.send(
                            JSON.stringify({
                                type: 'last-conversation',
                                data: {
                                    conversation: populatedConversation,
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

    async reaction(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { messageId } = req.params;
            const { messageType, type } = req.body;

            const result = reactionValidate.reaction.safeParse({
                user: meId,
                messageId,
                messageType,
                type,
            });

            if (!result.success) {
                next(errorResponse(Status.BAD_REQUEST, 'Validation error', result.error));
                return;
            }

            console.log(messageType);

            const Model = reactionModelMap[messageType as ReactionMessageType] as Model<any>;

            if (!Model) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid message type'));
                return;
            }

            // check user in conversation that message belong
            const isExistMessage = await Model.findById(messageId);
            if (!isExistMessage) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Message is not found'));
                return;
            }

            const isExistConversation = await ConversationSchema.findById(isExistMessage.conversationId);
            if (!isExistConversation) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Conversation is not found'));
                return;
            }

            const isParticipant = await ParticipantSchema.findOne({
                user: meId,
                conversationId: isExistConversation._id,
            });

            if (!isParticipant) {
                res.status(Status.NOT_FOUND).json(
                    errorResponse(Status.NOT_FOUND, 'You are not member in conversation to reaction message'),
                );
                return;
            }

            isExistConversation.lastMessage = {
                content: '',
                type: 'reaction',
                sender: new Types.ObjectId(meId),
                sentAt: new Date(),
                readedBy: [new Types.ObjectId(meId)],
            };

            const savedConversation = await isExistConversation.save();

            const populatedConversation = await savedConversation.populate([
                {
                    path: 'createdBy',
                    select: '_id avatar username fullName',
                },
                {
                    path: 'participants',
                    populate: {
                        path: 'user',
                        select: '_id avatar username fullName',
                    },
                },
                {
                    path: 'lastMessage.sender',
                    select: '_id avatar username fullName',
                },
            ]);

            const isExistReaction = await ReactionSchema.findOne({
                user: meId,
                messageId: messageId,
                messageType,
            }).populate({ path: 'user', select: '_id fullName avatar username' });

            let reactionData;

            if (isExistReaction) {
                isExistReaction.type = type;
                await isExistReaction.save();
                reactionData = isExistReaction;
            } else {
                reactionData = await ReactionSchema.create({
                    user: meId,
                    messageId,
                    messageType,
                    type,
                });

                if (!isExistMessage.reactions.includes(reactionData._id)) {
                    isExistMessage.reactions.push(reactionData._id);
                    await isExistMessage.save();
                }

                await reactionData.populate({ path: 'user', select: '_id fullName avatar username' });
            }

            res.status(Status.OK).json(successResponse(Status.OK, 'React successfully', reactionData));

            // ws send notification to all members in group
            const participants = await ParticipantSchema.find({ conversationId: isExistConversation._id }).select(
                'user',
            );
            const participantUserIds = new Set(participants.map((p) => p.user.toString()));
            const socket = ws.getWSS();
            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (
                        customClient.isAuthenticated &&
                        customClient.userId !== meId &&
                        participantUserIds.has(customClient.userId)
                    ) {
                        customClient.send(
                            JSON.stringify({
                                type: 'reaction',
                                data: {
                                    reaction: reactionData,
                                    messageId,
                                },
                            }),
                        );
                    }
                });
            }

            // ws send last message to all members in group
            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (customClient.isAuthenticated && participantUserIds.has(customClient.userId)) {
                        customClient.send(
                            JSON.stringify({
                                type: 'last-conversation',
                                data: {
                                    conversation: populatedConversation,
                                },
                            }),
                        );
                    }
                });
            }

            return;
        } catch (error) {
            next(error);
        }
    }

    async cancelReaction(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { reactionId } = req.params;

            const isExistReaction = await ReactionSchema.findById(reactionId);
            if (!isExistReaction) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Reaction not found'));
                return;
            }

            if (isExistReaction.user.toString() !== meId) {
                res.status(Status.UNAUTHORIZED).json(errorResponse(Status.UNAUTHORIZED, 'You are not reacted user'));
                return;
            }

            const Model = reactionModelMap[isExistReaction.messageType as ReactionMessageType] as Model<any>;

            const isExistMessage = await Model.findById(isExistReaction.messageId);
            if (!isExistMessage) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Message is not found'));
                return;
            }

            const isExistConversation = await ConversationSchema.findById(isExistMessage.conversationId);
            if (!isExistConversation) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Conversation not found'));
                return;
            }

            // Delete reaction from message's reactions array
            await Model.findByIdAndUpdate(isExistReaction.messageId, {
                $pull: { reactions: isExistReaction._id },
            });

            // Delete the reaction document
            let reactionData = await ReactionSchema.findByIdAndDelete(reactionId);

            res.status(Status.OK).json(successResponse(Status.OK, 'Delete reaction successfully', reactionData));

            // ws send notification to all members in group
            const participants = await ParticipantSchema.find({ conversationId: isExistConversation._id }).select(
                'user',
            );
            const participantUserIds = new Set(participants.map((p) => p.user.toString()));
            const socket = ws.getWSS();
            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (
                        customClient.isAuthenticated &&
                        customClient.userId !== meId &&
                        participantUserIds.has(customClient.userId)
                    ) {
                        customClient.send(
                            JSON.stringify({
                                type: 'cancel-reaction',
                                data: {
                                    cancelReaction: reactionData,
                                    cancelMessageId: isExistMessage._id,
                                },
                            }),
                        );
                    }
                });
            }

            return;
        } catch (error) {
            next(error);
        }
    }
}
export default new MessageController();
