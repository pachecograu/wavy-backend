const io = require('socket.io-client');

// Configuración de conexión
const SERVER_URL = 'http://localhost:3000';

// Simular emisor
const emisorSocket = io(SERVER_URL);
// Simular oyente
const oyenteSocket = io(SERVER_URL);

let waveId = null;

// Configurar emisor
emisorSocket.on('connect', () => {
  console.log('✅ EMISOR conectado');
  
  // Conectar usuario emisor
  emisorSocket.emit('user-connected', { userId: 'emisor-test-123' });
  
  // Crear wave
  setTimeout(() => {
    emisorSocket.emit('create-wave', {
      userId: 'emisor-test-123',
      name: 'Test Wave',
      djName: 'DJ Test'
    });
  }, 1000);
});

// Configurar oyente
oyenteSocket.on('connect', () => {
  console.log('✅ OYENTE conectado');
  
  // Conectar usuario oyente
  oyenteSocket.emit('user-connected', { userId: 'oyente-test-456' });
});

// Escuchar cuando se crea la wave
emisorSocket.on('wave-online', (wave) => {
  console.log('📻 Wave creada:', wave.name);
  waveId = wave._id || wave.id;
  
  // El oyente se une a la wave
  setTimeout(() => {
    oyenteSocket.emit('join-wave', {
      waveId: waveId,
      userId: 'oyente-test-456'
    });
  }, 1000);
});

// Escuchar actualizaciones de oyentes
emisorSocket.on('listeners-update', (data) => {
  console.log(`👥 Oyentes en wave ${data.waveId}: ${data.count}`);
  
  // Cuando hay oyentes, enviar mensaje de prueba
  if (data.count > 0) {
    setTimeout(() => {
      console.log('📤 EMISOR enviando mensaje de prueba...');
      emisorSocket.emit('test-transmission', {
        waveId: waveId,
        message: 'Hola oyentes! ¿Me escuchan?',
        timestamp: Date.now()
      });
    }, 2000);
  }
});

// Oyente recibe la transmisión
oyenteSocket.on('transmission-received', (data) => {
  console.log('📥 OYENTE recibió:', data.message);
  console.log('⏰ Timestamp:', new Date(data.timestamp).toLocaleTimeString());
  
  // Confirmar recepción
  oyenteSocket.emit('confirm-reception', {
    waveId: waveId,
    userId: 'oyente-test-456',
    timestamp: data.timestamp
  });
});

// Emisor recibe confirmación
emisorSocket.on('reception-confirmed', (data) => {
  console.log('✅ CONFIRMACIÓN recibida del oyente:', data.userId);
  console.log('⏰ Confirmado en:', new Date(data.confirmedAt).toLocaleTimeString());
  
  // Finalizar prueba
  setTimeout(() => {
    console.log('🏁 Prueba completada exitosamente!');
    process.exit(0);
  }, 2000);
});

// Manejo de errores
emisorSocket.on('error', (error) => {
  console.error('❌ Error emisor:', error);
});

oyenteSocket.on('error', (error) => {
  console.error('❌ Error oyente:', error);
});

// Timeout de seguridad
setTimeout(() => {
  console.log('⏰ Timeout - cerrando prueba');
  process.exit(1);
}, 15000);