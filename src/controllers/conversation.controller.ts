import bcrypt from 'bcrypt';

import { Request, Response, NextFunction } from 'express';
import ConversationSchema from '@/models/conversation.model';
import MessageSchema from '@/models/message.model';
import { createParticipants, createParticipantsForGroup } from '@/helper';

import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';
import { AuthRequest } from '@/types/auth-request';

class ConversationController {
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const me = req.payload?.userId;

            const {
                isGroup,
                name,
                thumbnail,
                password,
                type,
                description,
                rules,
                participants: participantsReq,
            } = req.body;
            // 1-1 conversation
            if (!isGroup) {
                console.log('create conversation 1-1');

                // check if conversation already exists
                const isExist = await ConversationSchema.findOne({
                    isGroup: false,
                    participants: { $all: participantsReq },
                    isDeleted: false,
                    $expr: {
                        $eq: [{ $size: '$participants' }, participantsReq.length],
                    },
                });

                if (isExist) {
                    res.status(Status.BAD_REQUEST).json(
                        errorResponse(Status.BAD_REQUEST, 'Conversation already exists'),
                    );
                    return;
                }

                const newParticipants = await createParticipants(participantsReq);

                const conversation = await ConversationSchema.create({
                    isGroup,
                    createdBy: me,
                    participants: newParticipants,
                });

                res.json(successResponse(Status.OK, 'Create conversation successfully', conversation));
                return;
            } else {
                // group conversation
                console.log('create conversation group');

                const newParticipants = await createParticipantsForGroup([me], me);

                let newPassword = null;

                if (thumbnail) {
                    // handle store image
                }

                if (!!password) {
                    const salt = await bcrypt.genSalt(10);
                    newPassword = await bcrypt.hash(password, salt);
                }

                const conversation = await ConversationSchema.create({
                    isGroup,
                    createdBy: me,
                    participants: newParticipants,
                    name,
                    thumbnail,
                    password: newPassword,
                    isPrivate: !!password,
                    description,
                    rules,
                    type,
                });

                res.json(successResponse(Status.OK, 'Create group conversation successfully', conversation));
                return;
            }
        } catch (error) {
            next(error);
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

            const conversation = await ConversationSchema.findById(conversationId);
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
            const conversation = await ConversationSchema.find({
                $or: [
                    {
                        createdBy: meId,
                    },
                    {
                        participants: { $in: [meId] },
                    },
                ],
            });
            if (!conversation) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Conversation not found', []));
                return;
            }

            res.json(successResponse(Status.OK, 'Get conversation by id successfully', conversation || []));
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
}

export default new ConversationController();
