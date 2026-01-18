// Main entry point - Orchestrates particle system application
// All logic is delegated to focused modules

import { state, particles, serializeState, PERF_UPDATE_MS, PERF_GPU_SAMPLE_MS, RECORDING_DT } from './src/state.js';
import { Renderer } from './src/renderer.js';
import { updateCamera, computeDOFParams, worldUnitsPerPixelAt, view } from './src/camera.js';
import { spawnAt, updateParticles, emitParticles, sortParticlesByDepth, buildInstanceData } from './src/particles.js';
import { updateAnimations } from './src/animation.js';
import { renderAllGizmos, updateGizmoHover, startGizmoDrag, updateGizmoDrag, endGizmoDrag } from './src/gizmos.js';
import { initElements, setupEventListeners, syncUIFromState, updatePerfHud, setupCurveEditor, setupGradientEditor } from './src/ui-bindings.js';
import { startVideoRecording, downloadVideo, downloadHtml } from './exportUtils.js';

// ============================================================================
// Application State
// ============================================================================

let renderer = null;
let canvas = null;
let gizmoCanvas = null;
let gizmoCtx = null;

let instanceData = null;
let lastFrame = 0;

// Curve editors
let sizeCurveEditor = null;
let opacityCurveEditor = null;
let colorGradientEditor = null;
let bgGradientEditor = null;

// Video recording
let mediaRecorder = null;
let recordedChunks = [];

// ============================================================================
// Initialization
// ============================================================================

async function init() {
  // Get canvas elements
  canvas = document.getElementById("gfx");
  gizmoCanvas = document.getElementById("gizmo");
  
  if (!canvas || !gizmoCanvas) {
    console.error("Canvas elements not found");
    return;
  }
  
  gizmoCtx = gizmoCanvas.getContext("2d");
  
  // Initialize renderer
  renderer = new Renderer();
  const success = await renderer.init(canvas);
  
  if (!success) {
    document.body.innerHTML = '<div style="color:#fff;padding:40px;text-align:center;"><h1>WebGPU Not Supported</h1><p>Please use a browser that supports WebGPU (Chrome 113+, Edge 113+, or Firefox Nightly with flags enabled)</p></div>';
    return;
  }
  
  // Initialize instance data buffer
  instanceData = new Float32Array(state.particle.capacity * 17);
  
  // Initialize UI
  initElements();
  setupEventListeners({
    onCapacityChange: handleCapacityChange,
    onDprChange: handleResize,
    onRecordVideo: handleRecordVideo,
    onExportHtml: handleExportHtml,
  });
  
  // Setup curve editors
  sizeCurveEditor = setupCurveEditor("sizeCurveCanvas", state.curves.size, (pts) => {
    state.curves.size = pts;
  });
  
  opacityCurveEditor = setupCurveEditor("opacityCurveCanvas", state.curves.opacity, (pts) => {
    state.curves.opacity = pts;
  });
  
  colorGradientEditor = setupGradientEditor("colorGradientCanvas", state.curves.colorGradient, (pts) => {
    state.curves.colorGradient = pts;
  });
  
  bgGradientEditor = setupGradientEditor("bgGradientCanvas", state.background.gradientPoints, (pts) => {
    state.background.gradientPoints = pts;
  });
  
  // Sync UI to initial state
  syncUIFromState();
  
  // Setup canvas events
  setupCanvasEvents();
  
  // Handle resize
  handleResize();
  window.addEventListener("resize", handleResize);
  
  // Start render loop
  lastFrame = performance.now();
  requestAnimationFrame(frame);
}

// ============================================================================
// Canvas Event Handling
// ============================================================================

function setupCanvasEvents() {
  // Gizmo interaction
  gizmoCanvas.addEventListener("mousemove", (e) => {
    const rect = gizmoCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (state.gizmos.dragging) {
      updateGizmoDrag(x, y, gizmoCanvas.width, gizmoCanvas.height, rect.height);
    } else {
      updateGizmoHover(x, y, gizmoCanvas.width, gizmoCanvas.height);
    }
  });
  
  gizmoCanvas.addEventListener("mousedown", (e) => {
    const rect = gizmoCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (startGizmoDrag(x, y, gizmoCanvas.width, gizmoCanvas.height)) {
      e.preventDefault();
    }
  });
  
  gizmoCanvas.addEventListener("mouseup", () => {
    endGizmoDrag();
  });
  
  gizmoCanvas.addEventListener("mouseleave", () => {
    endGizmoDrag();
  });
  
  // Prevent context menu on gizmo canvas
  gizmoCanvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
}

// ============================================================================
// Resize Handling
// ============================================================================

function handleResize() {
  const dpr = window.devicePixelRatio * state.render.dprMultiplier;
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  
  canvas.width = width;
  canvas.height = height;
  gizmoCanvas.width = width;
  gizmoCanvas.height = height;
  
  renderer.resize(width, height);
}

function handleCapacityChange(newCapacity) {
  // Recreate instance buffer if needed
  if (newCapacity > instanceData.length / 17) {
    instanceData = new Float32Array(newCapacity * 17);
  }
  
  // Trim particles if over capacity
  while (particles.length > newCapacity) {
    particles.pop();
  }
}

// ============================================================================
// Export Handlers
// ============================================================================

function setRecordingUi(isRecording, message = "") {
  const recordBtn = document.getElementById("recordVideoBtn");
  const statusEl = document.getElementById("recordingStatus");
  if (recordBtn) {
    const label = recordBtn.querySelector("span");
    if (label) label.textContent = isRecording ? "Stop Recording" : "Start Recording";
  }
  if (statusEl) statusEl.textContent = message;
}

function handleRecordVideo() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    return;
  }
  
  const formatEl = document.getElementById("videoFormat");
  const preferredFormat = formatEl ? formatEl.value : "webm";

  state.recording.fixedFpsEnabled = true;
  state.recording.frameAccum = 0;

  const result = startVideoRecording(canvas, preferredFormat);
  if (result) {
    mediaRecorder = result.recorder;
    recordedChunks = result.chunks;

    setRecordingUi(true, `Recording (${result.extension.toUpperCase()}, ${result.fps} FPS)…`);
    
    mediaRecorder.onstop = () => {
      state.recording.fixedFpsEnabled = false;
      setRecordingUi(false, "Processing…");
      downloadVideo(recordedChunks, {
        mimeType: result.mimeType,
        extension: result.extension,
        onInfo: (info) => {
          const { width, height, durationSec } = info || {};
          const dims = width && height ? `${width}×${height}` : "unknown size";
          const dur = durationSec ? `${durationSec.toFixed(2)}s` : "";
          setRecordingUi(false, `Saved (${result.extension.toUpperCase()} ${dims}${dur ? `, ${dur}` : ""})`);
        },
      });
      mediaRecorder = null;
      recordedChunks = [];
    };
  } else {
    state.recording.fixedFpsEnabled = false;
  }
}

function handleExportHtml() {
  const settings = serializeState();
  downloadHtml(settings);
}

// ============================================================================
// Main Render Loop
// ============================================================================

function frame(now) {
  requestAnimationFrame(frame);
  
  // Calculate delta time
  let dt = (now - lastFrame) / 1000;
  lastFrame = now;
  
  // Clamp dt to prevent huge jumps
  dt = Math.min(dt, 0.1);
  
  // Fixed timestep for recording
  if (state.recording.fixedFpsEnabled) {
    state.recording.frameAccum += dt;
    if (state.recording.frameAccum < RECORDING_DT) return;
    state.recording.frameAccum -= RECORDING_DT;
    dt = RECORDING_DT;
  }
  
  const frameStart = performance.now();
  
  // Update animations
  updateAnimations(dt, syncEmitterUI, syncVortexUI, syncAttractorUI);
  
  // Emit and update particles
  emitParticles(dt);
  updateParticles(dt, now);
  
  // Get camera parameters
  const uniformData = updateCamera(now / 1000, canvas.width, canvas.height);
  
  // Sort particles for proper blending
  const cameraEye = state.camera.viewEnabled ? state.camera.eye : state.camera.neutralEye;
  sortParticlesByDepth(cameraEye, state.camera.forward);
  
  // Build instance data
  const baseUnitsPerPixel = worldUnitsPerPixelAt(state.emitter.pos, canvas.clientHeight);
  const particleCount = buildInstanceData(instanceData, state.particle.size, baseUnitsPerPixel);
  
  // Build background uniforms (includes gradient stops)
  const bgUniformData = buildBackgroundUniforms();
  
  // Build DOF uniforms
  let cocData = null, blurData = null, compositeData = null, blurNearData = null;
  const dofActive = state.camera.viewEnabled && state.dof.enabled;
  if (dofActive) {
    const dofParams = computeDOFParams(dt, canvas.width, canvas.height);
    cocData = dofParams.cocUniformData;
    blurData = dofParams.blurUniformData;
    compositeData = dofParams.compositeUniformData;
    
    // Near blur pass uniform (same as far but with isNearPass = 1)
    blurNearData = new Float32Array(blurData);
    blurNearData[4] = 1.0; // isNearPass
  }
  
  // Update GPU buffers
  renderer.updateUniforms(uniformData, bgUniformData, cocData, blurData, compositeData, dofActive);
  renderer.updateInstances(instanceData, particleCount);
  
  // Render
  renderer.render(particleCount, dofActive, blurNearData);
  
  // Render gizmos
  renderAllGizmos(gizmoCtx, gizmoCanvas.width, gizmoCanvas.height);
  
  // Update performance HUD
  const frameEnd = performance.now();
  updatePerformanceMetrics(frameStart, frameEnd, particleCount, now);
}

// ============================================================================
// Background Uniform Building
// ============================================================================

function buildBackgroundUniforms() {
  // BackgroundUniforms struct layout (192 bytes):
  // mode: u32, linearDirection: u32, radialCenter: vec2f  (16 bytes)
  // solidColor: vec4f                                      (16 bytes)
  // stop0-stop7: 8 x vec4f (r,g,b,position)               (128 bytes)
  // numStops: u32, _pad: vec3u                            (16 bytes)
  // Total: 176 bytes, padded to 192 bytes
  
  const buffer = new ArrayBuffer(192);
  const u32View = new Uint32Array(buffer);
  const f32View = new Float32Array(buffer);
  
  // Mode: 0 = transparent, 1 = solid, 2 = linear, 3 = radial
  let mode = 1; // solid
  if (state.background.mode === "transparent") mode = 0;
  else if (state.background.mode === "linear" || state.background.mode === "linear-gradient") mode = 2;
  else if (state.background.mode === "radial" || state.background.mode === "radial-gradient") mode = 3;
  
  // First 16 bytes: mode (u32), linearDirection (u32), radialCenter (vec2f)
  u32View[0] = mode;
  u32View[1] = state.background.linearDirection === "horizontal" ? 1 : 0;
  f32View[2] = state.background.radialCenter[0];
  f32View[3] = state.background.radialCenter[1];
  
  // Second 16 bytes: solidColor (vec4f)
  f32View[4] = state.background.solidColor[0];
  f32View[5] = state.background.solidColor[1];
  f32View[6] = state.background.solidColor[2];
  f32View[7] = 1.0;
  
  // Gradient stops (8 vec4f: r, g, b, position) - 128 bytes starting at offset 32
  const stops = state.background.gradientPoints;
  for (let i = 0; i < 8; i++) {
    const offset = 8 + i * 4; // float index
    if (i < stops.length) {
      f32View[offset + 0] = stops[i].color[0];
      f32View[offset + 1] = stops[i].color[1];
      f32View[offset + 2] = stops[i].color[2];
      f32View[offset + 3] = stops[i].x;
    }
  }
  
  // numStops (u32) + padding - at byte offset 160 (float index 40)
  u32View[40] = stops.length;
  
  return f32View;
}

// ============================================================================
// Performance Metrics
// ============================================================================

function updatePerformanceMetrics(frameStart, frameEnd, particleCount, now) {
  const cpuMs = frameEnd - frameStart;
  
  state.perf.accum += cpuMs;
  state.perf.count++;
  
  if (now - state.perf.lastUpdate > PERF_UPDATE_MS) {
    const avgCpu = state.perf.accum / state.perf.count;
    const fps = 1000 / (now - state.perf.lastFrame) * state.perf.count;
    
    updatePerfHud(fps, particleCount, avgCpu, state.perf.gpuMs);
    
    state.perf.accum = 0;
    state.perf.count = 0;
    state.perf.lastUpdate = now;
    state.perf.lastFrame = now;
  }
  
  // Sample GPU time periodically
  if (renderer.timestampSupported && !state.perf.gpuInFlight && now - state.perf.lastGpuSample > PERF_GPU_SAMPLE_MS) {
    state.perf.gpuInFlight = true;
    state.perf.lastGpuSample = now;
    
    renderer.readGpuTime().then(gpuMs => {
      if (gpuMs !== null) {
        state.perf.gpuMs = gpuMs;
      }
      state.perf.gpuInFlight = false;
    });
  }
}

// ============================================================================
// UI Sync Callbacks for Animation
// ============================================================================

function syncEmitterUI() {
  const els = document.getElementById("emitterPosX");
  if (els) {
    els.value = state.emitter.pos[0];
    const v = document.getElementById("emitterPosXVal");
    if (v) v.textContent = state.emitter.pos[0].toFixed(2);
  }
  const ely = document.getElementById("emitterPosY");
  if (ely) {
    ely.value = state.emitter.pos[1];
    const v = document.getElementById("emitterPosYVal");
    if (v) v.textContent = state.emitter.pos[1].toFixed(2);
  }
  const elz = document.getElementById("emitterPosZ");
  if (elz) {
    elz.value = state.emitter.pos[2];
    const v = document.getElementById("emitterPosZVal");
    if (v) v.textContent = state.emitter.pos[2].toFixed(2);
  }
}

function syncVortexUI() {
  const els = document.getElementById("vortexPosX");
  if (els) {
    els.value = state.vortex.pos[0];
    const v = document.getElementById("vortexPosXVal");
    if (v) v.textContent = state.vortex.pos[0].toFixed(2);
  }
  const ely = document.getElementById("vortexPosY");
  if (ely) {
    ely.value = state.vortex.pos[1];
    const v = document.getElementById("vortexPosYVal");
    if (v) v.textContent = state.vortex.pos[1].toFixed(2);
  }
  const elz = document.getElementById("vortexPosZ");
  if (elz) {
    elz.value = state.vortex.pos[2];
    const v = document.getElementById("vortexPosZVal");
    if (v) v.textContent = state.vortex.pos[2].toFixed(2);
  }
}

function syncAttractorUI() {
  const els = document.getElementById("attractorPosX");
  if (els) {
    els.value = state.attractor.pos[0];
    const v = document.getElementById("attractorPosXVal");
    if (v) v.textContent = state.attractor.pos[0].toFixed(2);
  }
  const ely = document.getElementById("attractorPosY");
  if (ely) {
    ely.value = state.attractor.pos[1];
    const v = document.getElementById("attractorPosYVal");
    if (v) v.textContent = state.attractor.pos[1].toFixed(2);
  }
  const elz = document.getElementById("attractorPosZ");
  if (elz) {
    elz.value = state.attractor.pos[2];
    const v = document.getElementById("attractorPosZVal");
    if (v) v.textContent = state.attractor.pos[2].toFixed(2);
  }
}

// ============================================================================
// Start Application
// ============================================================================

init();
