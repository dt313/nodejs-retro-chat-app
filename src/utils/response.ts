import { Link, ApiResponse, ApiErrorResponse, Status } from '@/types/response';

export function successResponse<T>(
    status: Status = Status.OK,
    message: string,
    data?: T,
    links?: Link[],
): ApiResponse<T> {
    return {
        status,
        message,
        data,
        _links: links,
    };
}

export function errorResponse(
    status: Status = Status.INTERNAL_SERVER_ERROR,
    message: string,
    error?: any,
): ApiErrorResponse {
    return {
        status,
        message,
        error,
    };
}
