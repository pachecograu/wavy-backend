const logger = require('../utils/logger');

// In-memory quality reports per wave (no DynamoDB — free tier friendly)
const qualityReports = new Map(); // waveId -> Map<userId, report>

module.exports = (io, socket) => {

  socket.on('report-quality', (data) => {
    const { waveId, userId, bitrate, latencyMs, bufferHealth, timestamp } = data;
    
    if (!qualityReports.has(waveId)) {
      qualityReports.set(waveId, new Map());
    }
    
    qualityReports.get(waveId).set(userId, {
      userId,
      bitrate: bitrate || 0,
      latencyMs: latencyMs || 0,
      bufferHealth: bufferHealth || 'good',
      reportedAt: timestamp || Date.now()
    });
    
    // Forward to emisor in real-time
    socket.to(waveId).emit('listener-quality', {
      userId, bitrate, latencyMs, bufferHealth, timestamp: Date.now()
    });
  });

  socket.on('get-quality-summary', (data) => {
    const { waveId } = data;
    const reports = qualityReports.get(waveId);
    
    if (!reports || reports.size === 0) {
      socket.emit('quality-summary', { waveId, listeners: 0, avgBitrate: 0, avgLatency: 0, poorConnections: 0, reports: [] });
      return;
    }
    
    const now = Date.now();
    const recent = Array.from(reports.values()).filter(r => (now - r.reportedAt) < 30000);
    
    const avgBitrate = recent.length > 0
      ? Math.round(recent.reduce((sum, r) => sum + r.bitrate, 0) / recent.length) : 0;
    const avgLatency = recent.length > 0
      ? Math.round(recent.reduce((sum, r) => sum + r.latencyMs, 0) / recent.length) : 0;
    
    socket.emit('quality-summary', {
      waveId,
      listeners: recent.length,
      avgBitrate,
      avgLatency,
      poorConnections: recent.filter(r => r.bufferHealth === 'poor').length,
      reports: recent
    });
  });
};

// Exported cleanup functions — called from wave.socket.js
module.exports.removeListener = (waveId, userId) => {
  if (qualityReports.has(waveId)) {
    qualityReports.get(waveId).delete(userId);
  }
};

module.exports.cleanupWave = (waveId) => {
  qualityReports.delete(waveId);
};
