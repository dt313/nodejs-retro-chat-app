import { z } from 'zod';

export const createGroupInvitation = z.object({
    groupId: z.string().min(1, { message: 'Group ID is required' }),
    toId: z.string().min(1, { message: 'User ID is required' }),
    fromId: z.string().min(1, { message: 'Sender ID is required' }),
});

export const replyInvitation = z.object({
    id: z.string().min(1, { message: 'Invitation ID is required' }),
    status: z.enum(['accepted', 'rejected']),
    userId: z.string().min(1, { message: 'User ID is required' }),
});

export const createFriendRequest = z.object({
    toId: z.string().min(1, { message: 'User ID is required' }),
    fromId: z.string().min(1, { message: 'Requester ID is required' }),
});

export const replyFriendRequest = z.object({
    id: z.string().min(1, { message: 'Invitation ID is required' }),
    status: z.enum(['accepted', 'rejected']),
    userId: z.string().min(1, { message: 'User ID is required' }),
});

export const cancelFriendRequest = z.object({
    sender: z.string().min(1, { message: 'User ID is required' }),
    receiver: z.string().min(1, { message: 'From ID is required' }),
});

export const cancelGroupInvitation = z.object({
    sender: z.string().min(1, { message: 'User ID is required' }),
    receiver: z.string().min(1, { message: 'From ID is required' }),
    groupId: z.string().min(1, { message: 'Group ID is required' }),
});

export const replyGroupInvitation = z.object({
    id: z.string().min(1, { message: 'Invitation ID is required' }),
    status: z.enum(['accepted', 'rejected']),
    userId: z.string().min(1, { message: 'User ID is required' }),
    groupId: z.string().min(1, { message: 'Group ID is required' }),
});

export const unFriend = z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
    friendId: z.string().min(1, { message: 'Friend ID is required' }),
});
