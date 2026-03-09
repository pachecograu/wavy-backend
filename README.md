# WAVY Backend + MediaMTX Streaming

Backend de Node.js con streaming de audio en tiempo real usando MediaMTX y WebRTC.

## Requisitos

- Node.js 18+
- MediaMTX (para streaming de audio)
- MongoDB (opcional, usa memoria si no está disponible)

## Instalación de MediaMTX

### Windows
1. Descargar desde: https://github.com/bluenviron/mediamtx/releases
2. Extraer `mediamtx.exe` a una carpeta
3. Agregar la carpeta al PATH del sistema

### Linux/macOS
```bash
# Opción 1: Descargar binario
wget https://github.com/bluenviron/mediamtx/releases/latest/download/mediamtx_v1.4.2_linux_amd64.tar.gz
tar -xzf mediamtx_v1.4.2_linux_amd64.tar.gz
sudo mv mediamtx /usr/local/bin/

# Opción 2: Instalar con Go
go install github.com/bluenviron/mediamtx@latest
```

## Configuración

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno (opcional):
```bash
cp .env.example .env
# Editar .env con tu configuración
```

## Ejecución

### Opción 1: Script automático
```bash
# Linux/macOS
chmod +x start-wavy.sh
./start-wavy.sh

# Windows
start-wavy.bat
```

### Opción 2: Manual
```bash
# Terminal 1: Iniciar MediaMTX
mediamtx mediamtx.yml

# Terminal 2: Iniciar backend
npm start
```

## Servicios

- **Backend API**: http://localhost:3000
- **WebSocket**: ws://localhost:3000
- **MediaMTX WebRTC**: ws://localhost:8889
- **MediaMTX HLS**: http://localhost:8888
- **MediaMTX API**: http://localhost:9997

## Arquitectura de Streaming

```
[Emisor Flutter] --WebRTC--> [MediaMTX] --WebRTC--> [Oyente Flutter]
                                 |
                            [HLS Stream] (fallback web)
```

### Flujo de Audio

1. **Emisor**: Captura audio del micrófono → WebRTC → MediaMTX
2. **MediaMTX**: Recibe stream → Distribuye a múltiples oyentes
3. **Oyentes**: Reciben stream via WebRTC → Reproducen audio

## Configuración de MediaMTX

El archivo `mediamtx.yml` incluye:

- **WebRTC**: Puerto 8889 para streaming directo
- **HLS**: Puerto 8888 para compatibilidad web
- **API**: Puerto 9997 para monitoreo
- **Paths**: Configuración de streams por wave ID

## Desarrollo

```bash
# Modo desarrollo con auto-reload
npm run dev

# Ver logs de MediaMTX
tail -f mediamtx.log

# Monitorear streams activos
curl http://localhost:9997/v3/paths/list
```

## Troubleshooting

### MediaMTX no inicia
- Verificar que el puerto 8889 esté libre
- Revisar permisos del archivo `mediamtx.yml`
- Verificar logs en `mediamtx.log`

### Sin audio en oyentes
- Verificar permisos de micrófono en el navegador/app
- Comprobar configuración de ICE servers
- Revisar logs de WebRTC en DevTools

### Latencia alta
- Ajustar `hlsPartDuration` en `mediamtx.yml`
- Usar WebRTC directo en lugar de HLS
- Verificar ancho de banda de red