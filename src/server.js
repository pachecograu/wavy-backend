require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const waveSocket = require('./sockets/wave.socket');
const chatSocket = require('./sockets/chat.socket');
const reactionSocket = require('./sockets/reaction.socket');
const trackSocket = require('./sockets/track.socket');
const hybridSocket = require('./sockets/hybrid.socket');
const voiceSocket = require('./sockets/voice.socket');
const qualitySocket = require('./sockets/quality.socket');
const logSocket = require('./sockets/log.socket');

const hlsService = require('./services/hls.service');
const liveKitService = require('./services/livekit.service');
const Cache = require('./models/Cache');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: 'us-east-1' });
const S3_BUCKET = 'wavy-music-372714114281';

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
app.use('/hls', express.static(path.join(__dirname, '../public/hls')));

// DynamoDB está listo (sin necesidad de conexión)
console.log('🗄️ DynamoDB configured');

// Iniciar servicios de audio
hlsService.start();

// API Routes
app.get('/api/rooms/:roomId/stream', (req, res) => {
  const { roomId } = req.params;
  const streamUrl = hlsService.getStreamUrl(roomId);
  
  res.json({
    roomId,
    streamUrl,
    isActive: hlsService.isStreamActive(roomId)
  });
});

app.post('/api/rooms/:roomId/voice-token', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, isHost } = req.body;
    
    // Check cache first
    const cachedToken = await Cache.getCachedVoiceToken(roomId, userId);
    if (cachedToken) {
      console.log(`🎯 Cache hit: Voice token for ${userId} in room ${roomId}`);
      return res.json(cachedToken);
    }
    
    // Generate new token
    const voiceToken = await liveKitService.createVoiceToken(roomId, userId, isHost);
    
    // Cache the token
    await Cache.cacheVoiceToken(roomId, userId, voiceToken);
    console.log(`💾 Cached voice token for ${userId} in room ${roomId}`);
    
    res.json(voiceToken);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// S3 Music listing
app.get('/api/music', async (req, res) => {
  try {
    const { Contents = [] } = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'music/'
    }));
    const tracks = Contents
      .filter(obj => obj.Key !== 'music/' && obj.Size > 0)
      .map(obj => {
        const filename = decodeURIComponent(obj.Key.replace('music/', '').replace(/\+/g, ' '));
        const name = filename.replace(/\.[^.]+$/, '');
        return {
          title: name,
          url: `https://${S3_BUCKET}.s3.us-east-1.amazonaws.com/${obj.Key}`,
          size: obj.Size
        };
      });
    res.json({ tracks });
  } catch (error) {
    console.error('S3 list error:', error.message);
    res.status(500).json({ tracks: [], error: error.message });
  }
});

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
      hls: hlsService.getActiveStreams().length > 0,
      voice: liveKitService.getActiveVoiceRooms().length > 0
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌊 WAVY Backend running on port ${PORT}`);
  console.log(`🎵 HLS streams available at http://localhost:${PORT}/hls`);
  console.log(`🎙️ LiveKit WebRTC on ws://localhost:7880`);
});