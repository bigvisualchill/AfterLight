const canvas = document.getElementById("gfx");
const gizmoCanvas = document.getElementById("gizmo");
const gizmoCtx = gizmoCanvas ? gizmoCanvas.getContext("2d") : null;

if (!navigator.gpu) {
  document.body.innerHTML = "WebGPU not supported in this browser.";
  throw new Error("WebGPU not supported");
}

let particleCapacity = 10000; // Initial capacity, grows dynamically as needed
const GRAVITY = -0.2;
const CAMERA_FOV = Math.PI / 4;

let emissionRate = 40;
let initialSpeed = 1.0;
let turbulenceStrength = 1.2;
let turbulenceScale = 0.8;
let gravity = GRAVITY;
let wind = [0.0, 0.0, 0.0];
let drag = 0.0;
let forceMode = "turbulence";
let curlStrength = 1.2;
let curlScale = 0.8;
let vortexStrength = 1.8;
let vortexRadius = 1.5;
let vortexEnabled = false;
let attractorStrength = 0.0;
let attractorRadius = 0.0;
let attractorEnabled = false;
let emitterGizmoEnabled = false;
let groundLevel = -1.0;
let bounce = 0.2;
let groundEnabled = true;
let forcesEnabled = false;
let lifeSeconds = 2.0;
let lifeRandom = 0.0;
let emitterSize = 0.2;
let emitterShape = "point";
let emitMode = "auto";
let particleShape = "circle";
let emitFrom = "volume";
let coneAngle = 16;
let directionRotX = 0;
let directionRotY = 0;
let directionRotZ = 0;
let speedRandom = 0.2;
let emitterPos = [0, 0, 0];
let spinRate2d = 1.2;
let spinRateX = 1.2;
let spinRateY = 1.2;
let spinRateZ = 1.2;
let spinRandom = 0.4;
let particleSize = 1.0;
let focusOffset = 0.0;
let aperture = 7.0;
let dofMode = 0;
let focusRange = 0.8;
let focusOverlay = 0;
let dofEnabled = false;
let bloomStrength = 0.3;
let bloomThreshold = 0.8;
let exposure = 1.2;
let lightIntensity = 1.2;
let lightAzimuth = 0;
let lightElevation = 70;
let lightPos = [0, 1, 0.3];
let lightColor = [0.55, 0.74, 1.0];
let shadingEnabled = false;
let particleColorMode = "gradient";
let solidColor = [0.9, 0.9, 0.95];
let noiseStrength = 0.0;
let blendMode = "screen";
let softness = 0.0;

const particles = [];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise3(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;

  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);

  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);

  const nx00 = n000 * (1 - u) + n100 * u;
  const nx10 = n010 * (1 - u) + n110 * u;
  const nx01 = n001 * (1 - u) + n101 * u;
  const nx11 = n011 * (1 - u) + n111 * u;

  const nxy0 = nx00 * (1 - v) + nx10 * v;
  const nxy1 = nx01 * (1 - v) + nx11 * v;

  return nxy0 * (1 - w) + nxy1 * w;
}

function turbulence(x, y, z, octaves = 3) {
  let t = 0;
  let f = 1;
  let a = 1;
  for (let i = 0; i < octaves; i += 1) {
    t += Math.abs(noise3(x * f, y * f, z * f) * 2 - 1) * a;
    f *= 2;
    a *= 0.5;
  }
  return t;
}

function noiseVec3(x, y, z) {
  return [
    noise3(x, y, z),
    noise3(x + 31.7, y + 11.3, z + 47.2),
    noise3(x + 59.2, y + 27.1, z + 13.9),
  ];
}

function curlNoise(x, y, z) {
  const e = 0.1;
  const n1 = noiseVec3(x, y + e, z);
  const n2 = noiseVec3(x, y - e, z);
  const n3 = noiseVec3(x, y, z + e);
  const n4 = noiseVec3(x, y, z - e);
  const n5 = noiseVec3(x + e, y, z);
  const n6 = noiseVec3(x - e, y, z);

  const dFzDy = (n1[2] - n2[2]) / (2 * e);
  const dFyDz = (n3[1] - n4[1]) / (2 * e);
  const dFxDz = (n3[0] - n4[0]) / (2 * e);
  const dFzDx = (n5[2] - n6[2]) / (2 * e);
  const dFyDx = (n5[1] - n6[1]) / (2 * e);
  const dFxDy = (n1[0] - n2[0]) / (2 * e);

  return normalizeVec3([
    dFzDy - dFyDz,
    dFxDz - dFzDx,
    dFyDx - dFxDy,
  ]);
}

function normalizeVec3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function rotateX(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

function rotateY(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

function rotateZ(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

function applyEmitterRotation(point) {
  const ax = (directionRotX * Math.PI) / 180;
  const ay = (directionRotY * Math.PI) / 180;
  const az = (directionRotZ * Math.PI) / 180;
  let p = rotateX(point, ax);
  p = rotateY(p, ay);
  p = rotateZ(p, az);
  return p;
}

function worldToScreen(pos) {
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
  const sx = (ndcX * 0.5 + 0.5) * gizmoSize.width;
  const sy = (-ndcY * 0.5 + 0.5) * gizmoSize.height;
  return [sx, sy];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function roundToStep(value, step, min) {
  if (!Number.isFinite(step) || step <= 0) return value;
  const base = Number.isFinite(min) ? min : 0;
  return Math.round((value - base) / step) * step + base;
}

function formatWithStep(value, step) {
  if (!Number.isFinite(step) || step <= 0) return String(value);
  const precision = step.toString().split(".")[1]?.length ?? 0;
  return value.toFixed(Math.min(6, precision));
}

function bezierValue(p0, p1, p2, p3, t) {
  const inv = 1 - t;
  return (
    inv * inv * inv * p0 +
    3 * inv * inv * t * p1 +
    3 * inv * t * t * p2 +
    t * t * t * p3
  );
}

function evalCurve(points, x) {
  if (!points.length) return 0;
  if (x <= points[0].x) return points[0].y;
  if (x >= points[points.length - 1].x) return points[points.length - 1].y;
  let idx = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    if (x >= points[i].x && x <= points[i + 1].x) {
      idx = i;
      break;
    }
  }
  const p0 = points[Math.max(0, idx - 1)];
  const p1 = points[idx];
  const p2 = points[idx + 1];
  const p3 = points[Math.min(points.length - 1, idx + 2)];
  const span = Math.max(1e-5, p2.x - p1.x);
  const t = clamp((x - p1.x) / span, 0, 1);
  if (p1.mode === "linear" || p2.mode === "linear") {
    return lerp(p1.y, p2.y, t);
  }
  const c1 = p1.y + ((p2.y - p0.y) * span) / (6 * Math.max(1e-5, p2.x - p0.x));
  const c2 = p2.y - ((p3.y - p1.y) * span) / (6 * Math.max(1e-5, p3.x - p1.x));
  return bezierValue(p1.y, c1, c2, p2.y, t);
}

function evalGradient(points, x) {
  if (!points.length) return [1, 1, 1];
  if (x <= points[0].x) return points[0].color.slice();
  if (x >= points[points.length - 1].x) return points[points.length - 1].color.slice();
  let idx = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    if (x >= points[i].x && x <= points[i + 1].x) {
      idx = i;
      break;
    }
  }
  const a = points[idx];
  const b = points[idx + 1];
  const span = Math.max(1e-5, b.x - a.x);
  const t = clamp((x - a.x) / span, 0, 1);
  return [
    lerp(a.color[0], b.color[0], t),
    lerp(a.color[1], b.color[1], t),
    lerp(a.color[2], b.color[2], t),
  ];
}

function quatFromAxisAngle(axis, angle) {
  const half = angle * 0.5;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

function quatMul(a, b) {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function quatNormalize(q) {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

function randomInSphere(radius, onSurface) {
  let v = [rand(-1, 1), rand(-1, 1), rand(-1, 1)];
  let len = Math.hypot(v[0], v[1], v[2]) || 1;
  v = [v[0] / len, v[1] / len, v[2] / len];
  const scale = onSurface ? radius : radius * Math.cbrt(Math.random());
  return [v[0] * scale, v[1] * scale, v[2] * scale];
}

function randomOnBox(half) {
  const face = Math.floor(Math.random() * 6);
  const u = rand(-half, half);
  const v = rand(-half, half);
  switch (face) {
    case 0: return [half, u, v];
    case 1: return [-half, u, v];
    case 2: return [u, half, v];
    case 3: return [u, -half, v];
    case 4: return [u, v, half];
    default: return [u, v, -half];
  }
}

function randomOnPlane(half) {
  const edge = Math.floor(Math.random() * 4);
  const t = rand(-half, half);
  switch (edge) {
    case 0: return [half, t, 0];
    case 1: return [-half, t, 0];
    case 2: return [t, half, 0];
    default: return [t, -half, 0];
  }
}

function randomInPlane(half) {
  return [rand(-half, half), rand(-half, half), 0];
}

function randomInLine(length, onEnd) {
  if (onEnd) {
    return [Math.random() > 0.5 ? length * 0.5 : -length * 0.5, 0, 0];
  }
  return [rand(-length * 0.5, length * 0.5), 0, 0];
}

function randomConeDirection(dir, angleDeg) {
  const angle = (angleDeg * Math.PI) / 180;
  if (angle <= 0.001) return dir;
  const cosMax = Math.cos(angle);
  const cosTheta = cosMax + Math.random() * (1 - cosMax);
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  const phi = Math.random() * Math.PI * 2;

  const up = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const ux = up[1] * dir[2] - up[2] * dir[1];
  const uy = up[2] * dir[0] - up[0] * dir[2];
  const uz = up[0] * dir[1] - up[1] * dir[0];
  const uLen = Math.hypot(ux, uy, uz) || 1;
  const u = [ux / uLen, uy / uLen, uz / uLen];
  const vx = dir[1] * u[2] - dir[2] * u[1];
  const vy = dir[2] * u[0] - dir[0] * u[2];
  const vz = dir[0] * u[1] - dir[1] * u[0];
  const v = [vx, vy, vz];

  const dirOut = [
    u[0] * Math.cos(phi) * sinTheta + v[0] * Math.sin(phi) * sinTheta + dir[0] * cosTheta,
    u[1] * Math.cos(phi) * sinTheta + v[1] * Math.sin(phi) * sinTheta + dir[1] * cosTheta,
    u[2] * Math.cos(phi) * sinTheta + v[2] * Math.sin(phi) * sinTheta + dir[2] * cosTheta,
  ];
  return normalizeVec3(dirOut);
}
function mat4Perspective(out, fovy, aspect, near, far) {
  const f = 1.0 / Math.tan(fovy / 2);
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = far / (near - far);
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[14] = (far * near) / (near - far);
  out[15] = 0;
  return out;
}

function mat4LookAt(out, eye, target, up) {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz);
  const z0 = zx / len;
  const z1 = zy / len;
  const z2 = zz / len;

  const xx = up[1] * z2 - up[2] * z1;
  const xy = up[2] * z0 - up[0] * z2;
  const xz = up[0] * z1 - up[1] * z0;
  len = Math.hypot(xx, xy, xz);
  const x0 = xx / len;
  const x1 = xy / len;
  const x2 = xz / len;

  const y0 = z1 * x2 - z2 * x1;
  const y1 = z2 * x0 - z0 * x2;
  const y2 = z0 * x1 - z1 * x0;

  out[0] = x0;
  out[1] = y0;
  out[2] = z0;
  out[3] = 0;
  out[4] = x1;
  out[5] = y1;
  out[6] = z1;
  out[7] = 0;
  out[8] = x2;
  out[9] = y2;
  out[10] = z2;
  out[11] = 0;
  out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
  out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
  out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
  out[15] = 1;
  return out;
}

function mat4Multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
  const b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
  const b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
  const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];

  out[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
  out[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
  out[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
  out[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;

  out[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
  out[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
  out[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
  out[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;

  out[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
  out[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
  out[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
  out[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;

  out[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
  out[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
  out[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
  out[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;
  return out;
}

function mat4Invert(out, m) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  det = 1.0 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * det;
  out[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * det;
  out[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}

function unproject(ndcX, ndcY, ndcZ, invViewProj) {
  const x = ndcX;
  const y = ndcY;
  const z = ndcZ;
  const w = 1;

  const ox = invViewProj[0] * x + invViewProj[4] * y + invViewProj[8] * z + invViewProj[12] * w;
  const oy = invViewProj[1] * x + invViewProj[5] * y + invViewProj[9] * z + invViewProj[13] * w;
  const oz = invViewProj[2] * x + invViewProj[6] * y + invViewProj[10] * z + invViewProj[14] * w;
  const ow = invViewProj[3] * x + invViewProj[7] * y + invViewProj[11] * z + invViewProj[15] * w;

  return [ox / ow, oy / ow, oz / ow];
}

const context = canvas.getContext("webgpu");
if (!context) {
  document.body.innerHTML = "WebGPU context not available. Check browser support and GPU settings.";
  throw new Error("Failed to create WebGPU context");
}

async function requestAdapterWithFallback() {
  const attempts = [
    undefined,
    { powerPreference: "high-performance" },
    { powerPreference: "low-power" },
  ];
  for (let i = 0; i < attempts.length; i += 1) {
    try {
      const adapter = attempts[i]
        ? await navigator.gpu.requestAdapter(attempts[i])
        : await navigator.gpu.requestAdapter();
      if (adapter) return adapter;
    } catch (err) {
      // Ignore and try the next fallback.
    }
  }
  return null;
}

async function requestAdapterWithRetry(retries = 2) {
  for (let i = 0; i <= retries; i += 1) {
    const adapter = await requestAdapterWithFallback();
    if (adapter) return adapter;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

const adapter = await requestAdapterWithRetry(3);
if (!adapter) {
  document.body.innerHTML = "WebGPU adapter not found. Check your GPU/browser settings.";
  throw new Error("WebGPU adapter not available");
}
const device = await adapter.requestDevice();
const format = navigator.gpu.getPreferredCanvasFormat();

function buildCube() {
  const faces = [
    { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
    { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  ];
  const data = [];
  for (const face of faces) {
    const [a, b, c, d] = face.v;
    data.push(
      a[0], a[1], a[2], face.n[0], face.n[1], face.n[2],
      b[0], b[1], b[2], face.n[0], face.n[1], face.n[2],
      c[0], c[1], c[2], face.n[0], face.n[1], face.n[2],
      a[0], a[1], a[2], face.n[0], face.n[1], face.n[2],
      c[0], c[1], c[2], face.n[0], face.n[1], face.n[2],
      d[0], d[1], d[2], face.n[0], face.n[1], face.n[2],
    );
  }
  return new Float32Array(data);
}

function buildIcosahedron() {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ];
  const faces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  const data = [];
  for (const face of faces) {
    for (const idx of face) {
      const v = verts[idx];
      const len = Math.hypot(v[0], v[1], v[2]);
      const nx = v[0] / len;
      const ny = v[1] / len;
      const nz = v[2] / len;
      data.push(nx, ny, nz, nx, ny, nz);
    }
  }
  return new Float32Array(data);
}

function buildSphere(segments = 16, rings = 12) {
  const data = [];
  for (let y = 0; y < rings; y += 1) {
    const v0 = y / rings;
    const v1 = (y + 1) / rings;
    const phi0 = v0 * Math.PI;
    const phi1 = v1 * Math.PI;
    for (let x = 0; x < segments; x += 1) {
      const u0 = x / segments;
      const u1 = (x + 1) / segments;
      const theta0 = u0 * Math.PI * 2;
      const theta1 = u1 * Math.PI * 2;

      const p0 = [
        Math.sin(phi0) * Math.cos(theta0),
        Math.cos(phi0),
        Math.sin(phi0) * Math.sin(theta0),
      ];
      const p1 = [
        Math.sin(phi1) * Math.cos(theta0),
        Math.cos(phi1),
        Math.sin(phi1) * Math.sin(theta0),
      ];
      const p2 = [
        Math.sin(phi1) * Math.cos(theta1),
        Math.cos(phi1),
        Math.sin(phi1) * Math.sin(theta1),
      ];
      const p3 = [
        Math.sin(phi0) * Math.cos(theta1),
        Math.cos(phi0),
        Math.sin(phi0) * Math.sin(theta1),
      ];

      data.push(
        p0[0], p0[1], p0[2], p0[0], p0[1], p0[2],
        p1[0], p1[1], p1[2], p1[0], p1[1], p1[2],
        p2[0], p2[1], p2[2], p2[0], p2[1], p2[2],
        p0[0], p0[1], p0[2], p0[0], p0[1], p0[2],
        p2[0], p2[1], p2[2], p2[0], p2[1], p2[2],
        p3[0], p3[1], p3[2], p3[0], p3[1], p3[2],
      );
    }
  }
  return new Float32Array(data);
}

function buildQuad() {
  const n = [0, 0, 1];
  const v = [
    [-1, -1, 0],
    [1, -1, 0],
    [-1, 1, 0],
    [-1, 1, 0],
    [1, -1, 0],
    [1, 1, 0],
  ];
  const data = [];
  for (const p of v) {
    data.push(p[0], p[1], p[2], n[0], n[1], n[2]);
  }
  return new Float32Array(data);
}

function createMeshBuffer(data) {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, data);
  return { buffer, count: data.length / 6 };
}

const meshBuffers = {
  cube: createMeshBuffer(buildCube()),
  icosahedron: createMeshBuffer(buildIcosahedron()),
  sphere: createMeshBuffer(buildSphere()),
  square: createMeshBuffer(buildQuad()),
  circle: createMeshBuffer(buildQuad()),
};
let currentMesh = meshBuffers.cube;

const quadVerts = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1,
]);
const quadBuffer = device.createBuffer({
  size: quadVerts.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(quadBuffer, 0, quadVerts);

const instanceStride = 17 * 4;
let instanceBuffer = device.createBuffer({
  size: particleCapacity * instanceStride,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

const uniformBuffer = device.createBuffer({
  size: 160,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const noiseSize = 64;
const noiseData = new Uint8Array(noiseSize * noiseSize * 4);
for (let i = 0; i < noiseSize * noiseSize; i += 1) {
  const v = Math.floor(Math.random() * 255);
  noiseData[i * 4 + 0] = v;
  noiseData[i * 4 + 1] = v;
  noiseData[i * 4 + 2] = v;
  noiseData[i * 4 + 3] = 255;
}
const noiseTexture = device.createTexture({
  size: [noiseSize, noiseSize],
  format: "rgba8unorm",
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
});
device.queue.writeTexture(
  { texture: noiseTexture },
  noiseData,
  { bytesPerRow: noiseSize * 4 },
  [noiseSize, noiseSize]
);
const noiseSampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });

const shader = /* wgsl */ `
struct Uniforms {
  viewProj: mat4x4<f32>,
  lightDirIntensity: vec4<f32>,
  lightColorTime: vec4<f32>,
  shapeParams: vec4<f32>,
  cameraRight: vec4<f32>,
  cameraUp: vec4<f32>,
  motionBlurPad: vec4<f32>,
};

struct VertexIn {
  @location(0) pos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) instPos: vec3<f32>,
  @location(3) instSize: f32,
  @location(4) lifeT: f32,
  @location(5) seed: f32,
  @location(6) axis: vec3<f32>,
  @location(7) spin: f32,
  @location(8) instVel: vec3<f32>,
  @location(9) instOpacity: f32,
  @location(10) instColor: vec3<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) lifeT: f32,
  @location(2) localPos: vec3<f32>,
  @location(3) opacity: f32,
  @location(4) color: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var noiseTexture: texture_2d<f32>;
@group(0) @binding(2) var noiseSampler: sampler;

fn rotateByAxisAngle(v: vec3<f32>, axis: vec3<f32>, angle: f32) -> vec3<f32> {
  let c = cos(angle);
  let s = sin(angle);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}

@vertex
fn vs_main(input: VertexIn) -> VertexOut {
  var out: VertexOut;
  if (uniforms.shapeParams.x > 0.5) {
    let right = uniforms.cameraRight.xyz;
    let up = uniforms.cameraUp.xyz;
    let angle = input.seed + uniforms.lightColorTime.w * input.spin;
    let c = cos(angle);
    let s = sin(angle);
    let spinRight = right * c + up * s;
    let spinUp = -right * s + up * c;
    let billboard = (spinRight * input.pos.x + spinUp * input.pos.y) * input.instSize;
    let world = input.instPos + billboard;
    out.position = uniforms.viewProj * vec4<f32>(world, 1.0);
    out.normal = normalize(cross(right, up));
    out.localPos = vec3<f32>(input.pos.xy, 0.0);
  } else {
  let axis = normalize(input.axis);
  let angle = input.seed + uniforms.lightColorTime.w * input.spin;
    let rotated = rotateByAxisAngle(input.pos, axis, angle);
    let velDir = normalize(input.instVel);
    let stretch = velDir * length(input.instVel) * uniforms.motionBlurPad.x;
    let world = input.instPos + rotated * input.instSize + stretch * dot(rotated, velDir);
    out.position = uniforms.viewProj * vec4<f32>(world, 1.0);
    out.normal = rotateByAxisAngle(input.normal, axis, angle);
    out.localPos = input.pos;
  }
  out.lifeT = input.lifeT;
  out.opacity = input.instOpacity;
  out.color = input.instColor;
  return out;
}

@fragment
fn fs_main(input: VertexOut) -> @location(0) vec4<f32> {
  let normal = normalize(input.normal);
  let light = normalize(uniforms.lightDirIntensity.xyz);
  let diff = max(dot(normal, light), 0.0) * uniforms.lightDirIntensity.w;
  let lifeT = clamp(input.lifeT, 0.0, 1.0);
  let base = input.color;
  let lit = base * uniforms.lightColorTime.xyz * (0.25 + diff * 0.9);
  let shaded = mix(base, lit, step(0.5, uniforms.motionBlurPad.y));
  let uv = input.localPos.xy * 0.5 + 0.5;
  let noise = textureSample(noiseTexture, noiseSampler, uv).r;
  let noiseMix = mix(1.0, noise, uniforms.shapeParams.z);
  let blendScale = uniforms.motionBlurPad.w;
  let alpha = input.opacity * blendScale;
  let premul = step(0.5, uniforms.motionBlurPad.z);
  let colorOut = shaded * noiseMix * blendScale;
  if (uniforms.shapeParams.x > 1.5) {
    let edge = length(input.localPos.xy);
    if (uniforms.shapeParams.w > 0.001) {
      let shapeMask = 1.0 - smoothstep(1.0 - uniforms.shapeParams.w, 1.0, edge);
      if (shapeMask <= 0.001) {
        discard;
      }
      let outAlpha = alpha * shapeMask;
      let outColor = mix(colorOut, colorOut * outAlpha, premul);
      return vec4<f32>(outColor, outAlpha);
    }
    if (edge > 1.0) {
      discard;
    }
    let outAlpha = alpha;
    let outColor = mix(colorOut, colorOut * outAlpha, premul);
    return vec4<f32>(outColor, outAlpha);
  } else if (uniforms.shapeParams.x > 0.5) {
    let edge = max(abs(input.localPos.x), abs(input.localPos.y));
    if (uniforms.shapeParams.w > 0.001) {
      let shapeMask = 1.0 - smoothstep(1.0 - uniforms.shapeParams.w, 1.0, edge);
      if (shapeMask <= 0.001) {
        discard;
      }
      let outAlpha = alpha * shapeMask;
      let outColor = mix(colorOut, colorOut * outAlpha, premul);
      return vec4<f32>(outColor, outAlpha);
    }
    if (edge > 1.0) {
      discard;
    }
    let outAlpha = alpha;
    let outColor = mix(colorOut, colorOut * outAlpha, premul);
    return vec4<f32>(outColor, outAlpha);
  }
  let outAlpha = alpha;
  let outColor = mix(colorOut, colorOut * outAlpha, premul);
  return vec4<f32>(outColor, outAlpha);
}
`;

const particleModule = device.createShaderModule({ code: shader });
const particleBindGroupLayout = device.createBindGroupLayout({
  entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
  ],
});
const particlePipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [particleBindGroupLayout],
});

function createParticlePipeline(mode) {
  let blend;
  if (mode === "additive") {
    blend = {
      color: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" },
      alpha: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" },
    };
  } else if (mode === "screen") {
    blend = {
      color: { srcFactor: "one", dstFactor: "one-minus-src", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src", operation: "add" },
    };
  } else if (mode === "multiply") {
    blend = {
      color: { srcFactor: "dst", dstFactor: "zero", operation: "add" },
      alpha: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
    };
  } else {
    blend = {
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
    };
  }
  return device.createRenderPipeline({
    layout: particlePipelineLayout,
    vertex: {
      module: particleModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 24,
          attributes: [
            { shaderLocation: 0, format: "float32x3", offset: 0 },
            { shaderLocation: 1, format: "float32x3", offset: 12 },
          ],
        },
        {
          arrayStride: instanceStride,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 2, format: "float32x3", offset: 0 },
            { shaderLocation: 3, format: "float32", offset: 12 },
            { shaderLocation: 4, format: "float32", offset: 16 },
            { shaderLocation: 5, format: "float32", offset: 20 },
            { shaderLocation: 6, format: "float32x3", offset: 24 },
            { shaderLocation: 7, format: "float32", offset: 36 },
            { shaderLocation: 8, format: "float32x3", offset: 40 },
            { shaderLocation: 9, format: "float32", offset: 52 },
            { shaderLocation: 10, format: "float32x3", offset: 56 },
          ],
        },
      ],
    },
    fragment: {
      module: particleModule,
      entryPoint: "fs_main",
      targets: [{ format, blend }],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: false,
      depthCompare: "less",
    },
  });
}

const particlePipelines = {
  alpha: createParticlePipeline("alpha"),
  additive: createParticlePipeline("additive"),
  screen: createParticlePipeline("screen"),
  multiply: createParticlePipeline("multiply"),
};

const bindGroup = device.createBindGroup({
  layout: particleBindGroupLayout,
  entries: [
    { binding: 0, resource: { buffer: uniformBuffer } },
    { binding: 1, resource: noiseTexture.createView() },
    { binding: 2, resource: noiseSampler },
  ],
});

const dofShaderCode = await (await fetch("./dof-shader.wgsl")).text();
const dofModule = device.createShaderModule({ code: dofShaderCode });
const dofSampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
const dofUniformBuffer = device.createBuffer({
  size: 64,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const dofPipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: {
    module: dofModule,
    entryPoint: "vs",
    buffers: [
      {
        arrayStride: 8,
        attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }],
      },
    ],
  },
  fragment: {
    module: dofModule,
    entryPoint: "fs",
    targets: [{ format }],
  },
  primitive: { topology: "triangle-list" },
});

let colorTexture;
let depthTexture;
let dofBindGroup;
let gizmoSize = { width: 0, height: 0, dpr: 1 };
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = canvas.clientWidth || window.innerWidth;
  const cssHeight = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
  canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
  context.configure({ device, format, alphaMode: "premultiplied" });
  if (gizmoCanvas && gizmoCtx) {
    gizmoSize = { width: cssWidth, height: cssHeight, dpr };
    gizmoCanvas.width = Math.max(1, Math.floor(cssWidth * dpr));
    gizmoCanvas.height = Math.max(1, Math.floor(cssHeight * dpr));
    gizmoCanvas.style.width = `${cssWidth}px`;
    gizmoCanvas.style.height = `${cssHeight}px`;
    gizmoCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (colorTexture) colorTexture.destroy();
  if (depthTexture) depthTexture.destroy();
  colorTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  dofBindGroup = device.createBindGroup({
    layout: dofPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: colorTexture.createView() },
      { binding: 1, resource: depthTexture.createView() },
      { binding: 2, resource: dofSampler },
      { binding: 3, resource: { buffer: dofUniformBuffer } },
    ],
  });
}
window.addEventListener("resize", resize);
resize();

const view = new Float32Array(16);
const proj = new Float32Array(16);
const viewProj = new Float32Array(16);
const invViewProj = new Float32Array(16);
const uniformData = new Float32Array(40);
const dofData = new Float32Array(16);
let instanceData = new Float32Array(particleCapacity * 17);

const eye = [0, 0.4, 6];
const target = [0, 0, 0];
const up = [0, 1, 0];
const cameraRight = [1, 0, 0];
const cameraUp = [0, 1, 0];
const cameraForward = [0, 0, -1];

function updateCamera(timeSeconds) {
  const aspect = canvas.width / canvas.height;
  mat4Perspective(proj, CAMERA_FOV, aspect, 0.1, 50);
  mat4LookAt(view, eye, target, up);
  mat4Multiply(viewProj, proj, view);
  mat4Invert(invViewProj, viewProj);
  cameraRight[0] = view[0];
  cameraRight[1] = view[4];
  cameraRight[2] = view[8];
  cameraUp[0] = view[1];
  cameraUp[1] = view[5];
  cameraUp[2] = view[9];
  cameraForward[0] = -view[2];
  cameraForward[1] = -view[6];
  cameraForward[2] = -view[10];

  const lightPosLen = Math.hypot(lightPos[0], lightPos[1], lightPos[2]);
  let lightWorld;
  if (lightPosLen > 1e-4) {
    lightWorld = normalizeVec3(lightPos);
  } else {
    const az = (lightAzimuth * Math.PI) / 180;
    const el = (lightElevation * Math.PI) / 180;
    lightWorld = normalizeVec3([
      Math.cos(el) * Math.cos(az),
      Math.sin(el),
      Math.cos(el) * Math.sin(az),
    ]);
  }
  const lx = lightWorld[0];
  const ly = lightWorld[1];
  const lz = lightWorld[2];

  uniformData.set(viewProj, 0);
  uniformData[16] = lx;
  uniformData[17] = ly;
  uniformData[18] = lz;
  uniformData[19] = lightIntensity;
  uniformData[20] = lightColor[0];
  uniformData[21] = lightColor[1];
  uniformData[22] = lightColor[2];
  uniformData[23] = timeSeconds;
  uniformData[24] = particleShape === "square" ? 1 : particleShape === "circle" ? 2 : 0;
  uniformData[25] = 1.0;
  uniformData[26] = noiseStrength;
  uniformData[27] = softness;
  uniformData[28] = view[0];
  uniformData[29] = view[4];
  uniformData[30] = view[8];
  uniformData[31] = 0;
  uniformData[32] = view[1];
  uniformData[33] = view[5];
  uniformData[34] = view[9];
  uniformData[35] = 0;
  uniformData[36] = 0.0;
  uniformData[37] = shadingEnabled ? 1 : 0;
  uniformData[38] = blendMode === "screen" ? 1 : 0;
  uniformData[39] = blendMode === "additive" ? 0.4 : blendMode === "screen" ? 0.6 : 1.0;
  device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer);
}

function worldUnitsPerPixelAt(position) {
  const dx = position[0] - eye[0];
  const dy = position[1] - eye[1];
  const dz = position[2] - eye[2];
  const depth = Math.max(0.1, dx * cameraForward[0] + dy * cameraForward[1] + dz * cameraForward[2]);
  const viewHeight = 2 * depth * Math.tan(CAMERA_FOV * 0.5);
  return viewHeight / Math.max(1, canvas.height);
}

function drawEmitterWireframe(color, lineWidth) {
  if (!gizmoCtx) return;
  const segments = [];
  const size = Math.max(0.05, emitterSize);
  const center = [emitterPos[0], emitterPos[1], emitterPos[2]];
  const rotateLocal = (p) => {
    const r = applyEmitterRotation(p);
    return [r[0] + center[0], r[1] + center[1], r[2] + center[2]];
  };

  if (emitterShape === "sphere") {
    const rings = 24;
    for (let i = 0; i < rings; i += 1) {
      const a0 = (i / rings) * Math.PI * 2;
      const a1 = ((i + 1) / rings) * Math.PI * 2;
      const c0 = Math.cos(a0) * size;
      const s0 = Math.sin(a0) * size;
      const c1 = Math.cos(a1) * size;
      const s1 = Math.sin(a1) * size;
      segments.push([
        [center[0] + c0, center[1] + s0, center[2]],
        [center[0] + c1, center[1] + s1, center[2]],
      ]);
      segments.push([
        [center[0], center[1] + c0, center[2] + s0],
        [center[0], center[1] + c1, center[2] + s1],
      ]);
      segments.push([
        [center[0] + c0, center[1], center[2] + s0],
        [center[0] + c1, center[1], center[2] + s1],
      ]);
    }
  } else if (emitterShape === "box") {
    const h = size;
    const corners = [
      [-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h],
      [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h],
    ].map(rotateLocal);
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    edges.forEach(([a, b]) => segments.push([corners[a], corners[b]]));
  } else if (emitterShape === "plane") {
    const h = size;
    const p0 = rotateLocal([-h, -h, 0]);
    const p1 = rotateLocal([h, -h, 0]);
    const p2 = rotateLocal([h, h, 0]);
    const p3 = rotateLocal([-h, h, 0]);
    segments.push([p0, p1], [p1, p2], [p2, p3], [p3, p0]);
  } else if (emitterShape === "line") {
    const h = size * 0.5;
    const p0 = rotateLocal([-h, 0, 0]);
    const p1 = rotateLocal([h, 0, 0]);
    segments.push([p0, p1]);
  } else {
    const h = size * 0.25;
    segments.push([rotateLocal([-h, 0, 0]), rotateLocal([h, 0, 0])]);
    segments.push([rotateLocal([0, -h, 0]), rotateLocal([0, h, 0])]);
    segments.push([rotateLocal([0, 0, -h]), rotateLocal([0, 0, h])]);
  }

  gizmoCtx.strokeStyle = color;
  gizmoCtx.lineWidth = lineWidth;
  gizmoCtx.beginPath();
  segments.forEach(([a, b]) => {
    const sa = worldToScreen(a);
    const sb = worldToScreen(b);
    if (!sa || !sb) return;
    gizmoCtx.moveTo(sa[0], sa[1]);
    gizmoCtx.lineTo(sb[0], sb[1]);
  });
  gizmoCtx.stroke();
}

function drawEmitterGizmo() {
  if (!gizmoCtx) return;
  gizmoCtx.clearRect(0, 0, gizmoSize.width, gizmoSize.height);
  if (!emitterGizmoEnabled) return;
  const wireColor = "rgba(140, 210, 255, 0.9)";
  const lineWidth = 1.2;
  drawEmitterWireframe(wireColor, lineWidth);

  const origin = [emitterPos[0], emitterPos[1], emitterPos[2]];
  const handleLen = Math.max(0.3, emitterSize * 1.2);
  const axes = [
    { axis: [1, 0, 0], color: "rgba(255, 90, 90, 0.95)" },
    { axis: [0, 1, 0], color: "rgba(90, 255, 140, 0.95)" },
    { axis: [0, 0, 1], color: "rgba(90, 160, 255, 0.95)" },
  ];
  gizmoCtx.lineWidth = lineWidth;
  axes.forEach(({ axis, color }) => {
    const rotatedAxis = applyEmitterRotation(axis);
    const end = [
      origin[0] + rotatedAxis[0] * handleLen,
      origin[1] + rotatedAxis[1] * handleLen,
      origin[2] + rotatedAxis[2] * handleLen,
    ];
    const so = worldToScreen(origin);
    const se = worldToScreen(end);
    if (!so || !se) return;
    gizmoCtx.strokeStyle = color;
    gizmoCtx.beginPath();
    gizmoCtx.moveTo(so[0], so[1]);
    gizmoCtx.lineTo(se[0], se[1]);
    gizmoCtx.stroke();
    gizmoCtx.fillStyle = color;
    gizmoCtx.beginPath();
    gizmoCtx.arc(se[0], se[1], 4, 0, Math.PI * 2);
    gizmoCtx.fill();
    const dir = [se[0] - so[0], se[1] - so[1]];
    const len = Math.hypot(dir[0], dir[1]) || 1;
    const ux = dir[0] / len;
    const uy = dir[1] / len;
    const perp = [-uy, ux];
    const arrowSize = 6;
    const tip = [se[0] + ux * arrowSize, se[1] + uy * arrowSize];
    const left = [
      se[0] - ux * arrowSize + perp[0] * (arrowSize * 0.6),
      se[1] - uy * arrowSize + perp[1] * (arrowSize * 0.6),
    ];
    const right = [
      se[0] - ux * arrowSize - perp[0] * (arrowSize * 0.6),
      se[1] - uy * arrowSize - perp[1] * (arrowSize * 0.6),
    ];
    gizmoCtx.beginPath();
    gizmoCtx.moveTo(tip[0], tip[1]);
    gizmoCtx.lineTo(left[0], left[1]);
    gizmoCtx.lineTo(right[0], right[1]);
    gizmoCtx.closePath();
    gizmoCtx.fill();
  });
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
}

function updateEmitterPosInputs() {
  if (emitterPosXInput) {
    emitterPosXInput.value = String(emitterPos[0]);
    emitterPosXInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (emitterPosYInput) {
    emitterPosYInput.value = String(emitterPos[1]);
    emitterPosYInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (emitterPosZInput) {
    emitterPosZInput.value = String(emitterPos[2]);
    emitterPosZInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function startGizmoDrag(event) {
  if (!gizmoCtx) return false;
  const pointer = getPointerPosition(event);
  const origin = [emitterPos[0], emitterPos[1], emitterPos[2]];
  const handleLen = Math.max(0.3, emitterSize * 1.2);
  const axes = [
    { name: "x", axis: [1, 0, 0] },
    { name: "y", axis: [0, 1, 0] },
    { name: "z", axis: [0, 0, 1] },
  ];
  let best = null;
  let bestDist = Infinity;
  axes.forEach(({ name, axis }) => {
    const rotatedAxis = applyEmitterRotation(axis);
    const end = [
      origin[0] + rotatedAxis[0] * handleLen,
      origin[1] + rotatedAxis[1] * handleLen,
      origin[2] + rotatedAxis[2] * handleLen,
    ];
    const se = worldToScreen(end);
    const so = worldToScreen(origin);
    if (!se || !so) return;
    const dx = pointer[0] - se[0];
    const dy = pointer[1] - se[1];
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = { name, axis: rotatedAxis, so, se };
    }
  });
  if (!best || bestDist > 10) return false;
  const dir = [best.se[0] - best.so[0], best.se[1] - best.so[1]];
  const len = Math.hypot(dir[0], dir[1]) || 1;
  gizmoDragDir = [dir[0] / len, dir[1] / len];
  gizmoDragAxis = best.axis;
  gizmoLastPointer = pointer;
  gizmoDragging = true;
  return true;
}

function updateGizmoDrag(event) {
  if (!gizmoDragging || !gizmoDragAxis) return;
  const pointer = getPointerPosition(event);
  const dx = pointer[0] - gizmoLastPointer[0];
  const dy = pointer[1] - gizmoLastPointer[1];
  const projected = dx * gizmoDragDir[0] + dy * gizmoDragDir[1];
  const deltaWorld = projected * worldUnitsPerPixelAt(emitterPos);
  emitterPos[0] += gizmoDragAxis[0] * deltaWorld;
  emitterPos[1] += gizmoDragAxis[1] * deltaWorld;
  emitterPos[2] += gizmoDragAxis[2] * deltaWorld;
  gizmoLastPointer = pointer;
  updateEmitterPosInputs();
}

updateCamera(0);
spawnAt(0, 0);

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function rgbToHex(rgb) {
  return (
    "#" +
    rgb
      .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

function setupCurveEditor(canvas, options) {
  const state = {
    points: options.points.map((p) => ({ x: p.x, y: p.y, mode: p.mode || "bezier" })),
    yMin: options.yMin,
    yMax: options.yMax,
    onChange: options.onChange,
    snap: options.snap || 0,
  };
  let dragging = -1;
  let contextIndex = -1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }

  function toCanvas(p) {
    const pad = 10;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    return {
      x: pad + p.x * w,
      y: pad + (1 - (p.y - state.yMin) / (state.yMax - state.yMin)) * h,
    };
  }

  function fromCanvas(x, y) {
    const pad = 10;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    const nx = clamp((x - pad) / w, 0, 1);
    const ny = clamp(1 - (y - pad) / h, 0, 1);
    return {
      x: nx,
      y: state.yMin + ny * (state.yMax - state.yMin),
    };
  }

  function drawGrid(ctx) {
    const pad = 10;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    const step = state.snap > 0 ? state.snap : 0.1;
    for (let i = 0; i <= 1.0001; i += step) {
      const isMajor = Math.abs(i - 0) < 0.001 || Math.abs(i - 0.5) < 0.001 || Math.abs(i - 1) < 0.001;
      ctx.strokeStyle = isMajor ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)";
      ctx.lineWidth = isMajor ? 1.2 : 1;
      const x = pad + i * w;
      const y = pad + (1 - i) * h;
      ctx.beginPath();
      ctx.moveTo(x, pad);
      ctx.lineTo(x, pad + h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(pad + w, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(214,224,234,0.75)";
    ctx.font = "12px 'SF Mono', Menlo, monospace";
    ctx.fillText("1", pad + 2, pad + 10);
    ctx.fillText("0.5", pad + 2, pad + h * 0.5 + 5);
    ctx.fillText("0", pad + 2, pad + h + 4);
    ctx.fillText("0", pad, pad + h + 12);
    ctx.fillText("0.5", pad + w * 0.5 - 10, pad + h + 12);
    ctx.fillText("1", pad + w - 6, pad + h + 12);
  }

  function drawCurve(ctx) {
    ctx.strokeStyle = "rgba(86,156,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const samples = 80;
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const y = evalCurve(state.points, t);
      const p = toCanvas({ x: t, y });
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  function drawPoints(ctx) {
    for (let i = 0; i < state.points.length; i += 1) {
      const p = toCanvas(state.points[i]);
      const isLinear = state.points[i].mode === "linear";
      ctx.fillStyle = i === dragging ? "#d6e0ea" : "rgba(214,224,234,0.95)";
      ctx.strokeStyle = "rgba(11,15,20,0.95)";
      ctx.lineWidth = 2;
      if (isLinear) {
        const size = 11;
        ctx.beginPath();
        ctx.rect(p.x - size / 2, p.y - size / 2, size, size);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function render() {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx);
    drawCurve(ctx);
    drawPoints(ctx);
  }

  function hitTest(x, y) {
    for (let i = 0; i < state.points.length; i += 1) {
      const p = toCanvas(state.points[i]);
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < 10 * 10) return i;
    }
    return -1;
  }

  function updatePoint(index, pos) {
    const eps = 0.01;
    let nextPos = { x: pos.x, y: pos.y };
    if (state.snap > 0) {
      const xSnap = Math.round(nextPos.x / state.snap) * state.snap;
      const yNorm = (nextPos.y - state.yMin) / (state.yMax - state.yMin);
      const ySnap = Math.round(yNorm / state.snap) * state.snap;
      nextPos = {
        x: clamp(xSnap, 0, 1),
        y: state.yMin + clamp(ySnap, 0, 1) * (state.yMax - state.yMin),
      };
    }
    if (index === 0) {
      state.points[index].y = clamp(nextPos.y, state.yMin, state.yMax);
      return;
    }
    if (index === state.points.length - 1) {
      state.points[index].y = clamp(nextPos.y, state.yMin, state.yMax);
      return;
    }
    const prev = state.points[index - 1];
    const next = state.points[index + 1];
    state.points[index].x = clamp(nextPos.x, prev.x + eps, next.x - eps);
    state.points[index].y = clamp(nextPos.y, state.yMin, state.yMax);
  }

  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    dragging = hitTest(x, y);
    if (dragging !== -1) {
      canvas.setPointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (dragging === -1) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    const pos = fromCanvas(x, y);
    updatePoint(dragging, pos);
    render();
    state.onChange(state.points);
  });
  canvas.addEventListener("pointerup", () => {
    dragging = -1;
  });
  canvas.addEventListener("pointerleave", () => {
    dragging = -1;
  });
  canvas.addEventListener("dblclick", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    const pos = fromCanvas(x, y);
    if (state.snap > 0) {
      const xSnap = Math.round(pos.x / state.snap) * state.snap;
      const yNorm = (pos.y - state.yMin) / (state.yMax - state.yMin);
      const ySnap = Math.round(yNorm / state.snap) * state.snap;
      pos.x = clamp(xSnap, 0, 1);
      pos.y = state.yMin + clamp(ySnap, 0, 1) * (state.yMax - state.yMin);
    }
    state.points.push({ x: pos.x, y: pos.y, mode: "bezier" });
    state.points.sort((a, b) => a.x - b.x);
    render();
    state.onChange(state.points);
  });

  const menu = document.createElement("div");
  menu.style.position = "fixed";
  menu.style.zIndex = "50";
  menu.style.padding = "6px";
  menu.style.borderRadius = "8px";
  menu.style.background = "rgba(12, 18, 26, 0.96)";
  menu.style.border = "1px solid rgba(255, 255, 255, 0.12)";
  menu.style.boxShadow = "0 10px 24px rgba(0,0,0,0.35)";
  menu.style.display = "none";
  menu.style.font = "12px/1.2 'SF Mono', Menlo, monospace";
  menu.style.color = "#d6e0ea";
  const btnBezier = document.createElement("button");
  btnBezier.type = "button";
  btnBezier.textContent = "Bezier";
  btnBezier.className = "pill-toggle";
  btnBezier.style.marginRight = "6px";
  const btnLinear = document.createElement("button");
  btnLinear.type = "button";
  btnLinear.textContent = "Linear";
  btnLinear.className = "pill-toggle";
  menu.appendChild(btnBezier);
  menu.appendChild(btnLinear);
  document.body.appendChild(menu);

  function hideMenu() {
    menu.style.display = "none";
    contextIndex = -1;
  }

  canvas.addEventListener("contextmenu", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    const hit = hitTest(x, y);
    if (hit === -1) return;
    event.preventDefault();
    contextIndex = hit;
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    const mode = state.points[contextIndex].mode || "bezier";
    btnBezier.dataset.state = mode === "bezier" ? "on" : "off";
    btnBezier.textContent = "Bezier";
    btnLinear.dataset.state = mode === "linear" ? "on" : "off";
    btnLinear.textContent = "Linear";
    menu.style.display = "block";
  });

  btnBezier.addEventListener("click", () => {
    if (contextIndex === -1) return;
    state.points[contextIndex].mode = "bezier";
    render();
    state.onChange(state.points);
    hideMenu();
  });
  btnLinear.addEventListener("click", () => {
    if (contextIndex === -1) return;
    state.points[contextIndex].mode = "linear";
    render();
    state.onChange(state.points);
    hideMenu();
  });
  window.addEventListener("click", (event) => {
    if (menu.style.display === "none") return;
    if (!menu.contains(event.target)) hideMenu();
  });
  window.addEventListener("blur", hideMenu);

  resize();
  render();
  return {
    resize() {
      resize();
      render();
    },
    getPoints() {
      return state.points;
    },
  };
}

function setupGradientEditor(canvas, options) {
  const state = {
    points: options.points.map((p) => ({
      x: p.x,
      color: [p.color[0], p.color[1], p.color[2]],
    })),
    onChange: options.onChange,
  };
  let dragging = -1;
  let active = -1;
  let dragMoved = false;

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.style.position = "fixed";
  colorInput.style.opacity = "0";
  colorInput.style.pointerEvents = "none";
  colorInput.style.zIndex = "60";
  colorInput.style.width = "28px";
  colorInput.style.height = "28px";
  colorInput.style.border = "none";
  colorInput.style.padding = "0";
  document.body.appendChild(colorInput);

  const toolbar = document.createElement("div");
  toolbar.style.display = "flex";
  toolbar.style.gap = "6px";
  toolbar.style.alignItems = "center";
  toolbar.style.marginTop = "6px";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "+";
  addBtn.className = "pill-toggle";
  addBtn.style.minWidth = "28px";
  addBtn.style.padding = "4px 0";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "-";
  removeBtn.className = "pill-toggle";
  removeBtn.style.minWidth = "28px";
  removeBtn.style.padding = "4px 0";
  toolbar.appendChild(addBtn);
  toolbar.appendChild(removeBtn);
  canvas.parentElement.appendChild(toolbar);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }

  function toCanvas(p) {
    const pad = 10;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    return {
      x: pad + p.x * w,
      y: pad + h * 0.5,
    };
  }

  function fromCanvas(x) {
    const pad = 10;
    const w = canvas.width - pad * 2;
    return clamp((x - pad) / w, 0, 1);
  }

  function drawGradient(ctx) {
    const pad = 10;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    const grad = ctx.createLinearGradient(pad, 0, pad + w, 0);
    state.points.forEach((p) => {
      const color = `rgb(${Math.round(p.color[0] * 255)}, ${Math.round(
        p.color[1] * 255
      )}, ${Math.round(p.color[2] * 255)})`;
      grad.addColorStop(p.x, color);
    });
    ctx.fillStyle = grad;
    ctx.fillRect(pad, pad, w, h);
  }

  function drawPoints(ctx) {
    for (let i = 0; i < state.points.length; i += 1) {
      const p = toCanvas(state.points[i]);
      ctx.fillStyle = `rgb(${Math.round(state.points[i].color[0] * 255)}, ${Math.round(
        state.points[i].color[1] * 255
      )}, ${Math.round(state.points[i].color[2] * 255)})`;
      ctx.strokeStyle = i === active ? "#d6e0ea" : "rgba(0,0,0,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function render() {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGradient(ctx);
    drawPoints(ctx);
  }

  function hitTest(x, y) {
    for (let i = 0; i < state.points.length; i += 1) {
      const p = toCanvas(state.points[i]);
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < 10 * 10) return i;
    }
    return -1;
  }

  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    dragging = hitTest(x, y);
    if (dragging !== -1) {
      active = dragging;
      dragMoved = false;
      canvas.setPointerCapture(event.pointerId);
      render();
      return;
    }
    active = -1;
    render();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (dragging === -1) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const nextX = fromCanvas(x);
    const point = state.points[dragging];
    dragMoved = true;
    if (dragging > 0) {
      point.x = Math.max(nextX, state.points[dragging - 1].x + 0.01);
    } else {
      point.x = nextX;
    }
    if (dragging < state.points.length - 1) {
      point.x = Math.min(point.x, state.points[dragging + 1].x - 0.01);
    } else {
      point.x = Math.min(point.x, 1);
    }
    render();
    state.onChange(state.points);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (dragging !== -1 && !dragMoved) {
      openColorPicker(event.clientX + 8, event.clientY + 8);
    }
    dragging = -1;
  });
  canvas.addEventListener("pointerleave", () => {
    dragging = -1;
  });
  canvas.addEventListener("dblclick", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const pos = fromCanvas(x);
    state.points.push({ x: pos, color: [1, 1, 1] });
    state.points.sort((a, b) => a.x - b.x);
    active = state.points.findIndex((p) => p.x === pos);
    render();
    state.onChange(state.points);
  });
  function openColorPicker(clientX, clientY) {
    const rgb = state.points[active].color;
    colorInput.value = rgbToHex(rgb);
    colorInput.style.left = `${clientX}px`;
    colorInput.style.top = `${clientY}px`;
    colorInput.style.opacity = "1";
    colorInput.style.pointerEvents = "auto";
    colorInput.click();
  }

  function closeColorPicker() {
    colorInput.style.opacity = "0";
    colorInput.style.pointerEvents = "none";
  }

  canvas.addEventListener("contextmenu", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    const hit = hitTest(x, y);
    if (hit === -1) return;
    event.preventDefault();
    if (state.points.length <= 2) return;
    state.points.splice(hit, 1);
    active = -1;
    render();
    state.onChange(state.points);
  });

  colorInput.addEventListener("input", () => {
    if (active === -1) return;
    state.points[active].color = hexToRgb(colorInput.value);
    render();
    state.onChange(state.points);
  });

  addBtn.addEventListener("click", () => {
    const pos = 0.5;
    state.points.push({ x: pos, color: [1, 1, 1] });
    state.points.sort((a, b) => a.x - b.x);
    active = state.points.findIndex((p) => p.x === pos);
    render();
    state.onChange(state.points);
  });
  removeBtn.addEventListener("click", () => {
    if (active === -1) return;
    if (state.points.length <= 2) return;
    state.points.splice(active, 1);
    active = -1;
    render();
    state.onChange(state.points);
  });
  colorInput.addEventListener("blur", closeColorPicker);
  window.addEventListener("scroll", closeColorPicker, { passive: true });

  resize();
  render();
  return {
    resize() {
      resize();
      render();
    },
    getPoints() {
      return state.points;
    },
  };
}

function bindRange(id, valueId, getter, setter) {
  const input = document.getElementById(id);
  const label = document.getElementById(valueId);
  if (!input || !label) return;
  input.value = String(getter());
  label.textContent = formatWithStep(parseFloat(input.value), parseFloat(input.step));
  label.classList.add("editable-value");
  label.dataset.inputId = id;
  if (input.min) label.dataset.min = input.min;
  if (input.max) label.dataset.max = input.max;
  if (input.step) label.dataset.step = input.step;
  input.addEventListener("input", () => {
    const next = setter(parseFloat(input.value));
    if (typeof next === "number") {
      input.value = String(next);
    }
    label.textContent = formatWithStep(parseFloat(input.value), parseFloat(input.step));
  });
}

bindRange("emissionRate", "emissionRateVal", () => emissionRate, (v) => {
  emissionRate = Math.max(0, v);
  return emissionRate;
});
bindRange("turbulence", "turbulenceVal", () => turbulenceStrength, (v) => {
  turbulenceStrength = v;
  return turbulenceStrength;
});
bindRange("turbulenceScale", "turbulenceScaleVal", () => turbulenceScale, (v) => {
  turbulenceScale = Math.max(0.1, v);
  return turbulenceScale;
});
bindRange("curlStrength", "curlStrengthVal", () => curlStrength, (v) => {
  curlStrength = v;
  return curlStrength;
});
bindRange("curlScale", "curlScaleVal", () => curlScale, (v) => {
  curlScale = Math.max(0.1, v);
  return curlScale;
});
bindRange("vortexStrength", "vortexStrengthVal", () => vortexStrength, (v) => {
  vortexStrength = Math.max(0, v);
  return vortexStrength;
});
bindRange("vortexRadius", "vortexRadiusVal", () => vortexRadius, (v) => {
  vortexRadius = Math.max(0.1, v);
  return vortexRadius;
});
bindRange("gravity", "gravityVal", () => gravity, (v) => {
  gravity = v;
  return gravity;
});
bindRange("windX", "windXVal", () => wind[0], (v) => {
  wind[0] = v;
  return wind[0];
});
bindRange("windY", "windYVal", () => wind[1], (v) => {
  wind[1] = v;
  return wind[1];
});
bindRange("windZ", "windZVal", () => wind[2], (v) => {
  wind[2] = v;
  return wind[2];
});
bindRange("drag", "dragVal", () => drag, (v) => {
  drag = Math.max(0, v);
  return drag;
});
bindRange("attractorStrength", "attractorStrengthVal", () => attractorStrength, (v) => {
  attractorStrength = Math.max(0, v);
  return attractorStrength;
});
bindRange("attractorRadius", "attractorRadiusVal", () => attractorRadius, (v) => {
  attractorRadius = Math.max(0, v);
  return attractorRadius;
});
bindRange("groundLevel", "groundLevelVal", () => groundLevel, (v) => {
  groundLevel = v;
  return groundLevel;
});
bindRange("bounce", "bounceVal", () => bounce, (v) => {
  bounce = Math.max(0, Math.min(1, v));
  return bounce;
});
function setToggleState(button, enabled) {
  button.dataset.state = enabled ? "on" : "off";
  button.textContent = enabled ? "On" : "Off";
}

const forcesControls = document.getElementById("forcesControls");
forcesControls.style.display = forcesEnabled ? "" : "none";

const forceModeSelect = document.getElementById("forceMode");
const turbulenceControls = document.getElementById("turbulenceControls");
const curlControls = document.getElementById("curlControls");
const vortexControls = document.getElementById("vortexControls");
const attractorControls = document.getElementById("attractorControls");

function updateForceModeUI() {
  if (forceModeSelect) forceModeSelect.value = forceMode;
if (turbulenceControls) turbulenceControls.style.display = forceMode === "turbulence" ? "" : "none";
if (curlControls) curlControls.style.display = forceMode === "curl" ? "" : "none";
if (vortexControls) vortexControls.style.display = vortexEnabled ? "" : "none";
if (attractorControls) attractorControls.style.display = attractorEnabled ? "" : "none";
}

if (forceModeSelect) {
  forceModeSelect.value = forceMode;
  forceModeSelect.addEventListener("change", () => {
    forceMode = forceModeSelect.value;
    updateForceModeUI();
  });
}
updateForceModeUI();

const vortexToggle = document.getElementById("vortexEnabled");
setToggleState(vortexToggle, vortexEnabled);
vortexToggle.addEventListener("click", () => {
  vortexEnabled = !vortexEnabled;
  setToggleState(vortexToggle, vortexEnabled);
  updateForceModeUI();
});

const attractorToggle = document.getElementById("attractorEnabled");
setToggleState(attractorToggle, attractorEnabled);
attractorToggle.addEventListener("click", () => {
  attractorEnabled = !attractorEnabled;
  setToggleState(attractorToggle, attractorEnabled);
  updateForceModeUI();
});

const groundToggle = document.getElementById("groundEnabled");
const groundControls = document.getElementById("groundControls");
groundControls.style.display = groundEnabled ? "" : "none";
setToggleState(groundToggle, groundEnabled);
groundToggle.addEventListener("click", () => {
  groundEnabled = !groundEnabled;
  setToggleState(groundToggle, groundEnabled);
  groundControls.style.display = groundEnabled ? "" : "none";
});
const forcesToggle = document.getElementById("forcesEnabled");
setToggleState(forcesToggle, forcesEnabled);
forcesToggle.addEventListener("click", () => {
  forcesEnabled = !forcesEnabled;
  setToggleState(forcesToggle, forcesEnabled);
  forcesControls.style.display = forcesEnabled ? "" : "none";
});
bindRange("lifeSeconds", "lifeSecondsVal", () => lifeSeconds, (v) => {
  lifeSeconds = Math.max(0.1, v);
  return lifeSeconds;
});
bindRange("lifeRandom", "lifeRandomVal", () => lifeRandom, (v) => {
  lifeRandom = Math.max(0, Math.min(1, v));
  return lifeRandom;
});
bindRange("spinRate2d", "spinRate2dVal", () => spinRate2d, (v) => {
  spinRate2d = v;
  return spinRate2d;
});
bindRange("spinRateX", "spinRateXVal", () => spinRateX, (v) => {
  spinRateX = v;
  return spinRateX;
});
bindRange("spinRateY", "spinRateYVal", () => spinRateY, (v) => {
  spinRateY = v;
  return spinRateY;
});
bindRange("spinRateZ", "spinRateZVal", () => spinRateZ, (v) => {
  spinRateZ = v;
  return spinRateZ;
});
bindRange("spinRandom", "spinRandomVal", () => spinRandom, (v) => {
  spinRandom = Math.max(0, v);
  return spinRandom;
});
bindRange("particleSize", "particleSizeVal", () => particleSize, (v) => {
  particleSize = Math.max(1, Math.min(500, v));
  return particleSize;
});
bindRange("emitterSize", "emitterSizeVal", () => emitterSize, (v) => {
  emitterSize = Math.max(0, v);
  return emitterSize;
});
bindRange("initialSpeed", "initialSpeedVal", () => initialSpeed, (v) => {
  initialSpeed = Math.max(0, v);
  return initialSpeed;
});
bindRange("speedRandom", "speedRandomVal", () => speedRandom, (v) => {
  speedRandom = Math.max(0, v);
  return speedRandom;
});
bindRange("coneAngle", "coneAngleVal", () => coneAngle, (v) => {
  coneAngle = v;
  return coneAngle;
});
bindRange("emitterPosX", "emitterPosXVal", () => emitterPos[0], (v) => {
  emitterPos[0] = v;
  return emitterPos[0];
});
bindRange("emitterPosY", "emitterPosYVal", () => emitterPos[1], (v) => {
  emitterPos[1] = v;
  return emitterPos[1];
});
bindRange("emitterPosZ", "emitterPosZVal", () => emitterPos[2], (v) => {
  emitterPos[2] = v;
  return emitterPos[2];
});
bindRange("focusDepth", "focusDepthVal", () => focusOffset, (v) => {
  focusOffset = v;
  return focusOffset;
});
bindRange("aperture", "apertureVal", () => aperture, (v) => {
  aperture = Math.max(0, v);
  return aperture;
});
bindRange("focusRange", "focusRangeVal", () => focusRange, (v) => {
  focusRange = Math.max(0.1, v);
  return focusRange;
});
bindRange("bloomStrength", "bloomStrengthVal", () => bloomStrength, (v) => {
  bloomStrength = Math.max(0, v);
  return bloomStrength;
});
bindRange("bloomThreshold", "bloomThresholdVal", () => bloomThreshold, (v) => {
  bloomThreshold = Math.max(0, Math.min(1.5, v));
  return bloomThreshold;
});
bindRange("exposure", "exposureVal", () => exposure, (v) => {
  exposure = Math.max(0.1, v);
  return exposure;
});
bindRange("softness", "softnessVal", () => softness, (v) => {
  softness = Math.max(0, Math.min(1, v));
  return softness;
});
bindRange("lightIntensity", "lightIntensityVal", () => lightIntensity, (v) => {
  lightIntensity = Math.max(0, v);
  return lightIntensity;
});
bindRange("lightPosX", "lightPosXVal", () => lightPos[0], (v) => {
  lightPos[0] = v;
  return lightPos[0];
});
bindRange("lightPosY", "lightPosYVal", () => lightPos[1], (v) => {
  lightPos[1] = v;
  return lightPos[1];
});
bindRange("lightPosZ", "lightPosZVal", () => lightPos[2], (v) => {
  lightPos[2] = v;
  return lightPos[2];
});
bindRange("lightAzimuth", "lightAzimuthVal", () => lightAzimuth, (v) => {
  lightAzimuth = v;
  return lightAzimuth;
});
bindRange("lightElevation", "lightElevationVal", () => lightElevation, (v) => {
  lightElevation = v;
  return lightElevation;
});

const dofModeSelect = document.getElementById("dofMode");
dofModeSelect.value = "bokeh";
dofModeSelect.addEventListener("change", () => {
  dofMode = dofModeSelect.value === "physical" ? 1 : 0;
});

const dofToggle = document.getElementById("dofEnabled");
const dofControls = document.getElementById("dofControls");
dofControls.style.display = dofEnabled ? "" : "none";
setToggleState(dofToggle, dofEnabled);
dofToggle.addEventListener("click", () => {
  dofEnabled = !dofEnabled;
  setToggleState(dofToggle, dofEnabled);
  dofControls.style.display = dofEnabled ? "" : "none";
});

const shadingToggle = document.getElementById("shadingEnabled");
const shadingControls = document.getElementById("shadingControls");
shadingControls.style.display = shadingEnabled ? "" : "none";
setToggleState(shadingToggle, shadingEnabled);
shadingToggle.addEventListener("click", () => {
  shadingEnabled = !shadingEnabled;
  setToggleState(shadingToggle, shadingEnabled);
  shadingControls.style.display = shadingEnabled ? "" : "none";
});

const focusOverlayToggle = document.getElementById("focusOverlay");
setToggleState(focusOverlayToggle, focusOverlay > 0.5);
focusOverlayToggle.addEventListener("click", () => {
  focusOverlay = focusOverlay > 0.5 ? 0 : 1;
  setToggleState(focusOverlayToggle, focusOverlay > 0.5);
});

const emitterShapeSelect = document.getElementById("emitterShape");
const emitterShapeControls = document.getElementById("emitterShapeControls");
emitterShapeControls.style.display = emitterShape === "point" ? "none" : "";
emitterShapeSelect.value = emitterShape;
emitterShapeSelect.addEventListener("change", () => {
  emitterShape = emitterShapeSelect.value;
  emitterShapeControls.style.display = emitterShape === "point" ? "none" : "";
});

const emitFromSelect = document.getElementById("emitFrom");
emitFromSelect.value = emitFrom;
emitFromSelect.addEventListener("change", () => {
  emitFrom = emitFromSelect.value;
});

const emitModeSelect = document.getElementById("emitMode");
emitModeSelect.value = emitMode;
emitModeSelect.addEventListener("change", () => {
  emitMode = emitModeSelect.value;
});

const particleShapeSelect = document.getElementById("particleShape");
const softnessControl = document.getElementById("softnessControl");
const spin2dControls = document.getElementById("spin2dControls");
const spin3dControls = document.getElementById("spin3dControls");
const is2DShape = () => particleShape === "circle" || particleShape === "square";
softnessControl.style.display = is2DShape() ? "" : "none";
spin2dControls.style.display = is2DShape() ? "" : "none";
spin3dControls.style.display = is2DShape() ? "none" : "";
particleShapeSelect.value = particleShape;
particleShapeSelect.addEventListener("change", () => {
  particleShape = particleShapeSelect.value;
  currentMesh = meshBuffers[particleShape] || meshBuffers.cube;
  softnessControl.style.display = is2DShape() ? "" : "none";
  spin2dControls.style.display = is2DShape() ? "" : "none";
  spin3dControls.style.display = is2DShape() ? "none" : "";
});

const blendModeSelect = document.getElementById("blendMode");
blendModeSelect.value = blendMode;
blendModeSelect.addEventListener("change", () => {
  blendMode = blendModeSelect.value;
});

const emitterGizmoToggle = document.getElementById("emitterGizmo");
setToggleState(emitterGizmoToggle, emitterGizmoEnabled);
emitterGizmoToggle.addEventListener("click", () => {
  emitterGizmoEnabled = !emitterGizmoEnabled;
  setToggleState(emitterGizmoToggle, emitterGizmoEnabled);
  drawEmitterGizmo();
});

const direction3dControls = document.getElementById("direction3dControls");
const directionXWheel = document.getElementById("directionXWheel");
const directionXDot = document.getElementById("directionXDot");
const directionXVal = document.getElementById("directionXVal");
const directionXReset = document.getElementById("directionXReset");
const directionYWheel = document.getElementById("directionYWheel");
const directionYDot = document.getElementById("directionYDot");
const directionYVal = document.getElementById("directionYVal");
const directionYReset = document.getElementById("directionYReset");
const directionZWheel = document.getElementById("directionZWheel");
const directionZDot = document.getElementById("directionZDot");
const directionZVal = document.getElementById("directionZVal");
const directionZReset = document.getElementById("directionZReset");

function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function updateWheel(wheel, dot, angleDeg) {
  if (!wheel || !dot) return;
  const radius = wheel.clientWidth * 0.5;
  const angle = ((angleDeg - 90) * Math.PI) / 180;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  dot.style.left = `${radius + x}px`;
  dot.style.top = `${radius + y}px`;
}

function updateDirectionUI() {
  directionRotX = normalizeAngle(directionRotX);
  directionRotY = normalizeAngle(directionRotY);
  directionRotZ = normalizeAngle(directionRotZ);
  if (directionXVal && !directionXVal.classList.contains("editing")) {
    directionXVal.textContent = `${Math.round(directionRotX)}°`;
  }
  if (directionYVal && !directionYVal.classList.contains("editing")) {
    directionYVal.textContent = `${Math.round(directionRotY)}°`;
  }
  if (directionZVal && !directionZVal.classList.contains("editing")) {
    directionZVal.textContent = `${Math.round(directionRotZ)}°`;
  }
  updateWheel(directionXWheel, directionXDot, directionRotX);
  updateWheel(directionYWheel, directionYDot, directionRotY);
  updateWheel(directionZWheel, directionZDot, directionRotZ);
}

function angleFromPointer(event, wheel) {
  const rect = wheel.getBoundingClientRect();
  const centerX = rect.left + rect.width * 0.5;
  const centerY = rect.top + rect.height * 0.5;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const angle = Math.atan2(dy, dx);
  return normalizeAngle((angle * 180) / Math.PI + 90);
}

function setupAngleValueEditor(element, getter, setter) {
  if (element) {
    element.classList.add("editable-value");
  }
  setupEditableNumber(element, {
    getValue: getter,
    setValue: (value) => {
      setter(normalizeAngle(value));
      updateDirectionUI();
    },
    min: 0,
    max: 360,
    step: 1,
    formatDisplay: (value) => `${Math.round(value)}°`,
    formatEdit: (value) => `${Math.round(value)}`,
  });
}

function attachAngleWheel(wheel, onChange) {
  if (!wheel) return;
  let dragging = false;
  wheel.addEventListener("pointerdown", (event) => {
    dragging = true;
    wheel.setPointerCapture(event.pointerId);
    onChange(angleFromPointer(event, wheel));
  });
  wheel.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    onChange(angleFromPointer(event, wheel));
  });
  wheel.addEventListener("pointerup", (event) => {
    dragging = false;
    wheel.releasePointerCapture(event.pointerId);
  });
  wheel.addEventListener("pointercancel", (event) => {
    dragging = false;
    wheel.releasePointerCapture(event.pointerId);
  });
}

setupAngleValueEditor(directionXVal, () => directionRotX, (value) => {
  directionRotX = value;
});
setupAngleValueEditor(directionYVal, () => directionRotY, (value) => {
  directionRotY = value;
});
setupAngleValueEditor(directionZVal, () => directionRotZ, (value) => {
  directionRotZ = value;
});

attachAngleWheel(directionXWheel, (angle) => {
  directionRotX = angle;
  updateDirectionUI();
});
attachAngleWheel(directionYWheel, (angle) => {
  directionRotY = angle;
  updateDirectionUI();
});
attachAngleWheel(directionZWheel, (angle) => {
  directionRotZ = angle;
  updateDirectionUI();
});

if (directionXReset) {
  directionXReset.addEventListener("click", () => {
    directionRotX = 0;
    updateDirectionUI();
  });
}
if (directionYReset) {
  directionYReset.addEventListener("click", () => {
    directionRotY = 0;
    updateDirectionUI();
  });
}
if (directionZReset) {
  directionZReset.addEventListener("click", () => {
    directionRotZ = 0;
    updateDirectionUI();
  });
}
updateDirectionUI();

const baseColorInput = document.getElementById("baseColor");
const baseColorVal = document.getElementById("baseColorVal");
baseColorInput.value = rgbToHex(lightColor);
baseColorVal.textContent = baseColorInput.value;
baseColorInput.addEventListener("input", () => {
  lightColor = hexToRgb(baseColorInput.value);
  baseColorVal.textContent = baseColorInput.value;
});

let sizeCurvePoints = [
  { x: 0, y: 0.0 },
  { x: 0.3, y: 1.0 },
  { x: 1, y: 0.0 },
];
let opacityCurvePoints = [
  { x: 0, y: 1.0 },
  { x: 0.5, y: 1.0 },
  { x: 1, y: 1.0 },
];
let colorGradientPoints = [
  { x: 0, color: [0.62, 0.78, 0.99] },
  { x: 1, color: [0.83, 0.34, 1.0] },
];

const sizeCurveCanvas = document.getElementById("sizeCurveCanvas");
const opacityCurveCanvas = document.getElementById("opacityCurveCanvas");
const colorGradientCanvas = document.getElementById("colorGradientCanvas");
const gradientControl = document.getElementById("gradientControl");
const colorModeSelect = document.getElementById("colorMode");
const solidColorControl = document.getElementById("solidColorControl");
const solidColorInput = document.getElementById("solidColor");
const solidColorVal = document.getElementById("solidColorVal");

const sizeCurveEditor = setupCurveEditor(sizeCurveCanvas, {
  points: sizeCurvePoints,
  yMin: 0,
  yMax: 1,
  snap: 0.1,
  onChange: (points) => {
    sizeCurvePoints = points;
  },
});
const opacityCurveEditor = setupCurveEditor(opacityCurveCanvas, {
  points: opacityCurvePoints,
  yMin: 0,
  yMax: 1,
  snap: 0.1,
  onChange: (points) => {
    opacityCurvePoints = points;
  },
});
const gradientEditor = setupGradientEditor(colorGradientCanvas, {
  points: colorGradientPoints,
  onChange: (points) => {
    colorGradientPoints = points;
  },
});

const emitterPosXInput = document.getElementById("emitterPosX");
const emitterPosYInput = document.getElementById("emitterPosY");
const emitterPosZInput = document.getElementById("emitterPosZ");

colorModeSelect.value = particleColorMode;
function updateColorModeUI() {
  const isSolid = particleColorMode === "solid";
  gradientControl.style.display = isSolid ? "none" : "";
  solidColorControl.style.display = isSolid ? "" : "none";
}
updateColorModeUI();
colorModeSelect.addEventListener("change", () => {
  particleColorMode = colorModeSelect.value;
  updateColorModeUI();
});

solidColorInput.value = rgbToHex(solidColor);
solidColorVal.textContent = solidColorInput.value;
solidColorInput.addEventListener("input", () => {
  solidColor = hexToRgb(solidColorInput.value);
  solidColorVal.textContent = solidColorInput.value;
});

function attachSliderResets() {
  document.querySelectorAll(".control").forEach((control) => {
    const input = control.querySelector('input[type="range"]');
    if (!input || !input.dataset.default) return;
    if (control.querySelector(".reset-btn")) return;
    control.classList.add("range-control");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reset-btn";
    btn.textContent = "ø";
    btn.addEventListener("click", () => {
      input.value = input.dataset.default;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    control.appendChild(btn);
  });
}
attachSliderResets();

function setupRangeControls() {
  document.querySelectorAll(".control").forEach((control) => {
    const input = control.querySelector('input[type="range"]');
    if (!input) return;
    control.classList.add("range-control");
    control.classList.remove("expanded");
    const label = control.querySelector("label");
    if (!label || label.dataset.toggleBound) return;
    label.dataset.toggleBound = "true";
    const valueEl = label.querySelector(".editable-value");
    if (!label.querySelector(".label-left")) {
      const leftWrap = document.createElement("span");
      leftWrap.className = "label-left";
      const nodes = Array.from(label.childNodes);
      nodes.forEach((node) => {
        if (node === valueEl) return;
        leftWrap.appendChild(node);
      });
      label.insertBefore(leftWrap, valueEl || null);
    }
    if (!label.querySelector(".collapse-indicator")) {
      const indicator = document.createElement("span");
      indicator.className = "collapse-indicator";
      indicator.textContent = "▸";
      const leftWrap = label.querySelector(".label-left");
      if (leftWrap) {
        leftWrap.appendChild(indicator);
      } else {
        label.appendChild(indicator);
      }
    }
    label.addEventListener("click", (event) => {
      if (event.target.classList.contains("editable-value")) return;
      control.classList.toggle("expanded");
    });
  });
}
setupRangeControls();

function setupEditableNumber(element, options) {
  const { getValue, setValue, min, max, step, formatDisplay, formatEdit } = options;
  if (!element) return;
  const stepValue = Number.isFinite(step) ? step : 1;
  const minValue = Number.isFinite(min) ? min : -Infinity;
  const maxValue = Number.isFinite(max) ? max : Infinity;
  const displayFormatter = formatDisplay || ((value) => formatWithStep(value, stepValue));
  const editFormatter = formatEdit || ((value) => formatWithStep(value, stepValue));
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startValue = 0;

  function commitValue(rawValue) {
    let next = rawValue;
    if (Number.isFinite(minValue)) next = Math.max(minValue, next);
    if (Number.isFinite(maxValue)) next = Math.min(maxValue, next);
    next = roundToStep(next, stepValue, minValue);
    setValue(next);
  }

  function beginEdit() {
    const current = getValue();
    element.classList.add("editing");
    element.contentEditable = "true";
    element.focus();
    element.textContent = editFormatter(current);
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function finishEdit(commit) {
    element.contentEditable = "false";
    element.classList.remove("editing");
    const text = element.textContent.trim();
    if (commit) {
      const value = parseFloat(text);
      if (!Number.isNaN(value)) {
        commitValue(value);
      } else {
        element.textContent = displayFormatter(getValue());
      }
    } else {
      element.textContent = displayFormatter(getValue());
    }
  }

  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragging = true;
    moved = false;
    startX = event.clientX;
    startValue = getValue();
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    if (Math.abs(dx) > 2) moved = true;
    const sensitivity = stepValue * 0.25;
    commitValue(startValue + dx * sensitivity);
  });

  element.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    dragging = false;
    element.releasePointerCapture(event.pointerId);
    if (!moved) {
      beginEdit();
    }
  });

  element.addEventListener("pointercancel", (event) => {
    dragging = false;
    element.releasePointerCapture(event.pointerId);
  });

  element.addEventListener("blur", () => finishEdit(true));
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finishEdit(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finishEdit(false);
    }
  });
}

function setupRangeValueEditors() {
  document.querySelectorAll(".editable-value[data-input-id]").forEach((element) => {
    const input = document.getElementById(element.dataset.inputId);
    if (!input || element.dataset.editorBound) return;
    element.dataset.editorBound = "true";
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const step = parseFloat(input.step);
    setupEditableNumber(element, {
      getValue: () => parseFloat(input.value),
      setValue: (value) => {
        input.value = String(value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      },
      min,
      max,
      step,
      formatDisplay: (value) => formatWithStep(value, step),
      formatEdit: (value) => formatWithStep(value, step),
    });
  });
}
setupRangeValueEditors();

document.querySelectorAll(".panel-header").forEach((header) => {
  header.addEventListener("click", () => {
    const panel = header.closest(".panel");
    const toggle = header.querySelector(".panel-toggle");
    panel.classList.toggle("collapsed");
    toggle.textContent = panel.classList.contains("collapsed") ? "▸" : "▾";
    sizeCurveEditor.resize();
    opacityCurveEditor.resize();
    gradientEditor.resize();
  });
});

window.addEventListener("resize", () => {
  sizeCurveEditor.resize();
  opacityCurveEditor.resize();
  gradientEditor.resize();
  updateDirectionUI();
});

function getEmissionDirection() {
  const ax = (directionRotX * Math.PI) / 180;
  const ay = (directionRotY * Math.PI) / 180;
  const az = (directionRotZ * Math.PI) / 180;
  let dir = [0, 1, 0];
  dir = rotateX(dir, ax);
  dir = rotateY(dir, ay);
  dir = rotateZ(dir, az);
  return normalizeVec3(dir);
}

function growParticleBuffers(newCapacity) {
  particleCapacity = newCapacity;
  instanceBuffer.destroy();
  instanceBuffer = device.createBuffer({
    size: particleCapacity * instanceStride,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  instanceData = new Float32Array(particleCapacity * 17);
}

function spawnAt(x, y, count = 1, timeOffset = 0) {
  for (let i = 0; i < count; i += 1) {
    const spread = emitterSize;
    let offset = [0, 0, 0];
    const onEdge = emitFrom === "edge";
    if (emitterShape === "sphere") {
      offset = randomInSphere(spread, onEdge);
    } else if (emitterShape === "box") {
      offset = onEdge ? randomOnBox(spread) : [rand(-spread, spread), rand(-spread, spread), rand(-spread, spread)];
    } else if (emitterShape === "plane") {
      offset = onEdge ? randomOnPlane(spread) : randomInPlane(spread);
    } else if (emitterShape === "line") {
      const length = emitterSize;
      const along = rand(-length * 0.5, length * 0.5);
      const radius = emitterSize;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const jitter = [
        cameraUp[0] * Math.cos(theta) * r + cameraForward[0] * Math.sin(theta) * r,
        cameraUp[1] * Math.cos(theta) * r + cameraForward[1] * Math.sin(theta) * r,
        cameraUp[2] * Math.cos(theta) * r + cameraForward[2] * Math.sin(theta) * r,
      ];
      offset = [
        cameraRight[0] * along + jitter[0],
        cameraRight[1] * along + jitter[1],
        cameraRight[2] * along + jitter[2],
      ];
    }

    const pos = [
      x + emitterPos[0] + offset[0],
      y + emitterPos[1] + offset[1],
      emitterPos[2] + offset[2],
    ];
    const baseDir = getEmissionDirection();
    const dir = randomConeDirection(baseDir, coneAngle);
    const speed = Math.max(0, initialSpeed * (1 + rand(-speedRandom, speedRandom)));
    const vel = [dir[0] * speed, dir[1] * speed, dir[2] * speed];
    let axis;
    let spin;
    if (particleShape === "circle" || particleShape === "square") {
      axis = [0, 0, 1];
      spin = -spinRate2d * (1 + rand(-spinRandom, spinRandom));
    } else {
      const sx = spinRateX * (1 + rand(-spinRandom, spinRandom));
      const sy = spinRateY * (1 + rand(-spinRandom, spinRandom));
      const sz = spinRateZ * (1 + rand(-spinRandom, spinRandom));
      const ax = Math.abs(sx);
      const ay = Math.abs(sy);
      const az = Math.abs(sz);
      if (ax >= ay && ax >= az) {
        axis = [1, 0, 0];
        spin = sx;
      } else if (ay >= az) {
        axis = [0, 1, 0];
        spin = sy;
      } else {
        axis = [0, 0, 1];
        spin = sz;
      }
    }
    const life = lifeSeconds * (1 + rand(-lifeRandom, lifeRandom));
    const seed =
      (particleShape === "circle" || particleShape === "square") && Math.abs(spinRate2d) < 1e-4
        ? 0
        : Math.random() * Math.PI * 2;
    let particleColor = null;
    if (particleColorMode === "random") {
      particleColor = evalGradient(colorGradientPoints, Math.random());
    } else if (particleColorMode === "solid") {
      particleColor = solidColor.slice();
    }
    const age = Math.max(0, timeOffset);
    const posOffset = age > 0 ? [vel[0] * age, vel[1] * age, vel[2] * age] : [0, 0, 0];
    particles.push({
      pos,
      vel,
      age,
      life: Math.max(0.1, life),
      size: 1.0,
      seed,
      axis,
      spin,
      color: particleColor,
    });
    if (age > 0) {
      const p = particles[particles.length - 1];
      p.pos[0] += posOffset[0];
      p.pos[1] += posOffset[1];
      p.pos[2] += posOffset[2];
    }
  }
}

function screenToWorldHit(event) {
  const rect = canvas.getBoundingClientRect();
  const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  const near = unproject(nx, ny, 0, invViewProj);
  const far = unproject(nx, ny, 1, invViewProj);
  const dir = [far[0] - near[0], far[1] - near[1], far[2] - near[2]];
  if (Math.abs(dir[2]) < 1e-5) {
    return [0, 0];
  }
  const t = -near[2] / dir[2];
  if (!Number.isFinite(t)) {
    return [0, 0];
  }
  return [near[0] + dir[0] * t, near[1] + dir[1] * t];
}

let isSpawning = false;
let spawnAccum = 0;
let lastHit = [0, 0];
let gizmoDragging = false;
let gizmoDragAxis = null;
let gizmoDragDir = [0, 0];
let gizmoLastPointer = [0, 0];

window.addEventListener("pointerdown", (event) => {
  if (emitterGizmoEnabled && startGizmoDrag(event)) return;
  if (emitMode === "auto") return;
  lastHit = screenToWorldHit(event);
  spawnAt(lastHit[0], lastHit[1]);
  isSpawning = true;
});
window.addEventListener("pointermove", (event) => {
  if (gizmoDragging) {
    updateGizmoDrag(event);
    return;
  }
  if (!isSpawning) return;
  lastHit = screenToWorldHit(event);
});
window.addEventListener("pointerup", () => {
  isSpawning = false;
  if (gizmoDragging) {
    gizmoDragging = false;
    gizmoDragAxis = null;
  }
});
window.addEventListener("pointerleave", () => {
  isSpawning = false;
  if (gizmoDragging) {
    gizmoDragging = false;
    gizmoDragAxis = null;
  }
});

let lastTime = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      particles.splice(i, 1);
      continue;
    }
    if (forcesEnabled) {
      const t = now * 0.0003 + p.seed;
      if (forceMode === "turbulence") {
        const nx = noise3(
          p.pos[0] * turbulenceScale + t,
          p.pos[1] * turbulenceScale,
          p.pos[2] * turbulenceScale,
        );
        const ny = noise3(
          p.pos[0] * turbulenceScale,
          p.pos[1] * turbulenceScale - t,
          p.pos[2] * turbulenceScale,
        );
        const nz = noise3(
          p.pos[0] * turbulenceScale,
          p.pos[1] * turbulenceScale,
          p.pos[2] * turbulenceScale + t,
        );
        p.vel[0] += (nx * 2 - 1) * turbulenceStrength * dt;
        p.vel[1] += (ny * 2 - 1) * turbulenceStrength * dt;
        p.vel[2] += (nz * 2 - 1) * turbulenceStrength * dt;
      } else if (forceMode === "curl") {
        const c = curlNoise(p.pos[0] * curlScale + t, p.pos[1] * curlScale, p.pos[2] * curlScale - t);
        p.vel[0] += c[0] * curlStrength * dt;
        p.vel[1] += c[1] * curlStrength * dt;
        p.vel[2] += c[2] * curlStrength * dt;
      }
      if (vortexEnabled) {
        const dx = p.pos[0];
        const dz = p.pos[2];
        const dist = Math.hypot(dx, dz);
        if (dist < vortexRadius) {
          const falloff = 1 - dist / vortexRadius;
          const tangent = normalizeVec3([-dz, 0, dx]);
          p.vel[0] += tangent[0] * vortexStrength * falloff * dt;
          p.vel[1] += tangent[1] * vortexStrength * falloff * dt;
          p.vel[2] += tangent[2] * vortexStrength * falloff * dt;
        }
      }
      if (attractorEnabled && attractorStrength > 0 && attractorRadius > 0) {
        const dx = -p.pos[0];
        const dy = -p.pos[1];
        const dz = -p.pos[2];
        const dist = Math.hypot(dx, dy, dz) || 1;
        if (dist < attractorRadius) {
          const force = (1 - dist / attractorRadius) * attractorStrength;
          p.vel[0] += (dx / dist) * force * dt;
          p.vel[1] += (dy / dist) * force * dt;
          p.vel[2] += (dz / dist) * force * dt;
        }
      }
      p.vel[1] += gravity * dt;
      p.vel[0] += wind[0] * dt;
      p.vel[1] += wind[1] * dt;
      p.vel[2] += wind[2] * dt;
      if (drag > 0) {
        const damp = Math.max(0, 1 - drag * dt);
        p.vel[0] *= damp;
        p.vel[1] *= damp;
        p.vel[2] *= damp;
      }
    }

    p.pos[0] += p.vel[0] * dt;
    p.pos[1] += p.vel[1] * dt;
    p.pos[2] += p.vel[2] * dt;

    if (forcesEnabled && groundEnabled && emitterPos[1] >= groundLevel && p.pos[1] < groundLevel) {
      p.pos[1] = groundLevel;
      if (p.vel[1] < 0) {
        p.vel[1] = -p.vel[1] * bounce;
        p.vel[0] *= 1 - bounce * 0.2;
        p.vel[2] *= 1 - bounce * 0.2;
      }
    }

  }

  if (emitMode === "auto") {
    const lambda = emissionRate * dt;
    spawnAccum += lambda;
    const spawnNow = Math.floor(spawnAccum);
    if (spawnNow > 0) {
      spawnAccum -= spawnNow;
      for (let i = 0; i < spawnNow; i += 1) {
        const offset = ((i + 0.5) / spawnNow) * dt;
        spawnAt(0, 0, 1, offset);
      }
    }
  } else if (isSpawning) {
    const lambda = emissionRate * dt;
    spawnAccum += lambda;
    const spawnNow = Math.floor(spawnAccum);
    if (spawnNow > 0) {
      spawnAccum -= spawnNow;
      for (let i = 0; i < spawnNow; i += 1) {
        const offset = ((i + 0.5) / spawnNow) * dt;
        spawnAt(lastHit[0], lastHit[1], 1, offset);
      }
    }
  }

  const drawCount = particles.length;
  
  // Grow buffers if needed (double capacity each time)
  if (drawCount > particleCapacity) {
    growParticleBuffers(Math.max(drawCount, particleCapacity * 2));
  }
  
  if (drawCount > 0) {
    for (let i = 0; i < drawCount; i += 1) {
      const p = particles[i];
      const lifeT = p.age / p.life;
      const sizePixels = particleSize * 5;
      const baseUnitsPerPixel = worldUnitsPerPixelAt(target);
      const size = evalCurve(sizeCurvePoints, lifeT) * sizePixels * baseUnitsPerPixel;
      const opacity = evalCurve(opacityCurvePoints, lifeT);
      let color;
      if (particleColorMode === "solid") {
        color = solidColor;
      } else if (particleColorMode === "random") {
        color = p.color || solidColor;
      } else {
        color = evalGradient(colorGradientPoints, lifeT);
      }
      const base = i * 17;
      instanceData[base + 0] = p.pos[0];
      instanceData[base + 1] = p.pos[1];
      instanceData[base + 2] = p.pos[2];
      instanceData[base + 3] = size;
      instanceData[base + 4] = lifeT;
      instanceData[base + 5] = p.seed;
      instanceData[base + 6] = p.axis[0];
      instanceData[base + 7] = p.axis[1];
      instanceData[base + 8] = p.axis[2];
      instanceData[base + 9] = p.spin;
      instanceData[base + 10] = p.vel[0];
      instanceData[base + 11] = p.vel[1];
      instanceData[base + 12] = p.vel[2];
      instanceData[base + 13] = opacity;
      instanceData[base + 14] = color[0];
      instanceData[base + 15] = color[1];
      instanceData[base + 16] = color[2];
    }
    device.queue.writeBuffer(instanceBuffer, 0, instanceData.buffer, 0, drawCount * instanceStride);
  }

  updateCamera(now * 0.001);
  drawEmitterGizmo();
  const baseFocus = Math.hypot(eye[0], eye[1], eye[2]);
  const focusDistance = Math.max(0.1, baseFocus - focusOffset);
  if (dofEnabled) {
    dofData[0] = canvas.width;
    dofData[1] = canvas.height;
    dofData[2] = focusDistance;
    dofData[3] = focusRange;
    dofData[4] = aperture;
    dofData[5] = 0.1;
    dofData[6] = 50.0;
    dofData[7] = dofMode;
    dofData[8] = focusOverlay;
    dofData[9] = bloomStrength;
    dofData[10] = bloomThreshold;
    dofData[11] = exposure;
    dofData[12] = 0;
    dofData[13] = 0;
    dofData[14] = 0;
    dofData[15] = 0;
    device.queue.writeBuffer(dofUniformBuffer, 0, dofData);
  }

  const encoder = device.createCommandEncoder();
  const particleTargetView = dofEnabled
    ? colorTexture.createView()
    : context.getCurrentTexture().createView();
  const particlePass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: particleTargetView,
        clearValue: { r: 0.04, g: 0.06, b: 0.08, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthClearValue: 1,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  });
  const activePipeline = particlePipelines[blendMode] || particlePipelines.alpha;
  particlePass.setPipeline(activePipeline);
  particlePass.setBindGroup(0, bindGroup);
  particlePass.setVertexBuffer(0, currentMesh.buffer);
  particlePass.setVertexBuffer(1, instanceBuffer);
  if (drawCount > 0) {
    particlePass.draw(currentMesh.count, drawCount);
  }
  particlePass.end();

  if (dofEnabled) {
    const dofPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    dofPass.setPipeline(dofPipeline);
    dofPass.setBindGroup(0, dofBindGroup);
    dofPass.setVertexBuffer(0, quadBuffer);
    dofPass.draw(6);
    dofPass.end();
  }
  device.queue.submit([encoder.finish()]);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
