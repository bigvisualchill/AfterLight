// Main entry point - Orchestrates particle system application
// All logic is delegated to focused modules

import { state, particles, serializeState, PERF_UPDATE_MS, PERF_GPU_SAMPLE_MS, RECORDING_DT, spawnAccum, setSpawnAccum } from './src/state.js';
import { Renderer } from './src/renderer.js';
import { updateCamera, computeDOFParams, worldUnitsPerPixelAt, view } from './src/camera.js';
import { spawnAt, updateParticles, emitParticles, sortParticlesByDepth, buildInstanceData } from './src/particles.js';
import { updateAnimations } from './src/animation.js';
import { renderAllGizmos, updateGizmoHover, startGizmoDrag, updateGizmoDrag, endGizmoDrag } from './src/gizmos.js';
import { initElements, setupEventListeners, syncUIFromState, updatePerfHud, setPerfHudVisible, setupCurveEditor, setupGradientEditor } from './src/ui-bindings.js';
import { startVideoRecording, downloadVideo, downloadHtml } from './exportUtils.js';
import { rotateX, rotateY, rotateZ, normalizeVec3 } from './src/math.js';

// ============================================================================
// GPU Simulation State
// ============================================================================

let useGPUSim = true; // Use GPU particle simulation by default
let gpuFrameIndex = 0;
let gpuEmitterPrevPos = [0, 0, 0];
let gpuSpawnAccum = 0;

// ============================================================================
// GPU Param Builders
// ============================================================================

function applyEmitterRotation(point) {
  const ax = (state.emitter.directionRotX * Math.PI) / 180;
  const ay = (state.emitter.directionRotY * Math.PI) / 180;
  const az = (state.emitter.directionRotZ * Math.PI) / 180;
  let p = rotateX(point, ax);
  p = rotateY(p, ay);
  p = rotateZ(p, az);
  return p;
}

function getEmissionDirection() {
  let dir = [0, 1, 0];
  dir = applyEmitterRotation(dir);
  return normalizeVec3(dir);
}

function computeVortexAxis() {
  const ax = (state.vortex.rotX * Math.PI) / 180;
  const ay = (state.vortex.rotY * Math.PI) / 180;
  const az = (state.vortex.rotZ * Math.PI) / 180;
  let axis = [0, 1, 0];
  axis = rotateX(axis, ax);
  axis = rotateY(axis, ay);
  axis = rotateZ(axis, az);
  return normalizeVec3(axis);
}

/**
 * Build simulation uniform data for GPU compute
 */
function buildSimParams(dt, time) {
  const buffer = new ArrayBuffer(128);
  const f32 = new Float32Array(buffer);
  const u32 = new Uint32Array(buffer);
  
  // dt, time, gravity, drag (16 bytes)
  f32[0] = dt;
  f32[1] = time;
  f32[2] = state.forces.gravity;
  f32[3] = state.forces.drag;
  
  // wind (vec3), noiseEnabled (u32) (16 bytes)
  f32[4] = state.forces.wind[0];
  f32[5] = state.forces.wind[1];
  f32[6] = state.forces.wind[2];
  u32[7] = state.forces.noiseEnabled ? 1 : 0;
  
  // noiseMode, turbulenceStrength, turbulenceScale, curlStrength (16 bytes)
  u32[8] = state.forces.mode === "curl" ? 1 : 0;
  f32[9] = state.forces.turbulenceStrength;
  f32[10] = state.forces.turbulenceScale;
  f32[11] = state.forces.curlStrength;
  
  // curlScale, vortexEnabled, vortexStrength, vortexRadius (16 bytes)
  f32[12] = state.forces.curlScale;
  u32[13] = state.vortex.enabled ? 1 : 0;
  f32[14] = state.vortex.strength;
  f32[15] = state.vortex.radius;
  
  // vortexPos (vec3), attractorEnabled (u32) (16 bytes)
  f32[16] = state.vortex.pos[0];
  f32[17] = state.vortex.pos[1];
  f32[18] = state.vortex.pos[2];
  u32[19] = state.attractor.enabled ? 1 : 0;
  
  // vortexAxis (vec3), attractorStrength (16 bytes)
  const vortexAxis = computeVortexAxis();
  f32[20] = vortexAxis[0];
  f32[21] = vortexAxis[1];
  f32[22] = vortexAxis[2];
  f32[23] = state.attractor.strength;
  
  // attractorPos (vec3), attractorRadius (16 bytes)
  f32[24] = state.attractor.pos[0];
  f32[25] = state.attractor.pos[1];
  f32[26] = state.attractor.pos[2];
  f32[27] = state.attractor.radius;
  
  // groundEnabled, groundLevel, bounce, emitterPosY (16 bytes)
  u32[28] = state.forces.groundEnabled ? 1 : 0;
  f32[29] = state.forces.groundLevel;
  f32[30] = state.forces.bounce;
  f32[31] = state.emitter.pos[1];
  
  return f32;
}

/**
 * Build emit uniform data for GPU compute
 */
function buildEmitParams(spawnCount, dt) {
  const buffer = new ArrayBuffer(128);
  const f32 = new Float32Array(buffer);
  const u32 = new Uint32Array(buffer);
  
  // Emitter velocity (for particle inheritance)
  const emitterVel = [
    (state.emitter.pos[0] - gpuEmitterPrevPos[0]) / Math.max(dt, 0.001),
    (state.emitter.pos[1] - gpuEmitterPrevPos[1]) / Math.max(dt, 0.001),
    (state.emitter.pos[2] - gpuEmitterPrevPos[2]) / Math.max(dt, 0.001),
  ];
  
  // emitterPos (vec3), spawnCount (u32) (16 bytes)
  f32[0] = state.emitter.pos[0];
  f32[1] = state.emitter.pos[1];
  f32[2] = state.emitter.pos[2];
  u32[3] = spawnCount;
  
  // emitterPrevPos (vec3), emitterSize (f32) (16 bytes)
  f32[4] = gpuEmitterPrevPos[0];
  f32[5] = gpuEmitterPrevPos[1];
  f32[6] = gpuEmitterPrevPos[2];
  f32[7] = state.emitter.size;
  
  // emitterShape, emitFrom, direction, coneAngle (16 bytes)
  const shapeMap = { point: 0, sphere: 1, box: 2, plane: 3, line: 4 };
  u32[8] = shapeMap[state.emitter.shape] || 0;
  u32[9] = state.emitter.emitFrom === "surface" ? 1 : 0;
  const dirMap = { directional: 0, spherical: 1, outward: 2 };
  u32[10] = dirMap[state.emitter.direction] || 0;
  f32[11] = state.emitter.coneAngle;
  
  // baseDir (vec3), initialSpeed (16 bytes)
  const baseDir = getEmissionDirection();
  f32[12] = baseDir[0];
  f32[13] = baseDir[1];
  f32[14] = baseDir[2];
  f32[15] = state.particle.initialSpeed;
  
  // speedRandom, life, lifeRandom, sizeBase (16 bytes)
  f32[16] = state.emitter.speedRandom;
  f32[17] = state.particle.lifeSeconds;
  f32[18] = state.particle.lifeRandom;
  f32[19] = state.particle.size;
  
  // sizeRandom, spinBase, spinRandom, colorMode (16 bytes)
  f32[20] = state.particle.sizeRandom;
  f32[21] = (state.particle.spinRateX + state.particle.spinRateY + state.particle.spinRateZ) / 3;
  f32[22] = state.particle.spinRandom;
  const colorModeMap = { solid: 0, random: 1, gradient: 2 };
  u32[23] = colorModeMap[state.particle.colorMode] || 0;
  
  // solidColor (vec3), frameIndex (u32) (16 bytes)
  f32[24] = state.particle.solidColor[0];
  f32[25] = state.particle.solidColor[1];
  f32[26] = state.particle.solidColor[2];
  u32[27] = gpuFrameIndex;
  
  // emitterVelocity (vec3), emitterVelocityAmount (16 bytes)
  f32[28] = emitterVel[0];
  f32[29] = emitterVel[1];
  f32[30] = emitterVel[2];
  f32[31] = state.animation.emitterVelocityAmount;
  
  return f32;
}

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
  
  // Initialize instance data buffer (for CPU fallback mode)
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
  setPerfHudVisible(state.perf.hudVisible);
  setupKeyboardShortcuts();
  
  // Setup canvas events
  setupCanvasEvents();
  
  // Handle resize
  handleResize();
  window.addEventListener("resize", handleResize);
  
  // Start render loop
  lastFrame = performance.now();
  requestAnimationFrame(frame);
}

function setupKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) return;
    if (e.repeat) return;

    const target = e.target;
    const tag = target && target.tagName ? String(target.tagName).toLowerCase() : "";
    const isTypingTarget =
      target instanceof HTMLElement &&
      (target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select");
    if (isTypingTarget) return;

    if (e.key === "m" || e.key === "M") {
      state.perf.hudVisible = !state.perf.hudVisible;
      setPerfHudVisible(state.perf.hudVisible);
      e.preventDefault();
    } else if (e.key === "g" || e.key === "G") {
      state.perf.hudMode = state.perf.hudMode === "gpu" ? "basic" : "gpu";
      e.preventDefault();
    } else if (e.key === "l" || e.key === "L") {
      state.perf.lowCostRender = !state.perf.lowCostRender;
      e.preventDefault();
    } else if (e.key === "p" || e.key === "P") {
      // Toggle GPU/CPU particle simulation
      useGPUSim = !useGPUSim;
      console.log(`Particle simulation: ${useGPUSim ? 'GPU' : 'CPU'}`);
      e.preventDefault();
    }
  });
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

function ensureCapacityForParticles() {
  const required = particles.length;
  if (!Number.isFinite(required) || required <= 0) return;

  if (required > state.particle.capacity) {
    const nextCapacity = Math.max(required, state.particle.capacity * 2);
    state.particle.capacity = nextCapacity;
    instanceData = new Float32Array(nextCapacity * 17);
    renderer.ensureInstanceCapacity(nextCapacity);
  } else {
    renderer.ensureInstanceCapacity(state.particle.capacity);
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
  
  // Get camera parameters
  const uniformData = updateCamera(now / 1000, canvas.width, canvas.height);
  
  // Build background uniforms
  const bgUniformData = buildBackgroundUniforms();
  
  // Build DOF uniforms
  let cocData = null, blurData = null, compositeData = null, blurNearData = null;
  const dofActive = state.camera.viewEnabled && state.dof.enabled && !state.perf.lowCostRender;
  if (dofActive) {
    const dofParams = computeDOFParams(dt, canvas.width, canvas.height);
    cocData = dofParams.cocUniformData;
    blurData = dofParams.blurUniformData;
    compositeData = dofParams.compositeUniformData;
    blurNearData = new Float32Array(blurData);
    blurNearData[4] = 1.0; // isNearPass
  }
  
  // Update GPU buffers
  renderer.updateUniforms(uniformData, bgUniformData, cocData, blurData, compositeData, dofActive);
  
  let particleCount = 0;
  
  if (useGPUSim) {
    // GPU particle simulation path
    
    // Calculate spawn count
    const spawnDelta = state.particle.emissionRate * dt;
    gpuSpawnAccum += spawnDelta;
    // Get integer spawn count, keeping fractional part for next frame
    const spawnCount = Math.max(0, Math.floor(gpuSpawnAccum));
    gpuSpawnAccum -= spawnCount;
    
    // Build compute params
    const simParams = buildSimParams(dt, now);
    const emitParams = buildEmitParams(spawnCount, dt);
    
    // Run GPU compute (emit + simulate)
    const mesh = renderer.getCurrentMeshBuffer();
    renderer.runParticleCompute(simParams, emitParams, spawnCount, mesh);
    
    // Update state for next frame
    gpuEmitterPrevPos = [...state.emitter.pos];
    gpuFrameIndex++;
    
    // Render using GPU particle buffer
    renderer.renderGPU(dofActive, blurNearData);
    
    // For perf display, estimate particle count (GPU doesn't report back easily)
    particleCount = Math.min(gpuFrameIndex * 100, state.particle.capacity);
  } else {
    // CPU particle simulation path (fallback)
    emitParticles(dt);
    updateParticles(dt, now);
    ensureCapacityForParticles();
    
    // Sort particles for proper blending
    const cameraEye = state.camera.viewEnabled ? state.camera.eye : state.camera.neutralEye;
    sortParticlesByDepth(cameraEye, state.camera.forward);
    
    // Build instance data
    const baseUnitsPerPixel = worldUnitsPerPixelAt(state.emitter.pos, canvas.clientHeight);
    particleCount = buildInstanceData(instanceData, state.particle.size, baseUnitsPerPixel);
    
    // Update instance buffer
    renderer.updateInstances(instanceData, particleCount);
    
    // Render using CPU instance buffer
    renderer.render(particleCount, dofActive, blurNearData);
  }
  
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
  if (!state.perf.gpuInFlight && now - state.perf.lastGpuSample > PERF_GPU_SAMPLE_MS) {
    state.perf.gpuInFlight = true;
    state.perf.lastGpuSample = now;
    
    const p = renderer.timestampSupported ? renderer.readGpuTime() : renderer.readGpuWorkDoneMs();
    state.perf.gpuMsEstimated = !renderer.timestampSupported;
    p.then((gpuMs) => {
      if (gpuMs !== null) {
        state.perf.gpuMs = gpuMs;
        const prev = state.perf.gpuEmaMs || 0;
        const a = 0.2;
        state.perf.gpuEmaMs = prev > 0 ? prev * (1 - a) + gpuMs * a : gpuMs;
      }
      state.perf.gpuInFlight = false;
    }).catch(() => {
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
