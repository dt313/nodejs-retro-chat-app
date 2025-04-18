import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { client as redisClient } from '@/configs/redis';
import { getUserIdFromAccessToken } from '@/helper/jwt';

// Extend WebSocket type to include our custom property
interface CustomWebSocket extends WebSocket {
    isAuthenticated: boolean;
    userId: string;
}

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

            if (data.type === 'AUTH') {
                const { token } = data;
                const userId = await getUserIdFromAccessToken(token);

                if (userId) {
                    ws.isAuthenticated = true;
                    ws.userId = userId;
                    await redisClient.sAdd('online_users', userId);
                }
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
