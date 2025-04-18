import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '@/types/response';
export interface AppError extends Error {
    status?: number;
}

export const errorHandler = (err: ApiErrorResponse, req: Request, res: Response, next: NextFunction) => {
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
    });
};
