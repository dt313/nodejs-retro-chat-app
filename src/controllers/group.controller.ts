import { Request, Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';

import ConversationSchema from '@/models/conversation.model';
import UserSchema from '@/models/user.model';
import ParticipantSchema from '@/models/participant.model';
import GroupInvitationSchema from '@/models/group-invitation.model';
import { Status } from '@/types/response';
import { AuthRequest } from '@/types/auth-request';
import { verifyPassword } from '@/helper';
import { groupValidate } from '@/validation';
import { errorResponse, successResponse } from '@/utils/response';

import { senJoinGroupNotification } from '@/utils/ws-send-notification';
import { createParticipant } from '@/helper';
import { getUserIdFromAccessToken } from '@/helper/jwt';

class GroupController {
    async getAllGroups(req: Request, res: Response, next: NextFunction) {
        try {
            let meId = null;
            const authHeader = req.headers['authorization'];
            const token = authHeader?.split(' ')[1];

            if (token) {
                meId = await getUserIdFromAccessToken(token);
            }

            let groups = await ConversationSchema.find({ isGroup: true, isDeleted: false }).select(
                '-password -lastMessage -isDeleted -createdAt -__v -password -updatedAt -deletedBy',
            );

            const groupIds = groups.map((g) => g._id);

            if (meId) {
                const myParticipants = await ParticipantSchema.find({
                    user: meId,
                    conversationId: { $in: groupIds },
                });

                const myGroupIds = new Set(myParticipants.map((p) => p.conversationId.toString()));

                groups = groups.map((group: any) => {
                    return {
                        ...(group.toObject?.() ?? group),
                        isJoined: myGroupIds.has(group._id.toString()),
                    };
                });
            }

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
                isValidPassword = await verifyPassword(password, group.password);
                if (!isValidPassword) {
                    res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Group password wrong'));
                    return;
                }
            }

            const isExistParticipant = await ParticipantSchema.findOne({
                user: meId,
                conversationId: group._id,
            });

            if (isExistParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are already in this group chat'),
                );
                return;
            }

            console.log('participant ', meId, group._id);
            const newParticipant = await createParticipant(meIdObjectId, group._id, 'member');

            if (!newParticipant) {
                next(errorResponse(Status.BAD_REQUEST, 'Create participant failed'));
                return;
            }

            group.participants.push(newParticipant);
            await group.save();

            // notification to admin
            await senJoinGroupNotification({
                fromId: meId.toString(),
                toId: group.createdBy.toString(),
                type: 'group_joined',
                groupId: group._id.toString(),
            });

            res.status(Status.OK).json(successResponse(Status.OK, 'Joined group successfully', group));
        } catch (error) {
            next(error);
        }
    }

    async getInvitationUsers(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { groupId } = req.params;
            const { name } = req.query;
            const meId = req.payload?.userId;

            const query = name
                ? {
                      $or: [
                          { fullName: { $regex: name, $options: 'i' } },
                          { username: { $regex: name, $options: 'i' } },
                      ],
                  }
                : {};

            if (!meId) {
                res.status(Status.UNAUTHORIZED).json(errorResponse(Status.UNAUTHORIZED, 'User not authenticated'));
                return;
            }

            const isGroupExist = await ConversationSchema.findOne({ _id: groupId, isGroup: true });
            if (!isGroupExist) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Group not found'));
                return;
            }

            const participants = await ParticipantSchema.find({ conversationId: groupId });
            const participantIds = participants.map((p) => p.user.toString());

            const isParticipant = participantIds.includes(meId);

            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'You are not in this group'));
                return;
            }

            const users = await UserSchema.find({ _id: { $nin: participantIds }, ...query }).select(
                'avatar fullName username',
            );

            // Get all pending invitations for this group
            const pendingInvitations = await GroupInvitationSchema.find({
                conversationId: groupId,
                status: 'pending',
                sender: meId,
            });

            // Add invitationRequested field to each user
            const usersWithInvitationStatus = users.map((user) => {
                const hasInvitation = pendingInvitations.some(
                    (invite) => invite.invitedTo.toString() === user._id.toString(),
                );

                return {
                    ...user.toObject(),
                    isRequested: hasInvitation,
                };
            });

            res.status(Status.OK).json(
                successResponse(Status.OK, 'Invitation users fetched successfully', usersWithInvitationStatus),
            );
        } catch (error) {
            next(error);
        }
    }

    async getMembersOfGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const { groupId } = req.params;
            const { name } = req.query;

            const query = name
                ? {
                      $or: [
                          { fullName: { $regex: name, $options: 'i' } },
                          { username: { $regex: name, $options: 'i' } },
                      ],
                  }
                : {};

            const group = await ConversationSchema.findOne({ _id: groupId, isGroup: true });
            if (!group) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Group not found'));
                return;
            }

            const participants = await ParticipantSchema.find({
                conversationId: groupId,
            }).populate({
                path: 'user',
                match: query,
                select: '_id avatar username fullName',
            });

            const filteredParticipants = participants.filter((p) => p.user);

            res.status(Status.OK).json(
                successResponse(Status.OK, 'Members of group fetched successfully', filteredParticipants),
            );
        } catch (error) {
            next(error);
        }
    }
}
export default new GroupController();
