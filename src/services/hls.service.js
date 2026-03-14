const NodeMediaServer = require('node-media-server');
const path = require('path');
const fs = require('fs');

class HLSService {
  constructor() {
    this.activeStreams = new Map();
    this.setupDirectories();
    this.initMediaServer();
  }

  setupDirectories() {
    const hlsDir = path.join(__dirname, '../../public/hls');
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }
  }

  initMediaServer() {
    const config = {
      rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
      },
      http: {
        port: 8000,
        allow_origin: '*',
        mediaroot: path.join(__dirname, '../../public')
      },
      relay: {
        ffmpeg: process.platform === 'win32' ? 'ffmpeg' : '/usr/bin/ffmpeg',
        tasks: [
          {
            app: 'live',
            mode: 'push',
            edge: 'rtmp://127.0.0.1/hls'
          }
        ]
      },
      hls: {
        mediaroot: path.join(__dirname, '../../public'),
        allow_origin: '*'
      }
    };

    this.nms = new NodeMediaServer(config);
    
    this.nms.on('prePublish', (id, StreamPath, args) => {
      console.log(`[HLS] Stream started: ${StreamPath}`);
      this.handleStreamStart(StreamPath);
    });

    this.nms.on('donePublish', (id, StreamPath, args) => {
      console.log(`[HLS] Stream ended: ${StreamPath}`);
      this.handleStreamEnd(StreamPath);
    });
  }

  start() {
    this.nms.run();
    console.log('🎵 HLS Media Server started on port 8000');
    console.log('📡 RTMP input: rtmp://localhost:1935/live/ROOM_ID');
  }

  handleStreamStart(streamPath) {
    const roomId = this.extractRoomId(streamPath);
    if (roomId) {
      this.activeStreams.set(roomId, {
        streamPath,
        startTime: Date.now(),
        hlsPath: `/hls/${roomId}/index.m3u8`
      });
      console.log(`🎵 HLS stream started for room: ${roomId}`);
    }
  }

  handleStreamEnd(streamPath) {
    const roomId = this.extractRoomId(streamPath);
    if (roomId && this.activeStreams.has(roomId)) {
      this.activeStreams.delete(roomId);
      console.log(`🎵 HLS stream ended for room: ${roomId}`);
    }
  }

  extractRoomId(streamPath) {
    const match = streamPath.match(/\/live\/(.+)/);
    return match ? match[1] : null;
  }

  getStreamUrl(roomId) {
    const host = process.env.PUBLIC_HOST || 'localhost';
    const stream = this.activeStreams.get(roomId);
    return stream ? `http://${host}:8000${stream.hlsPath}` : `http://${host}:8000/hls/${roomId}/index.m3u8`;
  }

  isStreamActive(roomId) {
    return this.activeStreams.has(roomId);
  }

  getActiveStreams() {
    return Array.from(this.activeStreams.keys());
  }
}

module.exports = new HLSService();