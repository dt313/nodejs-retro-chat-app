import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';

import ConversationSchema from '@/models/conversation.model';
import UserSchema from '@/models/user.model';
import ParticipantSchema from '@/models/participant.model';
import GroupInvitationSchema from '@/models/group-invitation.model';
import MessageSchema from '@/models/message.model';
import { Status } from '@/types/response';
import { AuthRequest } from '@/types/auth-request';
import { verifyPassword } from '@/helper';
import { groupValidate } from '@/validation';
import { errorResponse, successResponse } from '@/utils/response';

import { senJoinGroupNotification } from '@/utils/ws-send-notification';
import { createParticipant } from '@/helper';
import { getUserIdFromAccessToken } from '@/helper/jwt';
import ws from '@/configs/ws';
import CustomWebSocket from '@/types/web-socket';
import FriendshipSchema from '@/models/friendship.model';
import FriendRequestSchema from '@/models/friend-request.model';

class GroupController {
    async getAllGroups(req: Request, res: Response, next: NextFunction) {
        try {
            let meId = null;
            const authHeader = req.headers['authorization'];
            const token = authHeader?.split(' ')[1];

            const { q, page = 1 } = req.query;
            const limit = 30;
            const skip = (Number(page) - 1) * Number(limit);

            if (token) {
                meId = await getUserIdFromAccessToken(token);
            }

            let groups = await ConversationSchema.find({
                isGroup: true,
                isDeleted: false,
                $or: [{ name: { $regex: q, $options: 'i' } }],
            })
                .select(
                    '-password -lastMessage -isDeleted -__v -password -deletedBy -description -rules -theme -backgroundUrl ',
                )
                .skip(skip)
                .limit(Number(limit))
                .populate({
                    path: 'participants',
                    select: 'user role',
                    populate: {
                        path: 'user',
                        select: 'fullName avatar username',
                    },
                });

            const groupIds = groups.map((g) => g._id);

            if (meId) {
                const myParticipants = await ParticipantSchema.find({
                    user: meId,
                    conversationId: { $in: groupIds },
                });

                const myGroupIds = new Set(myParticipants.map((p) => p.conversationId.toString()));

                const pendingInvitations = await GroupInvitationSchema.find({
                    invitedTo: meId,
                    status: 'pending',
                });

                const invitedGroupIds = new Set(pendingInvitations.map((invite) => invite.conversationId.toString()));

                groups = groups.map((group: any) => {
                    return {
                        ...(group.toObject?.() ?? group),
                        isJoined: myGroupIds.has(group._id.toString()),
                        isInvited: invitedGroupIds.has(group._id.toString()),
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
            const result = groupValidate.getGroupById.safeParse({ groupId: id });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const group = await ConversationSchema.findOne({ _id: id, isGroup: true }).select(
                'name description rules avatar createdBy participants isPrivate createdAt',
            );

            const authHeader = req.headers['authorization'];
            const token = authHeader?.split(' ')[1];
            let meId = null;

            if (token) {
                meId = await getUserIdFromAccessToken(token);
            }

            if (!group) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Không tìm thấy nhóm'));
                return;
            }

            const members = await ParticipantSchema.find({ conversationId: id, deletedAt: null });

            const isMember = members.some((m) => m.user.toString() === meId);

            const isRequested = await GroupInvitationSchema.findOne({
                conversationId: id,
                invitedTo: meId,
                status: 'pending',
            });

            res.json(
                successResponse(Status.OK, 'Group fetched successfully', {
                    ...group.toObject(),
                    members: members.length,
                    isMember,
                    isRequested: !!isRequested,
                }),
            );
        } catch (error) {
            next(error);
        }
    }

    async joinGroup(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { groupId } = req.params;
            const meId = req.payload?.userId;

            const result = groupValidate.joinGroup.safeParse({ userId: meId, groupId });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            if (!meId) {
                res.status(Status.UNAUTHORIZED).json(errorResponse(Status.UNAUTHORIZED, 'Bạn chưa đăng nhập'));
                return;
            }

            const password = req.body?.password || null;
            const meIdObjectId = new Types.ObjectId(meId);

            const user = await UserSchema.findOne({
                _id: meIdObjectId,
            });

            if (!user) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Không tìm thấy người dùng'));
                return;
            }

            const group = await ConversationSchema.findOne({
                _id: groupId,
                isGroup: true,
            });

            if (!group) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Không tìm thấy nhóm'));
                return;
            }

            let isValidPassword = !group.isPrivate;
            if (group.isPrivate) {
                isValidPassword = await verifyPassword(password, group.password);
                if (!isValidPassword) {
                    res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Mật khẩu không chính xác'));
                    return;
                }
            }

            const isExistParticipant = await ParticipantSchema.findOne({
                user: meId,
                conversationId: group._id,
            });

            if (isExistParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Bạn đã là thành viên của nhóm này'),
                );
                return;
            }

            const newParticipant = await createParticipant(meIdObjectId, group._id, 'member');

            if (!newParticipant) {
                next(errorResponse(Status.BAD_REQUEST, 'Create participant failed'));
                return;
            }

            group.participants.push(newParticipant);
            await group.save();

            // accept invitation if have
            const invitation = await GroupInvitationSchema.findOne({
                invitedTo: meId,
                conversationId: groupId,
            });

            if (invitation) {
                invitation.respondedAt = new Date();
                invitation.status = 'accepted';
                invitation.save();
            }

            // notification to admin
            await senJoinGroupNotification({
                fromId: meId.toString(),
                toId: group.createdBy.toString(),
                type: 'group_joined',
                groupId: group._id.toString(),
            });

            await group.save();

            // new message
            const newMessage = await MessageSchema.create({
                conversationId: group._id,
                sender: meId,
                content: 'group-joined',
                messageType: 'notification',
            });

            const populatedMessage = await newMessage.populate([
                { path: 'sender', select: 'fullName avatar username' },
            ]);

            const participants = await ParticipantSchema.find({ conversationId: group._id }).select('user');
            const participantUserIds = new Set(participants.map((p) => p.user.toString()));

            const socket = ws.getWSS();
            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (customClient.isAuthenticated && participantUserIds.has(customClient.userId)) {
                        customClient.send(
                            JSON.stringify({
                                type: 'message',
                                data: { message: populatedMessage, conversationId: group._id },
                            }),
                        );
                    }
                });
            }

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

            const result = groupValidate.getInvitationUsers.safeParse({ groupId, userId: meId });
            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const query = name
                ? {
                      $or: [
                          { fullName: { $regex: name, $options: 'i' } },
                          { username: { $regex: name, $options: 'i' } },
                      ],
                  }
                : {};

            if (!meId) {
                res.status(Status.UNAUTHORIZED).json(errorResponse(Status.UNAUTHORIZED, 'Bạn chưa đăng nhập'));
                return;
            }

            const isGroupExist = await ConversationSchema.findOne({ _id: groupId, isGroup: true });
            if (!isGroupExist) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Không tìm thấy nhóm'));
                return;
            }

            const participants = await ParticipantSchema.find({ conversationId: groupId });
            const participantIds = participants.map((p) => p.user.toString());

            const isParticipant = participantIds.includes(meId);

            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Bạn không phải là thành viên của nhóm này'),
                );
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

            const result = groupValidate.getMemberOfGroup.safeParse({ groupId });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const query = !!name
                ? {
                      $or: [
                          { fullName: { $regex: name, $options: 'i' } },
                          { username: { $regex: name, $options: 'i' } },
                      ],
                  }
                : {};

            const group = await ConversationSchema.findOne({ _id: groupId, isGroup: true });
            if (!group) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Không tìm thấy nhóm'));
                return;
            }

            const participantsRaw = await ParticipantSchema.find({
                conversationId: new Types.ObjectId(groupId),
            })
                .populate({
                    path: 'user',
                    match: query,
                    select: '_id avatar username fullName',
                })
                .select('-lastMessage -lastMessageReadAt -deletedAt -nickname');

            const participants = participantsRaw.filter((p) => p.user !== null);

            res.status(Status.OK).json(
                successResponse(Status.OK, 'Members of group fetched successfully', participants),
            );
        } catch (error) {
            next(error);
        }
    }

    async getMembersOfGroupInProfile(req: Request, res: Response, next: NextFunction) {
        try {
            const { groupId } = req.params;
            const { name } = req.query;

            let meId = null;
            const authHeader = req.headers['authorization'];
            const token = authHeader?.split(' ')[1];

            if (token) {
                meId = await getUserIdFromAccessToken(token);
            }

            const result = groupValidate.getMemberOfGroup.safeParse({ groupId });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

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
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Không tìm thấy nhóm'));
                return;
            }

            const participantsRaw = await ParticipantSchema.find({
                conversationId: new Types.ObjectId(groupId),
            })
                .populate({
                    path: 'user',
                    match: query,
                    select: '_id avatar username fullName',
                })
                .select('-lastMessage -lastMessageReadAt -deletedAt -nickname');

            let participants = participantsRaw.filter((p) => p.user !== null);

            if (meId) {
                const friendShips = await FriendshipSchema.find({ $or: [{ user1: meId }, { user2: meId }] });
                const myFriends = new Set(
                    friendShips.map((fr) => (fr.user1.toString() === meId ? fr.user2.toString() : fr.user1.toString())),
                );
                const friendRequests = await FriendRequestSchema.find({
                    status: 'pending',
                    $or: [
                        {
                            sender: meId,
                        },
                        { receiver: meId },
                    ],
                    $nor: [
                        {
                            sender: { $in: Array.from(myFriends) },
                            receiver: { $in: Array.from(myFriends) },
                        },
                    ],
                });

                const requestedByMe = new Set(
                    friendRequests.filter((fr) => fr.sender.toString() === meId).map((fr) => fr.receiver.toString()),
                );

                const requestedByOther = new Set(
                    friendRequests.filter((fr) => fr.receiver.toString() === meId).map((fr) => fr.sender.toString()),
                );

                participants = participants.map((p: any) => {
                    const userId = p.user._id.toString();
                    return {
                        ...(p.toObject?.() ?? p),
                        isFriendRequestedByOther: requestedByOther.has(userId),
                        isFriendRequestedByMe: requestedByMe.has(userId),
                        isFriend: myFriends.has(userId),
                    };
                });
            }
            res.status(Status.OK).json(
                successResponse(Status.OK, 'Members of group fetched successfully', participants),
            );
        } catch (error) {
            next(error);
        }
    }

    async getGroupsByUserId(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;

            let meId = null;
            const authHeader = req.headers['authorization'];
            const token = authHeader?.split(' ')[1];

            if (token) {
                meId = await getUserIdFromAccessToken(token);
            }

            const participants = await ParticipantSchema.find({ user: userId, deletedAt: null });

            const joinedConversationIds = participants.map((p) => p.conversationId);

            let groups = await ConversationSchema.find({
                isDeleted: false,
                isGroup: true,
                $or: [{ _id: { $in: joinedConversationIds } }],
            })
                .sort({ createdAt: -1 })
                .select('name thumbnail createdBy isPrivate');

            if (meId) {
                const meParticipant = await ParticipantSchema.find({ user: meId, deletedAt: null });

                const meJoinedConversationIds = meParticipant.map((p) => p.conversationId);
                const meJoinedGroupIds = new Set(meJoinedConversationIds.map((id) => id.toString()));

                const invitations = await GroupInvitationSchema.find({
                    invitedTo: meId,
                    status: 'pending',
                });

                const invitationIds = new Set(invitations.map((i) => i.conversationId.toString()));

                groups = groups.map((group: any) => {
                    const groupId = group._id.toString();
                    return {
                        ...(group.toObject?.() ?? group),
                        isMember: meJoinedGroupIds.has(groupId),
                        isInvited: invitationIds.has(groupId),
                    };
                });
            }

            res.status(Status.OK).json(successResponse(Status.OK, 'Groups fetched successfully', groups));
        } catch (error) {
            next(error);
        }
    }
}
export default new GroupController();
