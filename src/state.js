// Centralized state management for particle system
// Single source of truth for all application state

// ============================================================================
// Constants
// ============================================================================

export const CAMERA_FOV = Math.PI / 4;
export const GRAVITY = -0.2;

// DOF Constants
export const DOF_FOCAL_LENGTH_MM = 35.0;
export const DOF_SENSOR_WIDTH_MM = 36.0;
export const DOF_BLADE_COUNT = 6;
export const DOF_F_MIN = 1.4;
export const DOF_F_MAX = 16.0;
export const DOF_NEAR_FOCUS = 0.5;
export const DOF_FAR_FOCUS = 25.0;
export const DOF_BASE_MAX_BLUR_PX = 18.0;
export const DOF_FOCUS_SMOOTHING = 15.0;

// Performance HUD
export const PERF_UPDATE_MS = 500;
export const PERF_GPU_SAMPLE_MS = 600;

// Recording
export const RECORDING_FPS = 60;
export const RECORDING_DT = 1 / RECORDING_FPS;

// Gizmo
export const GIZMO_HANDLE_SIZE = 14;

// ============================================================================
// Application State
// ============================================================================

export const state = {
  // Particle settings
  particle: {
    capacity: 10000,
    emissionRate: 40,
    initialSpeed: 1.0,
    lifeSeconds: 2.0,
    lifeRandom: 0.0,
    size: 1.0,
    sizeRandom: 0.0,
    shape: "circle",
    sphereSubdivisions: 2,
    colorMode: "gradient",
    solidColor: [0.9, 0.9, 0.95],
    opacity: 1.0,
    blendMode: "screen",
    softness: 0.0,
    noiseStrength: 0.0,
    spinRateX: 1.2,
    spinRateY: 1.2,
    spinRateZ: 1.2,
    spinRandom: 0.4,
  },

  // Emitter settings
  emitter: {
    pos: [0, 0, 0],
    size: 0.2,
    shape: "point",
    emitFrom: "volume",
    direction: "directional",
    coneAngle: 16,
    directionRotX: 0,
    directionRotY: 0,
    directionRotZ: 0,
    speedRandom: 0.2,
    prevPos: [0, 0, 0],
    velocity: [0, 0, 0],
    frameStartPos: [0, 0, 0],
  },

  // Forces settings
  forces: {
    enabled: false,
    mode: "turbulence",
    gravity: GRAVITY,
    wind: [0.0, 0.0, 0.0],
    drag: 0.0,
    turbulenceStrength: 1.2,
    turbulenceScale: 0.8,
    curlStrength: 1.2,
    curlScale: 0.8,
    groundEnabled: true,
    groundLevel: -1.0,
    bounce: 0.2,
  },

  // Vortex settings
  vortex: {
    enabled: false,
    strength: 1.8,
    radius: 1.5,
    pos: [0, 0, 0],
    rotX: 0,
    rotY: 0,
    rotZ: 0,
  },

  // Attractor settings
  attractor: {
    enabled: false,
    strength: 0.0,
    radius: 0.0,
    pos: [0, 0, 0],
  },

  // Camera settings
  camera: {
    eye: [0, 0.4, 6],
    target: [0, 0, 0],
    up: [0, 1, 0],
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    viewEnabled: false,
    right: [1, 0, 0],
    upVec: [0, 1, 0],
    forward: [0, 0, -1],
    neutralEye: [0, 0.4, 6],
    neutralTarget: [0, 0, 0],
    activeViewEye: [0, 0.4, 6],
  },

  // DOF settings
  dof: {
    enabled: true,
    depthSlider: 0.5,
    apertureSlider: 0.3,
    focusOffset: 6.0,
    aperture: 7.0,
    focusRange: 0.8,
    debugMode: false,
    smoothedFocusZ: 6.0,
  },

  // Shading settings
  shading: {
    enabled: false,
    style: "smooth",
    lightIntensity: 1.2,
    lightPos: [0, 1, 0.3],
    lightColor: [0.55, 0.74, 1.0],
    rimIntensity: 0.4,
    specIntensity: 0.3,
    surfaceEnabled: true,
    wireframeEnabled: false,
    wireframeSameColor: true,
    wireframeColor: [1.0, 1.0, 1.0],
  },

  // Background settings
  background: {
    mode: "solid",
    solidColor: [0.0, 0.0, 0.0],
    gradientPoints: [
      { x: 0, color: [0.043, 0.059, 0.078] },
      { x: 1, color: [0.1, 0.15, 0.2] },
    ],
    linearDirection: "vertical",
    radialCenter: [0.5, 0.5],
  },

  // Animation settings
  animation: {
    time: 0,
    emitterEnabled: false,
    emitterX: { enabled: false, speed: 1.0, type: "sine", phase: Math.random() * Math.PI * 2, noiseOffset: Math.random() * 1000 },
    emitterY: { enabled: false, speed: 1.0, type: "sine", phase: Math.random() * Math.PI * 2, noiseOffset: Math.random() * 1000 },
    emitterZ: { enabled: false, speed: 1.0, type: "sine", phase: Math.random() * Math.PI * 2, noiseOffset: Math.random() * 1000 },
    emitterVelocityAffected: false,
    emitterVelocityAmount: 1.0,
    vortexEnabled: false,
    vortexX: { enabled: false, speed: 1.0, type: "sine", phase: Math.random() * Math.PI * 2, noiseOffset: Math.random() * 1000 },
    vortexY: { enabled: false, speed: 1.0, type: "sine", phase: Math.random() * Math.PI * 2, noiseOffset: Math.random() * 1000 },
    vortexZ: { enabled: false, speed: 1.0, type: "sine", phase: Math.random() * Math.PI * 2, noiseOffset: Math.random() * 1000 },
    attractorEnabled: false,
    attractorX: { enabled: false, speed: 1.0, type: "sine", phase: Math.random() * Math.PI * 2, noiseOffset: Math.random() * 1000 },
    attractorY: { enabled: false, speed: 1.0, type: "sine", phase: Math.random() * Math.PI * 2, noiseOffset: Math.random() * 1000 },
    attractorZ: { enabled: false, speed: 1.0, type: "sine", phase: Math.random() * Math.PI * 2, noiseOffset: Math.random() * 1000 },
  },

  // Gizmo settings
  gizmos: {
    emitterEnabled: false,
    vortexEnabled: false,
    attractorEnabled: false,
    lightEnabled: false,
    cameraEnabled: false,
    focusNavigatorEnabled: false,
    navigatorView: "top",
    dragging: false,
    dragAxis: null,
    dragTarget: null,
    dragDir: null,
    lastPointer: null,
    dragStartPointer: null,
    dragStartPos: null,
    dragStartDisplayPos: null,
    hoverAxis: null,
    hoverTarget: null,
  },

  // Curves
  curves: {
    size: [
      { x: 0, y: 0.2 },
      { x: 0.15, y: 0.85 },
      { x: 0.5, y: 1 },
      { x: 1, y: 0 }
    ],
    opacity: [
      { x: 0, y: 0 },
      { x: 0.1, y: 1 },
      { x: 0.8, y: 1 },
      { x: 1, y: 0 }
    ],
    colorGradient: [
      { x: 0.0, color: [1.0, 1.0, 1.0] },
      { x: 0.5, color: [0.85, 0.7, 0.95] },
      { x: 1.0, color: [0.6, 0.3, 0.7] }
    ],
  },

  // Performance tracking
  perf: {
    lastFrame: 0,
    accum: 0,
    count: 0,
    lastUpdate: 0,
    gpuMs: 0,
    gpuInFlight: false,
    lastGpuSample: 0,
    worstFrame: 0,
    frameStart: 0,
  },

  // Recording state
  recording: {
    fixedFpsEnabled: false,
    frameAccum: 0,
    mirrorEnabled: false,
  },

  // Render settings
  render: {
    dprMultiplier: 1,
  },
};

// Active particles array (mutable, performance-critical)
export const particles = [];

// Spawn accumulator
export let spawnAccum = 0;
export function setSpawnAccum(v) { spawnAccum = v; }

// ============================================================================
// State Accessors
// ============================================================================

/**
 * Get a nested state value by dot-notation path
 * @param {string} path - e.g., "particle.emissionRate" or "camera.eye"
 * @returns {*} The value at that path
 */
export function getState(path) {
  const parts = path.split(".");
  let obj = state;
  for (const part of parts) {
    if (obj === undefined || obj === null) return undefined;
    obj = obj[part];
  }
  return obj;
}

/**
 * Set a nested state value by dot-notation path
 * @param {string} path - e.g., "particle.emissionRate"
 * @param {*} value - The new value
 */
export function setState(path, value) {
  const parts = path.split(".");
  let obj = state;
  for (let i = 0; i < parts.length - 1; i++) {
    if (obj[parts[i]] === undefined) {
      obj[parts[i]] = {};
    }
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
}

// ============================================================================
// Snapshot Normalization (for preset loading)
// ============================================================================

export function normalizeSnapshotColor(value, fallback) {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
}

export function normalizeSnapshotVec3(value, fallback) {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
}

export function normalizeSnapshotPoints(points) {
  if (!Array.isArray(points)) return null;
  const out = [];
  for (const p of points) {
    if (!p || typeof p !== "object") continue;
    const x = Number("x" in p ? p.x : p.pos);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ x, y, mode: p.mode });
  }
  return out.length ? out : null;
}

export function normalizeSnapshotGradient(points) {
  if (!Array.isArray(points)) return null;
  const out = [];
  for (const p of points) {
    if (!p || typeof p !== "object") continue;
    const x = Number("x" in p ? p.x : p.pos);
    if (!Number.isFinite(x)) continue;
    const color = normalizeSnapshotColor(p.color, [1, 1, 1]);
    out.push({ x, color });
  }
  return out.length ? out : null;
}

// ============================================================================
// Serialize State for Export
// ============================================================================

export function serializeState() {
  return {
    // Particle settings
    emissionRate: state.particle.emissionRate,
    initialSpeed: state.particle.initialSpeed,
    lifeSeconds: state.particle.lifeSeconds,
    lifeRandom: state.particle.lifeRandom,
    particleSize: state.particle.size,
    sizeRandom: state.particle.sizeRandom,
    particleShape: state.particle.shape,
    sphereSubdivisions: state.particle.sphereSubdivisions,
    particleColorMode: state.particle.colorMode,
    solidColor: [...state.particle.solidColor],
    particleOpacity: state.particle.opacity,
    blendMode: state.particle.blendMode,
    softness: state.particle.softness,
    noiseStrength: state.particle.noiseStrength,
    spinRateX: state.particle.spinRateX,
    spinRateY: state.particle.spinRateY,
    spinRateZ: state.particle.spinRateZ,
    spinRandom: state.particle.spinRandom,

    // Emitter settings
    emitterPos: [...state.emitter.pos],
    emitterSize: state.emitter.size,
    emitterShape: state.emitter.shape,
    emitFrom: state.emitter.emitFrom,
    emissionDirection: state.emitter.direction,
    coneAngle: state.emitter.coneAngle,
    directionRotX: state.emitter.directionRotX,
    directionRotY: state.emitter.directionRotY,
    directionRotZ: state.emitter.directionRotZ,
    speedRandom: state.emitter.speedRandom,

    // Animation settings
    emitterAnimEnabled: state.animation.emitterEnabled,
    emitterAnimX: { ...state.animation.emitterX },
    emitterAnimY: { ...state.animation.emitterY },
    emitterAnimZ: { ...state.animation.emitterZ },
    emitterVelocityAffected: state.animation.emitterVelocityAffected,
    emitterVelocityAmount: state.animation.emitterVelocityAmount,
    vortexAnimEnabled: state.animation.vortexEnabled,
    vortexAnimX: { ...state.animation.vortexX },
    vortexAnimY: { ...state.animation.vortexY },
    vortexAnimZ: { ...state.animation.vortexZ },
    attractorAnimEnabled: state.animation.attractorEnabled,
    attractorAnimX: { ...state.animation.attractorX },
    attractorAnimY: { ...state.animation.attractorY },
    attractorAnimZ: { ...state.animation.attractorZ },

    // Forces settings
    forceMode: state.forces.mode,
    turbulenceStrength: state.forces.turbulenceStrength,
    turbulenceScale: state.forces.turbulenceScale,
    curlStrength: state.forces.curlStrength,
    curlScale: state.forces.curlScale,
    vortexEnabled: state.vortex.enabled,
    vortexStrength: state.vortex.strength,
    vortexRadius: state.vortex.radius,
    vortexPos: [...state.vortex.pos],
    vortexRotX: state.vortex.rotX,
    vortexRotY: state.vortex.rotY,
    vortexRotZ: state.vortex.rotZ,
    attractorEnabled: state.attractor.enabled,
    attractorStrength: state.attractor.strength,
    attractorRadius: state.attractor.radius,
    attractorPos: [...state.attractor.pos],
    gravity: state.forces.gravity,
    wind: [...state.forces.wind],
    drag: state.forces.drag,
    groundEnabled: state.forces.groundEnabled,
    groundLevel: state.forces.groundLevel,
    bounce: state.forces.bounce,
    forcesEnabled: state.forces.enabled,

    // Shading settings
    shadingEnabled: state.shading.enabled,
    shadingStyle: state.shading.style,
    lightIntensity: state.shading.lightIntensity,
    lightPos: [...state.shading.lightPos],
    lightColor: [...state.shading.lightColor],
    rimIntensity: state.shading.rimIntensity,
    specIntensity: state.shading.specIntensity,
    surfaceEnabled: state.shading.surfaceEnabled,
    wireframeEnabled: state.shading.wireframeEnabled,
    wireframeSameColor: state.shading.wireframeSameColor,
    wireframeColor: [...state.shading.wireframeColor],

    // Camera settings
    cameraRotX: state.camera.rotX,
    cameraRotY: state.camera.rotY,
    cameraRotZ: state.camera.rotZ,
    cameraViewEnabled: state.camera.viewEnabled,
    dofEnabled: state.dof.enabled,
    dofDepthSlider: state.dof.depthSlider,
    dofApertureSlider: state.dof.apertureSlider,
    focusRange: state.dof.focusRange,

    // Background settings
    bgMode: state.background.mode,
    bgSolidColor: [...state.background.solidColor],
    bgLinearDirection: state.background.linearDirection,
    bgRadialCenter: [...state.background.radialCenter],

    // Curves
    sizeCurvePoints: state.curves.size.map(p => ({ x: p.x, y: p.y, mode: p.mode })),
    opacityCurvePoints: state.curves.opacity.map(p => ({ x: p.x, y: p.y, mode: p.mode })),
    colorGradientPoints: state.curves.colorGradient.map(p => ({ x: p.x, color: [...p.color] })),
    bgGradientPoints: state.background.gradientPoints.map(p => ({ x: p.x, color: [...p.color] })),
  };
}

// ============================================================================
// Apply Snapshot to State
// ============================================================================

export function applySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;

  const setters = {
    emissionRate: (v) => { if (Number.isFinite(v)) state.particle.emissionRate = v; },
    initialSpeed: (v) => { if (Number.isFinite(v)) state.particle.initialSpeed = v; },
    lifeSeconds: (v) => { if (Number.isFinite(v)) state.particle.lifeSeconds = v; },
    lifeRandom: (v) => { if (Number.isFinite(v)) state.particle.lifeRandom = v; },
    particleSize: (v) => { if (Number.isFinite(v)) state.particle.size = v; },
    sizeRandom: (v) => { if (Number.isFinite(v)) state.particle.sizeRandom = v; },
    particleShape: (v) => { if (typeof v === "string") state.particle.shape = v; },
    sphereSubdivisions: (v) => { if (Number.isFinite(v)) state.particle.sphereSubdivisions = v; },
    particleColorMode: (v) => { if (typeof v === "string") state.particle.colorMode = v; },
    solidColor: (v) => { state.particle.solidColor = normalizeSnapshotColor(v, state.particle.solidColor); },
    particleOpacity: (v) => { if (Number.isFinite(v)) state.particle.opacity = v; },
    blendMode: (v) => { if (typeof v === "string") state.particle.blendMode = v; },
    softness: (v) => { if (Number.isFinite(v)) state.particle.softness = v; },
    noiseStrength: (v) => { if (Number.isFinite(v)) state.particle.noiseStrength = v; },
    spinRateX: (v) => { if (Number.isFinite(v)) state.particle.spinRateX = v; },
    spinRateY: (v) => { if (Number.isFinite(v)) state.particle.spinRateY = v; },
    spinRateZ: (v) => { if (Number.isFinite(v)) state.particle.spinRateZ = v; },
    spinRandom: (v) => { if (Number.isFinite(v)) state.particle.spinRandom = v; },
    emitterPos: (v) => { state.emitter.pos = normalizeSnapshotVec3(v, state.emitter.pos); },
    emitterSize: (v) => { if (Number.isFinite(v)) state.emitter.size = v; },
    emitterShape: (v) => { if (typeof v === "string") state.emitter.shape = v; },
    emitFrom: (v) => { if (typeof v === "string") state.emitter.emitFrom = v; },
    emissionDirection: (v) => { if (typeof v === "string") state.emitter.direction = v; },
    coneAngle: (v) => { if (Number.isFinite(v)) state.emitter.coneAngle = v; },
    directionRotX: (v) => { if (Number.isFinite(v)) state.emitter.directionRotX = v; },
    directionRotY: (v) => { if (Number.isFinite(v)) state.emitter.directionRotY = v; },
    directionRotZ: (v) => { if (Number.isFinite(v)) state.emitter.directionRotZ = v; },
    speedRandom: (v) => { if (Number.isFinite(v)) state.emitter.speedRandom = v; },
    emitterAnimEnabled: (v) => { state.animation.emitterEnabled = Boolean(v); },
    emitterAnimX: (v) => { if (v && typeof v === "object") Object.assign(state.animation.emitterX, v); },
    emitterAnimY: (v) => { if (v && typeof v === "object") Object.assign(state.animation.emitterY, v); },
    emitterAnimZ: (v) => { if (v && typeof v === "object") Object.assign(state.animation.emitterZ, v); },
    emitterVelocityAffected: (v) => { state.animation.emitterVelocityAffected = Boolean(v); },
    emitterVelocityAmount: (v) => { if (Number.isFinite(v)) state.animation.emitterVelocityAmount = v; },
    vortexAnimEnabled: (v) => { state.animation.vortexEnabled = Boolean(v); },
    vortexAnimX: (v) => { if (v && typeof v === "object") Object.assign(state.animation.vortexX, v); },
    vortexAnimY: (v) => { if (v && typeof v === "object") Object.assign(state.animation.vortexY, v); },
    vortexAnimZ: (v) => { if (v && typeof v === "object") Object.assign(state.animation.vortexZ, v); },
    attractorAnimEnabled: (v) => { state.animation.attractorEnabled = Boolean(v); },
    attractorAnimX: (v) => { if (v && typeof v === "object") Object.assign(state.animation.attractorX, v); },
    attractorAnimY: (v) => { if (v && typeof v === "object") Object.assign(state.animation.attractorY, v); },
    attractorAnimZ: (v) => { if (v && typeof v === "object") Object.assign(state.animation.attractorZ, v); },
    forceMode: (v) => { if (typeof v === "string") state.forces.mode = v; },
    turbulenceStrength: (v) => { if (Number.isFinite(v)) state.forces.turbulenceStrength = v; },
    turbulenceScale: (v) => { if (Number.isFinite(v)) state.forces.turbulenceScale = v; },
    curlStrength: (v) => { if (Number.isFinite(v)) state.forces.curlStrength = v; },
    curlScale: (v) => { if (Number.isFinite(v)) state.forces.curlScale = v; },
    vortexEnabled: (v) => { state.vortex.enabled = Boolean(v); },
    vortexStrength: (v) => { if (Number.isFinite(v)) state.vortex.strength = v; },
    vortexRadius: (v) => { if (Number.isFinite(v)) state.vortex.radius = v; },
    vortexPos: (v) => { state.vortex.pos = normalizeSnapshotVec3(v, state.vortex.pos); },
    vortexRotX: (v) => { if (Number.isFinite(v)) state.vortex.rotX = v; },
    vortexRotY: (v) => { if (Number.isFinite(v)) state.vortex.rotY = v; },
    vortexRotZ: (v) => { if (Number.isFinite(v)) state.vortex.rotZ = v; },
    attractorEnabled: (v) => { state.attractor.enabled = Boolean(v); },
    attractorStrength: (v) => { if (Number.isFinite(v)) state.attractor.strength = v; },
    attractorRadius: (v) => { if (Number.isFinite(v)) state.attractor.radius = v; },
    attractorPos: (v) => { state.attractor.pos = normalizeSnapshotVec3(v, state.attractor.pos); },
    gravity: (v) => { if (Number.isFinite(v)) state.forces.gravity = v; },
    wind: (v) => { state.forces.wind = normalizeSnapshotVec3(v, state.forces.wind); },
    drag: (v) => { if (Number.isFinite(v)) state.forces.drag = v; },
    groundEnabled: (v) => { state.forces.groundEnabled = Boolean(v); },
    groundLevel: (v) => { if (Number.isFinite(v)) state.forces.groundLevel = v; },
    bounce: (v) => { if (Number.isFinite(v)) state.forces.bounce = v; },
    forcesEnabled: (v) => { state.forces.enabled = Boolean(v); },
    shadingEnabled: (v) => { state.shading.enabled = Boolean(v); },
    shadingStyle: (v) => { if (typeof v === "string") state.shading.style = v; },
    lightIntensity: (v) => { if (Number.isFinite(v)) state.shading.lightIntensity = v; },
    lightPos: (v) => { state.shading.lightPos = normalizeSnapshotVec3(v, state.shading.lightPos); },
    lightColor: (v) => { state.shading.lightColor = normalizeSnapshotColor(v, state.shading.lightColor); },
    rimIntensity: (v) => { if (Number.isFinite(v)) state.shading.rimIntensity = v; },
    specIntensity: (v) => { if (Number.isFinite(v)) state.shading.specIntensity = v; },
    surfaceEnabled: (v) => { state.shading.surfaceEnabled = Boolean(v); },
    wireframeEnabled: (v) => { state.shading.wireframeEnabled = Boolean(v); },
    wireframeSameColor: (v) => { state.shading.wireframeSameColor = Boolean(v); },
    wireframeColor: (v) => { state.shading.wireframeColor = normalizeSnapshotColor(v, state.shading.wireframeColor); },
    cameraRotX: (v) => { if (Number.isFinite(v)) state.camera.rotX = v; },
    cameraRotY: (v) => { if (Number.isFinite(v)) state.camera.rotY = v; },
    cameraRotZ: (v) => { if (Number.isFinite(v)) state.camera.rotZ = v; },
    cameraViewEnabled: (v) => { state.camera.viewEnabled = Boolean(v); },
    dofEnabled: (v) => { state.dof.enabled = Boolean(v); },
    dofDepthSlider: (v) => { if (Number.isFinite(v)) state.dof.depthSlider = v; },
    dofApertureSlider: (v) => { if (Number.isFinite(v)) state.dof.apertureSlider = v; },
    focusRange: (v) => { if (Number.isFinite(v)) state.dof.focusRange = v; },
    bgMode: (v) => { if (typeof v === "string") state.background.mode = v; },
    bgSolidColor: (v) => { state.background.solidColor = normalizeSnapshotColor(v, state.background.solidColor); },
    bgLinearDirection: (v) => { if (typeof v === "string") state.background.linearDirection = v; },
    bgRadialCenter: (v) => { if (Array.isArray(v) && v.length >= 2) state.background.radialCenter = [Number(v[0]) || 0.5, Number(v[1]) || 0.5]; },
    sizeCurvePoints: (v) => { const pts = normalizeSnapshotPoints(v); if (pts) state.curves.size = pts; },
    opacityCurvePoints: (v) => { const pts = normalizeSnapshotPoints(v); if (pts) state.curves.opacity = pts; },
    colorGradientPoints: (v) => { const pts = normalizeSnapshotGradient(v); if (pts) state.curves.colorGradient = pts; },
    bgGradientPoints: (v) => { const pts = normalizeSnapshotGradient(v); if (pts) state.background.gradientPoints = pts; },
  };

  for (const [key, value] of Object.entries(snapshot)) {
    const setter = setters[key];
    if (setter) setter(value);
  }
}
