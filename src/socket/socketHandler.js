const logger = require('../utils/logger');

const socketHandler = (io) => {
  io.on('connection', (socket) => {
    logger.info(`CLIENT_CONNECTED: Socket ${socket.id} connected from ${socket.handshake.address}`);

    socket.on('join-wave', (waveId) => {
      logger.info(`SOCKET_JOIN_WAVE: Client ${socket.id} joining wave room: ${waveId}`);
      socket.join(waveId);
      socket.to(waveId).emit('user-joined', { userId: socket.id, waveId });
    });

    socket.on('leave-wave', (waveId) => {
      logger.info(`SOCKET_LEAVE_WAVE: Client ${socket.id} leaving wave room: ${waveId}`);
      socket.leave(waveId);
      socket.to(waveId).emit('user-left', { userId: socket.id, waveId });
    });

    socket.on('create-wave', (data) => {
      logger.info(`SOCKET_CREATE_WAVE: Client ${socket.id} creating wave with data:`, data);
      const waveId = `wave_${Date.now()}`;
      socket.emit('wave-created', { waveId, ...data });
    });

    socket.on('disconnect', (reason) => {
      logger.info(`CLIENT_DISCONNECTED: Socket ${socket.id} disconnected - Reason: ${reason}`);
    });

    socket.on('error', (error) => {
      logger.error(`SOCKET_ERROR: Socket ${socket.id} error - ${error.message}`);
    });
  });
};

module.exports = socketHandler;