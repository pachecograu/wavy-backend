const mongoose = require('mongoose');

const TrackSchema = new mongoose.Schema({
  waveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wave', required: true },
  title: { type: String, required: true },
  artist: { type: String, required: true },
  duration: Number,
  isCurrent: { type: Boolean, default: false },
  playedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Track', TrackSchema);