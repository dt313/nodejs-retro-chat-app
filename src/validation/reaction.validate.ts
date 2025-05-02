import z from 'zod';

export const reaction = z.object({
    user: z.string().min(1, { message: 'User ID is required' }),
    messageType: z.enum(['Message', 'Attachment', 'ImageAttachment']),
    type: z.enum(['like', 'love', 'haha', 'sad', 'angry', 'wow', 'care']),
    messageId: z.string().min(1, { message: 'MessageId ID is required' }),
});
