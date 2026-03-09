const mongoose = require('mongoose');

const WaveSchema = new mongoose.Schema({
  name: { type: String, required: true },
  djName: { type: String, required: true },
  ownerId: { type: String, required: true },
  isOnline: { type: Boolean, default: true },
  listenersCount: { type: Number, default: 0 },
  currentTrack: {
    title: String,
    artist: String,
    duration: Number,
    startTime: Date
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Wave', WaveSchema);