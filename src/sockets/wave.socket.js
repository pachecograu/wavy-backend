const Wave = require('../models/Wave');
const Cache = require('../models/Cache');
const logger = require('../utils/logger');

// In-memory storage for active waves and connected users
const activeWaves = new Map();
const memoryWaves = new Map();
const connectedUsers = new Map(); // Changed to Map to track socket IDs
const userSockets = new Map(); // Track multiple sockets per user

module.exports = (io, socket) => {
  
  // Track connected users with duplicate prevention
  socket.on('user-connected', (data) => {
    const { userId } = data;
    
    // Allow multiple connections per user (different tabs/devices)
    if (userSockets.has(userId)) {
      userSockets.get(userId).add(socket.id);
    } else {
      userSockets.set(userId, new Set([socket.id]));
    }
    
    connectedUsers.set(socket.id, userId);
    socket.userId = userId;
    logger.info(`USER_CONNECTED: ${userId} connected to socket ${socket.id}`);
  });
  
  socket.on('disconnect', () => {
    const userId = connectedUsers.get(socket.id);
    
    if (userId) {
      // Remove this socket from user's socket set
      if (userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id);
        
        // If no more sockets for this user, clean up completely
        if (userSockets.get(userId).size === 0) {
          userSockets.delete(userId);
          
          // Clean up user's waves
          for (const [waveId, waveData] of activeWaves.entries()) {
            if (memoryWaves.has(waveId)) {
              const wave = memoryWaves.get(waveId);
              if (wave.ownerId === userId) {
                activeWaves.delete(waveId);
                memoryWaves.delete(waveId);
                io.emit('wave-offline', { waveId });
                logger.info(`WAVE_OFFLINE: Wave ${waveId} went offline (owner ${userId} disconnected)`);
              }
            }
          }
          
          logger.info(`USER_FULLY_DISCONNECTED: ${userId} has no more active connections`);
        }
      }
      
      connectedUsers.delete(socket.id);
    }
    
    logger.info(`SOCKET_DISCONNECTED: ${socket.id}`);
  });
  
  socket.on('create-wave', async (data) => {
    try {
      const { userId } = data;
      
      if (!userId) {
        socket.emit('error', { message: 'User ID required' });
        return;
      }
      
      socket.userId = userId;
      
      // Use transaction to create wave and update user atomically
      const wave = await Wave.createWithTransaction({
        name: data.name || 'New Wave',
        djName: data.djName || 'Anonymous DJ',
        ownerId: userId
      });
      
      // Cache wave data
      await Cache.cacheWave(wave.waveId, wave);
      
      // Store in memory for quick access
      memoryWaves.set(wave.waveId, wave);
      
      const waveId = wave.waveId;
      activeWaves.set(waveId, { listeners: new Set() });
      
      socket.join(waveId);
      io.emit('wave-online', wave);
      
      logger.info(`EMISOR_CREATED_WAVE: User ${userId} created wave "${wave.name}" with TRANSACTION`);
    } catch (error) {
      logger.error(`CREATE_WAVE_ERROR: ${error.message}`);
      socket.emit('error', { message: 'Failed to create wave' });
    }
  });

  socket.on('stop-wave', async (data) => {
    const { waveId, userId } = data;
    
    try {
      // Use transaction to stop wave and update user atomically
      await Wave.stopWithTransaction(waveId, userId);
      
      // Remove from active waves
      activeWaves.delete(waveId);
      
      // Remove from memory storage
      memoryWaves.delete(waveId);
      
      // Notify all clients that wave is offline
      io.emit('wave-offline', { waveId });
      
      logger.info(`WAVE_STOPPED: User ${userId} stopped wave ${waveId} with TRANSACTION`);
    } catch (error) {
      logger.error(`STOP_WAVE_ERROR: ${error.message}`);
    }
  });
  
  socket.on('join-wave', async (data) => {
    const { waveId, userId } = data;
    
    try {
      socket.join(waveId);
      
      // Use transaction to join wave and create session atomically
      const sessionId = await Wave.joinWithTransaction(waveId, userId);
      socket.sessionId = sessionId;
      
      if (activeWaves.has(waveId)) {
        activeWaves.get(waveId).listeners.add(userId);
        const count = activeWaves.get(waveId).listeners.size;
        
        io.emit('listeners-update', { waveId, count });
        logger.info(`OYENTE_JOINED_WAVE: User ${userId} joined wave ${waveId} with TRANSACTION, session: ${sessionId}`);
        
        socket.to(waveId).emit('listener_joined', {
          userId,
          listenersCount: count,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error(`JOIN_WAVE_ERROR: ${error.message}`);
      socket.emit('error', { message: 'Failed to join wave' });
    }
  });

  socket.on('leave-wave', async (data) => {
    const { waveId, userId } = data;
    
    try {
      socket.leave(waveId);
      
      // Use transaction to leave wave and update session atomically
      if (socket.sessionId) {
        await Wave.leaveWithTransaction(waveId, socket.sessionId);
      }
      
      if (activeWaves.has(waveId)) {
        activeWaves.get(waveId).listeners.delete(userId);
        const count = activeWaves.get(waveId).listeners.size;
        
        io.emit('listeners-update', { waveId, count });
        logger.info(`USER_LEFT_WAVE: User ${userId} left wave ${waveId} with TRANSACTION`);
      }
    } catch (error) {
      logger.error(`LEAVE_WAVE_ERROR: ${error.message}`);
    }
  });

  socket.on('update-wave', async (data) => {
    try {
      const wave = await Wave.update(data.waveId, {
        name: data.name,
        djName: data.djName
      });
      
      io.to(data.waveId).emit('wave-updated', wave);
      logger.info(`WAVE_UPDATED: Wave ${data.waveId} updated to name "${wave.name}" DJ "${wave.djName}"`);
    } catch (error) {
      logger.error(`UPDATE_WAVE_ERROR: ${error.message}`);
      socket.emit('error', { message: 'Failed to update wave' });
    }
  });

  socket.on('get-online-waves', async (data) => {
    const { userRole } = data;
    
    if (userRole !== 'oyente') {
      socket.emit('online-waves', []);
      logger.info(`WAVES_LIST_DENIED: Emisor tried to access waves list`);
      return;
    }
    
    // Only return waves from currently connected users
    const realConnectedUsers = new Set(Array.from(userSockets.keys()));
    
    // Try cache first for each wave
    const waves = [];
    for (const [waveId, wave] of memoryWaves.entries()) {
      if (wave.isOnline && realConnectedUsers.has(wave.ownerId)) {
        const cachedWave = await Cache.getCachedWave(waveId);
        waves.push(cachedWave || wave);
      }
    }
    
    const onlineWaves = waves.map(wave => ({
      ...wave,
      listenersCount: activeWaves.get(wave.waveId)?.listeners.size || 0
    }));
    
    socket.emit('online-waves', onlineWaves);
    logger.info(`WAVES_LIST_REQUESTED: Sent ${onlineWaves.length} online waves (with CACHE)`);
  });

  // Test transmission from emisor to oyentes
  socket.on('test-transmission', (data) => {
    const { waveId, message, timestamp } = data;
    
    // Send test message to all listeners in the wave
    socket.to(waveId).emit('transmission-received', {
      message,
      timestamp: timestamp || Date.now(),
      from: 'emisor'
    });
    
    logger.info(`TEST_TRANSMISSION: Emisor sent test message to wave ${waveId}: "${message}"`);
  });

  // Oyente confirms reception
  socket.on('confirm-reception', (data) => {
    const { waveId, userId, timestamp } = data;
    
    // Send confirmation back to emisor
    socket.to(waveId).emit('reception-confirmed', {
      userId,
      timestamp: timestamp || Date.now(),
      confirmedAt: Date.now()
    });
    
    logger.info(`RECEPTION_CONFIRMED: Oyente ${userId} confirmed reception in wave ${waveId}`);
  });

  // Audio streaming events
  socket.on('audio-stream', (data) => {
    const { waveId, audioData, timestamp } = data;
    
    // Broadcast audio to all listeners in the wave
    socket.to(waveId).emit('audio-data', {
      audioData,
      timestamp: timestamp || Date.now()
    });
  });

  socket.on('track-info', (data) => {
    const { waveId, trackInfo } = data;
    
    // Send current track info to all listeners
    socket.to(waveId).emit('current-track', trackInfo);
    
    logger.info(`TRACK_INFO: Emisor updated track in wave ${waveId}: "${trackInfo.title}"`);
  });

  socket.on('playback-sync', (data) => {
    const { waveId, currentTime, isPlaying } = data;
    
    // Sync playback state with all listeners
    socket.to(waveId).emit('sync-playback', {
      currentTime,
      isPlaying,
      timestamp: Date.now()
    });
  });

  socket.on('audio-chunk', (data) => {
    const { waveId, chunk, sequence } = data;
    
    // Forward audio chunk to all listeners
    socket.to(waveId).emit('receive-audio-chunk', {
      chunk,
      sequence,
      timestamp: Date.now()
    });
  });

  // Emisor starts playing a song
  socket.on('start-song', (data) => {
    const { waveId, songData } = data;
    
    socket.to(waveId).emit('song-started', {
      songData,
      timestamp: Date.now()
    });
    
    logger.info(`SONG_STARTED: Emisor started song in wave ${waveId}`);
  });

  // Emisor pauses/resumes song
  socket.on('song-control', (data) => {
    const { waveId, action, currentTime } = data;
    
    socket.to(waveId).emit('song-control-update', {
      action, // 'play', 'pause', 'stop'
      currentTime,
      timestamp: Date.now()
    });
    
    logger.info(`SONG_CONTROL: Emisor ${action} song at ${currentTime}s in wave ${waveId}`);
  });

  // Real-time audio streaming
  socket.on('live-audio', (data) => {
    const { waveId, audioBuffer } = data;
    
    socket.to(waveId).emit('receive-live-audio', {
      audioBuffer,
      timestamp: Date.now()
    });
  });

  // Stream bits data for visualization
  socket.on('stream-bits', (data) => {
    const { waveId, bitsData, byteSize } = data;
    
    socket.to(waveId).emit('receive-bits', {
      bitsData,
      byteSize,
      timestamp: Date.now()
    });
    
    logger.info(`BITS_STREAMED: ${byteSize} bytes sent to wave ${waveId}`);
  });
};