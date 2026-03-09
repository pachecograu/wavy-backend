const waveSocket = require('../sockets/wave.socket');
const trackSocket = require('../sockets/track.socket');
const logSocket = require('../sockets/log.socket');
const logger = require('../utils/logger');

module.exports = (io) => {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);
    
    // Initialize socket handlers
    waveSocket(io, socket);
    trackSocket(io, socket);
    logSocket(io, socket);
    
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
};