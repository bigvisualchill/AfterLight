#!/bin/zsh
cd "$(dirname "$0")"
echo "Starting WebGPU Particle System..."
echo "Opening http://127.0.0.1:5173 in Chrome..."
OPEN_BROWSER=1 exec node ./server.js
