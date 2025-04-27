import { Request, Response, NextFunction } from 'express';
import ConversationSchema from '@/models/conversation.model';
import UserSchema from '@/models/user.model';
import { createParticipants, createParticipantsForGroup } from '@/helper';

import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';
import { AuthRequest } from '@/types/auth-request';

class ConversationController {
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const me = req.payload?.userId;

            const { isGroup, name, avatar, type, description, rules, participants: participantsReq } = req.body;
            // 1-1 conversation
            if (!isGroup && participantsReq.length === 2) {
                console.log('create conversation 1-1');

                // check if conversation already exists
                const isExist = await ConversationSchema.findOne({
                    isGroup: false,
                    participants: { $all: participantsReq },
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

                const conversation = await ConversationSchema.create({
                    isGroup,
                    createdBy: me,
                    participants: newParticipants,
                    name,
                    avatar,
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
            const { id } = req.params;

            const conversation = await ConversationSchema.findById(id);
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
            const me = req.payload?.userId;

            const conversation = await ConversationSchema.find({ createdBy: me });
            if (!conversation) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Conversation not found', []));
                return;
            }

            res.json(successResponse(Status.OK, 'Get conversation by id successfully', conversation || []));
        } catch (error) {
            next(error);
        }
    }
}

export default new ConversationController();
