module.exports = (io, socket) => {
  
  socket.on('send-reaction', (data) => {
    const { waveId, userId, reaction } = data;
    
    const reactionData = {
      id: Date.now().toString(),
      waveId,
      userId,
      reaction,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast reaction to all users in the wave
    socket.to(waveId).emit('reaction-received', reactionData);
    
    console.log(`⭐ Reaction in ${waveId}: ${reaction} from ${userId}`);
  });

  socket.on('invite-mic', async (data) => {
    const { waveId, fromUserId, toUserId } = data;
    
    const inviteData = {
      waveId,
      fromUserId,
      toUserId,
      timestamp: new Date().toISOString()
    };
    
    // Send invitation to specific user
    io.to(toUserId).emit('mic-invited', inviteData);
    
    console.log(`🎤 Mic invitation from ${fromUserId} to ${toUserId} in ${waveId}`);
  });

  socket.on('accept-mic', (data) => {
    const { waveId, userId } = data;
    
    // Notify all users in wave that someone accepted mic
    io.to(waveId).emit('mic-accepted', { waveId, userId });
    
    console.log(`✅ Mic accepted by ${userId} in ${waveId}`);
  });

  socket.on('revoke-mic', (data) => {
    const { waveId, userId } = data;
    
    // Notify all users that mic was revoked
    io.to(waveId).emit('mic-revoked', { waveId, userId });
    
    console.log(`❌ Mic revoked for ${userId} in ${waveId}`);
  });
};