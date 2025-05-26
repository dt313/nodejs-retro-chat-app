import bcrypt from 'bcrypt';

import { Request, Response, NextFunction } from 'express';
import ConversationSchema from '@/models/conversation.model';
import MessageSchema from '@/models/message.model';
import UserSchema from '@/models/user.model';
import ParticipantSchema from '@/models/participant.model';
import NotificationSchema from '@/models/notification.model';
import AttachmentSchema from '@/models/attachment.model';
import ImageAttachmentSchema from '@/models/images-attachment.model';

import { createParticipant } from '@/helper';
import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';
import { AuthRequest } from '@/types/auth-request';
import { conversationValidate } from '@/validation';
import { Model, Types } from 'mongoose';
import { storeImgToCloudinary } from '@/utils/cloudinary';
import ws from '@/configs/ws';
import CustomWebSocket from '@/types/web-socket';

class ConversationController {
    async createGroupConversation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            console.log('create conversation group');
            const meId = req.payload?.userId;
            const { name, password, type, description, rules } = req.body;
            let thumbnail = req.file as Express.Multer.File;

            const result = conversationValidate.createGroupConversation.safeParse({ ...req.body, meId });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            let newPassword = null;

            if (!!password) {
                const salt = await bcrypt.genSalt(10);
                newPassword = await bcrypt.hash(password, salt);
            }

            if (thumbnail && thumbnail.buffer) {
                const stream = await storeImgToCloudinary(thumbnail, 'conversation-thumbnails');
                thumbnail = (stream as any).secure_url;
                console.log(thumbnail);
            }

            const conversation = await ConversationSchema.create({
                isGroup: true,
                createdBy: meId,
                name,
                thumbnail,
                password: newPassword,
                isPrivate: !!password,
                description,
                rules,
                type,
            });

            // create participants
            const newParticipant = await createParticipant(meId, conversation._id, 'creator');
            if (!newParticipant) {
                next(errorResponse(Status.BAD_REQUEST, 'Failed to create participants'));
                return;
            }

            conversation.participants.push(newParticipant);
            await conversation.save();

            res.json(successResponse(Status.OK, 'Create group conversation successfully', conversation));
            return;
        } catch (error) {
            next(error);
        } finally {
        }
    }

    async getAllConversations(req: Request, res: Response, next: NextFunction) {
        try {
            const conversations = await ConversationSchema.find({ isDeleted: false });
            res.json(successResponse(Status.OK, 'Get all conversations successfully', conversations));
            return;
        } catch (error) {
            next(error);
        }
    }

    async getAllConversationsByName(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { name } = req.query || '';
            const searchName = typeof name === 'string' ? name : '';

            const participants = await ParticipantSchema.find({ user: meId, deletedAt: null });
            const joinedConversationIds = participants.map((p) => p.conversationId);

            // Get all conversations first
            const baseQuery = {
                isDeleted: false,
                $or: [{ _id: { $in: joinedConversationIds } }],
            };

            const conversations = await ConversationSchema.find(baseQuery)
                .populate('createdBy', '_id avatar username fullName')
                .populate({
                    path: 'participants',
                    populate: {
                        path: 'user',
                        select: '_id avatar username fullName',
                    },
                })
                .populate({
                    path: 'lastMessage.sender',
                    select: '_id avatar username fullName',
                })
                .sort({ 'lastMessage.sentAt': -1 });

            if (searchName) {
                // Filter conversations based on name search
                const filteredConversations = conversations.filter((conv) => {
                    // Match group name for group conversations
                    if (conv.isGroup && conv.name) {
                        if (conv.name.toLowerCase().includes(searchName.toLowerCase())) {
                            return true;
                        }
                    }
                    // Match participant name for 1-1 conversations
                    else if (!conv.isGroup) {
                        const otherParticipant = conv.participants.find(
                            (p: any) => p.user._id.toString() !== meId?.toString(),
                        ) as any;
                        if (otherParticipant) {
                            const fullName = otherParticipant.user.fullName.toLowerCase();
                            const username = otherParticipant.user.username.toLowerCase();
                            const searchTerm = searchName.toLowerCase();
                            return fullName.includes(searchTerm) || username.includes(searchTerm);
                        }
                    }
                    return false;
                });

                res.json(
                    successResponse(Status.OK, 'Get all conversations by name successfully', filteredConversations),
                );
            } else {
                res.json(successResponse(Status.OK, 'Get all conversations by name successfully', conversations));
            }
            return;
        } catch (error) {
            next(error);
        }
    }

    async getConversationById(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { conversationId } = req.params;
            const meId = req.payload?.userId;

            const result = conversationValidate.getConversationById.safeParse({ conversationId, meId });
            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const conversation = await ConversationSchema.findOne({
                _id: conversationId,
                isDeleted: false,
            })
                .populate({
                    path: 'participants',
                    populate: {
                        path: 'user',
                        select: '_id avatar username fullName email',
                    },
                })
                .populate({
                    path: 'pinnedMessage',
                    select: 'content sender',
                    populate: {
                        path: 'sender',
                        select: '_id avatar username fullName email',
                    },
                });

            const isParticipant = await ParticipantSchema.findOne({
                conversationId,
                user: meId,
            });

            if (!isParticipant) {
                res.status(Status.NOT_FOUND).json(
                    errorResponse(Status.NOT_FOUND, 'You are not member of this conversation'),
                );
                return;
            }

            if (!conversation) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Conversation not found'));
                return;
            }
            res.json(successResponse(Status.OK, 'Get conversation by id successfully', conversation));
        } catch (error) {
            next(error);
        }
    }

    async getConversationsByMe(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;

            const participants = await ParticipantSchema.find({ user: meId, deletedAt: null });

            const joinedConversationIds = participants.map((p) => p.conversationId);
            console.log('participants', joinedConversationIds.length);

            const conversations = await ConversationSchema.find({
                isDeleted: false,
                $or: [{ _id: { $in: joinedConversationIds } }],
            })
                .populate('createdBy', '_id avatar username fullName')
                .populate({
                    path: 'participants',
                    populate: {
                        path: 'user',
                        select: '_id avatar username fullName',
                    },
                })
                .populate({
                    path: 'lastMessage.sender',
                    select: '_id avatar username fullName',
                })
                .sort({ 'lastMessage.sentAt': -1 });

            console.log('conversations', conversations.length);

            res.json(successResponse(Status.OK, 'Get conversation by me successfully', conversations || []));
        } catch (error) {
            next(error);
        }
    }

    async getMessageOfConversationById(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { conversationId } = req.params;
            const meId = req.payload?.userId;

            const result = conversationValidate.getMessageOfConversationById.safeParse({ conversationId, meId });
            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            // pagination
            const { before, after, limit = 30 } = req.query;

            if (!conversationId) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation id is required'));
                return;
            }

            const conversation = await ConversationSchema.findOne({
                _id: conversationId,
                isDeleted: false,
            });

            if (!conversation) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Conversation is not found'));
                return;
            }

            const isParticipant = await ParticipantSchema.findOne({
                conversationId,
                user: meId,
            });

            if (!isParticipant) {
                res.status(Status.NOT_FOUND).json(
                    errorResponse(Status.NOT_FOUND, 'You are not member of this conversation'),
                );
                return;
            }

            interface MessageFilter {
                conversationId: string;
                createdAt?: { $lt?: string; $gt?: string; $gte?: string };
            }

            const filter: MessageFilter = { conversationId, createdAt: { $gte: isParticipant.jointAt.toISOString() } };

            if (before && typeof before === 'string') {
                filter.createdAt = { $lt: before, $gte: isParticipant.jointAt.toISOString() };
            }

            if (after && typeof after === 'string') {
                filter.createdAt = { $gt: after, $gte: isParticipant.jointAt.toISOString() };
            }

            const messages = await MessageSchema.find({ ...filter })
                .populate('sender', 'fullName avatar username')
                .populate({
                    path: 'attachments',
                    select: 'url name type size reactions isDeleted',
                    populate: {
                        path: 'reactions',
                        populate: {
                            path: 'user',
                            select: 'fullName firstName avatar username',
                        },
                    },
                })
                .populate({
                    path: 'images',
                    select: 'images reactions isDeleted',
                    populate: {
                        path: 'reactions',
                        populate: {
                            path: 'user',
                            select: 'fullName firstName avatar username',
                        },
                    },
                })
                .populate({
                    path: 'reactions',
                    populate: {
                        path: 'user',
                        select: 'fullName firstName avatar username',
                    },
                })
                .populate({
                    path: 'replyTo',
                    select: 'content sender',
                    populate: {
                        path: 'sender',
                        select: 'fullName firstName avatar username',
                    },
                })
                .sort(after ? { createdAt: 1 } : { createdAt: -1 })
                .limit(Number(limit));

            res.status(Status.OK).json(
                successResponse(Status.OK, 'Get message of conversation successfully', messages),
            );
        } catch (error) {
            next(error);
        }
    }

    async getOrCreateConversationWithSingleUser(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { withUserId } = req.params;

            const result = conversationValidate.getOrCreateConversation.safeParse({ meId, userId: withUserId });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const isExistUser = await UserSchema.findById(withUserId);

            if (!isExistUser) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User is not found'));
                return;
            }

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
                        memberIds: { $all: [new Types.ObjectId(meId), new Types.ObjectId(withUserId)] },
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

            if (conversation.length === 1) {
                // check if conversation is deleted

                const isParticipantDeleted = await ParticipantSchema.findOne({
                    conversationId: conversation[0]._id,
                    user: meId,
                    deletedAt: { $ne: null },
                });

                if (isParticipantDeleted) {
                    isParticipantDeleted.deletedAt = null;
                    isParticipantDeleted.jointAt = new Date();
                    await isParticipantDeleted.save();
                }
                res.status(Status.OK).json(
                    successResponse(Status.OK, 'Get conversation 1-1 successfully', conversation[0]),
                );
                return;
            } else {
                // create conversation 1-1

                const newConversation = await ConversationSchema.create({
                    createdBy: meId,
                });

                // create participants
                const meParticipant = await createParticipant(meId, newConversation._id, 'member');
                const userParticipant = await createParticipant(withUserId, newConversation._id, 'member');

                if (!meParticipant || !userParticipant) {
                    res.status(Status.BAD_REQUEST).json(
                        errorResponse(Status.BAD_REQUEST, 'Failed to create participant'),
                    );
                    return;
                }

                newConversation.participants.push(meParticipant);
                newConversation.participants.push(userParticipant);

                await newConversation.save();

                const populatedConversation = await ConversationSchema.findOne({
                    _id: newConversation._id,
                    isDeleted: false,
                })
                    .populate('createdBy', '_id username fullName avatar')
                    .populate({
                        path: 'participants',
                        populate: {
                            path: 'user',
                            select: '_id avatar username fullName',
                        },
                    });

                res.status(Status.CREATED).json(
                    successResponse(Status.CREATED, 'Conversation created successfully', populatedConversation),
                );
            }
        } catch (error) {
            next(error);
        }
    }

    async readLastMessage(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;

            const result = conversationValidate.readLastMessage.safeParse({ conversationId, meId });
            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const isExistConversation = await ConversationSchema.findOne({
                _id: conversationId,
                isDeleted: false,
            });

            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            const isParticipant = await ParticipantSchema.findOne({ user: meId, conversationId: isExistConversation });
            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not members in this conversation'),
                );
                return;
            }

            const lastMessage = await MessageSchema.findOne({ conversationId })
                .sort({ createdAt: -1 })
                .populate('attachments');
            console.log(lastMessage);

            const imageMessageId = lastMessage?.images ? lastMessage?.images._id : null;
            const attachmentId =
                lastMessage && lastMessage.attachments && lastMessage.attachments.length > 0
                    ? lastMessage.attachments[lastMessage.attachments.length - 1]._id
                    : null;

            // compare createdAt and select oldest one
            if (lastMessage?.content) {
                isParticipant.lastMessage = lastMessage._id;
            } else {
                const lastId = imageMessageId || attachmentId;
                if (lastId) {
                    isParticipant.lastMessage = lastId;
                }
            }
            isParticipant.lastMessageReadAt = new Date();
            await isParticipant.save();

            const lastMessageReadUser = isExistConversation.lastMessage?.readedBy;

            const isReadUser = lastMessageReadUser?.some((u) => u.toString() === meId);

            if (isReadUser) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are already read this message'),
                );
                return;
            }

            isExistConversation.lastMessage?.readedBy.push(new Types.ObjectId(meId));

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

            const participants = await ParticipantSchema.find({ conversationId }).select('user');
            const participantUserIds = new Set(participants.map((p) => p.user.toString()));

            // ws send message to all members in group
            const socket = ws.getWSS();
            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (customClient.isAuthenticated && participantUserIds.has(customClient.userId)) {
                        customClient.send(
                            JSON.stringify({
                                type: 'conversation-update',
                                data: {
                                    conversationId,
                                    conversation: populatedConversation,
                                },
                            }),
                        );
                    }
                });
            }

            res.status(Status.OK).json(
                successResponse(Status.OK, 'Read last message successfully', populatedConversation),
            );
        } catch (error) {
            next(error);
        }
    }

    async searchMessageOfConversation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;
            const { query } = req.query;

            const result = conversationValidate.searchMessageOfConversation.safeParse({
                conversationId,
                meId,
                query,
            });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const isExistConversation = await ConversationSchema.findOne({
                _id: conversationId,
                isDeleted: false,
            });
            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            const isParticipant = await ParticipantSchema.findOne({ user: meId, conversationId: isExistConversation });
            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not members in this conversation'),
                );
                return;
            }

            const messages = await MessageSchema.find({
                conversationId,
                messageType: { $in: ['text', 'text-file', 'text-image', 'text-image-file'] },
                content: { $regex: query, $options: 'i' },
                createdAt: { $gte: isParticipant.jointAt.toISOString() },
            })
                .populate('sender', '_id avatar username fullName')
                .sort({ createdAt: -1 });

            res.status(Status.OK).json(successResponse(Status.OK, 'Search message successfully', messages));
        } catch (error) {
            next(error);
        }
    }

    async deleteUserFromConversation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;
            const { userId } = req.body;

            const result = conversationValidate.deleteUserFromConversation.safeParse({
                conversationId,
                meId,
                userId,
            });
            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const isExistConversation = await ConversationSchema.findOne({
                _id: conversationId,
                isGroup: true,
                isDeleted: false,
            });

            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            const isParticipant = await ParticipantSchema.findOne({
                user: meId,
                conversationId: isExistConversation,
                role: { $in: ['creator', 'admin'] },
            }).populate('user', '_id avatar username fullName');

            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not creator or admin in this conversation'),
                );
                return;
            }

            const isDeleteParticipant = await ParticipantSchema.findOne({
                user: userId,
                conversationId: isExistConversation,
                role: { $ne: 'creator' },
            }).populate('user', '_id avatar username fullName');

            if (!isDeleteParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'User is not member of this conversation'),
                );
                return;
            }

            if (isDeleteParticipant.role === 'creator' && isParticipant.role === 'creator') {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Permission denied'));
                return;
            }

            if (
                isParticipant.role === 'admin' &&
                (isDeleteParticipant.role === 'admin' || isDeleteParticipant.role === 'creator')
            ) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Permission denied'));
                return;
            }

            if (isParticipant.user._id.toString() === isDeleteParticipant.user._id.toString()) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'You cannot kick yourself'));
                return;
            }

            await isDeleteParticipant.deleteOne();

            isExistConversation.participants = isExistConversation.participants.filter((p) => p.toString() !== userId);
            await isExistConversation.save();

            res.status(Status.OK).json(
                successResponse(Status.OK, 'Delete user from conversation successfully', isDeleteParticipant),
            );

            const notification = await NotificationSchema.create({
                user: userId,
                type: 'remove_from_conversation',
                group: isExistConversation._id,
                sender: meId,
            });

            const populatedNotification = await NotificationSchema.findOne({
                _id: notification._id,
            })
                .populate('sender', 'fullName avatar id username')
                .populate('user', 'fullName avatar id username')
                .populate('group', 'id name thumbnail');

            // send notification to user that they have been removed from the conversation
            const socket = ws.getWSS();

            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (customClient.isAuthenticated && customClient.userId === userId) {
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
        } catch (error) {
            next(error);
        }
    }

    async getMessageOfConversationByMessageId(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { conversationId, messageId } = req.params;

            const result = conversationValidate.getMessageOfConversationByMessageId.safeParse({
                conversationId,
                messageId,
            });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const isExistConversation = await ConversationSchema.findOne({
                _id: conversationId,
                isDeleted: false,
            });
            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            const schemaMap: Record<string, Model<any>> = {
                text: MessageSchema,
                file: AttachmentSchema,
                image: ImageAttachmentSchema,
            };

            // find message type
            let messageType: string | null = null;
            let isExistMessage = null;

            for (const [type, schema] of Object.entries(schemaMap)) {
                isExistMessage = await schema.findById(messageId);
                if (isExistMessage) {
                    messageType = type;
                    break;
                }
            }

            if (messageType === null) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Message is not found'));
                return;
            }

            let searchMessageId = null;
            const messagePopulateOptions = [
                { path: 'sender', select: 'fullName avatar username' },
                {
                    path: 'attachments',
                    select: 'url name type size reactions isDeleted',
                    populate: {
                        path: 'reactions',
                        populate: {
                            path: 'user',
                            select: 'fullName firstName avatar username',
                        },
                    },
                },
                {
                    path: 'images',
                    select: 'images reactions isDeleted',
                    populate: {
                        path: 'reactions',
                        populate: {
                            path: 'user',
                            select: 'fullName firstName avatar username',
                        },
                    },
                },
                {
                    path: 'reactions',
                    populate: {
                        path: 'user',
                        select: 'fullName firstName avatar username',
                    },
                },
                {
                    path: 'replyTo',
                    select: 'content sender',
                    populate: {
                        path: 'sender',
                        select: 'fullName firstName avatar username',
                    },
                },
            ];
            // find messageId if type is file or image
            if (messageType == 'text') {
                searchMessageId = isExistMessage._id;
                isExistMessage = await isExistMessage.populate(messagePopulateOptions);
            } else if (['file', 'image'].includes(messageType)) {
                const query = messageType === 'file' ? { attachments: messageId } : { images: messageId };
                isExistMessage = await MessageSchema.findOne(query).populate(messagePopulateOptions);

                console.log('isExistMessage', isExistMessage);
                if (isExistMessage) {
                    searchMessageId = isExistMessage._id;
                }
            } else {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid type'));
                return;
            }

            if (!searchMessageId) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Message is not found'));
                return;
            }

            //  Get 15 messages before and 15 messages after the message's createdAt timestamp
            const beforeMessages = await MessageSchema.find({
                conversationId,
                createdAt: { $lt: isExistMessage.createdAt },
            })
                .populate(messagePopulateOptions)
                .sort({ createdAt: -1 })
                .limit(15);

            const afterMessages = await MessageSchema.find({
                conversationId,
                createdAt: { $gt: isExistMessage.createdAt },
            })
                .populate(messagePopulateOptions)
                .sort({ createdAt: 1 })
                .limit(15);

            const messages = [...beforeMessages.reverse(), isExistMessage, ...afterMessages];

            res.status(Status.OK).json(successResponse(Status.OK, 'Search message successfully', messages));
        } catch (error) {
            next(error);
        }
    }

    async changeRoleParticipant(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;
            const { userId, role } = req.body;

            const result = conversationValidate.changeRoleParticipant.safeParse({
                conversationId,
                meId,
                userId,
                role,
            });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const isExistConversation = await ConversationSchema.findOne({
                _id: conversationId,
                isDeleted: false,
            });
            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            const isParticipant = await ParticipantSchema.findOne({
                user: meId,
                conversationId: isExistConversation,
                role: 'creator',
            });

            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not creator in this conversation'),
                );
                return;
            }

            const isChangeRoleParticipant = await ParticipantSchema.findOne({
                user: userId,
                conversationId: isExistConversation,
            });

            if (!isChangeRoleParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'User is not member of this conversation'),
                );
                return;
            }

            isChangeRoleParticipant.role = role;
            await isChangeRoleParticipant.save();

            res.status(Status.OK).json(
                successResponse(Status.OK, 'Change role participant successfully', isChangeRoleParticipant),
            );

            const notification = await NotificationSchema.create({
                user: userId,
                type: role === 'admin' ? 'change_admin_role' : 'change_member_role',
                group: isExistConversation._id,
                sender: meId,
            });

            const populatedNotification = await NotificationSchema.findOne({
                _id: notification._id,
            })
                .populate('sender', 'fullName avatar id username')
                .populate('user', 'fullName avatar id username')
                .populate('group', 'id name thumbnail');

            // send notification to user that they have been removed from the conversation
            const socket = ws.getWSS();

            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (customClient.isAuthenticated && customClient.userId === userId) {
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
        } catch (error) {
            next(error);
        }
    }

    async leaveConversation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;

            const result = conversationValidate.leaveConversation.safeParse({ conversationId, meId });
            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const isExistConversation = await ConversationSchema.findOne({
                _id: conversationId,
                isDeleted: false,
            });

            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            const isParticipant = await ParticipantSchema.findOne({
                user: meId,
                conversationId: isExistConversation,
            });

            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not member of this conversation'),
                );
                return;
            }

            // group conversation
            if (isExistConversation.isGroup) {
                if (isParticipant.role === 'creator') {
                    res.status(Status.BAD_REQUEST).json(
                        errorResponse(Status.BAD_REQUEST, 'You are creator of this conversation'),
                    );
                    return;
                }

                await isParticipant.deleteOne();

                isExistConversation.participants = isExistConversation.participants.filter(
                    (p) => p.toString() !== isParticipant._id.toString(),
                );

                await isExistConversation.save();

                res.status(Status.OK).json(
                    successResponse(Status.OK, 'Leave group conversation successfully', isParticipant),
                );

                // new message
                const newMessage = await MessageSchema.create({
                    conversationId: isExistConversation._id,
                    sender: meId,
                    content: 'group-left',
                    messageType: 'notification',
                });

                const populatedMessage = await newMessage.populate([
                    { path: 'sender', select: 'fullName avatar username' },
                ]);

                const participants = await ParticipantSchema.find({ conversationId: isExistConversation._id }).select(
                    'user',
                );
                const participantUserIds = new Set(participants.map((p) => p.user.toString()));

                const socket = ws.getWSS();
                if (socket) {
                    socket.clients.forEach((client) => {
                        const customClient = client as CustomWebSocket;
                        if (customClient.isAuthenticated && participantUserIds.has(customClient.userId)) {
                            customClient.send(
                                JSON.stringify({
                                    type: 'message',
                                    data: { message: populatedMessage, conversationId: isExistConversation._id },
                                }),
                            );
                        }
                    });
                }
            } else {
                isParticipant.deletedAt = new Date();
                await isParticipant.save();

                res.status(Status.OK).json(
                    successResponse(Status.OK, 'Leave conversation successfully', isParticipant),
                );
            }
        } catch (error) {
            next(error);
        }
    }

    async updateConversation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;
            const { type, value } = req.body;
            let img = req.file as Express.Multer.File;

            const result = conversationValidate.updateConversation.safeParse({
                conversationId,
                meId,
            });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            if (!type && (!img || !value)) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Type and value are required'));
                return;
            }

            const isExistConversation = await ConversationSchema.findOne({
                _id: conversationId,
                isDeleted: false,
            });
            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            if (isExistConversation.createdBy.toString() !== meId && isExistConversation.isGroup) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not creator of this conversation'),
                );
                return;
            }

            const isParticipant = await ParticipantSchema.findOne({
                user: meId,
                conversationId: isExistConversation,
            });

            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not member of this conversation'),
                );
                return;
            }

            let notificationContent = '';
            switch (type) {
                case 'name':
                    if (!isExistConversation.isGroup) {
                        res.status(Status.BAD_REQUEST).json(
                            errorResponse(Status.BAD_REQUEST, '1-1 conversation does not support name'),
                        );
                        return;
                    }
                    isExistConversation.name = value;
                    notificationContent = `group-name-updated`;
                    break;
                case 'backgroundUrl':
                    if (img) {
                        const stream = await storeImgToCloudinary(img, 'conversation-background');
                        isExistConversation.backgroundUrl = (stream as any).secure_url;
                        notificationContent = `background-url-updated`;
                    }
                    break;
                case 'nickname':
                    console.log('nickname', value);
                    if (isExistConversation.isGroup) {
                        res.status(Status.BAD_REQUEST).json(
                            errorResponse(Status.BAD_REQUEST, 'Group conversation does not support nickname'),
                        );
                        return;
                    }
                    const participants = await ParticipantSchema.find({
                        conversationId: isExistConversation._id,
                    }).populate('user', 'fullName avatar username');

                    for (const p of participants) {
                        if (p.user._id.toString() === meId) continue;
                        p.nickname = value;
                        await p.save();
                    }
                    notificationContent = `nickname-updated`;
                    break;

                case 'description':
                    if (!isExistConversation.isGroup) {
                        res.status(Status.BAD_REQUEST).json(
                            errorResponse(Status.BAD_REQUEST, '1-1 conversation does not support description'),
                        );
                        return;
                    }
                    isExistConversation.description = value;
                    notificationContent = `group-description-updated`;
                    break;
                case 'rules':
                    if (!isExistConversation.isGroup) {
                        res.status(Status.BAD_REQUEST).json(
                            errorResponse(Status.BAD_REQUEST, '1-1 conversation does not support rules'),
                        );
                        return;
                    }
                    isExistConversation.rules = value;
                    notificationContent = `group-rules-updated`;
                    break;
                case 'thumbnail':
                    if (!isExistConversation.isGroup) {
                        res.status(Status.BAD_REQUEST).json(
                            errorResponse(Status.BAD_REQUEST, '1-1 conversation does not support thumbnail'),
                        );
                        return;
                    }

                    if (img) {
                        const stream = await storeImgToCloudinary(img, 'conversation-thumbnails');
                        isExistConversation.thumbnail = (stream as any).secure_url;
                        notificationContent = `group-thumbnail-updated`;
                    }
                    break;
                case 'password':
                    if (!isExistConversation.isGroup) {
                        res.status(Status.BAD_REQUEST).json(
                            errorResponse(Status.BAD_REQUEST, '1-1 conversation does not support password'),
                        );
                        return;
                    }

                    const salt = await bcrypt.genSalt(10);
                    const newPassword = await bcrypt.hash(value, salt);

                    isExistConversation.password = newPassword;
                    isExistConversation.isPrivate = true;
                    notificationContent = `group-password-updated`;
                    break;

                case 'pinnedMessage':
                    if (value === 'null') {
                        isExistConversation.pinnedMessage = null;
                        notificationContent = `pinned-message-removed`;
                        break;
                    }
                    const pinnedMessage = await MessageSchema.findById(value);
                    if (!pinnedMessage) {
                        res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Message is not found'));
                        return;
                    }
                    isExistConversation.pinnedMessage = pinnedMessage._id;
                    notificationContent = `pinned-message-added`;
                    break;
                default:
                    res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid type'));
                    return;
            }

            const updatedConversation = await isExistConversation.save();
            const populatedConversation = await ConversationSchema.populate(updatedConversation, [
                {
                    path: 'pinnedMessage',
                    select: 'content sender',
                    populate: {
                        path: 'sender',
                        select: '_id avatar username fullName email',
                    },
                },
                {
                    path: 'participants',
                    populate: {
                        path: 'user',
                        select: '_id avatar username fullName email',
                    },
                },
            ]);

            if (notificationContent) {
                const newMessage = await MessageSchema.create({
                    conversationId: isExistConversation._id,
                    sender: meId,
                    content: notificationContent,
                    messageType: 'notification',
                });

                const populatedMessage = await newMessage.populate([
                    { path: 'sender', select: 'fullName avatar username' },
                ]);

                const participants = await ParticipantSchema.find({ conversationId: isExistConversation._id }).select(
                    'user',
                );
                const participantUserIds = new Set(participants.map((p) => p.user.toString()));

                const socket = ws.getWSS();
                if (socket) {
                    socket.clients.forEach((client) => {
                        const customClient = client as CustomWebSocket;
                        if (customClient.isAuthenticated && participantUserIds.has(customClient.userId)) {
                            customClient.send(
                                JSON.stringify({
                                    type: 'message',
                                    data: { message: populatedMessage, conversationId: isExistConversation._id },
                                }),
                            );
                        }
                    });
                }
            }

            res.status(Status.OK).json(
                successResponse(Status.OK, 'Update group conversation successfully', populatedConversation),
            );
        } catch (error) {
            next(error);
        }
    }

    async deleteGroupConversation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;

            const result = conversationValidate.deleteConversation.safeParse({ conversationId, meId });
            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const isExistConversation = await ConversationSchema.findOne({
                _id: conversationId,
                isDeleted: false,
            });
            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            if (isExistConversation.isGroup === false) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, '1-1 conversation does not support delete'),
                );
                return;
            }

            if (isExistConversation.createdBy.toString() !== meId) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not creator of this conversation'),
                );
                return;
            }

            isExistConversation.isDeleted = true;
            await isExistConversation.save();

            res.status(Status.OK).json(
                successResponse(Status.OK, 'Delete group conversation successfully', isExistConversation),
            );
        } catch (error) {
            next(error);
        }
    }
}
export default new ConversationController();
