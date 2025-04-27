import { WebSocket } from 'ws';
// Extend WebSocket type to include our custom property
interface CustomWebSocket extends WebSocket {
    isAuthenticated: boolean;
    userId: string;
}

export default CustomWebSocket;
