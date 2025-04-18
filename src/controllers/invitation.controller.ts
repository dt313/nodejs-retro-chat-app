import { Request, Response, NextFunction } from 'express';
import GroupInvitationSchema from '@/models/group-invitation.model';
import ConversationSchema from '@/models/conversation.model';
import FriendRequestSchema from '@/models/friend-request.model';
import FriendshipSchema from '@/models/friendship.model';
import UserSchema from '@/models/user.model';
import NotificationSchema from '@/models/notification.model';
import { WebSocket } from 'ws';

import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';
import { invitationValidate } from '@/validation';
import ws from '@/configs/ws';

// Extend WebSocket type to include our custom property
interface CustomWebSocket extends WebSocket {
    isAuthenticated: boolean;
    userId: string;
}

class InvitationController {
    async createGroupInvitation(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { invitedBy, invitedTo } = req.body;

            const group = await ConversationSchema.findOne({
                _id: id,
                isGroup: true,
            });

            if (!group) {
                res.json(errorResponse(Status.NOT_FOUND, 'Group not found'));
                return;
            }

            console.log(group);

            const isMember = group.participants.some((participant) => participant.toString() === invitedBy);

            if (!isMember) {
                res.json(errorResponse(Status.FORBIDDEN, 'You are not a member of this group'));
                return;
            }

            const isInvited = await GroupInvitationSchema.findOne({
                groupId: id,
                invitedTo,
            });

            let newInvitation = null;

            if (isInvited) {
                if (isInvited.status === 'pending') {
                    res.json(errorResponse(Status.FORBIDDEN, 'This friend is already invited to this group'));
                    return;
                }

                if (isInvited.status === 'accepted') {
                    res.json(errorResponse(Status.FORBIDDEN, 'This friend is already a member of this group'));
                    return;
                }

                if (isInvited.status === 'rejected') {
                    // update status to pending
                    newInvitation = await GroupInvitationSchema.findByIdAndUpdate(isInvited._id, { status: 'pending' });
                    res.json(successResponse(Status.OK, 'Invite member to group successfully', newInvitation));
                    return;
                }
            }

            newInvitation = await GroupInvitationSchema.create({
                conversationId: id,
                invitedBy,
                invitedTo,
            });

            // notify receiver socket

            res.json(successResponse(Status.OK, 'Invite member to group successfully', newInvitation));
        } catch (error) {
            next(error);
        }
    }

    async getAllInvitationsOfGroupByUserId(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;

            if (!userId) {
                res.json(errorResponse(Status.BAD_REQUEST, 'User ID is not provided'));
                return;
            }

            const invitations = await GroupInvitationSchema.find({ invitedTo: userId });
            res.json(successResponse(Status.OK, 'Get all invitations of group successfully', invitations));
        } catch (error) {
            next(error);
        }
    }

    async replyInvitation(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { status, userId } = req.body;

            const result = invitationValidate.replyInvitation.safeParse({ id, status, userId });

            if (!result.success) {
                res.json(errorResponse(Status.BAD_REQUEST, 'Invalid request', result.error));
                return;
            }

            const invitation = await GroupInvitationSchema.findOne({ _id: id, invitedTo: userId, status: 'pending' });

            if (!invitation) {
                res.json(errorResponse(Status.NOT_FOUND, 'Invitation not found'));
                return;
            }

            if (status === 'accept') {
                invitation.status = 'accepted';

                // add this user to the group
                const group = await ConversationSchema.findOne({ _id: invitation.conversationId });

                if (!group) {
                    res.json(errorResponse(Status.NOT_FOUND, 'Group not found'));
                    return;
                }

                group.participants.push(userId);
                await group.save();

                // notify to all members of the group that the new member has joined the group
            }

            if (status === 'rejected') {
                invitation.status = 'rejected';
            }

            invitation.respondedAt = new Date();
            await invitation.save();

            res.json(successResponse(Status.OK, 'Invitation replied successfully', invitation));
        } catch (error) {
            next(error);
        }
    }

    async getAllFriendRequestsByUserId(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            if (!userId) {
                res.json(errorResponse(Status.BAD_REQUEST, 'User ID is not provided'));
                return;
            }

            const friendRequests = await FriendRequestSchema.find({ receiverId: userId });
            res.json(successResponse(Status.OK, 'Get all friend requests successfully', friendRequests));
            return;
        } catch (error) {
            next(error);
        }
    }

    async createFriendRequest(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const { requesterId } = req.body;

            const result = invitationValidate.createFriendRequest.safeParse({ userId, requesterId });

            if (!result.success) {
                res.json(errorResponse(Status.BAD_REQUEST, 'Invalid request', result.error));
                return;
            }

            if (userId === requesterId) {
                res.json(errorResponse(Status.BAD_REQUEST, 'You cannot send a friend request to yourself'));
                return;
            }

            const isReceivedUserExist = await UserSchema.findOne({ _id: userId });

            if (!isReceivedUserExist) {
                res.json(errorResponse(Status.NOT_FOUND, 'User you want to add is not found'));
                return;
            }

            const isRequestUserExist = await UserSchema.findOne({ _id: requesterId });

            if (!isRequestUserExist) {
                res.json(errorResponse(Status.NOT_FOUND, 'User you want to add is not found'));
                return;
            }

            const isRequested = await FriendRequestSchema.findOne({
                $or: [
                    {
                        receiver: userId,
                        sender: requesterId,
                    },
                    {
                        receiver: requesterId,
                        sender: userId,
                    },
                ],
            });

            if (isRequested) {
                res.json(errorResponse(Status.BAD_REQUEST, 'Request already exists by you or this user'));
                return;
            }

            const isFriend = await FriendshipSchema.findOne({
                $or: [
                    { user1: userId, user2: requesterId },
                    { user1: requesterId, user2: userId },
                ],
            });

            if (isFriend) {
                res.json(errorResponse(Status.BAD_REQUEST, 'You are already friends'));
                return;
            }

            const newFriendRequest = await FriendRequestSchema.create({
                sender: requesterId,
                receiver: userId,
            });

            // notify to receiver

            const notification = await NotificationSchema.create({
                user: userId,
                type: 'friend_request',
                sender: requesterId,
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

            res.json(successResponse(Status.OK, 'Friend request sent successfully', newFriendRequest));
        } catch (error) {
            next(error);
        }
    }

    async replyFriendRequest(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { status, userId } = req.body;

            const result = invitationValidate.replyFriendRequest.safeParse({ id, status, userId });

            if (!result.success) {
                res.json(errorResponse(Status.BAD_REQUEST, 'Invalid request', result.error));
                return;
            }

            const isUserExist = await UserSchema.findOne({ _id: userId });

            if (!isUserExist) {
                res.json(errorResponse(Status.NOT_FOUND, 'User not found'));
                return;
            }

            const friendRequest = await FriendRequestSchema.findOne({ _id: id, receiverId: userId, status: 'pending' });

            console.log(friendRequest);

            if (!friendRequest) {
                res.json(errorResponse(Status.NOT_FOUND, 'Friend request not found'));
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
}
export default new InvitationController();
