import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import API_URL from '../config';

const SocketContext = createContext(null);

let _socket = null;

function getSocket() {
  if (!_socket) {
    _socket = io(API_URL, { transports: ['polling', 'websocket'] });
  }
  return _socket;
}

export function SocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
