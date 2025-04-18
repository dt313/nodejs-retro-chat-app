import { z } from 'zod';

export const replyInvitation = z.object({
    id: z.string().min(1, { message: 'Invitation ID is required' }),
    status: z.enum(['accepted', 'rejected']),
    userId: z.string().min(1, { message: 'User ID is required' }),
});

export const createFriendRequest = z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
    requesterId: z.string().min(1, { message: 'Requester ID is required' }),
});

export const replyFriendRequest = z.object({
    id: z.string().min(1, { message: 'Invitation ID is required' }),
    status: z.enum(['accepted', 'rejected']),
    userId: z.string().min(1, { message: 'User ID is required' }),
});
