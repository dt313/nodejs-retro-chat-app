import { AuthRequest } from '@/types/auth-request';
import { Request, Response, NextFunction } from 'express';
import UserSchema from '@/models/user.model';
import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';

class UserController {
    async getInformation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.payload?.userId;
            const user = await UserSchema.findById(userId);
            if (user) {
                res.json(user);
            } else {
                res.json(errorResponse(Status.NOT_FOUND, 'User not found'));
            }
        } catch (error) {
            next(error);
        }
    }

    async getUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const users = await UserSchema.find();
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
                res.json(errorResponse(Status.NOT_FOUND, 'User not found'));
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
                res.json(errorResponse(Status.NOT_FOUND, 'User not found'));
            }
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
