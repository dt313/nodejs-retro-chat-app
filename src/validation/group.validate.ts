import { z } from 'zod';

export const joinGroup = z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
    groupId: z.string().min(1, { message: 'Group ID is required' }),
});

export const getGroupById = z.object({
    groupId: z.string().min(1, { message: 'Group ID is required' }),
});

export const getInvitationUsers = z.object({
    groupId: z.string().min(1, { message: 'Group ID is required' }),
    userId: z.string().min(1, { message: 'User ID is required' }),
});

export const getMemberOfGroup = z.object({
    groupId: z.string().min(1, { message: 'Group ID is required' }),
});
