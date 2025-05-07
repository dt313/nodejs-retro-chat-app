import { Request, Response, NextFunction } from 'express';
import GroupInvitationSchema from '@/models/group-invitation.model';
import ConversationSchema from '@/models/conversation.model';
import FriendRequestSchema from '@/models/friend-request.model';
import FriendshipSchema from '@/models/friendship.model';
import UserSchema from '@/models/user.model';
import NotificationSchema from '@/models/notification.model';
import ParticipantSchema from '@/models/participant.model';
import CustomWebSocket from '@/types/web-socket';

import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';
import { invitationValidate } from '@/validation';
import ws from '@/configs/ws';
import { AuthRequest } from '@/types/auth-request';
import { compareTime, diffTime } from '@/helper/time';
import GroupInvitation from '@/models/group-invitation.model';

class InvitationController {
    async createGroupInvitation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { groupId, userId } = req.params;
            const meId = req.payload?.userId;

            if (!meId) {
                res.status(Status.UNAUTHORIZED).json(errorResponse(Status.UNAUTHORIZED, 'User not authenticated'));
                return;
            }

            const isGroupExist = await ConversationSchema.findOne({ _id: groupId, isGroup: true });
            if (!isGroupExist) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Group not found'));
                return;
            }

            const isUserExist = await UserSchema.findOne({ _id: userId });
            if (!isUserExist) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User not found'));
                return;
            }

            const isParticipant = await ParticipantSchema.findOne({
                user: meId,
                conversationId: groupId,
            });

            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not a member of this group'),
                );
                return;
            }

            const isRequested = await GroupInvitationSchema.findOne({
                conversationId: groupId,
                invitedTo: userId,
                invitedBy: meId,
            });

            console.log(isRequested);

            if (isRequested) {
                if (isRequested.status === 'rejected' && isRequested.respondedAt) {
                    const diff = diffTime(isRequested.respondedAt);
                    const oneDay = 24 * 60 * 60 * 1000;
                    const compareDate = compareTime(oneDay, diff);
                    if (compareDate === 1) {
                        res.status(Status.BAD_REQUEST).json(
                            errorResponse(
                                Status.BAD_REQUEST,
                                'You cannot invite this user to this group 2 time in a day',
                            ),
                        );
                        return;
                    }
                } else if (isRequested.status === 'accepted') {
                    res.status(Status.BAD_REQUEST).json(
                        errorResponse(Status.BAD_REQUEST, 'This user is already in this group'),
                    );
                    return;
                } else {
                    res.status(Status.BAD_REQUEST).json(
                        errorResponse(Status.BAD_REQUEST, 'You already invited this user to this group'),
                    );
                    return;
                }
            }

            const newInvitation = await GroupInvitationSchema.create({
                conversationId: groupId,
                invitedTo: userId,
                invitedBy: meId,
                status: 'pending',
            });

            const notification = await NotificationSchema.create({
                user: userId,
                type: 'group_invitation',
                sender: meId,
                group: groupId,
            });

            const populatedNotification = await NotificationSchema.findOne({
                _id: notification._id,
            })
                .populate('sender', 'fullName avatar id username')
                .populate('user', 'fullName avatar id username')
                .populate('group', 'name');

            const socket = ws.getWSS();

            if (socket) {
                socket.clients.forEach((client: any) => {
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
            res.json(successResponse(Status.OK, 'Friend request sent successfully', newInvitation));
        } catch (error) {
            next(error);
        }
    }

    async getAllInvitationsOfGroupByUserId(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;

            if (!userId) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'User ID is not provided'));
                return;
            }

            const invitations = await GroupInvitationSchema.find({ invitedTo: userId });
            res.json(successResponse(Status.OK, 'Get all invitations of group successfully', invitations));
        } catch (error) {
            next(error);
        }
    }

    async replyGroupInvitation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { status, senderId, groupId } = req.body;
            const meId = req.payload?.userId;

            const result = invitationValidate.replyGroupInvitation.safeParse({
                id: meId,
                status,
                userId: senderId,
                groupId,
            });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid request', result.error));
                return;
            }

            const isUserExist = await UserSchema.findOne({ _id: senderId });

            if (!isUserExist) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User not found'));
                return;
            }

            const isGroupExist = await ConversationSchema.findOne({ _id: groupId, isGroup: true });

            if (!isGroupExist) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Group not found'));
                return;
            }

            const invitation = await GroupInvitationSchema.findOne({
                invitedTo: meId,
                invitedBy: senderId,
                conversationId: groupId,
                status: 'pending',
            });

            if (!invitation) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Invitation not found'));
                return;
            }

            if (status === 'accepted') {
                invitation.status = 'accepted';
                // add to friendship

                const newParticipant = await ParticipantSchema.create({
                    user: meId,
                    conversationId: groupId,
                });

                if (newParticipant) {
                    isGroupExist.participants.push(newParticipant._id);
                    await isGroupExist.save();
                }

                // notification for sender
                const notification = await NotificationSchema.create({
                    user: senderId,
                    type: 'group_joined',
                    sender: meId,
                    group: groupId,
                });

                const populatedNotification = await NotificationSchema.findOne({
                    _id: notification._id,
                })
                    .populate('sender', 'fullName avatar id username')
                    .populate('user', 'fullName avatar id username')
                    .populate('group', 'name');

                const socket = ws.getWSS();

                if (socket) {
                    socket.clients.forEach((client) => {
                        const customClient = client as CustomWebSocket;
                        if (customClient.isAuthenticated && customClient.userId === senderId) {
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
            }

            if (status === 'rejected') {
                invitation.status = 'rejected';
            }

            invitation.respondedAt = new Date();

            await invitation.save();

            await NotificationSchema.deleteOne({
                user: meId,
                sender: senderId,
                group: groupId,
                type: 'group_invitation',
            });

            res.json(successResponse(Status.OK, 'Friend request replied successfully', invitation));
        } catch (error) {
            next(error);
        }
    }

    async cancelGroupInvitation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { toUserId } = req.params;
            const { groupId } = req.body;
            const meId = req.payload?.userId;

            const result = invitationValidate.cancelGroupInvitation.safeParse({
                receiver: toUserId,
                sender: meId,
                groupId,
            });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid request', result.error));
                return;
            }

            if (!meId) {
                res.status(Status.UNAUTHORIZED).json(errorResponse(Status.UNAUTHORIZED, 'User not authenticated'));
                return;
            }

            const isGroupExist = await ConversationSchema.findOne({ _id: groupId, isGroup: true });

            if (!isGroupExist) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Group not found'));
                return;
            }

            const isParticipant = await ParticipantSchema.findOne({
                user: meId,
                conversationId: groupId,
            });

            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not a member of this group'),
                );
                return;
            }

            const isInvitationExist = await GroupInvitationSchema.findOne({
                invitedBy: meId,
                invitedTo: toUserId,
                conversationId: groupId,
                status: 'pending',
            });

            if (!isInvitationExist) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Invitation not found'));
                return;
            }

            await GroupInvitationSchema.deleteOne({
                _id: isInvitationExist._id,
            });

            await NotificationSchema.deleteOne({
                user: toUserId,
                sender: meId,
                group: groupId,
                type: 'group_invitation',
            });

            res.status(Status.OK).json(
                successResponse(Status.OK, 'Cancel group invitation successfully', isInvitationExist),
            );
        } catch (error) {
            next(error);
        }
    }

    async getAllFriendRequestsByUserId(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            if (!userId) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'User ID is not provided'));
                return;
            }

            const friendRequests = await FriendRequestSchema.find({ receiverId: userId });
            res.json(successResponse(Status.OK, 'Get all friend requests successfully', friendRequests));
            return;
        } catch (error) {
            next(error);
        }
    }

    async createFriendRequest(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { to: toId } = req.params;
            const fromId = req.payload?.userId;

            console.log('AUTH ', fromId);
            const result = invitationValidate.createFriendRequest.safeParse({ toId, fromId });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid request', result.error));
                return;
            }

            if (toId === fromId) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You cannot send a friend request to yourself'),
                );
                return;
            }

            const isReceivedUserExist = await UserSchema.findOne({ _id: toId });

            if (!isReceivedUserExist) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User you want to add is not found'));
                return;
            }

            const isRequestUserExist = await UserSchema.findOne({ _id: fromId });

            if (!isRequestUserExist) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User you want to add is not found'));
                return;
            }

            const isRequested = await FriendRequestSchema.findOne({
                $or: [
                    {
                        receiver: toId,
                        sender: fromId,
                    },
                    {
                        receiver: fromId,
                        sender: toId,
                    },
                ],
            });

            if (isRequested) {
                if (isRequested.status === 'rejected' && isRequested.respondedAt) {
                    const diff = diffTime(isRequested.respondedAt);
                    const oneDay = 24 * 60 * 60 * 1000;
                    const compareDate = compareTime(oneDay, diff);
                    if (compareDate === 1) {
                        res.status(Status.BAD_REQUEST).json(
                            errorResponse(Status.BAD_REQUEST, 'You cannot request 2 time in a day'),
                        );
                        return;
                    }
                } else if (isRequested.status === 'accepted') {
                    res.status(Status.BAD_REQUEST).json(
                        errorResponse(Status.BAD_REQUEST, 'This user is already your friend'),
                    );
                    return;
                } else {
                    res.status(Status.BAD_REQUEST).json(
                        errorResponse(Status.BAD_REQUEST, 'You already requested this user'),
                    );
                    return;
                }
            }

            const isFriend = await FriendshipSchema.findOne({
                $or: [
                    { user1: toId, user2: fromId },
                    { user1: fromId, user2: toId },
                ],
            });

            if (isFriend) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'You are already friends'));
                return;
            }

            const newFriendRequest = await FriendRequestSchema.create({
                sender: fromId,
                receiver: toId,
            });

            // notify to receiver

            const notification = await NotificationSchema.create({
                user: toId,
                type: 'friend_request',
                sender: fromId,
            });

            const populatedNotification = await NotificationSchema.findOne({
                _id: notification._id,
            })
                .populate('sender', 'fullName avatar id username')
                .populate('user', 'fullName avatar id username');

            const socket = ws.getWSS();

            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (customClient.isAuthenticated && customClient.userId === toId) {
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

            res.json(successResponse(Status.OK, 'Friend request sent successfully', newFriendRequest));
        } catch (error) {
            next(error);
        }
    }

    async replyFriendRequestById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { status, userId } = req.body;

            const result = invitationValidate.replyFriendRequest.safeParse({ id, status, userId });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid request', result.error));
                return;
            }

            const isUserExist = await UserSchema.findOne({ _id: userId });

            if (!isUserExist) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User not found'));
                return;
            }

            const friendRequest = await FriendRequestSchema.findOne({
                _id: id,
                receiver: userId,
                status: 'pending',
            });

            console.log(friendRequest);

            if (!friendRequest) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Friend request not found'));
                return;
            }

            if (status === 'accepted') {
                friendRequest.status = 'accepted';
                // add to friendship
                await FriendshipSchema.create({
                    user1: friendRequest.sender,
                    user2: friendRequest.receiver,
                });

                // notify to sender
            }

            if (status === 'rejected') {
                friendRequest.status = 'rejected';
            }

            friendRequest.respondedAt = new Date();
            await friendRequest.save();

            res.json(successResponse(Status.OK, 'Friend request replied successfully', friendRequest));
        } catch (error) {
            next(error);
        }
    }

    async replyFriendRequest(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { status, senderId } = req.body;
            const meId = req.payload?.userId;

            const result = invitationValidate.replyFriendRequest.safeParse({ id: meId, status, userId: senderId });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid request', result.error));
                return;
            }

            const isUserExist = await UserSchema.findOne({ _id: senderId });

            if (!isUserExist) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User not found'));
                return;
            }

            const friendRequest = await FriendRequestSchema.findOne({
                receiver: meId,
                sender: senderId,
                status: 'pending',
            });

            console.log(friendRequest);

            if (!friendRequest) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'Friend request not found'));
                return;
            }

            if (status === 'accepted') {
                friendRequest.status = 'accepted';
                // add to friendship
                await FriendshipSchema.create({
                    user1: friendRequest.sender,
                    user2: friendRequest.receiver,
                });

                // notification for sender
                const notification = await NotificationSchema.create({
                    user: senderId,
                    type: 'friend_request_accepted',
                    sender: meId,
                });

                const populatedNotification = await NotificationSchema.findOne({
                    _id: notification._id,
                })
                    .populate('sender', 'fullName avatar id username')
                    .populate('user', 'fullName avatar id username');

                const socket = ws.getWSS();

                if (socket) {
                    socket.clients.forEach((client) => {
                        const customClient = client as CustomWebSocket;
                        if (customClient.isAuthenticated && customClient.userId === senderId) {
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
            }

            if (status === 'rejected') {
                friendRequest.status = 'rejected';
            }

            friendRequest.respondedAt = new Date();

            await friendRequest.save();

            await NotificationSchema.deleteOne({
                user: meId,
                sender: senderId,
                type: 'friend_request',
            });

            res.json(successResponse(Status.OK, 'Friend request replied successfully', friendRequest));
        } catch (error) {
            next(error);
        }
    }

    async cancelFriendRequest(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { toUserId } = req.params;
            const meId = req.payload?.userId;

            const result = invitationValidate.cancelFriendRequest.safeParse({ receiver: toUserId, sender: meId });

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid request', result.error));
                return;
            }

            const friendRequest = await FriendRequestSchema.findOneAndDelete({
                status: 'pending',
                sender: meId,
                receiver: toUserId,
            });

            if (!!friendRequest) {
                res.status(Status.OK).json(
                    successResponse(Status.OK, 'Cancel friend request successfully', friendRequest),
                );

                // remove notification
                await NotificationSchema.deleteOne({
                    user: toUserId,
                    sender: meId,
                    type: 'friend_request',
                });
            } else {
                res.status(Status.NOT_FOUND).json(
                    errorResponse(Status.NOT_FOUND, 'Cannot found friend request record'),
                );
            }
        } catch (error) {
            next(error);
        }
    }
}
export default new InvitationController();
