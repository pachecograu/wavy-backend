@echo off
echo 🌊 Starting WAVY Hybrid Backend...

echo Installing dependencies...
npm install

echo Creating directories...
if not exist "public\hls" mkdir public\hls

echo Starting LiveKit Server...
start "LiveKit" cmd /k "echo Starting LiveKit... && timeout 2 && livekit-server.exe --config livekit.yaml"

echo Waiting for LiveKit to start...
timeout 5

echo Starting Node Backend...
start "Node Backend" cmd /k "npm run dev"

echo ✅ WAVY Backend started!
echo 🎵 HLS streaming: http://localhost:8000/hls
echo 📡 RTMP input: rtmp://localhost:1935/live/ROOM_ID
echo 🎙️ WebRTC voice: ws://localhost:7880
echo 🌐 API server: http://localhost:3000

pause