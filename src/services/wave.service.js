const waveService = {
  waves: [
    {
      _id: '1',
      name: 'Chill Vibes 🌙',
      djName: 'DJ Luna',
      isOnline: true,
      listenersCount: 42
    },
    {
      _id: '2', 
      name: 'Rock Classics 🎸',
      djName: 'RockMaster',
      isOnline: true,
      listenersCount: 128
    }
  ],

  getOnlineWaves() {
    return this.waves.filter(w => w.isOnline);
  },

  createWave(data) {
    const wave = {
      _id: `wave_${Date.now()}`,
      name: data.name || 'New Wave',
      djName: data.creator || 'Anonymous DJ',
      isOnline: true,
      listenersCount: 0
    };
    this.waves.push(wave);
    return wave;
  },

  addListener(waveId) {
    const wave = this.waves.find(w => w._id === waveId);
    if (wave) wave.listenersCount++;
  },

  removeListener(waveId) {
    const wave = this.waves.find(w => w._id === waveId);
    if (wave && wave.listenersCount > 0) wave.listenersCount--;
  }
};

module.exports = waveService;