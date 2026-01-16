// Export utilities for WebGPU Particle System
// Handles settings serialization, presets, and standalone export

/**
 * List of all serializable settings with their default values
 * This serves as the schema for presets and standalone exports
 */
export const SETTINGS_SCHEMA = {
  // Particle settings
  emissionRate: 40,
  initialSpeed: 1.0,
  lifeSeconds: 2.0,
  lifeRandom: 0.0,
  particleSize: 1.0,
  sizeRandom: 0.0,
  particleShape: "circle",
  sphereSubdivisions: 2,
  particleColorMode: "gradient",
  solidColor: [0.9, 0.9, 0.95],
  particleOpacity: 1.0,
  blendMode: "screen",
  softness: 0.0,
  noiseStrength: 0.0,
  
  // Spin settings
  spinRateX: 1.2,
  spinRateY: 1.2,
  spinRateZ: 1.2,
  spinRandom: 0.4,
  
  // Emitter settings
  emitterPos: [0, 0, 0],
  emitterSize: 0.2,
  emitterShape: "point",
  emitFrom: "volume",
  emissionDirection: "directional",
  coneAngle: 16,
  directionRotX: 0,
  directionRotY: 0,
  directionRotZ: 0,
  speedRandom: 0.2,
  
  // Animation settings
  emitterAnimEnabled: false,
  emitterAnimX: { enabled: false, speed: 1.0, type: "sine" },
  emitterAnimY: { enabled: false, speed: 1.0, type: "sine" },
  emitterAnimZ: { enabled: false, speed: 1.0, type: "sine" },
  emitterVelocityAffected: false,
  emitterVelocityAmount: 1.0,
  vortexAnimEnabled: false,
  vortexAnimX: { enabled: false, speed: 1.0, type: "sine" },
  vortexAnimY: { enabled: false, speed: 1.0, type: "sine" },
  vortexAnimZ: { enabled: false, speed: 1.0, type: "sine" },
  attractorAnimEnabled: false,
  attractorAnimX: { enabled: false, speed: 1.0, type: "sine" },
  attractorAnimY: { enabled: false, speed: 1.0, type: "sine" },
  attractorAnimZ: { enabled: false, speed: 1.0, type: "sine" },
  
  // Forces settings
  forceMode: "turbulence",
  turbulenceStrength: 1.2,
  turbulenceScale: 0.8,
  curlStrength: 1.2,
  curlScale: 0.8,
  vortexEnabled: false,
  vortexStrength: 1.8,
  vortexRadius: 1.5,
  vortexPos: [0, 0, 0],
  vortexRotX: 0,
  vortexRotY: 0,
  vortexRotZ: 0,
  attractorEnabled: false,
  attractorStrength: 0.0,
  attractorRadius: 0.0,
  attractorPos: [0, 0, 0],
  gravity: -2.0,
  wind: [0.0, 0.0, 0.0],
  drag: 0.0,
  groundEnabled: true,
  groundLevel: -1.0,
  bounce: 0.2,
  forcesEnabled: false,
  
  // Shading settings
  shadingEnabled: false,
  shadingStyle: "smooth",
  lightIntensity: 1.2,
  lightPos: [0, 1, 0.3],
  lightColor: [0.55, 0.74, 1.0],
  rimIntensity: 0.4,
  specIntensity: 0.3,
  surfaceEnabled: true,
  wireframeEnabled: false,
  wireframeSameColor: true,
  wireframeColor: [1.0, 1.0, 1.0],
  
  // Camera settings
  cameraRotX: 0,
  cameraRotY: 0,
  cameraRotZ: 0,
  cameraViewEnabled: false,
  dofEnabled: true,
  dofDepthSlider: 0.5,
  dofApertureSlider: 0.3,
  focusRange: 0.8,
  
  // Background settings
  bgMode: "solid",
  bgSolidColor: [0.0, 0.0, 0.0],
  bgLinearDirection: "vertical",
  bgRadialCenter: [0.5, 0.5],
  
  // Curve data
  sizeCurvePoints: [
    { x: 0, y: 0.2 },
    { x: 0.15, y: 0.85 },
    { x: 0.5, y: 1 },
    { x: 1, y: 0 }
  ],
  opacityCurvePoints: [
    { x: 0, y: 0 },
    { x: 0.1, y: 1 },
    { x: 0.8, y: 1 },
    { x: 1, y: 0 }
  ],
  colorGradientPoints: [
    { pos: 0.0, color: [1.0, 1.0, 1.0] },
    { pos: 0.5, color: [0.85, 0.7, 0.95] },
    { pos: 1.0, color: [0.6, 0.3, 0.7] }
  ],
  bgGradientPoints: [
    { pos: 0, color: [0.05, 0.05, 0.1] },
    { pos: 1, color: [0.0, 0.0, 0.0] }
  ]
};

/**
 * Serialize current settings from the global scope
 * @param {Object} globals - Object containing all the global settings variables
 * @returns {Object} Serialized settings object
 */
export function serializeSettings(globals) {
  const settings = {};
  
  for (const key of Object.keys(SETTINGS_SCHEMA)) {
    if (key in globals) {
      const value = globals[key];
      // Deep clone arrays and objects
      if (Array.isArray(value)) {
        settings[key] = JSON.parse(JSON.stringify(value));
      } else if (typeof value === 'object' && value !== null) {
        settings[key] = JSON.parse(JSON.stringify(value));
      } else {
        settings[key] = value;
      }
    }
  }
  
  return settings;
}

/**
 * Deserialize settings and apply them via setter functions
 * @param {Object} settings - Settings object to apply
 * @param {Object} setters - Object mapping setting names to setter functions
 */
export function deserializeSettings(settings, setters) {
  for (const [key, value] of Object.entries(settings)) {
    if (key in setters && typeof setters[key] === 'function') {
      try {
        setters[key](value);
      } catch (e) {
        console.warn(`Failed to apply setting ${key}:`, e);
      }
    }
  }
}

/**
 * Download settings as a JSON preset file
 * @param {Object} settings - Settings object to save
 * @param {string} filename - Name for the downloaded file
 */
export function downloadPreset(settings, filename = 'particle-preset.json') {
  const json = JSON.stringify(settings, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Load a preset file and return the settings object
 * @param {File} file - File object from file input
 * @returns {Promise<Object>} Parsed settings object
 */
export function loadPresetFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result);
        resolve(settings);
      } catch (err) {
        reject(new Error('Invalid preset file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Video recording state
 */
let mediaRecorder = null;
let recordedChunks = [];

/**
 * Get the best supported mime type for a format
 * @param {string} format - 'webm' or 'mp4'
 * @returns {Object} { mimeType, extension, supported }
 */
export function getVideoMimeType(format) {
  if (format === 'mp4') {
    // Try MP4 codecs in order of preference
    const mp4Types = [
      'video/mp4;codecs=avc1.42E01E', // H.264 Baseline
      'video/mp4;codecs=avc1.4D401E', // H.264 Main
      'video/mp4;codecs=avc1.64001E', // H.264 High
      'video/mp4'
    ];
    for (const type of mp4Types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return { mimeType: type, extension: 'mp4', supported: true };
      }
    }
    // MP4 not supported, fall back to WebM
    return { mimeType: null, extension: 'mp4', supported: false };
  }
  
  // WebM (default)
  const webmTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  for (const type of webmTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return { mimeType: type, extension: 'webm', supported: true };
    }
  }
  return { mimeType: 'video/webm', extension: 'webm', supported: true };
}

/**
 * Start recording the canvas as video
 * @param {HTMLCanvasElement} canvas - Canvas element to record
 * @param {string} format - 'webm' or 'mp4'
 * @param {Function} onStart - Callback when recording starts
 * @param {Function} onStop - Callback when recording stops with blob and extension
 * @param {Function} onError - Callback when format not supported
 * @returns {Object} Recording controller with stop() method
 */
export function startVideoRecording(canvas, format, onStart, onStop, onError) {
  const { mimeType, extension, supported } = getVideoMimeType(format);
  
  if (!supported || !mimeType) {
    if (onError) {
      onError(`${format.toUpperCase()} format is not supported in this browser. Try WebM instead.`);
    }
    return null;
  }
  
  const stream = canvas.captureStream(60); // 60 fps
  recordedChunks = [];
  
  mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8000000 // 8 Mbps for high quality
  });
  
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };
  
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: mimeType });
    if (onStop) onStop(blob, extension);
  };
  
  mediaRecorder.start(100); // Collect data every 100ms
  if (onStart) onStart();
  
  return {
    stop: () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    },
    isRecording: () => mediaRecorder && mediaRecorder.state === 'recording'
  };
}

/**
 * Download a video blob as a file
 * @param {Blob} blob - Video blob
 * @param {string} filename - Filename for download
 */
export function downloadVideo(blob, filename = 'particle-recording.webm') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format seconds as mm:ss
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
