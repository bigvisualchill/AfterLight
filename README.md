# WebGPU Ocean Sunset Animation

A WebGPU-based animated ocean scene at sunset with depth of field effects. The camera is positioned at water level, creating an immersive view of the ocean horizon.

## Features

- Animated ocean surface using sine wave combinations
- Sunset skybox with gradient colors and sun
- Depth of field post-processing effect
- Camera positioned at water level
- Real-time animation loop

## Requirements

- A modern browser with WebGPU support (Chrome 113+, Edge 113+, or Safari 18+)
- A local web server (WebGPU requires serving files over HTTP/HTTPS, not file://)

## Running

1. Start a local web server in this directory. For example:
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Using Node.js (with http-server)
   npx http-server -p 8000
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## Files

- `index.html` - Main HTML entry point
- `main.js` - WebGPU initialization, rendering pipeline, and animation loop
- `ocean-shader.wgsl` - Ocean surface vertex and fragment shaders
- `skybox-shader.wgsl` - Skybox rendering shaders
- `dof-shader.wgsl` - Depth of field post-processing shader

## Technical Details

- Ocean surface: 128x128 grid mesh with animated wave heights
- Rendering: Two-pass pipeline (scene render to texture, then DOF post-processing)
- Depth of field: Focus distance set to keep horizon in focus, blurring foreground and background
- Animation: Time-based wave animation using multiple sine wave combinations
