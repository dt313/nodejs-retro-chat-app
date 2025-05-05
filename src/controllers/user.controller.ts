import { AuthRequest } from '@/types/auth-request';
import { Request, Response, NextFunction } from 'express';
import UserSchema from '@/models/user.model';
import FriendRequestSchema from '@/models/friend-request.model';
import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';
import { getUserIdFromAccessToken } from '@/helper/jwt';
import { ObjectId } from 'mongoose';
import Friendship from '@/models/friendship.model';

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

            if (token) {
                meId = await getUserIdFromAccessToken(token);
            }

            let users = await UserSchema.find({ _id: { $ne: meId } });

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
            const user = await UserSchema.findOne({ username });
            if (user) {
                res.json(successResponse(Status.OK, 'User fetched successfully', user));
            } else {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User not found'));
            }
        } catch (error) {
            next(error);
        }
    }

    async getFriends(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;

            const isExistUser = await UserSchema.findById(meId);
            if (!isExistUser) {
                res.status(Status.NOT_FOUND).json(errorResponse(Status.NOT_FOUND, 'User not found'));
                return;
            }

            const friendship = await Friendship.find({ $or: [{ user1: meId }, { user2: meId }] });
            const friendIds = friendship.map((friend) =>
                friend.user1.toString() === meId ? friend.user2.toString() : friend.user1.toString(),
            );
            const friends = await UserSchema.find({ _id: { $in: friendIds } }).select('avatar fullName username');

            console.log('friends', friends);
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
}
export default new UserController();
