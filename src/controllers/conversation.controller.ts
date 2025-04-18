import { Request, Response, NextFunction } from 'express';
import ConversationSchema from '@/models/conversation.model';
import { createParticipants, createParticipantsForGroup } from '@/helper';

import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';

class ConversationController {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { isGroup, name, avatar, description, rules, createdBy, participants: participantsReq } = req.body;
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
                    res.json(errorResponse(Status.BAD_REQUEST, 'Conversation already exists'));
                    return;
                }

                const newParticipants = await createParticipants(participantsReq);

                const conversation = await ConversationSchema.create({
                    isGroup,
                    createdBy,
                    participants: newParticipants,
                });

                res.json(successResponse(Status.OK, 'Create conversation successfully', conversation));
                return;
            } else {
                // group conversation
                console.log('create conversation group');

                const newParticipants = await createParticipantsForGroup(participantsReq, createdBy);

                const conversation = await ConversationSchema.create({
                    isGroup,
                    createdBy,
                    participants: newParticipants,
                    name,
                    avatar,
                    description,
                    rules,
                });

                res.json(successResponse(Status.OK, 'Create group conversation successfully', conversation));
                return;
            }

            res.json(successResponse(Status.OK, 'Create conversation successfully'));
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

    async getConversationById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const conversation = await ConversationSchema.findById(id);
            if (!conversation) {
                res.json(errorResponse(Status.NOT_FOUND, 'Conversation not found'));
                return;
            }
            res.json(successResponse(Status.OK, 'Get conversation by id successfully', conversation));
        } catch (error) {
            next(error);
        }
    }
}

export default new ConversationController();
