import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { client as redisClient } from '@/configs/redis';
import { getUserIdFromAccessToken } from '@/helper/jwt';
import ParticipantSchema from '@/models/participant.model';
import CustomWebSocket from '@/types/web-socket';
import UserSchema from '@/models/user.model';

let wss: WebSocketServer;

function initWSS(server: Server) {
    wss = new WebSocketServer({ server });

    console.log('WebSocket server initialized');

    wss.on('connection', (ws: CustomWebSocket) => {
        console.log('Client connected');
        ws.isAuthenticated = false;
        ws.userId = '';

        console.log('Client count ', wss.clients.size);

        ws.on('message', async (message) => {
            console.log('Message received: ', message.toString());
            const data = JSON.parse(message.toString());

            switch (data.type) {
                case 'AUTH':
                    const { token } = data;
                    const userId = await getUserIdFromAccessToken(token);

                    if (userId) {
                        ws.isAuthenticated = true;
                        ws.userId = userId;
                        await redisClient.sAdd('online_users', userId);
                    }
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
            await redisClient.sRem('online_users', ws.userId);
            ws.isAuthenticated = true;
            ws.userId = '';
        });

        ws.on('error', (error) => {
            console.error('WebSocket error: ', error);
        });
    });
}

function getWSS() {
    return wss;
}

export default { initWSS, getWSS };
