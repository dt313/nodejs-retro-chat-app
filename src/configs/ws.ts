import { Server } from 'http';
import { WebSocketServer } from 'ws';
import { client as redisClient } from '@/configs/redis';
import { getUserIdFromAccessToken } from '@/helper/jwt';
import ParticipantSchema from '@/models/participant.model';
import CustomWebSocket from '@/types/web-socket';
import UserSchema from '@/models/user.model';
import { randomUUID } from 'crypto';
import ConversationSchema from '@/models/conversation.model';

let wss: WebSocketServer;
interface BroadcastMessage {
    type: string;
    data: any;
}

/**
 * Broadcast message to all participants in a conversation
 * @param wss - WebSocket server instance
 * @param conversationId - Target conversation ID
 * @param message - Message to broadcast
 * @param excludeUserId - Optional user ID to exclude from broadcast
 * @param excludeClient - Optional client to exclude from broadcast
 */

const broadcastToConversation = async (
    wss: any,
    conversationId: string,
    message: BroadcastMessage,
    excludeUserId?: string,
    excludeClient?: CustomWebSocket,
) => {
    try {
        // Get conversation participants from database
        const participants = await ParticipantSchema.find({
            conversationId: conversationId,
        }).select('user');

        const participantUserIds = new Set(participants.map((p) => p.user.toString()));

        // Remove excluded user if specified
        if (excludeUserId) {
            participantUserIds.delete(excludeUserId);
        }

        console.log(`Broadcasting to conversation ${conversationId}:`, {
            participantCount: participantUserIds.size,
            messageType: message.type,
            excludeUserId,
        });

        let sentCount = 0;
        let onlineCount = 0;

        // Broadcast to all connected clients who are participants
        wss.clients.forEach((client: CustomWebSocket) => {
            if (
                client.readyState === WebSocket.OPEN &&
                client.isAuthenticated &&
                participantUserIds.has(client.userId) &&
                client !== excludeClient
            ) {
                try {
                    client.send(JSON.stringify(message));
                    sentCount++;
                } catch (error) {
                    console.error(`Error sending message to user ${client.userId}:`, error);
                }
                onlineCount++;
            }
        });

        console.log(`Message sent to ${sentCount}/${onlineCount} online participants`);
        return { sentCount, onlineCount, totalParticipants: participantUserIds.size };
    } catch (error) {
        console.error('Error in broadcastToConversation:', error);
        throw error;
    }
};

/**
 * Broadcast message to a specific user
 * @param wss - WebSocket server instance
 * @param userId - Target user ID
 * @param message - Message to broadcast
 * @returns Promise<boolean> - Success status
 */
const broadcastToUser = async (wss: any, userId: string, message: BroadcastMessage): Promise<boolean> => {
    try {
        console.log(`Broadcasting to user ${userId}:`, message.type);

        let sent = false;
        let clientsFound = 0;

        // Find all clients for this user (user might have multiple tabs/devices)
        wss.clients.forEach((client: CustomWebSocket) => {
            if (client.readyState === WebSocket.OPEN && client.isAuthenticated && client.userId === userId) {
                clientsFound++;
                try {
                    client.send(JSON.stringify(message));
                    sent = true;
                } catch (error) {
                    console.error(`Error sending message to user ${userId}:`, error);
                }
            }
        });

        if (clientsFound === 0) {
            console.log(`User ${userId} is not online`);
        } else {
            console.log(`Message sent to ${clientsFound} client(s) for user ${userId}`);
        }

        return sent;
    } catch (error) {
        console.error('Error in broadcastToUser:', error);
        return false;
    }
};

async function initWSS(server: Server) {
    await redisClient.del('online_users');
    wss = new WebSocketServer({ server });

    console.log('WebSocket server initialized');

    wss.on('connection', async (ws: CustomWebSocket) => {
        console.log('Client connected');
        ws.isAuthenticated = false;
        ws.userId = '';
        ws.clientId = randomUUID();

        // send online users
        ws.send(
            JSON.stringify({
                type: 'online_users',
                data: {
                    onlineUsers: Array.from(await redisClient.sMembers('online_users')),
                },
            }),
        );

        ws.on('message', async (message) => {
            console.log('Message received: ', message.toString());
            const data = JSON.parse(message.toString());

            switch (data.type) {
                case 'AUTH':
                    const { token } = data;
                    const userId = await getUserIdFromAccessToken(token);

                    // if

                    if (userId) {
                        ws.isAuthenticated = true;
                        ws.userId = userId;
                        await redisClient.sAdd('online_users', userId);
                    }

                    // send all socket clients the updated online users list
                    for (const client of wss.clients) {
                        const customClient = client as CustomWebSocket;

                        try {
                            customClient.send(
                                JSON.stringify({
                                    type: 'new_online_user',
                                    data: {
                                        onlineUser: userId,
                                    },
                                }),
                            );
                        } catch (err) {
                            console.error('Lỗi khi gửi socket:', err);
                        }
                    }

                    console.log('online user', Array.from(await redisClient.sMembers('online_users')));
                    console.log('Số lượng client đang kết nối:', wss.clients.size);
                    break;

                case 'TYPING':
                case 'NO_TYPING':
                    const { conversationId, userId: typingUserId } = data.data;

                    const typingUser = await UserSchema.findById(typingUserId).select(
                        'avatar fullName firstName username',
                    );
                    // Get participants from database
                    const participants = await ParticipantSchema.find({ conversationId }).select('user');
                    const participantUserIds = new Set(participants.map((p) => p.user.toString()));
                    // send to all online participant in conversation
                    wss.clients.forEach((client) => {
                        const customClient = client as CustomWebSocket;
                        if (
                            customClient.isAuthenticated &&
                            customClient.userId !== typingUserId &&
                            participantUserIds.has(customClient.userId)
                        ) {
                            customClient.send(
                                JSON.stringify({
                                    type: data.type === 'TYPING' ? 'typing' : 'no-typing',
                                    data: {
                                        conversationId,
                                        typingUser,
                                    },
                                }),
                            );
                        }
                    });
                    break;
                case 'CALL':
                case 'VIDEO_CALL':
                    const phoneSender = data.data.sender;
                    const toConversation = data.data.receiver;

                    const conversation = await ConversationSchema.findById(toConversation.conversationId);

                    console.log('video', conversation);
                    if (!conversation) {
                        // send error for sender
                        const senderClient = Array.from(wss.clients).find((client) => {
                            const customClient = client as CustomWebSocket;
                            return customClient.isAuthenticated && customClient.userId === phoneSender.id;
                        });
                        if (senderClient) {
                            (senderClient as CustomWebSocket).send(
                                JSON.stringify({
                                    type: 'CALL_ERROR',
                                    data: {
                                        message: 'Không tìm thấy cuộc trò chuyện',
                                        conversationId: toConversation.id,
                                    },
                                }),
                            );
                        }
                        break;
                    }

                    broadcastToConversation(
                        wss,
                        toConversation.conversationId,
                        {
                            type: data.type === 'VIDEO_CALL' ? 'incoming_video_call' : 'incoming_call',
                            data: {
                                sender: phoneSender,
                                receiver: toConversation,
                                conversationId: data.data.conversationId,
                            },
                        },
                        phoneSender.id,
                    );

                    break;
                case 'ICE_CANDIDATE':
                    broadcastToConversation(
                        wss,
                        data.data.conversationId,
                        {
                            type: 'ice_candidate',
                            data: data.data,
                        },
                        data.data.excludeId,
                    );
                    break;

                case 'ANSWER_CALL':
                    broadcastToConversation(
                        wss,
                        data.data.conversationId,
                        {
                            type: 'answer_call',
                            data: data.data,
                        },
                        data.data.excludeId,
                    );
                    break;
                case 'OFFER':
                    broadcastToConversation(
                        wss,
                        data.data.conversationId,
                        {
                            type: 'offer',
                            data: data.data,
                        },
                        data.data.excludeId,
                    );
                    break;

                case 'CALL_END':
                    broadcastToConversation(
                        wss,
                        data.data.conversationId,
                        {
                            type: 'call_end',
                            data: data.data,
                        },
                        data.data.excludeId,
                    );
                    break;
                case 'CALL_REJECT':
                    broadcastToConversation(
                        wss,
                        data.data.conversationId,
                        {
                            type: 'call_reject',
                            data: data.data,
                        },
                        data.data.excludeId,
                    );
                    break;

                case 'ANSWER':
                    console.log(' data.data.excludeId,', data.data.excludeId);
                    broadcastToConversation(
                        wss,
                        data.data.conversationId,
                        {
                            type: 'answer',
                            data: data.data,
                        },
                        data.data.excludeId,
                    );
                    break;
            }
        });

        ws.on('close', async () => {
            console.log('Client disconnected');
            if (!ws.isAuthenticated) return;
            await redisClient.sRem('online_users', ws.userId);
            // send all socket clients the updated online users list
            wss.clients.forEach(async (client) => {
                client.send(
                    JSON.stringify({
                        type: 'offline_user',
                        data: {
                            offlineUser: ws.userId,
                        },
                    }),
                );
            });
            ws.isAuthenticated = false;
            ws.userId = '';
        });

        ws.on('error', (error) => {
            console.error('WebSocket error: ', error);
            ws.close();
        });
    });
}

function getWSS() {
    return wss;
}

export default { initWSS, getWSS };
