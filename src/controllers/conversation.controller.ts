import bcrypt from 'bcrypt';

import { Request, Response, NextFunction } from 'express';
import ConversationSchema from '@/models/conversation.model';
import MessageSchema from '@/models/message.model';
import UserSchema from '@/models/user.model';
import ParticipantSchema from '@/models/participant.model';

import { createParticipant } from '@/helper';
import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';
import { AuthRequest } from '@/types/auth-request';
import { conversationValidate } from '@/validation';
import { Types } from 'mongoose';
import { storeImgToCloudinary } from '@/utils/cloudinary';

class ConversationController {
    async createGroupConversation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const me = req.payload?.userId;
            const { name, password, type, description, rules } = req.body;
            let thumbnail = req.file as Express.Multer.File;

            // group conversation
            console.log('create conversation group');

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
                createdBy: me,
                name,
                thumbnail,
                password: newPassword,
                isPrivate: !!password,
                description,
                rules,
                type,
            });

            // create participants
            const newParticipant = await createParticipant(me, conversation._id, 'creator');
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
            const conversations = await ConversationSchema.find({});
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

            const participants = await ParticipantSchema.find({ user: meId });
            const joinedConversationIds = participants.map((p) => p.conversationId);

            console.log('name', name, joinedConversationIds);

            // Get all conversations first
            const baseQuery = {
                isDeleted: false,
                $or: [{ createdBy: meId }, { _id: { $in: joinedConversationIds } }],
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

            const conversation = await ConversationSchema.findById(conversationId).populate({
                path: 'participants',
                populate: {
                    path: 'user',
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

            const participants = await ParticipantSchema.find({ user: meId });

            const joinedConversationIds = participants.map((p) => p.conversationId);

            const conversations = await ConversationSchema.find({
                isDeleted: false,
                $or: [{ createdBy: meId }, { _id: { $in: joinedConversationIds } }],
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

            res.json(successResponse(Status.OK, 'Get conversation by id successfully', conversations || []));
        } catch (error) {
            next(error);
        }
    }

    async getMessageOfConversationById(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { conversationId } = req.params;
            const meId = req.payload?.userId;

            if (!conversationId) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation id is required'));
                return;
            }

            const conversation = await ConversationSchema.findById(conversationId);

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

            const messages = await MessageSchema.find({ conversationId })
                .populate('sender', 'fullName avatar username')
                .populate({
                    path: 'attachments',
                    select: 'url name type size reactions',
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
                    select: 'images reactions',
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
                .sort({ createdAt: 1 });

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

            console.log('conversation ', conversation);

            if (conversation.length > 1) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Failed to get or create conversation'),
                );
                return;
            }

            if (conversation.length === 1) {
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

                const populatedConversation = await ConversationSchema.findById(newConversation._id)
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

            const isExistConversation = await ConversationSchema.findById(conversationId);
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

            const lastMessageReadUser = isExistConversation.lastMessage?.readedBy;

            const isReadUser = lastMessageReadUser?.some((u) => u.toString() === meId);

            if (isReadUser) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are already read this message'),
                );
                return;
            }

            isExistConversation.lastMessage?.readedBy.push(new Types.ObjectId(meId));
            await isExistConversation.save();
            res.status(Status.OK).json(successResponse(Status.OK, 'Read last message successfully', true));
        } catch (error) {
            next(error);
        }
    }

    async searchMessageOfConversation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;
            const { query } = req.query;

            if (!query) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Query is required'));
                return;
            }

            const isExistConversation = await ConversationSchema.findById(conversationId);
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
            })
                .populate('sender', '_id avatar username fullName')
                .sort({ createdAt: -1 });

            res.status(Status.OK).json(successResponse(Status.OK, 'Search message successfully', messages));
        } catch (error) {
            next(error);
        }
    }
}

export default new ConversationController();
