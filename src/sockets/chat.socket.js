const Wave = require('../models/Wave');
const logger = require('../utils/logger');

module.exports = (io, socket) => {
  
  socket.on('send-public-message', (data) => {
    const { waveId, userId, message } = data;
    
    const messageData = {
      id: Date.now().toString(),
      waveId,
      userId,
      message,
      type: 'public',
      timestamp: new Date().toISOString()
    };
    
    io.to(waveId).emit('public-message', messageData);
    logger.info(`PUBLIC_CHAT: ${userId} in ${waveId}: ${message}`);
  });

  socket.on('send-private-message', async (data) => {
    const { waveId, fromUserId, toUserId, message } = data;
    
    try {
      const wave = await Wave.findById(waveId);
      if (!wave) {
        socket.emit('error', { message: 'Wave not found' });
        return;
      }
      
      // Only owner <-> listener private chat allowed
      const isValidPrivateChat = wave.ownerId === fromUserId || wave.ownerId === toUserId;
      if (!isValidPrivateChat) {
        socket.emit('error', { message: 'Private chat not allowed' });
        return;
      }
      
      const messageData = {
        id: Date.now().toString(),
        waveId,
        fromUserId,
        toUserId,
        message,
        type: 'private',
        timestamp: new Date().toISOString()
      };
      
      // Send to both users via their userId rooms
      // (works because wave.socket.js does socket.join(userId) on connect)
      io.to(fromUserId).emit('private-message', messageData);
      io.to(toUserId).emit('private-message', messageData);
      
      logger.info(`PRIVATE_CHAT: ${fromUserId} -> ${toUserId} in ${waveId}`);
    } catch (error) {
      logger.error(`PRIVATE_CHAT_ERROR: ${error.message}`);
      socket.emit('error', { message: 'Failed to send private message' });
    }
  });
};
