const logger = require('../utils/logger');

module.exports = (io, socket) => {
  
  socket.on('send-reaction', (data) => {
    const { waveId, userId, reaction } = data;
    
    socket.to(waveId).emit('reaction-received', {
      id: Date.now().toString(),
      waveId,
      userId,
      reaction,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`REACTION: ${reaction} from ${userId} in ${waveId}`);
  });
};
