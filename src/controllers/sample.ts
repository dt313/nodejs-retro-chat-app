import { Request, Response, NextFunction } from 'express';

class GroupController {
    async getAllGroups(req: Request, res: Response, next: NextFunction) {
        try {
            console.log(req.query);
            res.send('Get all groups');
        } catch (error) {
            next(error);
        }
    }
}
export default new GroupController();
