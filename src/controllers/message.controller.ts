import { AuthRequest } from '@/types/auth-request';
import { Request, Response, NextFunction } from 'express';

class MessageController {
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        const me = req.payload?.userId;

        // logic create message

        try {
            console.log('create message');
        } catch (error) {
            next(error);
        }
    }

    async getMessage(req: AuthRequest, res: Response, next: NextFunction) {
        const me = req.payload?.userId;

        // logic create message

        try {
            console.log('create message');
        } catch (error) {
            next(error);
        }
    }
}
export default new MessageController();
