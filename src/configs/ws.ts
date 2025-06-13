import { Server } from 'http';
import { WebSocketServer } from 'ws';
import { client as redisClient } from '@/configs/redis';
import { getUserIdFromAccessToken } from '@/helper/jwt';
import ParticipantSchema from '@/models/participant.model';
import CustomWebSocket from '@/types/web-socket';
import UserSchema from '@/models/user.model';
import { randomUUID } from 'crypto';

let wss: WebSocketServer;

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
