import { z } from 'zod';

export const forwardMessage = z.object({
    meId: z.string().min(1, { message: 'User ID is required' }),
    messageId: z.string().min(1, { message: 'Message ID is required' }),
    id: z.string().min(1, { message: 'Friend ID is required' }),
    isConversation: z.boolean(),
    messageType: z.enum(['text', 'image', 'file', 'video', 'audio']),
});

export const createMessage = z.object({
    conversationId: z.string().min(1, { message: 'Conversation ID is required' }),
    userId: z.string().min(1, { message: 'User ID is required' }),
});

export const cancelReaction = z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
    reactionId: z.string().min(1, { message: 'Reaction ID is required' }),
});

export const deleteMessage = z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
    messageId: z.string().min(1, { message: 'Message ID is required' }),
    type: z.enum(['text', 'image', 'file'], {
        message: 'Invalid message type',
    }),
});
