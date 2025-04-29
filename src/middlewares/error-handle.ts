import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse, Status } from '@/types/response';
import { errorResponse } from '@/utils/response';

export interface AppError extends Error {
    status?: number;
}

export const errorHandler = (err: ApiErrorResponse, req: Request, res: Response, next: NextFunction) => {
    console.log(err.message);
    const errorMessage = err.message || 'Internal Server Error';
    res.status(err.status || 500).json(errorResponse(err.status || 500, errorMessage));
};
