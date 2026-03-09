const Wave = require('../models/Wave');

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
    console.log(`💬 Public message in ${waveId}: ${message}`);
  });

  socket.on('send-private-message', async (data) => {
    const { waveId, fromUserId, toUserId, message } = data;
    
    try {
      // Validate that one of the users is the wave owner
      const wave = await Wave.findById(waveId);
      if (!wave) {
        socket.emit('error', { message: 'Wave not found' });
        return;
      }
      
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
      
      // Send to both users
      io.to(fromUserId).emit('private-message', messageData);
      io.to(toUserId).emit('private-message', messageData);
      
      console.log(`📩 Private message from ${fromUserId} to ${toUserId}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to send private message' });
    }
  });
};