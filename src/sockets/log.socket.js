const logger = require('../utils/logger');

module.exports = (io, socket) => {
  
  socket.on('log-action', (data) => {
    const { action, userId, ...details } = data;
    logger.info(`${action}: User ${userId} - ${JSON.stringify(details)}`);
  });

  socket.on('user-login', (data) => {
    const { userId, displayName, loginType } = data;
    logger.info(`USER_LOGIN: User ${userId} (${displayName}) logged in via ${loginType}`);
  });

  socket.on('user-logout', (data) => {
    const { userId } = data;
    logger.info(`USER_LOGOUT: User ${userId} logged out`);
  });
};