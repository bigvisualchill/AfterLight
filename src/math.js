// Math utilities for particle system
// Vector math, matrix operations, noise functions, curve evaluation

// ============================================================================
// Basic Utilities
// ============================================================================

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function roundToStep(value, step, min) {
  if (!Number.isFinite(step) || step <= 0) return value;
  const base = Number.isFinite(min) ? min : 0;
  return Math.round((value - base) / step) * step + base;
}

export function formatWithStep(value, step) {
  if (!Number.isFinite(step) || step <= 0) return String(value);
  const precision = step.toString().split(".")[1]?.length ?? 0;
  return value.toFixed(Math.min(6, precision));
}

// ============================================================================
// Vector Operations
// ============================================================================

export function normalizeVec3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function rotateX(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

export function rotateY(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

export function rotateZ(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

export function applyRotation(point, rotX, rotY, rotZ) {
  let p = rotateX(point, rotX);
  p = rotateY(p, rotY);
  p = rotateZ(p, rotZ);
  return p;
}

// ============================================================================
// Quaternion Operations
// ============================================================================

export function quatFromAxisAngle(axis, angle) {
  const half = angle * 0.5;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

export function quatMul(a, b) {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quatNormalize(q) {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

// ============================================================================
// Matrix Operations (Column-major, WebGPU compatible)
// ============================================================================

export function mat4Perspective(out, fovy, aspect, near, far) {
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

export function mat4LookAt(out, eye, target, up) {
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

export function mat4Multiply(out, a, b) {
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

export function mat4Invert(out, m) {
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

export function unproject(ndcX, ndcY, ndcZ, invViewProj) {
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

// ============================================================================
// Noise Functions
// ============================================================================

export function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

export function noise3(x, y, z) {
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

export function turbulence(x, y, z, octaves = 3) {
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

export function noiseVec3(x, y, z) {
  return [
    noise3(x, y, z),
    noise3(x + 31.7, y + 11.3, z + 47.2),
    noise3(x + 59.2, y + 27.1, z + 13.9),
  ];
}

export function curlNoise(x, y, z) {
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

// ============================================================================
// Curve and Gradient Evaluation
// ============================================================================

export function bezierValue(p0, p1, p2, p3, t) {
  const inv = 1 - t;
  return (
    inv * inv * inv * p0 +
    3 * inv * inv * t * p1 +
    3 * inv * t * t * p2 +
    t * t * t * p3
  );
}

export function evalCurve(points, x) {
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

export function evalGradient(points, x) {
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

// ============================================================================
// Random Distribution Helpers
// ============================================================================

export function randomInSphere(radius, onSurface) {
  let v = [rand(-1, 1), rand(-1, 1), rand(-1, 1)];
  let len = Math.hypot(v[0], v[1], v[2]) || 1;
  v = [v[0] / len, v[1] / len, v[2] / len];
  const scale = onSurface ? radius : radius * Math.cbrt(Math.random());
  return [v[0] * scale, v[1] * scale, v[2] * scale];
}

export function randomSphereDirection() {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return [
    Math.sin(phi) * Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi)
  ];
}

export function randomOnBox(half) {
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

export function randomOnPlane(half) {
  const edge = Math.floor(Math.random() * 4);
  const t = rand(-half, half);
  switch (edge) {
    case 0: return [half, t, 0];
    case 1: return [-half, t, 0];
    case 2: return [t, half, 0];
    default: return [t, -half, 0];
  }
}

export function randomInPlane(half) {
  return [rand(-half, half), rand(-half, half), 0];
}

export function randomInLine(length, onEnd) {
  if (onEnd) {
    return [Math.random() > 0.5 ? length * 0.5 : -length * 0.5, 0, 0];
  }
  return [rand(-length * 0.5, length * 0.5), 0, 0];
}

export function randomConeDirection(dir, angleDeg) {
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

// ============================================================================
// Color Utilities
// ============================================================================

export function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return [r, g, b];
}

export function rgbToHex(rgb) {
  return (
    "#" +
    rgb
      .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}
