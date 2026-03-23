
/**
 * Per-room state: roomId -> { users: Map<userId, socketId>, hostUserId, micActive }
 * This is in-memory only – fine for a single ECS task.
 */
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { users: new Map(), hostUserId: null, micActive: false });
  }
  return rooms.get(roomId);
}

function findSocketId(roomId, userId) {
  return rooms.get(roomId)?.users.get(userId);
}

function handleLeave(io, socket) {
  const { roomId, userId } = socket;
  if (!roomId || !userId) return;

  const room = rooms.get(roomId);
  if (room) {
    room.users.delete(userId);
    if (socket.isHost) {
      room.hostUserId = null;
      room.micActive = false;
    }
    if (room.users.size === 0) rooms.delete(roomId);
  }

  socket.leave(roomId);
  socket.to(roomId).emit('user_left_room', { userId, timestamp: Date.now() });
  // Tell remaining peers to close their WebRTC connection to this user
  socket.to(roomId).emit('webrtc_peer_disconnected', { userId });

  socket.roomId = null;
  socket.userId = null;
  socket.isHost = false;
  console.log(`🌊 User ${userId} left hybrid room ${roomId}`);
}

module.exports = (io, socket) => {
  console.log(`🔌 Hybrid socket connected: ${socket.id}`);

  // ─── JOIN ──────────────────────────────────────────────────────────────────
  socket.on('join_hybrid_room', (data) => {
    try {
      const { roomId, userId, isHost } = data || {};
      if (!roomId || !userId) {
        socket.emit('error', { message: 'Missing roomId or userId' });
        return;
      }

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      socket.isHost = !!isHost;

      const room = getRoom(roomId);
      room.users.set(userId, socket.id);
      if (isHost) room.hostUserId = userId;

      socket.emit('hybrid_room_joined', {
        roomId,
        hostUserId: room.hostUserId,
        micActive: room.micActive,
      });

      socket.to(roomId).emit('user_joined_room', {
        userId,
        isHost: !!isHost,
        timestamp: Date.now(),
      });

      console.log(`🌊 User ${userId} joined room ${roomId} (host: ${isHost})`);
    } catch (err) {
      console.error('❌ join_hybrid_room error:', err);
      socket.emit('error', { message: err.message });
    }
  });

  // ─── MIC STATE ────────────────────────────────────────────────────────────
  // Host notifies that streaming has started – listeners should request an offer
  socket.on('mic_started', () => {
    const room = rooms.get(socket.roomId);
    if (!room || !socket.isHost) return;
    if (room.micActive) return;
    room.micActive = true;
    socket.to(socket.roomId).emit('mic_started', {
      hostUserId: socket.userId,
      timestamp: Date.now(),
    });
    console.log(`🎙️ Mic started in room ${socket.roomId} by ${socket.userId}`);
  });

  socket.on('mic_stopped', () => {
    const room = rooms.get(socket.roomId);
    if (!room || !socket.isHost) return;
    if (!room.micActive) return;
    room.micActive = false;
    socket.to(socket.roomId).emit('mic_stopped', {
      hostUserId: socket.userId,
      timestamp: Date.now(),
    });
    console.log(`🎙️ Mic stopped in room ${socket.roomId}`);
  });

  // ─── WebRTC SIGNALING ─────────────────────────────────────────────────────
  // Listener asks host to create a peer connection for it
  socket.on('request_webrtc_offer', (data) => {
    const { targetUserId } = data || {};
    const targetSocketId = findSocketId(socket.roomId, targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc_offer_requested', {
        fromUserId: socket.userId,
      });
    }
  });

  // Host sends SDP offer to a specific listener
  socket.on('webrtc_offer', (data) => {
    const { targetUserId, sdp } = data || {};
    const targetSocketId = findSocketId(socket.roomId, targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc_offer', {
        fromUserId: socket.userId,
        sdp,
      });
    }
  });

  // Listener sends SDP answer back to host
  socket.on('webrtc_answer', (data) => {
    const { targetUserId, sdp } = data || {};
    const targetSocketId = findSocketId(socket.roomId, targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc_answer', {
        fromUserId: socket.userId,
        sdp,
      });
    }
  });

  // ICE candidate relay (bidirectional)
  socket.on('webrtc_ice_candidate', (data) => {
    const { targetUserId, candidate } = data || {};
    const targetSocketId = findSocketId(socket.roomId, targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc_ice_candidate', {
        fromUserId: socket.userId,
        candidate,
      });
    }
  });

  // ─── ROOM STATUS ──────────────────────────────────────────────────────────
  socket.on('get_room_status', (data) => {
    const roomId = data?.roomId || socket.roomId;
    const room = rooms.get(roomId);
    socket.emit('room_status', {
      roomId,
      participants: room ? [...room.users.keys()] : [],
      micActive: room?.micActive ?? false,
      hostUserId: room?.hostUserId ?? null,
    });
  });

  // ─── LEAVE / DISCONNECT ───────────────────────────────────────────────────
  socket.on('leave_hybrid_room', () => handleLeave(io, socket));
  socket.on('disconnect', () => handleLeave(io, socket));
};