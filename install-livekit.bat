@echo off
echo 🎙️ Installing LiveKit Server...

echo Downloading LiveKit Server...
curl -L https://github.com/livekit/livekit/releases/latest/download/livekit_windows_amd64.exe -o livekit-server.exe

echo Creating LiveKit config...
echo api_key: devkey > livekit.yaml
echo api_secret: secret >> livekit.yaml
echo port: 7880 >> livekit.yaml
echo rtc: >> livekit.yaml
echo   tcp_port: 7881 >> livekit.yaml
echo   port_range_start: 50000 >> livekit.yaml
echo   port_range_end: 60000 >> livekit.yaml

echo ✅ LiveKit Server installed!
echo Run: livekit-server.exe --config livekit.yaml

pause