const jwt = require('jsonwebtoken');
let ioRef = null;

function init(server) {
  const { Server } = require('socket.io');
  ioRef = new Server(server, {
    cors: {
      origin: '*',
      credentials: true,
    },
  });

  ioRef.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || '';
      if (!token) return next();
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = {
        id: payload.id,
        email: payload.email,
        roles: payload.roles,
      };
      return next();
    } catch (err) {
      return next();
    }
  });

  ioRef.on('connection', (socket) => {
    socket.on('session:join', ({ sessionId }) => {
      if (!sessionId) return;
      socket.join(`session:${sessionId}`);
    });

    socket.on('session:layer-changed', ({ sessionId, mapId }) => {
      if (!sessionId) return;
      socket.to(`session:${sessionId}`).emit('session:layer-changed', { mapId });
    });

    socket.on('token:moved', ({ sessionId, tokenId, x, y }) => {
      if (!sessionId) return;
      socket.to(`session:${sessionId}`).emit('token:moved', { tokenId, x, y });
    });

    socket.on('dm:message', ({ sessionId, text }) => {
      if (!sessionId) return;
      socket.to(`session:${sessionId}`).emit('dm:message', { text });
    });
  });

  return ioRef;
}

function io() {
  if (!ioRef) throw new Error('Socket.IO no inicializado');
  return ioRef;
}

module.exports = { init, io };