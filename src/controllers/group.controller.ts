import { Request, Response, NextFunction } from 'express';
import ConversationSchema from '@/models/conversation.model';
import UserSchema from '@/models/user.model';
import GroupInvitationSchema from '@/models/group-invitation.model';
import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';

import { groupValidate } from '@/validation';

class GroupController {
    async getAllGroups(req: Request, res: Response, next: NextFunction) {
        try {
            const groups = await ConversationSchema.find({ isGroup: true });
            res.json(successResponse(Status.OK, 'Groups fetched successfully', groups));
        } catch (error) {
            next(error);
        }
    }

    async getGroupById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const group = await ConversationSchema.findOne({ _id: id, isGroup: true });

            if (!group) {
                res.json(errorResponse(Status.NOT_FOUND, 'Group not found'));
                return;
            }
            res.json(successResponse(Status.OK, 'Group fetched successfully', group));
        } catch (error) {
            next(error);
        }
    }

    async joinGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { userId } = req.body;

            const result = groupValidate.joinGroup.safeParse({ userId, groupId: id });

            if (!result.success) {
                res.json(errorResponse(Status.BAD_REQUEST, 'Invalid request', result.error));
                return;
            }

            const user = await UserSchema.findOne({
                _id: userId,
            });

            if (!user) {
                res.json(errorResponse(Status.NOT_FOUND, 'User not found'));
                return;
            }

            const group = await ConversationSchema.findOne({
                _id: id,
                isGroup: true,
            });

            if (!group) {
                res.json(errorResponse(Status.NOT_FOUND, 'Group not found'));
                return;
            }

            if (group.participants.includes(userId)) {
                res.json(errorResponse(Status.FORBIDDEN, 'You are already a member of this group'));
                return;
            }

            group.participants.push(userId);
            await group.save();

            res.json(successResponse(Status.OK, 'Joined group successfully', group));
        } catch (error) {
            next(error);
        }
    }
}
export default new GroupController();
