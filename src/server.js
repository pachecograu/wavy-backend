require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const waveSocket = require('./sockets/wave.socket');
const chatSocket = require('./sockets/chat.socket');
const reactionSocket = require('./sockets/reaction.socket');
const trackSocket = require('./sockets/track.socket');
const hybridSocket = require('./sockets/hybrid.socket');
const voiceSocket = require('./sockets/voice.socket');
const qualitySocket = require('./sockets/quality.socket');
const logSocket = require('./sockets/log.socket');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
// DynamoDB está listo (sin necesidad de conexión)
console.log('🗄️ DynamoDB configured');


// Socket.IO
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  
  waveSocket(io, socket);
  chatSocket(io, socket);
  reactionSocket(io, socket);
  trackSocket(io, socket);
  hybridSocket(io, socket);
  voiceSocket(io, socket);
  qualitySocket(io, socket);
  logSocket(io, socket);
  
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'WAVY backend online', 
    timestamp: new Date().toISOString(),
    services: {
      voice: 'webrtc-p2p'
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌊 WAVY Backend running on port ${PORT}`);
  console.log(`️ WebRTC P2P signaling active`);
});