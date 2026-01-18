// Camera and view/projection matrix management
// Includes DOF parameter computation

import { 
  mat4Perspective, 
  mat4LookAt, 
  mat4Multiply, 
  mat4Invert,
  normalizeVec3,
  rotateX,
  rotateY,
  rotateZ
} from './math.js';

import { 
  state, 
  CAMERA_FOV,
  DOF_FOCAL_LENGTH_MM,
  DOF_SENSOR_WIDTH_MM,
  DOF_BLADE_COUNT,
  DOF_F_MIN,
  DOF_F_MAX,
  DOF_NEAR_FOCUS,
  DOF_FAR_FOCUS,
  DOF_BASE_MAX_BLUR_PX,
  DOF_FOCUS_SMOOTHING
} from './state.js';

// ============================================================================
// Matrix Buffers (pre-allocated for performance)
// ============================================================================

export const view = new Float32Array(16);
export const proj = new Float32Array(16);
export const viewProj = new Float32Array(16);
export const invViewProj = new Float32Array(16);

// ============================================================================
// Camera Rotation
// ============================================================================

export function getCameraLensDir() {
  const ax = (state.camera.rotX * Math.PI) / 180;
  const ay = (state.camera.rotY * Math.PI) / 180;
  const az = (state.camera.rotZ * Math.PI) / 180;
  let dir = [0, 0, -1];
  dir = rotateX(dir, ax);
  dir = rotateY(dir, ay);
  dir = rotateZ(dir, az);
  return normalizeVec3(dir);
}

export function setCameraRotationFromTarget() {
  const dir = normalizeVec3([
    state.camera.target[0] - state.camera.eye[0],
    state.camera.target[1] - state.camera.eye[1],
    state.camera.target[2] - state.camera.eye[2],
  ]);
  const pitch = Math.asin(Math.max(-1, Math.min(1, dir[1])));
  const yaw = Math.atan2(dir[0], -dir[2]);
  state.camera.rotX = (pitch * 180) / Math.PI;
  state.camera.rotY = (yaw * 180) / Math.PI;
  state.camera.rotZ = 0;
}

export function getCameraGizmoOrigin() {
  const lensDir = getCameraLensDir();
  return [
    state.camera.eye[0] + lensDir[0] * 0.6,
    state.camera.eye[1] + lensDir[1] * 0.6,
    state.camera.eye[2] + lensDir[2] * 0.6,
  ];
}

// ============================================================================
// Camera Update
// ============================================================================

/**
 * Update camera matrices and uniform data
 * @param {number} timeSeconds - Current time in seconds
 * @param {number} canvasWidth - Canvas width in pixels
 * @param {number} canvasHeight - Canvas height in pixels
 * @returns {Float32Array} Uniform data array (52 floats)
 */
export function updateCamera(timeSeconds, canvasWidth, canvasHeight) {
  const aspect = canvasWidth / canvasHeight;
  mat4Perspective(proj, CAMERA_FOV, aspect, 0.1, 50);
  
  const viewEye = state.camera.viewEnabled ? state.camera.eye : state.camera.neutralEye;
  const viewTarget = state.camera.viewEnabled
    ? [
        viewEye[0] + getCameraLensDir()[0],
        viewEye[1] + getCameraLensDir()[1],
        viewEye[2] + getCameraLensDir()[2],
      ]
    : state.camera.neutralTarget;
  
  state.camera.activeViewEye[0] = viewEye[0];
  state.camera.activeViewEye[1] = viewEye[1];
  state.camera.activeViewEye[2] = viewEye[2];
  
  mat4LookAt(view, viewEye, viewTarget, state.camera.up);
  mat4Multiply(viewProj, proj, view);
  mat4Invert(invViewProj, viewProj);
  
  // Extract camera vectors from view matrix
  state.camera.right[0] = view[0];
  state.camera.right[1] = view[4];
  state.camera.right[2] = view[8];
  state.camera.upVec[0] = view[1];
  state.camera.upVec[1] = view[5];
  state.camera.upVec[2] = view[9];
  state.camera.forward[0] = -view[2];
  state.camera.forward[1] = -view[6];
  state.camera.forward[2] = -view[10];

  return buildUniformData(timeSeconds);
}

/**
 * Build the uniform data array for the particle shader
 * @param {number} timeSeconds - Current time
 * @returns {Float32Array} 52-float uniform array
 */
function buildUniformData(timeSeconds) {
  const uniformData = new Float32Array(52);
  
  const lightWorld = normalizeVec3(state.shading.lightPos);
  const lx = lightWorld[0];
  const ly = lightWorld[1];
  const lz = lightWorld[2];

  uniformData.set(viewProj, 0);
  uniformData[16] = lx;
  uniformData[17] = ly;
  uniformData[18] = lz;
  uniformData[19] = state.shading.lightIntensity;
  uniformData[20] = state.shading.lightColor[0];
  uniformData[21] = state.shading.lightColor[1];
  uniformData[22] = state.shading.lightColor[2];
  uniformData[23] = timeSeconds;
  uniformData[24] = state.particle.shape === "square" ? 1 : state.particle.shape === "circle" ? 2 : 0;
  uniformData[25] =
    state.particle.shape === "sphere" ? 1 : state.particle.shape === "icosahedron" ? 2 : state.particle.shape === "cube" ? 3 : 0;
  uniformData[26] = state.particle.noiseStrength;
  uniformData[27] = state.particle.softness;
  uniformData[28] = view[0];
  uniformData[29] = view[4];
  uniformData[30] = view[8];
  uniformData[31] = 0;
  uniformData[32] = view[1];
  uniformData[33] = view[5];
  uniformData[34] = view[9];
  uniformData[35] = 0;
  uniformData[36] = 0.0;
  uniformData[37] = state.shading.enabled ? 1 : 0;
  // Keep particle output premultiplied for all blend modes.
  uniformData[38] = 1.0;
  // No blend-mode-specific dimming.
  uniformData[39] = 1.0;
  // shadingParams: flat shading, rim intensity, spec intensity, unused
  uniformData[40] = state.shading.style === "flat" ? 1 : 0;
  uniformData[41] = state.shading.rimIntensity;
  uniformData[42] = state.shading.specIntensity;
  uniformData[43] = 0;
  // wireframeParams: wireframe enabled, surface enabled, same color, unused
  uniformData[44] = state.shading.wireframeEnabled ? 1 : 0;
  uniformData[45] = state.shading.surfaceEnabled ? 1 : 0;
  uniformData[46] = state.shading.wireframeSameColor ? 1 : 0;
  uniformData[47] = 0;
  // wireframeColor
  uniformData[48] = state.shading.wireframeColor[0];
  uniformData[49] = state.shading.wireframeColor[1];
  uniformData[50] = state.shading.wireframeColor[2];
  uniformData[51] = 1.0;

  return uniformData;
}

// ============================================================================
// World/Screen Coordinate Conversion
// ============================================================================

/**
 * Convert world position to screen coordinates
 * @param {number[]} pos - World position [x, y, z]
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 * @returns {number[]|null} Screen coordinates [x, y] or null if behind camera
 */
export function worldToScreen(pos, width, height) {
  const x = pos[0], y = pos[1], z = pos[2];
  const w =
    viewProj[3] * x +
    viewProj[7] * y +
    viewProj[11] * z +
    viewProj[15];
  if (w <= 0.0001) return null;
  const clipX =
    viewProj[0] * x +
    viewProj[4] * y +
    viewProj[8] * z +
    viewProj[12];
  const clipY =
    viewProj[1] * x +
    viewProj[5] * y +
    viewProj[9] * z +
    viewProj[13];
  const ndcX = clipX / w;
  const ndcY = clipY / w;
  const sx = (ndcX * 0.5 + 0.5) * width;
  const sy = (-ndcY * 0.5 + 0.5) * height;
  return [sx, sy];
}

/**
 * Calculate world units per pixel at a given position
 * @param {number[]} position - World position
 * @returns {number} World units per CSS pixel
 */
export function worldUnitsPerPixelAt(position, cssHeight) {
  const viewEye = state.camera.viewEnabled ? state.camera.eye : state.camera.neutralEye;
  const dx = position[0] - viewEye[0];
  const dy = position[1] - viewEye[1];
  const dz = position[2] - viewEye[2];
  const depth = Math.max(0.1, 
    dx * state.camera.forward[0] + 
    dy * state.camera.forward[1] + 
    dz * state.camera.forward[2]
  );
  const viewHeight = 2 * depth * Math.tan(CAMERA_FOV * 0.5);
  return viewHeight / Math.max(1, cssHeight);
}

// ============================================================================
// DOF Parameter Computation
// ============================================================================

/**
 * Compute DOF uniform data from the two slider values
 * @param {number} dt - Delta time for smoothing
 * @param {number} canvasHeight - Canvas height for resolution scaling
 * @returns {Object} DOF uniform data objects
 */
export function computeDOFParams(dt, canvasWidth, canvasHeight) {
  // Compute focus distance from depthSlider with non-linear mapping
  const targetFocusZ = DOF_NEAR_FOCUS + (DOF_FAR_FOCUS - DOF_NEAR_FOCUS) * Math.pow(state.dof.depthSlider, 2.0);
  
  // Apply CPU-side temporal smoothing
  const smoothingFactor = 1.0 - Math.exp(-dt * DOF_FOCUS_SMOOTHING);
  state.dof.smoothedFocusZ = state.dof.smoothedFocusZ + (targetFocusZ - state.dof.smoothedFocusZ) * smoothingFactor;
  
  // Compute f-number from apertureSlider with logarithmic mapping
  const lnFMin = Math.log(DOF_F_MIN);
  const lnFMax = Math.log(DOF_F_MAX);
  const fNumber = Math.exp(lnFMax + (lnFMin - lnFMax) * state.dof.apertureSlider);
  
  // Compute resolution-aware max blur radius
  const maxBlurPx = DOF_BASE_MAX_BLUR_PX * (canvasHeight / 1080.0);
  
  // Update legacy values for focus navigator compatibility
  state.dof.focusOffset = state.dof.smoothedFocusZ;
  state.dof.aperture = fNumber;

  // CoC uniforms (16 floats / 64 bytes)
  const cocUniformData = new Float32Array(16);
  cocUniformData[0] = canvasWidth;
  cocUniformData[1] = canvasHeight;
  cocUniformData[2] = state.dof.smoothedFocusZ;
  cocUniformData[3] = fNumber;
  cocUniformData[4] = DOF_FOCAL_LENGTH_MM;
  cocUniformData[5] = DOF_SENSOR_WIDTH_MM;
  cocUniformData[6] = 0.1;  // near
  cocUniformData[7] = 50.0; // far
  cocUniformData[8] = maxBlurPx;
  cocUniformData[9] = 0;  // pad
  cocUniformData[10] = 0; // pad
  cocUniformData[11] = 0; // pad

  // Blur uniforms (12 floats / 48 bytes)
  const blurUniformData = new Float32Array(12);
  blurUniformData[0] = canvasWidth;
  blurUniformData[1] = canvasHeight;
  blurUniformData[2] = maxBlurPx;
  blurUniformData[3] = DOF_BLADE_COUNT;
  blurUniformData[4] = 0; // isNearPass (0 = far)
  blurUniformData[5] = 0.1;  // near
  blurUniformData[6] = 50.0; // far
  blurUniformData[7] = 0;    // pad

  // Composite uniforms (12 floats / 48 bytes)
  const compositeUniformData = new Float32Array(12);
  compositeUniformData[0] = canvasWidth;
  compositeUniformData[1] = canvasHeight;
  compositeUniformData[2] = maxBlurPx;
  compositeUniformData[3] = 1.0;  // exposure
  compositeUniformData[4] = state.dof.debugMode ? 1.0 : 0.0;
  compositeUniformData[5] = 0;    // pad
  compositeUniformData[6] = 0;    // pad
  compositeUniformData[7] = 0;    // pad

  return { cocUniformData, blurUniformData, compositeUniformData };
}
