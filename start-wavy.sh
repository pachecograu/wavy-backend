#!/bin/bash

# WAVY Backend + MediaMTX Startup Script

echo "🌊 Starting WAVY Backend with MediaMTX..."

# Check if MediaMTX is installed
if ! command -v mediamtx &> /dev/null; then
    echo "❌ MediaMTX not found. Please install MediaMTX first:"
    echo "   Download from: https://github.com/bluenviron/mediamtx/releases"
    echo "   Or install via: go install github.com/bluenviron/mediamtx@latest"
    exit 1
fi

# Start MediaMTX in background
echo "🎵 Starting MediaMTX server..."
mediamtx mediamtx.yml &
MEDIAMTX_PID=$!

# Wait a moment for MediaMTX to start
sleep 2

# Start Node.js backend
echo "🚀 Starting WAVY Backend..."
npm start &
BACKEND_PID=$!

echo "✅ WAVY Backend running on http://localhost:3000"
echo "✅ MediaMTX WebRTC running on ws://localhost:8889"
echo "✅ MediaMTX HLS running on http://localhost:8888"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $MEDIAMTX_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for background processes
wait