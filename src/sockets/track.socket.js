const Track = require('../models/Track');
const logger = require('../utils/logger');

// In-memory storage for tracks
const memoryTracks = new Map();

module.exports = (io, socket) => {
  
  socket.on('update-current-track', async (data) => {
    const { waveId, title, artist, duration } = data;
    
    try {
      // Create new current track in DynamoDB
      const track = await Track.create({
        waveId,
        title,
        artist,
        duration,
        isCurrent: true
      });
      
      // Also store in memory
      const trackId = track.trackId;
      const waveTracksKey = `wave_${waveId}`;
      if (!memoryTracks.has(waveTracksKey)) {
        memoryTracks.set(waveTracksKey, []);
      }
      
      const waveTracks = memoryTracks.get(waveTracksKey);
      waveTracks.forEach(t => t.isCurrent = false);
      waveTracks.unshift({
        trackId,
        waveId,
        title,
        artist,
        duration,
        isCurrent: true,
        playedAt: new Date()
      });
      
      // Broadcast to all listeners in the wave
      io.to(waveId).emit('current-track-updated', {
        title,
        artist,
        duration,
        playedAt: new Date()
      });
      
      logger.info(`TRACK_PLAYING: Wave ${waveId} now playing "${title}" by "${artist}" (${duration}s)`);
    } catch (error) {
      logger.error(`UPDATE_TRACK_ERROR: ${error.message}`);
      socket.emit('error', { message: 'Failed to update track' });
    }
  });
  
  socket.on('get-wave-tracks', async (data) => {
    const { waveId } = data;
    
    try {
      // Get tracks from memory (DynamoDB queries would be expensive)
      const waveTracksKey = `wave_${waveId}`;
      const waveTracks = memoryTracks.get(waveTracksKey) || [];
      const tracks = waveTracks.slice(0, 20);
      
      socket.emit('wave-tracks', {
        waveId,
        tracks
      });
      
      logger.info(`TRACKS_REQUESTED: Sent ${tracks.length} tracks for wave ${waveId}`);
    } catch (error) {
      logger.error(`GET_TRACKS_ERROR: ${error.message}`);
      socket.emit('wave-tracks', { waveId, tracks: [] });
    }
  });
};