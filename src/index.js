const server = require('./server');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 WAVY Backend running on port ${PORT}`);
  logger.info(`📡 Socket.IO server ready`);
  logger.info(`🌐 Health check: http://localhost:${PORT}/health`);
});