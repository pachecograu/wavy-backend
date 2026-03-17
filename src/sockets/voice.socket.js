const logger = require('../utils/logger');

// Track mic state per wave
const micState = new Map(); // waveId -> { userId, isActive, volume }

module.exports = (io, socket) => {

  // === Locutor mode (mic over music) ===

  socket.on('mic-over-music-on', (data) => {
    const { waveId, userId, micVolume } = data;
    
    micState.set(waveId, { userId, isActive: true, volume: micVolume || 1.0 });
    
    socket.to(waveId).emit('locutor-on', {
      waveId,
      userId,
      micVolume: micVolume || 1.0,
      suggestedMusicVolume: 0.3,
      timestamp: Date.now()
    });
    
    logger.info(`LOCUTOR_ON: ${userId} activated mic in wave ${waveId}`);
  });

  socket.on('mic-over-music-off', (data) => {
    const { waveId, userId } = data;
    micState.delete(waveId);
    
    socket.to(waveId).emit('locutor-off', {
      waveId,
      userId,
      suggestedMusicVolume: 1.0,
      timestamp: Date.now()
    });
    
    logger.info(`LOCUTOR_OFF: ${userId} deactivated mic in wave ${waveId}`);
  });

  socket.on('locutor-balance', (data) => {
    const { waveId, micVolume, musicVolume } = data;
    
    socket.to(waveId).emit('locutor-balance-update', {
      waveId,
      micVolume: micVolume || 1.0,
      suggestedMusicVolume: musicVolume || 0.3,
      timestamp: Date.now()
    });
  });

  socket.on('get-mic-state', (data) => {
    const { waveId } = data;
    const state = micState.get(waveId);
    
    socket.emit('mic-state', {
      waveId,
      isActive: state ? state.isActive : false,
      micVolume: state ? state.volume : 0,
      suggestedMusicVolume: state && state.isActive ? 0.3 : 1.0
    });
  });

  // === Mic invitations (owner invites listener to speak) ===

  socket.on('invite-mic', (data) => {
    const { waveId, fromUserId, toUserId } = data;
    io.to(toUserId).emit('mic-invited', { waveId, fromUserId, toUserId, timestamp: new Date().toISOString() });
    logger.info(`MIC_INVITE: ${fromUserId} -> ${toUserId} in ${waveId}`);
  });

  socket.on('accept-mic', (data) => {
    const { waveId, userId } = data;
    io.to(waveId).emit('mic-accepted', { waveId, userId });
    logger.info(`MIC_ACCEPTED: ${userId} in ${waveId}`);
  });

  socket.on('revoke-mic', (data) => {
    const { waveId, userId } = data;
    io.to(waveId).emit('mic-revoked', { waveId, userId });
    logger.info(`MIC_REVOKED: ${userId} in ${waveId}`);
  });

  // Real-time mic audio relay (DJ → oyentes)
  socket.on('mic-audio', (data) => {
    const { waveId, audio } = data;
    if (waveId && audio) {
      socket.to(waveId).emit('mic-audio-data', { audio });
    }
  });
};

// Export for cleanup from wave.socket.js
module.exports.cleanupWave = (waveId) => {
  micState.delete(waveId);
};
