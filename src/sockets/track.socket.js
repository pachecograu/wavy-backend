const Track = require('../models/Track');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// In-memory storage for tracks
const memoryTracks = new Map();

// Check if MongoDB is connected
const isMongoConnected = () => mongoose.connection.readyState === 1;

module.exports = (io, socket) => {
  
  socket.on('update-current-track', async (data) => {
    const { waveId, title, artist, duration } = data;
    
    try {
      if (isMongoConnected()) {
        // Mark previous current track as not current
        await Track.updateMany(
          { waveId, isCurrent: true },
          { isCurrent: false }
        );
        
        // Create new current track
        const track = new Track({
          waveId,
          title,
          artist,
          duration,
          isCurrent: true
        });
        
        await track.save();
      } else {
        // Use memory storage
        const trackId = `track_${Date.now()}`;
        const track = {
          id: trackId,
          waveId,
          title,
          artist,
          duration,
          isCurrent: true,
          playedAt: new Date()
        };
        
        // Mark previous tracks as not current
        const waveTracksKey = `wave_${waveId}`;
        if (!memoryTracks.has(waveTracksKey)) {
          memoryTracks.set(waveTracksKey, []);
        }
        
        const waveTracks = memoryTracks.get(waveTracksKey);
        waveTracks.forEach(t => t.isCurrent = false);
        waveTracks.unshift(track);
      }
      
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
      let tracks = [];
      
      if (isMongoConnected()) {
        tracks = await Track.find({ waveId })
          .sort({ playedAt: -1 })
          .limit(20);
        
        tracks = tracks.map(track => ({
          title: track.title,
          artist: track.artist,
          duration: track.duration,
          isCurrent: track.isCurrent,
          playedAt: track.playedAt
        }));
      } else {
        // Use memory storage
        const waveTracksKey = `wave_${waveId}`;
        const waveTracks = memoryTracks.get(waveTracksKey) || [];
        tracks = waveTracks.slice(0, 20);
      }
      
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