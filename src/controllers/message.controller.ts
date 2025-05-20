import { createParticipant, getMessageType } from '@/helper';
import ConversationSchema from '@/models/conversation.model';
import AttachmentSchema from '@/models/attachment.model';
import ImageAttachmentSchema from '@/models/images-attachment.model';
import MessageSchema from '@/models/message.model';
import ReactionSchema from '@/models/reaction.model';
import UserSchema from '@/models/user.model';

import { AuthRequest } from '@/types/auth-request';
import { Status } from '@/types/response';
import { successResponse, errorResponse } from '@/utils/response';
import mongoose, { Model, Types } from 'mongoose';
import { Response, NextFunction } from 'express';
import ws from '@/configs/ws';
import CustomWebSocket from '@/types/web-socket';
import ParticipantSchema from '@/models/participant.model';
import { storeFileToCloudinary, storeImgToCloudinary } from '@/utils/cloudinary';
import { messageValidate, reactionValidate } from '@/validation';
import { ReactionMessageType, reactionModelMap } from '@/utils/model-map';

class MessageController {
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;
            const { replyTo, replyType, content, isGroup } = req.body;
            const attachments = req.files as Express.Multer.File[]; // Cast to the correct type

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

            const isExistConversation = await ConversationSchema.findOne({
                _id: conversationId,
                isGroup,
                isDeleted: false,
            });

            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            // if user is not in conversation
            let isParticipant = await ParticipantSchema.findOne({ user: meId, conversationId });
            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not member of this conversation'),
                );
                return;
            }

            console.log('isGroup', isGroup);

            if (isGroup === 'false') {
                console.log('isGroup', isGroup);
                const participants = await ParticipantSchema.find({ conversationId, deletedAt: { $ne: null } });

                console.log('participants', participants);

                if (participants.length > 0) {
                    for (const participant of participants) {
                        participant.deletedAt = null;
                        participant.jointAt = new Date();
                        await participant.save();
                    }
                }
            }

            let newImages = null;
            // if message has attachments
            const newAttachments = new Set<Types.ObjectId>();
            if (attachments && attachments.length > 0) {
                // get all image types
                const files = attachments.filter((attachment) => !attachment.mimetype.startsWith('image/'));
                const images = attachments.filter((attachment) => attachment.mimetype.startsWith('image/'));
                if (files.length > 0) {
                    console.log('SAVE FILE');
                    for (const file of files) {
                        const stream = await storeFileToCloudinary(file, 'conversation-files');
                        const fileUrl = (stream as any).secure_url;
                        const fileName = (stream as any).public_id.split('/').pop();

                        console.log('fileName', fileName);

                        const newAttachment = await AttachmentSchema.create({
                            url: fileUrl,
                            name: fileName,
                            type: 'file',
                            size: file.size,
                            conversationId,
                            sender: meIdObjectId,
                        });
                        newAttachments.add(newAttachment._id);
                    }
                }
                if (images.length > 0) {
                    const imageUrls = new Set();
                    // save image to cloud
                    for (const image of images) {
                        const stream = await storeImgToCloudinary(image, 'conversation-images');
                        const imageUrl = (stream as any).secure_url;
                        const fileName = (stream as any).public_id.split('/').pop();
                        console.log('fileName', fileName);
                        imageUrls.add({
                            url: imageUrl,
                            size: image.size,
                            name: fileName,
                        });
                    }

                    newImages = await ImageAttachmentSchema.create({
                        images: Array.from(imageUrls),
                        conversationId,
                        sender: meIdObjectId,
                    });
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

            if (content) isParticipant.lastMessage = newMessage._id;
            else {
                const lastImageId = newImages?._id;
                const attachmentsArray = Array.from(newAttachments);
                const lastFileId =
                    attachmentsArray.length > 0 ? attachmentsArray[attachmentsArray.length - 1]._id : null;

                if (lastImageId) {
                    isParticipant.lastMessage = new mongoose.Types.ObjectId(lastImageId);
                } else if (lastFileId) {
                    isParticipant.lastMessage = lastFileId;
                }
            }

            isParticipant.lastMessageReadAt = new Date();
            await isParticipant.save();

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
            console.log('participantUserIds', participantUserIds);

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

            const isExistConversation = await ConversationSchema.findOne({
                _id: isExistMessage.conversationId,
                isDeleted: false,
            });
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

            if (isExistConversation.isGroup === false) {
                const participants = await ParticipantSchema.find({
                    conversationId: isExistConversation._id,
                    deletedAt: { $ne: null },
                });

                if (participants.length > 0) {
                    for (const participant of participants) {
                        participant.deletedAt = null;
                        participant.jointAt = new Date();
                        await participant.save();
                    }
                }
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

            // ws send reaction to all members in group
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

            console.log('reactionId', reactionId);

            const isExistReaction = await ReactionSchema.findById(reactionId);
            console.log('isExistReaction', isExistReaction);
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

            const isExistConversation = await ConversationSchema.findOne({
                _id: isExistMessage.conversationId,
                isDeleted: false,
            });
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

    async forwardMessage(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { messageId } = req.params;
            const { friendId, messageType } = req.body;

            const result = messageValidate.forwardMessage.safeParse({
                meId,
                messageId,
                friendId,
            });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation error', result.error),
                );
                return;
            }

            const isExistFriend = await UserSchema.findById(friendId);
            if (!isExistFriend) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Friend not found'));
                return;
            }

            // find conversation between me and friend by participant of me and friend
            const conversation = await ConversationSchema.aggregate([
                { $match: { isGroup: false, isDeleted: false } },
                {
                    $lookup: {
                        from: 'participants',
                        localField: '_id',
                        foreignField: 'conversationId',
                        as: 'members',
                    },
                },
                {
                    $addFields: {
                        memberIds: {
                            $map: {
                                input: '$members',
                                as: 'm',
                                in: '$$m.user',
                            },
                        },
                    },
                },
                {
                    $match: {
                        memberIds: { $all: [new Types.ObjectId(meId), new Types.ObjectId(friendId)] },
                        $expr: { $eq: [{ $size: '$memberIds' }, 2] },
                    },
                },
            ]);

            if (conversation.length > 1) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Failed to get or create conversation'),
                );
                return;
            }

            let newConversation = null;
            if (conversation.length === 1) {
                newConversation = conversation[0];

                const participants = await ParticipantSchema.find({
                    conversationId: newConversation._id,
                    deletedAt: { $ne: null },
                });

                if (participants.length > 0) {
                    for (const participant of participants) {
                        participant.deletedAt = null;
                        participant.jointAt = new Date();
                        await participant.save();
                    }
                }
            } else {
                // create conversation 1-1
                newConversation = await ConversationSchema.create({
                    createdBy: meId,
                });

                // create participants
                const meParticipant = await createParticipant(meId, newConversation._id, 'member');
                const userParticipant = await createParticipant(friendId, newConversation._id, 'member');

                if (!meParticipant || !userParticipant) {
                    res.status(Status.BAD_REQUEST).json(
                        errorResponse(Status.BAD_REQUEST, 'Failed to create participant'),
                    );
                    return;
                }

                newConversation.participants.push(meParticipant);
                newConversation.participants.push(userParticipant);
                await newConversation.save();
            }

            let newAttachments: any[] = [];

            if (messageType === 'file') {
                const isAttachment = await AttachmentSchema.findById(messageId);
                // copy attachment to new conversation
                if (isAttachment) {
                    const newAttachment = await AttachmentSchema.create({
                        ...isAttachment.toObject(),
                        _id: new Types.ObjectId(),
                        conversationId: newConversation._id,
                        sender: meId,
                        reactions: [],
                        isDeleted: false,
                    });
                    newAttachments.push(newAttachment);
                }
            }

            let newImageAttachmentId = null;
            if (messageType === 'image') {
                const oldImage = await ImageAttachmentSchema.findById(messageId);
                console.log('oldImage', oldImage);

                if (oldImage) {
                    const newImageAttachment = await ImageAttachmentSchema.create({
                        images: oldImage.images,
                        conversationId: newConversation._id,
                        sender: meId,
                        reactions: [],
                        isDeleted: false,
                    });

                    console.log('newImageAttachment', newImageAttachment);
                    newImageAttachmentId = newImageAttachment._id;
                }
            }

            let newContent = '';
            if (messageType === 'text') {
                const isExistMessage = await MessageSchema.findById(messageId);
                newContent = isExistMessage?.content || '';
            }

            // Tạo message mới
            const forwardedMessage = await MessageSchema.create({
                conversationId: newConversation._id,
                sender: meId,
                content: newContent,
                messageType: getMessageType({
                    content: !!newContent,
                    file: newAttachments.length > 0,
                    image: !!newImageAttachmentId,
                }),
                attachments: newAttachments,
                images: newImageAttachmentId,
                isForwarded: true,
            });

            console.log('forwardedMessage', forwardedMessage);

            res.status(Status.OK).json(successResponse(Status.OK, 'Forward message successfully', forwardedMessage));

            const participants = await ParticipantSchema.find({ conversationId: newConversation._id }).select('user');
            const participantUserIds = new Set(participants.map((p) => p.user.toString()));
            // ws send message to all members in group

            const populatedMessage = await forwardedMessage.populate([
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
            const socket = ws.getWSS();
            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (customClient.isAuthenticated && participantUserIds.has(customClient.userId)) {
                        customClient.send(
                            JSON.stringify({
                                type: 'message',
                                data: {
                                    message: populatedMessage,
                                    conversationId: newConversation._id,
                                },
                            }),
                        );
                    }
                });
            }

            newConversation.lastMessage = {
                content: populatedMessage.content || '',
                type: populatedMessage.messageType || 'text',
                sender: new Types.ObjectId(meId),
                sentAt: new Date(),
                readedBy: [new Types.ObjectId(meId)],
            };

            const savedConversation = await ConversationSchema.findOneAndUpdate(
                { _id: newConversation._id, isDeleted: false },
                { lastMessage: newConversation.lastMessage },
                { new: true },
            );

            if (!savedConversation) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Conversation not found'));
                return;
            }

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
        } catch (error) {
            next(error);
        }
    }

    async deleteMessage(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { type, messageId } = req.params;

            const getType = (type: string) => {
                if (type === 'text') {
                    return MessageSchema;
                }

                if (type === 'file') {
                    return AttachmentSchema;
                }

                if (type === 'image') {
                    return ImageAttachmentSchema;
                }
            };

            const Model = getType(type) as Model<any>;

            const isExistMessage = await Model.findById(messageId);
            if (!isExistMessage) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Message not found'));
                return;
            }

            if (isExistMessage.sender.toString() !== meId) {
                res.status(Status.UNAUTHORIZED).json(
                    errorResponse(Status.UNAUTHORIZED, 'You are not the sender of this message'),
                );
                return;
            }

            const isExistConversation = await ConversationSchema.findOne({
                _id: isExistMessage.conversationId,
                isDeleted: false,
            });
            if (!isExistConversation) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Conversation not found'));
                return;
            }

            if (isExistConversation.isGroup === false) {
                if (isExistConversation.isGroup === false) {
                    const participants = await ParticipantSchema.find({
                        conversationId: isExistConversation._id,
                        deletedAt: { $ne: null },
                    });

                    if (participants.length > 0) {
                        for (const participant of participants) {
                            participant.deletedAt = null;
                            participant.jointAt = new Date();
                            await participant.save();
                        }
                    }
                }
            }

            isExistMessage.isDeleted = true;
            await isExistMessage.save();

            isExistConversation.lastMessage = {
                content: '',
                type: 'delete',
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
            // send notification to all members in conversation
            const participants = await ParticipantSchema.find({ conversationId: isExistConversation._id }).select(
                'user',
            );
            const participantUserIds = new Set(participants.map((p) => p.user.toString()));

            const socket = ws.getWSS();
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

            res.status(Status.OK).json(successResponse(Status.OK, 'Message deleted successfully', isExistMessage));
        } catch (error) {
            next(error);
        }
    }
}

export default new MessageController();
