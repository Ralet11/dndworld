import { io, Socket } from 'socket.io-client';
import { API_URL } from '../constants/Config';

// Replace with your distinct IP or configuration strategy
const SOCKET_URL = API_URL;

class SocketService {
    public socket: Socket;

    constructor() {
        this.socket = io(SOCKET_URL, {
            // Start with polling and upgrade when the proxy supports WebSocket.
            transports: ['polling', 'websocket'],
            autoConnect: true,
        });

        this.socket.on('connect', () => {
            console.log('SocketService: Connected to server:', this.socket.id);
        });

        this.socket.on('disconnect', () => {
            console.log('SocketService: Disconnected');
        });

        this.socket.on('connect_error', (err) => {
            console.error('SocketService: Connection Error:', err);
        });
    }

    getSocket() {
        return this.socket;
    }
}

const socketService = new SocketService();
export default socketService.getSocket();
