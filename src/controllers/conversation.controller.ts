import bcrypt from 'bcrypt';

import { Request, Response, NextFunction } from 'express';
import ConversationSchema from '@/models/conversation.model';
import MessageSchema from '@/models/message.model';
import UserSchema from '@/models/user.model';
import ParticipantSchema from '@/models/participant.model';

import { createParticipant, createParticipants } from '@/helper';
import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';
import { AuthRequest } from '@/types/auth-request';
import { conversationValidate } from '@/validation';
import { Types } from 'mongoose';
import cloudinary from '@/configs/cloudinary';

class ConversationController {
    async createGroupConversation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const me = req.payload?.userId;
            const { name, password, type, description, rules, participants: participantsReq } = req.body;
            let thumbnail = req.file as Express.Multer.File;

            // group conversation
            console.log('create conversation group');

            let newPassword = null;

            if (!!password) {
                const salt = await bcrypt.genSalt(10);
                newPassword = await bcrypt.hash(password, salt);
            }

            if (thumbnail && thumbnail.buffer) {
                const stream = await new Promise((resolve, reject) => {
                    cloudinary.v2.uploader
                        .upload_stream(
                            {
                                folder: 'conversation-thumbnail',
                                resource_type: 'image',
                            },
                            (error, result) => {
                                if (error) {
                                    reject(error);
                                } else {
                                    resolve(result);
                                }
                            },
                        )
                        .end(thumbnail.buffer);
                });
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

    async getConversationById(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { conversationId } = req.params;

            const conversation = await ConversationSchema.findById(conversationId).populate({
                path: 'participants',
                populate: {
                    path: 'user',
                    select: '_id avatar username fullName',
                },
            });

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
                .populate('lastMessage', 'content createdAt');

            res.json(successResponse(Status.OK, 'Get conversation by id successfully', conversations || []));
        } catch (error) {
            next(error);
        }
    }

    async getMessageOfConversationById(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { conversationId } = req.params;

            console.log('conversation : ', conversationId, !conversationId);

            if (!conversationId) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation id is required'));
                return;
            }

            const conversation = await ConversationSchema.findById(conversationId);

            if (!conversation) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Conversation is not found'));
                return;
            }

            const messages = await MessageSchema.find({ conversationId })
                .populate('sender', 'fullName avatar id username')
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
        } finally {
        }
    }
}

export default new ConversationController();
