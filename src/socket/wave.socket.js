const waveService = require('../services/wave.service');
const logger = require('../utils/logger');

module.exports = (socket, io) => {
  
  socket.on('join-wave', (waveId) => {
    logger.info(`Client ${socket.id} joined wave: ${waveId}`);
    socket.join(waveId);
    waveService.addListener(waveId);
    socket.to(waveId).emit('user-joined', { userId: socket.id, waveId });
  });

  socket.on('leave-wave', (waveId) => {
    logger.info(`Client ${socket.id} left wave: ${waveId}`);
    socket.leave(waveId);
    waveService.removeListener(waveId);
    socket.to(waveId).emit('user-left', { userId: socket.id, waveId });
  });

  socket.on('create-wave', (data) => {
    logger.info(`Client ${socket.id} created wave:`, data);
    const wave = waveService.createWave(data);
    socket.emit('wave-created', wave);
  });

  socket.on('send-reaction', (data) => {
    logger.info(`Client ${socket.id} sent reaction:`, data);
    socket.to(data.waveId).emit('reaction-received', { 
      userId: socket.id, 
      reaction: data.reaction,
      waveId: data.waveId 
    });
  });

  socket.on('public-message', (data) => {
    logger.info(`Client ${socket.id} sent message:`, data);
    io.to(data.waveId).emit('message-received', {
      userId: socket.id,
      message: data.message,
      waveId: data.waveId,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('private-message', (data) => {
    logger.info(`Client ${socket.id} sent private message to ${data.userId}`);
    socket.to(data.userId).emit('private-message-received', {
      fromUserId: socket.id,
      message: data.message,
      timestamp: new Date().toISOString()
    });
  });
};