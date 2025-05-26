import { z } from 'zod';

export const getOrCreateConversation = z.object({
    meId: z.string().min(1, { message: 'User ID is required' }),
    userId: z.string().min(1, { message: 'User ID that you want to create conversation with is required' }),
});

export const createGroupConversation = z.object({
    name: z.string().min(1, { message: 'Name is required' }),
    password: z.string().optional(),
    type: z.string().min(1, { message: 'Type is required' }),
    description: z.string().optional(),
    rules: z.string().optional(),
    meId: z.string().min(1, { message: 'You are not authenticated' }),
});

export const getConversationById = z.object({
    conversationId: z.string().min(1, { message: 'Conversation ID is required' }),
    meId: z.string().min(1, { message: 'You are not authenticated' }),
});

export const getMessageOfConversationById = z.object({
    conversationId: z.string().min(1, { message: 'Conversation ID is required' }),
    meId: z.string().min(1, { message: 'You are not authenticated' }),
});

export const readLastMessage = z.object({
    conversationId: z.string().min(1, { message: 'Conversation ID is required' }),
    meId: z.string().min(1, { message: 'You are not authenticated' }),
});

export const searchMessageOfConversation = z.object({
    conversationId: z.string().min(1, { message: 'Conversation ID is required' }),
    meId: z.string().min(1, { message: 'You are not authenticated' }),
    query: z.string().min(1, { message: 'Query is required' }),
});

export const deleteUserFromConversation = z.object({
    conversationId: z.string().min(1, { message: 'Conversation ID is required' }),
    meId: z.string().min(1, { message: 'You are not authenticated' }),
    userId: z.string().min(1, { message: 'User ID that you want to delete from conversation is required' }),
});

export const getMessageOfConversationByMessageId = z.object({
    conversationId: z.string().min(1, { message: 'Conversation ID is required' }),
    messageId: z.string().min(1, { message: 'Message ID is required' }),
});

export const changeRoleParticipant = z.object({
    conversationId: z.string().min(1, { message: 'Conversation ID is required' }),
    meId: z.string().min(1, { message: 'You are not authenticated' }),
    userId: z.string().min(1, { message: 'User ID that you want to change role is required' }),
    role: z.string().min(1, { message: 'Role is required' }),
});

export const leaveConversation = z.object({
    conversationId: z.string().min(1, { message: 'Conversation ID is required' }),
    meId: z.string().min(1, { message: 'You are not authenticated' }),
});

export const updateConversation = z.object({
    conversationId: z.string().min(1, { message: 'Conversation ID is required' }),
    meId: z.string().min(1, { message: 'You are not authenticated' }),
});

export const deleteConversation = z.object({
    conversationId: z.string().min(1, { message: 'Conversation ID is required' }),
    meId: z.string().min(1, { message: 'You are not authenticated' }),
});
