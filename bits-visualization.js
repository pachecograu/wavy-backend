// Código para el EMISOR - Enviar bits de audio
function startBitsTransmission(waveId, audioElement) {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaElementSource(audioElement);
  const analyser = audioContext.createAnalyser();
  
  source.connect(analyser);
  analyser.connect(audioContext.destination);
  
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  function sendBits() {
    analyser.getByteFrequencyData(dataArray);
    
    // Convertir a string de bits para visualización
    const bitsString = Array.from(dataArray)
      .slice(0, 32) // Solo primeros 32 bytes para visualización
      .map(byte => byte.toString(2).padStart(8, '0'))
      .join('');
    
    socket.emit('stream-bits', {
      waveId: waveId,
      bitsData: bitsString,
      byteSize: dataArray.length
    });
    
    requestAnimationFrame(sendBits);
  }
  
  sendBits();
}

// Código para el OYENTE - Mostrar bits recibidos
socket.on('receive-bits', (data) => {
  const { bitsData, byteSize, timestamp } = data;
  
  // Mostrar en consola
  console.log(`📡 BITS RECIBIDOS: ${bitsData.substring(0, 64)}...`);
  console.log(`📊 Tamaño: ${byteSize} bytes | Tiempo: ${new Date(timestamp).toLocaleTimeString()}`);
  
  // Mostrar en la interfaz
  const bitsDisplay = document.getElementById('bitsDisplay');
  if (bitsDisplay) {
    bitsDisplay.innerHTML = `
      <div class="bits-stream">
        <h4>🔴 Transmisión en Vivo</h4>
        <div class="bits-data">${bitsData.substring(0, 128)}...</div>
        <div class="stream-info">
          <span>📊 ${byteSize} bytes</span>
          <span>⏰ ${new Date(timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    `;
  }
  
  // Actualizar contador de bits
  const bitsCounter = document.getElementById('bitsCounter');
  if (bitsCounter) {
    const currentCount = parseInt(bitsCounter.textContent) || 0;
    bitsCounter.textContent = currentCount + byteSize;
  }
});

// CSS para la visualización
const bitsCSS = `
.bits-stream {
  background: #1a1a1a;
  color: #00ff00;
  padding: 10px;
  border-radius: 5px;
  font-family: 'Courier New', monospace;
  margin: 10px 0;
}

.bits-data {
  font-size: 12px;
  word-break: break-all;
  line-height: 1.4;
  margin: 10px 0;
  animation: pulse 0.5s ease-in-out;
}

.stream-info {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #888;
}

@keyframes pulse {
  0% { opacity: 0.7; }
  50% { opacity: 1; }
  100% { opacity: 0.7; }
}
`;

// Agregar CSS al documento
const style = document.createElement('style');
style.textContent = bitsCSS;
document.head.appendChild(style);