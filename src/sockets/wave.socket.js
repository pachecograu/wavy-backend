const Wave = require('../models/Wave');
const Cache = require('../models/Cache');
const logger = require('../utils/logger');
const voiceSocket = require('./voice.socket');
const qualitySocket = require('./quality.socket');

// In-memory storage for active waves and connected users
const activeWaves = new Map();
const memoryWaves = new Map();
const connectedUsers = new Map();
const userSockets = new Map();
const playbackState = new Map(); // waveId -> { action, currentTime, timestamp }
// Track emisor connection state per wave
const emisorState = new Map(); // waveId -> { userId, state, disconnectedAt }
const RECONNECT_GRACE_PERIOD = 15000; // 15s grace period before marking wave offline

module.exports = (io, socket) => {
  
  // Track connected users + join userId room for private chat
  socket.on('user-connected', (data) => {
    const { userId } = data;
    
    // Join a room with the userId so private messages can reach this user
    socket.join(userId);
    
    if (userSockets.has(userId)) {
      userSockets.get(userId).add(socket.id);
    } else {
      userSockets.set(userId, new Set([socket.id]));
    }
    
    connectedUsers.set(socket.id, userId);
    socket.userId = userId;
    
    // Check if this user was a disconnected emisor — trigger reconnect
    for (const [waveId, state] of emisorState.entries()) {
      if (state.userId === userId && state.state === 'reconnecting') {
        clearTimeout(state.offlineTimer);
        state.state = 'connected';
        emisorState.set(waveId, state);
        
        // Notify all listeners to reconnect to the stream
        io.to(waveId).emit('emisor-reconnected', { waveId, userId });
        io.to(waveId).emit('emisor-state', { waveId, state: 'connected' });
        logger.info(`EMISOR_RECONNECTED: ${userId} reconnected to wave ${waveId}`);
      }
    }
    
    logger.info(`USER_CONNECTED: ${userId} connected to socket ${socket.id}`);
  });
  
  socket.on('disconnect', () => {
    const userId = connectedUsers.get(socket.id);
    
    if (userId) {
      if (userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id);
        
        if (userSockets.get(userId).size === 0) {
          userSockets.delete(userId);
          
          // Check if this user owns any active waves — start grace period
          for (const [waveId, waveData] of activeWaves.entries()) {
            if (memoryWaves.has(waveId)) {
              const wave = memoryWaves.get(waveId);
              if (wave.ownerId === userId) {
                // Don't kill wave immediately — give grace period for reconnect
                const state = {
                  userId,
                  state: 'reconnecting',
                  disconnectedAt: Date.now(),
                  offlineTimer: setTimeout(() => {
                    // Grace period expired — wave goes offline
                    activeWaves.delete(waveId);
                    memoryWaves.delete(waveId);
                    emisorState.delete(waveId);
                    voiceSocket.cleanupWave(waveId);
                    qualitySocket.cleanupWave(waveId);
                    io.emit('wave-offline', { waveId });
                    io.to(waveId).emit('emisor-state', { waveId, state: 'disconnected' });
                    logger.info(`WAVE_OFFLINE: Wave ${waveId} went offline after grace period`);
                  }, RECONNECT_GRACE_PERIOD)
                };
                emisorState.set(waveId, state);
                
                // Notify listeners that emisor is reconnecting
                io.to(waveId).emit('emisor-state', { waveId, state: 'reconnecting' });
                logger.info(`EMISOR_DISCONNECTED: ${userId} disconnected from wave ${waveId}, grace period started`);
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
      
      let wave;
      try {
        wave = await Wave.createWithTransaction({
          name: data.name || 'New Wave',
          djName: data.djName || 'Anonymous DJ',
          ownerId: userId,
          genre: data.genre || 'Sin información',
          description: data.description || 'Sin información'
        });
      } catch (dbError) {
        // DynamoDB failed — create wave in-memory only
        logger.warn(`CREATE_WAVE_DB_FALLBACK: DynamoDB failed (${dbError.message}), using in-memory`);
        const { v4: uuidv4 } = require('uuid');
        wave = {
          waveId: uuidv4(),
          name: data.name || 'New Wave',
          djName: data.djName || 'Anonymous DJ',
          ownerId: userId,
          genre: data.genre || 'Sin información',
          description: data.description || 'Sin información',
          isOnline: true,
          listenersCount: 0,
          currentTrack: null,
          createdAt: new Date().toISOString()
        };
      }
      
      try { await Cache.cacheWave(wave.waveId, wave); } catch(e) { /* ignore cache errors */ }
      memoryWaves.set(wave.waveId, wave);
      
      const waveId = wave.waveId;
      activeWaves.set(waveId, { listeners: new Set() });
      
      // Track emisor state
      emisorState.set(waveId, { userId, state: 'connected', disconnectedAt: null, offlineTimer: null });
      
      socket.join(waveId);
      io.emit('wave-online', wave);
      
      logger.info(`EMISOR_CREATED_WAVE: User ${userId} created wave "${wave.name}"`);
    } catch (error) {
      logger.error(`CREATE_WAVE_ERROR: ${error.message}`);
      socket.emit('error', { message: 'Failed to create wave: ' + error.message });
    }
  });

  socket.on('stop-wave', async (data) => {
    const { waveId, userId } = data;
    
    try {
      try { await Wave.stopWithTransaction(waveId, userId); } catch(e) {
        logger.warn(`STOP_WAVE_DB_FALLBACK: ${e.message}`);
      }
      
      activeWaves.delete(waveId);
      memoryWaves.delete(waveId);
      playbackState.delete(waveId);
      
      const state = emisorState.get(waveId);
      if (state && state.offlineTimer) clearTimeout(state.offlineTimer);
      emisorState.delete(waveId);
      
      voiceSocket.cleanupWave(waveId);
      qualitySocket.cleanupWave(waveId);
      
      io.emit('wave-offline', { waveId });
      io.to(waveId).emit('emisor-state', { waveId, state: 'offline' });
      
      logger.info(`WAVE_STOPPED: User ${userId} stopped wave ${waveId}`);
    } catch (error) {
      logger.error(`STOP_WAVE_ERROR: ${error.message}`);
    }
  });
  
  socket.on('join-wave', async (data) => {
    const { waveId, userId } = data;
    
    try {
      socket.join(waveId);
      
      let sessionId;
      try {
        sessionId = await Wave.joinWithTransaction(waveId, userId);
      } catch(e) {
        logger.warn(`JOIN_WAVE_DB_FALLBACK: ${e.message}`);
        sessionId = require('uuid').v4();
      }
      socket.sessionId = sessionId;
      
      if (activeWaves.has(waveId)) {
        activeWaves.get(waveId).listeners.add(userId);
        const count = activeWaves.get(waveId).listeners.size;
        
        io.emit('listeners-update', { waveId, count });
        logger.info(`OYENTE_JOINED_WAVE: User ${userId} joined wave ${waveId}`);
        
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
      
      if (socket.sessionId) {
        try { await Wave.leaveWithTransaction(waveId, socket.sessionId); } catch(e) {
          logger.warn(`LEAVE_WAVE_DB_FALLBACK: ${e.message}`);
        }
      }
      
      if (activeWaves.has(waveId)) {
        activeWaves.get(waveId).listeners.delete(userId);
        const count = activeWaves.get(waveId).listeners.size;
        
        qualitySocket.removeListener(waveId, userId);
        
        io.emit('listeners-update', { waveId, count });
        logger.info(`USER_LEFT_WAVE: User ${userId} left wave ${waveId}`);
      }
    } catch (error) {
      logger.error(`LEAVE_WAVE_ERROR: ${error.message}`);
    }
  });

  socket.on('update-wave', async (data) => {
    try {
      const updates = {};
      if (data.name) updates.name = data.name;
      if (data.djName) updates.djName = data.djName;
      if (data.genre) updates.genre = data.genre;
      if (data.description) updates.description = data.description;
      
      try { await Wave.update(data.waveId, updates); } catch(e) {
        logger.warn(`UPDATE_WAVE_DB_FALLBACK: ${e.message}`);
      }
      
      if (memoryWaves.has(data.waveId)) {
        const mw = memoryWaves.get(data.waveId);
        Object.assign(mw, updates);
      }
      
      io.to(data.waveId).emit('wave-updated', { ...memoryWaves.get(data.waveId), ...updates, waveId: data.waveId });
      logger.info(`WAVE_UPDATED: Wave ${data.waveId} updated`);
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
      if (wave.isOnline && activeWaves.has(waveId) && realConnectedUsers.has(wave.ownerId)) {
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
    const { waveId, action, currentTime } = data;
    const state = {
      action,
      currentTime,
      timestamp: Date.now(),
    };
    playbackState.set(waveId, state);
    
    socket.to(waveId).emit('sync-playback', {
      action,
      currentTime,
      timestamp: Date.now()
    });
  });

  socket.on('request-playback-state', (data) => {
    const { waveId } = data || {};
    if (!waveId) return;
    const state = playbackState.get(waveId);
    if (!state) return;

    socket.emit('playback-state', state);
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

  // Get emisor connection state
  socket.on('get-emisor-state', (data) => {
    const { waveId } = data;
    const state = emisorState.get(waveId);
    socket.emit('emisor-state', {
      waveId,
      state: state ? state.state : 'unknown'
    });
  });
};

// Export shared state for other modules
module.exports.activeWaves = activeWaves;
module.exports.memoryWaves = memoryWaves;
module.exports.userSockets = userSockets;
module.exports.connectedUsers = connectedUsers;