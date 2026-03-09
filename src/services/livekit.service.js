const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

class LiveKitService {
  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    this.apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
    this.wsUrl = process.env.LIVEKIT_URL || 'ws://localhost:7880';
    
    this.roomService = new RoomServiceClient(this.wsUrl, this.apiKey, this.apiSecret);
    this.activeVoiceRooms = new Map();
    console.log('🎙️ LiveKit Service initialized');
  }

  async createVoiceToken(roomId, participantId, isHost = false) {
    try {
      const at = new AccessToken(this.apiKey, this.apiSecret, {
        identity: participantId,
        ttl: '1h'
      });

      at.addGrant({
        room: `voice_${roomId}`,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: isHost
      });

      const token = await at.toJwt();
      console.log(`🎙️ Voice token created for ${participantId} in room ${roomId}`);
      
      return {
        token,
        wsUrl: this.wsUrl,
        roomName: `voice_${roomId}`
      };
    } catch (error) {
      console.error('Error creating voice token:', error);
      throw error;
    }
  }

  async createVoiceRoom(roomId) {
    try {
      const roomName = `voice_${roomId}`;
      
      await this.roomService.createRoom({
        name: roomName,
        emptyTimeout: 300,
        maxParticipants: 10
      });

      this.activeVoiceRooms.set(roomId, {
        roomName,
        participants: new Set(),
        createdAt: Date.now()
      });

      console.log(`🎙️ Voice room created: ${roomName}`);
      return roomName;
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        console.log(`🎙️ Voice room already exists: voice_${roomId}`);
        return `voice_${roomId}`;
      }
      console.error('Error creating voice room:', error);
      throw error;
    }
  }

  async deleteVoiceRoom(roomId) {
    try {
      const roomName = `voice_${roomId}`;
      await this.roomService.deleteRoom(roomName);
      this.activeVoiceRooms.delete(roomId);
      console.log(`🎙️ Voice room deleted: ${roomName}`);
    } catch (error) {
      console.error('Error deleting voice room:', error);
    }
  }

  async getVoiceRoomInfo(roomId) {
    try {
      const roomName = `voice_${roomId}`;
      const rooms = await this.roomService.listRooms([roomName]);
      return rooms.length > 0 ? rooms[0] : null;
    } catch (error) {
      console.error('Error getting voice room info:', error);
      return null;
    }
  }

  addParticipantToVoiceRoom(roomId, participantId) {
    const room = this.activeVoiceRooms.get(roomId);
    if (room) {
      room.participants.add(participantId);
    }
  }

  removeParticipantFromVoiceRoom(roomId, participantId) {
    const room = this.activeVoiceRooms.get(roomId);
    if (room) {
      room.participants.delete(participantId);
      
      if (room.participants.size === 0) {
        setTimeout(() => {
          if (room.participants.size === 0) {
            this.deleteVoiceRoom(roomId);
          }
        }, 30000);
      }
    }
  }

  getActiveVoiceRooms() {
    return Array.from(this.activeVoiceRooms.keys());
  }

  getVoiceParticipants(roomId) {
    const room = this.activeVoiceRooms.get(roomId);
    return room ? Array.from(room.participants) : [];
  }
}

module.exports = new LiveKitService();