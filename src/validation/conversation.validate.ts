import { z } from 'zod';

export const getOrCreateConversation = z.object({
    meId: z.string().min(1, { message: 'User ID is required' }),
    userId: z.string().min(1, { message: 'Group ID is required' }),
});
