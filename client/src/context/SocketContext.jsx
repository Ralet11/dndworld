import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import API_URL from '../config';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  if (!token) {
    return <SocketContext.Provider value={{ socket: null, connected: false, connectionError: '' }}>{children}</SocketContext.Provider>;
  }
  return <AuthenticatedSocketProvider key={token} token={token}>{children}</AuthenticatedSocketProvider>;
}

function AuthenticatedSocketProvider({ token, children }) {
  const [socket] = useState(() => io(API_URL, {
    transports: ['polling', 'websocket'],
    auth: { token },
  }));
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    const handleConnect = () => {
      setConnected(true);
      setConnectionError('');
    };
    const handleDisconnect = () => setConnected(false);
    const handleConnectError = error => {
      setConnected(false);
      setConnectionError(error?.message || 'No se pudo conectar con el servidor.');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    if (socket.connected) handleConnect();
    else socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, connected, connectionError }}>
      {children}
    </SocketContext.Provider>
  );
}

// Context hooks intentionally live beside their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  return useContext(SocketContext);
}
