import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';

import ConversationSchema from '@/models/conversation.model';
import UserSchema from '@/models/user.model';

import { Status } from '@/types/response';
import { AuthRequest } from '@/types/auth-request';
import { verifyPassword } from '@/helper';
import { groupValidate } from '@/validation';
import { errorResponse, successResponse } from '@/utils/response';

import { senJoinGroupNotification } from '@/utils/ws-send-notification';

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
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Group not found'));
                return;
            }
            res.json(successResponse(Status.OK, 'Group fetched successfully', group));
        } catch (error) {
            next(error);
        }
    }

    async joinGroup(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { groupId } = req.params;
            const meId = req.payload?.userId;

            if (!meId) {
                res.status(Status.UNAUTHORIZED).json(errorResponse(Status.UNAUTHORIZED, 'User not authenticated'));
                return;
            }

            const password = req.body?.password || null;
            const meIdObjectId = new Types.ObjectId(meId);

            const result = groupValidate.joinGroup.safeParse({ userId: meId, groupId });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid request', result.error));
                return;
            }

            const user = await UserSchema.findOne({
                _id: meIdObjectId,
            });

            if (!user) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User not found'));
                return;
            }

            const group = await ConversationSchema.findOne({
                _id: groupId,
                isGroup: true,
            });

            if (!group) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Group not found'));
                return;
            }

            let isValidPassword = !group.isPrivate;
            if (group.isPrivate) {
                console.log(password);
                isValidPassword = await verifyPassword(password, group.password);
                if (!isValidPassword) {
                    res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Group password wrong'));
                    return;
                }
            }

            if (isValidPassword && group.participants.includes(meIdObjectId)) {
                res.status(Status.FORBIDDEN).json(
                    errorResponse(Status.FORBIDDEN, 'You are already a member of this group'),
                );
                return;
            }

            group.participants.push(meIdObjectId);
            await group.save();

            // notification to admin
            await senJoinGroupNotification({
                fromId: meId.toString(),
                toId: group.createdBy.toString(),
                type: 'group_joined',
                groupId: group._id.toString(),
            });

            res.json(successResponse(Status.OK, 'Joined group successfully', group));
        } catch (error) {
            next(error);
        }
    }
}
export default new GroupController();
