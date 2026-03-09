const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  authType: { type: String, enum: ['anon', 'google', 'phone'], required: true },
  displayName: { type: String, required: true },
  avatar: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);