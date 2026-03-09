const hlsService = require('../services/hls.service');
const liveKitService = require('../services/livekit.service');

module.exports = (io, socket) => {
  console.log(`🔌 Hybrid socket connected: ${socket.id}`);
  
  // Unirse a sala híbrida (música + voz)
  socket.on('join_hybrid_room', async (data) => {
    try {
      console.log(`🌊 Received join_hybrid_room:`, data);
      const { roomId, userId, isHost } = data;
      
      if (!roomId || !userId) {
        socket.emit('error', { message: 'Missing roomId or userId' });
        return;
      }
      
      // Unirse a la sala de Socket.IO
      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      
      // Crear sala de voz si es host
      if (isHost) {
        await liveKitService.createVoiceRoom(roomId);
      }
      
      // Responder con URLs de streaming
      const response = {
        roomId,
        hlsUrl: hlsService.getStreamUrl(roomId),
        isStreamActive: hlsService.isStreamActive(roomId)
      };
      
      console.log(`🌊 Sending hybrid_room_joined:`, response);
      socket.emit('hybrid_room_joined', response);
      
      // Notificar a otros en la sala
      socket.to(roomId).emit('user_joined_room', {
        userId,
        timestamp: Date.now()
      });
      
      console.log(`🌊 User ${userId} joined hybrid room ${roomId}`);
    } catch (error) {
      console.error(`❌ Error in join_hybrid_room:`, error);
      socket.emit('error', { message: 'Error joining room', error: error.message });
    }
  });

  // Solicitar token de voz
  socket.on('request_voice_token', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.userId;
      
      if (!userId || !roomId) {
        socket.emit('error', { message: 'Missing userId or roomId' });
        return;
      }
      
      const voiceToken = await liveKitService.createVoiceToken(roomId, userId);
      
      socket.emit('voice_token_granted', {
        ...voiceToken,
        roomId
      });
      
      // Agregar participante a la sala de voz
      liveKitService.addParticipantToVoiceRoom(roomId, userId);
      
      // Notificar a otros que alguien se unió a la voz
      socket.to(roomId).emit('voice_participant_joined', {
        userId,
        timestamp: Date.now()
      });
      
      console.log(`🎙️ Voice token granted to ${userId} for room ${roomId}`);
    } catch (error) {
      socket.emit('error', { message: 'Error creating voice token', error: error.message });
    }
  });

  // Salir de sala híbrida
  socket.on('leave_hybrid_room', async () => {
    try {
      const roomId = socket.roomId;
      const userId = socket.userId;
      
      if (roomId && userId) {
        // Salir de Socket.IO room
        socket.leave(roomId);
        
        // Remover de sala de voz
        liveKitService.removeParticipantFromVoiceRoom(roomId, userId);
        
        // Notificar a otros
        socket.to(roomId).emit('user_left_room', {
          userId,
          timestamp: Date.now()
        });
        
        socket.to(roomId).emit('voice_participant_left', {
          userId,
          timestamp: Date.now()
        });
        
        console.log(`🌊 User ${userId} left hybrid room ${roomId}`);
      }
      
      socket.roomId = null;
      socket.userId = null;
    } catch (error) {
      console.error('Error leaving hybrid room:', error);
    }
  });

  // Obtener estado de la sala
  socket.on('get_room_status', async (data) => {
    try {
      const { roomId } = data;
      
      const status = {
        roomId,
        hlsUrl: hlsService.getStreamUrl(roomId),
        isStreamActive: hlsService.isStreamActive(roomId),
        voiceParticipants: liveKitService.getVoiceParticipants(roomId),
        voiceRoomInfo: await liveKitService.getVoiceRoomInfo(roomId)
      };
      
      socket.emit('room_status', status);
    } catch (error) {
      socket.emit('error', { message: 'Error getting room status', error: error.message });
    }
  });

  // Manejar desconexión
  socket.on('disconnect', async () => {
    try {
      const roomId = socket.roomId;
      const userId = socket.userId;
      
      if (roomId && userId) {
        // Remover de sala de voz
        liveKitService.removeParticipantFromVoiceRoom(roomId, userId);
        
        // Notificar a otros
        socket.to(roomId).emit('user_disconnected', {
          userId,
          timestamp: Date.now()
        });
        
        console.log(`🌊 User ${userId} disconnected from room ${roomId}`);
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
};