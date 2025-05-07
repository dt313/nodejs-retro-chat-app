import { z } from 'zod';

export const forwardMessage = z.object({
    meId: z.string().min(1, { message: 'User ID is required' }),
    messageId: z.string().min(1, { message: 'Message ID is required' }),
    friendId: z.string().min(1, { message: 'Friend ID is required' }),
});
