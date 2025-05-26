import { AuthRequest } from '@/types/auth-request';
import { Request, Response, NextFunction } from 'express';
import UserSchema from '@/models/user.model';
import FriendRequestSchema from '@/models/friend-request.model';
import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';
import { getUserIdFromAccessToken } from '@/helper/jwt';
import Friendship from '@/models/friendship.model';
import ParticipantSchema from '@/models/participant.model';
import bcrypt from 'bcrypt';
import { userValidate } from '@/validation';
class UserController {
    async getInformation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.payload?.userId;
            const user = await UserSchema.findById(userId).select('-password');
            if (user) {
                res.json(user);
            } else {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User not found'));
            }
        } catch (error) {
            next(error);
        }
    }

    async getUsers(req: Request, res: Response, next: NextFunction) {
        try {
            let meId = null;
            const authHeader = req.headers['authorization'];
            const token = authHeader?.split(' ')[1];

            const { q } = req.query;

            if (token) {
                meId = await getUserIdFromAccessToken(token);
            }

            let users = await UserSchema.find({
                _id: { $ne: meId },
                $or: [{ fullName: { $regex: q, $options: 'i' } }, { username: { $regex: q, $options: 'i' } }],
            });

            if (meId) {
                console.log(meId);

                const friendShips = await Friendship.find({ $or: [{ user1: meId }, { user2: meId }] });
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

                users = users.map((user: any) => {
                    const userId = user._id.toString();
                    return {
                        ...(user.toObject?.() ?? user),
                        isFriendRequestedByOther: requestedByOther.has(userId),
                        isFriendRequestedByMe: requestedByMe.has(userId),
                        isFriend: myFriends.has(userId),
                    };
                });
            }

            res.json(successResponse(Status.OK, 'Users fetched successfully', users));
        } catch (error) {
            next(error);
        }
    }

    async getUserById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const user = await UserSchema.findById(id);
            if (user) {
                res.json(successResponse(Status.OK, 'User fetched successfully', user));
            } else {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User not found'));
            }
        } catch (error) {
            next(error);
        }
    }

    async getUserByUsername(req: Request, res: Response, next: NextFunction) {
        try {
            const { username } = req.params;
            const authHeader = req.headers['authorization'];
            const token = authHeader?.split(' ')[1];
            let meId = null;

            if (token) {
                meId = await getUserIdFromAccessToken(token);
            }

            const user = await UserSchema.findOne({ username });

            if (!user) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User not found'));
                return;
            }

            const isFriend = await Friendship.findOne({
                $or: [
                    { user1: meId, user2: user._id },
                    { user2: meId, user1: user._id },
                ],
            });

            const isFriendRequestedByMe = await FriendRequestSchema.findOne({
                sender: meId,
                receiver: user._id,
                status: 'pending',
            });
            const isFriendRequestedByOther = await FriendRequestSchema.findOne({
                sender: user._id,
                receiver: meId,
                status: 'pending',
            });

            console.log('isFriendRequestedByMe', isFriendRequestedByMe);
            console.log('isFriendRequestedByOther', isFriendRequestedByOther);

            const friends = await Friendship.find({
                $or: [{ user1: meId }, { user2: meId }],
            });
            const participants = await ParticipantSchema.find({ user: user._id }).populate(
                'conversationId',
                'name isGroup isDeleted',
            );
            const conversations = participants.map((p) => p.conversationId);
            const groups = conversations.filter((c: any) => c.isGroup && !c.isDeleted);

            res.json(
                successResponse(Status.OK, 'User fetched successfully', {
                    ...user.toObject(),
                    isFriend: !!isFriend,
                    isFriendRequestedByMe: !!isFriendRequestedByMe,
                    isFriendRequestedByOther: !!isFriendRequestedByOther,
                    friends: friends.length,
                    groups: groups.length,
                }),
            );
        } catch (error) {
            next(error);
        }
    }

    async getFriends(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { name } = req.query;

            if (!meId) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid user ID'));
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

            const isExistUser = await UserSchema.findById(meId);
            if (!isExistUser) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User not found'));
                return;
            }

            const friendship = await Friendship.find({ $or: [{ user1: meId }, { user2: meId }] });
            const friendIds = friendship.map((friend) =>
                friend.user1.toString() === meId ? friend.user2.toString() : friend.user1.toString(),
            );
            const friends = await UserSchema.find({
                _id: { $in: friendIds },
                ...query,
            }).select('avatar fullName username');

            res.status(Status.OK).json(successResponse(Status.OK, 'Friends fetched successfully', friends));
            return;
        } catch (error) {
            next(error);
        }
    }

    async updateUser(req: Request, res: Response, next: NextFunction) {
        try {
        } catch (error) {
            next(error);
        }
    }

    async deleteUser(req: Request, res: Response, next: NextFunction) {
        try {
        } catch (error) {
            next(error);
        }
    }

    async resetPassword(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;

            const result = userValidate.resetPassword.safeParse({ email, password });
            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid request', result.error));
                return;
            }

            const user = await UserSchema.findOne({ email });
            if (!user) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User not found'));
                return;
            }

            // encode password
            const salt = await bcrypt.genSalt(10);
            const encodedPassword = await bcrypt.hash(password, salt);

            // update password
            user.password = encodedPassword;
            await user.save();

            res.status(Status.OK).json(successResponse(Status.OK, 'Password reset successfully', true));
        } catch (error) {
            next(error);
        }
    }
}
export default new UserController();
