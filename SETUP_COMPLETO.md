# 🚀 WAVY Backend - Setup Completo

## 📋 Requisitos Previos

1. **Node.js** >= 18.0.0
2. **FFmpeg** instalado y en PATH
3. **LiveKit Server** (se descarga automáticamente)

## 🔧 Instalación

### 1. Instalar LiveKit Server
```bash
# Ejecutar una vez
install-livekit.bat
```

### 2. Iniciar Backend Completo
```bash
# Inicia todos los servicios
start-production.bat
```

## 🎯 Servicios Activos

### HLS Streaming (Puerto 8000)
- **Input RTMP**: `rtmp://localhost:1935/live/ROOM_ID`
- **Output HLS**: `http://localhost:8000/hls/ROOM_ID/index.m3u8`
- **Uso**: OBS Studio → RTMP → HLS para Flutter

### LiveKit WebRTC (Puerto 7880)
- **WebSocket**: `ws://localhost:7880`
- **API Key**: `devkey`
- **API Secret**: `secret`
- **Uso**: Voz en tiempo real

### Node.js API (Puerto 3000)
- **Socket.IO**: Coordinación híbrida
- **REST API**: Tokens y control
- **Health**: `http://localhost:3000/health`

## 🎮 Cómo Usar

### Para Streaming de Música
1. Abrir OBS Studio
2. Configurar RTMP: `rtmp://localhost:1935/live/test-room-1`
3. Iniciar streaming
4. Flutter reproduce: `http://localhost:8000/hls/test-room-1/index.m3u8`

### Para Voz WebRTC
1. Flutter solicita token vía Socket.IO
2. Backend genera token LiveKit
3. Flutter conecta WebRTC con token
4. Voz en tiempo real funcionando

## ✅ Verificación

```bash
# Verificar servicios
curl http://localhost:3000/health
curl http://localhost:8000/hls/test/index.m3u8
```

## 🔧 Configuración

### .env
```
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

### livekit.yaml
```yaml
api_key: devkey
api_secret: secret
port: 7880
```

¡Backend híbrido completamente funcional! 🎉