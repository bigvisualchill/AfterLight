// GPU Particle Simulation Compute Shader
// Handles particle emission and physics simulation entirely on GPU

// ============================================================================
// Data Structures
// ============================================================================

struct Particle {
  pos: vec3<f32>,       // 0-2: position
  age: f32,             // 3: current age
  vel: vec3<f32>,       // 4-6: velocity
  life: f32,            // 7: max lifetime
  seed: f32,            // 8: random seed for rotation
  spin: f32,            // 9: spin rate
  size: f32,            // 10: size multiplier
  flags: u32,           // 11: alive flag and other bits
  axis: vec3<f32>,      // 12-14: rotation axis
  _pad1: f32,           // 15: padding
  color: vec3<f32>,     // 16-18: particle color (RGB)
  _pad2: f32,           // 19: padding
};

struct SimUniforms {
  dt: f32,
  time: f32,
  gravity: f32,
  drag: f32,
  
  wind: vec3<f32>,
  noiseEnabled: u32,
  
  noiseMode: u32,       // 0 = turbulence, 1 = curl
  turbulenceStrength: f32,
  turbulenceScale: f32,
  curlStrength: f32,
  
  curlScale: f32,
  vortexEnabled: u32,
  vortexStrength: f32,
  vortexRadius: f32,
  
  vortexPos: vec3<f32>,
  attractorEnabled: u32,
  
  vortexAxis: vec3<f32>,
  attractorStrength: f32,
  
  attractorPos: vec3<f32>,
  attractorRadius: f32,
  
  groundEnabled: u32,
  groundLevel: f32,
  bounce: f32,
  emitterPosY: f32,
};

struct EmitUniforms {
  emitterPos: vec3<f32>,
  spawnCount: u32,
  
  emitterPrevPos: vec3<f32>,
  emitterSize: f32,
  
  emitterShape: u32,    // 0=point, 1=sphere, 2=box, 3=plane, 4=line
  emitFrom: u32,        // 0=volume, 1=surface
  direction: u32,       // 0=directional, 1=spherical, 2=outward
  coneAngle: f32,
  
  baseDir: vec3<f32>,
  initialSpeed: f32,
  
  speedRandom: f32,
  life: f32,
  lifeRandom: f32,
  sizeBase: f32,
  
  sizeRandom: f32,
  spinBase: f32,
  spinRandom: f32,
  colorMode: u32,       // 0=solid, 1=random, 2=gradient
  
  solidColor: vec3<f32>,
  frameIndex: u32,
  
  emitterVelocity: vec3<f32>,
  emitterVelocityAmount: f32,
};

struct AtomicCounter {
  count: atomic<u32>,
};

struct IndirectArgs {
  indexCount: u32,
  instanceCount: atomic<u32>,
  firstIndex: u32,
  baseVertex: u32,
  firstInstance: u32,
};

// ============================================================================
// Bindings
// ============================================================================

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> simUniforms: SimUniforms;
@group(0) @binding(2) var<storage, read_write> aliveCounter: AtomicCounter;
@group(0) @binding(3) var<storage, read_write> indirectArgs: IndirectArgs;

@group(1) @binding(0) var<uniform> emitUniforms: EmitUniforms;
@group(1) @binding(1) var<storage, read_write> freeList: array<u32>;
@group(1) @binding(2) var<storage, read_write> freeListCounter: AtomicCounter;

// ============================================================================
// Noise Functions (ported from math.js)
// ============================================================================

fn hash3(x: f32, y: f32, z: f32) -> f32 {
  let s = sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return fract(s);
}

fn noise3(x: f32, y: f32, z: f32) -> f32 {
  let ix = floor(x);
  let iy = floor(y);
  let iz = floor(z);
  let fx = x - ix;
  let fy = y - iy;
  let fz = z - iz;

  let u = fx * fx * (3.0 - 2.0 * fx);
  let v = fy * fy * (3.0 - 2.0 * fy);
  let w = fz * fz * (3.0 - 2.0 * fz);

  let n000 = hash3(ix, iy, iz);
  let n100 = hash3(ix + 1.0, iy, iz);
  let n010 = hash3(ix, iy + 1.0, iz);
  let n110 = hash3(ix + 1.0, iy + 1.0, iz);
  let n001 = hash3(ix, iy, iz + 1.0);
  let n101 = hash3(ix + 1.0, iy, iz + 1.0);
  let n011 = hash3(ix, iy + 1.0, iz + 1.0);
  let n111 = hash3(ix + 1.0, iy + 1.0, iz + 1.0);

  let nx00 = mix(n000, n100, u);
  let nx10 = mix(n010, n110, u);
  let nx01 = mix(n001, n101, u);
  let nx11 = mix(n011, n111, u);

  let nxy0 = mix(nx00, nx10, v);
  let nxy1 = mix(nx01, nx11, v);

  return mix(nxy0, nxy1, w);
}

fn noiseVec3(x: f32, y: f32, z: f32) -> vec3<f32> {
  return vec3<f32>(
    noise3(x, y, z),
    noise3(x + 31.7, y + 11.3, z + 47.2),
    noise3(x + 59.2, y + 27.1, z + 13.9)
  );
}

fn curlNoise(x: f32, y: f32, z: f32) -> vec3<f32> {
  let e = 0.1;
  let n1 = noiseVec3(x, y + e, z);
  let n2 = noiseVec3(x, y - e, z);
  let n3 = noiseVec3(x, y, z + e);
  let n4 = noiseVec3(x, y, z - e);
  let n5 = noiseVec3(x + e, y, z);
  let n6 = noiseVec3(x - e, y, z);

  let dFzDy = (n1.z - n2.z) / (2.0 * e);
  let dFyDz = (n3.y - n4.y) / (2.0 * e);
  let dFxDz = (n3.x - n4.x) / (2.0 * e);
  let dFzDx = (n5.z - n6.z) / (2.0 * e);
  let dFyDx = (n5.y - n6.y) / (2.0 * e);
  let dFxDy = (n1.x - n2.x) / (2.0 * e);

  return normalize(vec3<f32>(
    dFzDy - dFyDz,
    dFxDz - dFzDx,
    dFyDx - dFxDy
  ));
}

// ============================================================================
// Random Number Generation (PCG-based)
// ============================================================================

fn pcg(seed: u32) -> u32 {
  let state = seed * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn randomFloat(seed: ptr<function, u32>) -> f32 {
  *seed = pcg(*seed);
  return f32(*seed) / 4294967295.0;
}

fn randomRange(seed: ptr<function, u32>, minVal: f32, maxVal: f32) -> f32 {
  return minVal + randomFloat(seed) * (maxVal - minVal);
}

fn randomSphereDirection(seed: ptr<function, u32>) -> vec3<f32> {
  let theta = randomFloat(seed) * 6.28318530718;
  let phi = acos(2.0 * randomFloat(seed) - 1.0);
  return vec3<f32>(
    sin(phi) * cos(theta),
    sin(phi) * sin(theta),
    cos(phi)
  );
}

fn randomInSphere(seed: ptr<function, u32>, radius: f32, onSurface: bool) -> vec3<f32> {
  var dir = randomSphereDirection(seed);
  let scale = select(radius * pow(randomFloat(seed), 0.333333), radius, onSurface);
  return dir * scale;
}

fn randomConeDirection(seed: ptr<function, u32>, dir: vec3<f32>, angleDeg: f32) -> vec3<f32> {
  let angle = angleDeg * 0.01745329252;
  if (angle <= 0.001) {
    return dir;
  }
  let cosMax = cos(angle);
  let cosTheta = cosMax + randomFloat(seed) * (1.0 - cosMax);
  let sinTheta = sqrt(1.0 - cosTheta * cosTheta);
  let phi = randomFloat(seed) * 6.28318530718;

  var up = select(vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 0.0), abs(dir.y) <= 0.9);
  let u = normalize(cross(up, dir));
  let v = cross(dir, u);

  return normalize(
    u * cos(phi) * sinTheta + 
    v * sin(phi) * sinTheta + 
    dir * cosTheta
  );
}

// ============================================================================
// Emit Compute Shader
// ============================================================================

@compute @workgroup_size(64)
fn emit(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= emitUniforms.spawnCount) {
    return;
  }

  // Atomically try to claim a free slot
  // Race condition safety: if count underflows (wraps to max u32) or is 0, restore and bail
  let freeIdx = atomicSub(&freeListCounter.count, 1u);
  let maxParticles = arrayLength(&particles);
  if (freeIdx == 0u || freeIdx > maxParticles) {
    // Either no slots available (freeIdx == 0) or counter underflowed (freeIdx > maxParticles)
    atomicAdd(&freeListCounter.count, 1u);
    return;
  }
  let particleIdx = freeList[freeIdx - 1u];

  var seed = particleIdx * 1973u + emitUniforms.frameIndex * 9277u + idx * 26699u;

  let t = f32(idx) / max(1.0, f32(emitUniforms.spawnCount));
  let emitPos = mix(emitUniforms.emitterPrevPos, emitUniforms.emitterPos, t);

  var offset = vec3<f32>(0.0);
  let onSurface = emitUniforms.emitFrom == 1u;
  let size = emitUniforms.emitterSize;

  switch (emitUniforms.emitterShape) {
    case 1u: { offset = randomInSphere(&seed, size, onSurface); }
    case 2u: {
      if (onSurface) {
        let face = u32(randomFloat(&seed) * 6.0);
        let u = randomRange(&seed, -size, size);
        let v = randomRange(&seed, -size, size);
        switch (face) {
          case 0u: { offset = vec3<f32>(size, u, v); }
          case 1u: { offset = vec3<f32>(-size, u, v); }
          case 2u: { offset = vec3<f32>(u, size, v); }
          case 3u: { offset = vec3<f32>(u, -size, v); }
          case 4u: { offset = vec3<f32>(u, v, size); }
          default: { offset = vec3<f32>(u, v, -size); }
        }
      } else {
        offset = vec3<f32>(
          randomRange(&seed, -size, size),
          randomRange(&seed, -size, size),
          randomRange(&seed, -size, size)
        );
      }
    }
    case 3u: { offset = vec3<f32>(randomRange(&seed, -size, size), randomRange(&seed, -size, size), 0.0); }
    case 4u: { offset = vec3<f32>(randomRange(&seed, -size, size), 0.0, 0.0); }
    default: { offset = vec3<f32>(0.0); }
  }

  let pos = emitPos + offset;

  var velDir: vec3<f32>;
  if (emitUniforms.direction == 1u) {
    velDir = randomSphereDirection(&seed);
  } else if (emitUniforms.direction == 2u) {
    let len = length(offset);
    velDir = select(randomSphereDirection(&seed), offset / len, len > 0.000001);
  } else {
    velDir = randomConeDirection(&seed, emitUniforms.baseDir, emitUniforms.coneAngle);
  }

  let speedMult = 1.0 + (randomFloat(&seed) - 0.5) * 2.0 * emitUniforms.speedRandom;
  let speed = emitUniforms.initialSpeed * speedMult;
  var vel = velDir * speed;
  vel += emitUniforms.emitterVelocity * emitUniforms.emitterVelocityAmount;

  // Add small base randomness (±5%) to prevent synchronized death waves, plus user-controlled randomness
  let baseRandom = (randomFloat(&seed) - 0.5) * 0.1; // ±5% inherent variation
  let userRandom = (randomFloat(&seed) - 0.5) * 2.0 * emitUniforms.lifeRandom;
  let lifeMult = 1.0 + baseRandom + userRandom;
  let life = emitUniforms.life * max(0.1, lifeMult);

  let sizeMult = 1.0 + (randomFloat(&seed) - 0.5) * 2.0 * emitUniforms.sizeRandom;
  let particleSize = emitUniforms.sizeBase * sizeMult;

  let axis = normalize(vec3<f32>(randomFloat(&seed) - 0.5, randomFloat(&seed) - 0.5, randomFloat(&seed) - 0.5));
  let spinRate = emitUniforms.spinBase * (1.0 + (randomFloat(&seed) - 0.5) * emitUniforms.spinRandom * 2.0);

  var color = emitUniforms.solidColor;
  if (emitUniforms.colorMode == 1u) {
    color = vec3<f32>(randomFloat(&seed), randomFloat(&seed), randomFloat(&seed));
  }

  var p: Particle;
  p.pos = pos;
  p.vel = vel;
  p.age = 0.0;
  p.life = life;
  p.seed = randomFloat(&seed) * 6.28318530718;
  p.axis = axis;
  p.spin = spinRate;
  p.size = particleSize;
  p.color = color;
  p.flags = 1u;
  p._pad1 = 0.0;
  p._pad2 = 0.0;

  particles[particleIdx] = p;
  atomicAdd(&aliveCounter.count, 1u);
}

// ============================================================================
// Simulate Compute Shader
// ============================================================================

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= arrayLength(&particles)) {
    return;
  }

  var p = particles[idx];
  if (p.flags == 0u) {
    return;
  }

  let dt = simUniforms.dt;
  p.age += dt;

  if (p.age >= p.life) {
    p.flags = 0u;
    particles[idx] = p;
    // Return this slot to the free list (with bounds check for safety)
    let freeIdx = atomicAdd(&freeListCounter.count, 1u);
    let maxParticles = arrayLength(&particles);
    if (freeIdx < maxParticles) {
      freeList[freeIdx] = idx;
    }
    atomicSub(&aliveCounter.count, 1u);
    return;
  }

  let t = simUniforms.time * 0.0003 + p.seed;

  if (simUniforms.noiseEnabled != 0u) {
    if (simUniforms.noiseMode == 0u) {
      let scale = simUniforms.turbulenceScale;
      let nx = noise3(p.pos.x * scale + t, p.pos.y * scale, p.pos.z * scale);
      let ny = noise3(p.pos.x * scale, p.pos.y * scale - t, p.pos.z * scale);
      let nz = noise3(p.pos.x * scale, p.pos.y * scale, p.pos.z * scale + t);
      p.vel += (vec3<f32>(nx, ny, nz) * 2.0 - 1.0) * simUniforms.turbulenceStrength * dt;
    } else {
      let scale = simUniforms.curlScale;
      let c = curlNoise(p.pos.x * scale + t, p.pos.y * scale, p.pos.z * scale - t);
      p.vel += c * simUniforms.curlStrength * dt;
    }
  }

  if (simUniforms.vortexEnabled != 0u) {
    let axis = simUniforms.vortexAxis;
    let rel = p.pos - simUniforms.vortexPos;
    let proj = dot(rel, axis);
    let radial = rel - axis * proj;
    let dist = length(radial);
    if (dist < simUniforms.vortexRadius && dist > 0.0001) {
      let falloff = 1.0 - dist / simUniforms.vortexRadius;
      let tangent = normalize(cross(axis, radial));
      p.vel += tangent * simUniforms.vortexStrength * falloff * dt;
    }
  }

  if (simUniforms.attractorEnabled != 0u && simUniforms.attractorStrength > 0.0 && simUniforms.attractorRadius > 0.0) {
    let delta = simUniforms.attractorPos - p.pos;
    let dist = max(length(delta), 1.0);
    if (dist < simUniforms.attractorRadius) {
      let force = (1.0 - dist / simUniforms.attractorRadius) * simUniforms.attractorStrength;
      p.vel += normalize(delta) * force * dt;
    }
  }

  p.vel.y += simUniforms.gravity * dt;
  p.vel += simUniforms.wind * dt;

  if (simUniforms.drag > 0.0) {
    let damp = max(0.0, 1.0 - simUniforms.drag * dt);
    p.vel *= damp;
  }

  p.pos += p.vel * dt;

  if (simUniforms.groundEnabled != 0u && simUniforms.emitterPosY >= simUniforms.groundLevel && p.pos.y < simUniforms.groundLevel) {
    p.pos.y = simUniforms.groundLevel;
    if (p.vel.y < 0.0) {
      p.vel.y = -p.vel.y * simUniforms.bounce;
      p.vel.x *= 1.0 - simUniforms.bounce * 0.2;
      p.vel.z *= 1.0 - simUniforms.bounce * 0.2;
    }
  }

  particles[idx] = p;
}

@compute @workgroup_size(1)
fn buildIndirect(@builtin(global_invocation_id) id: vec3<u32>) {
  let alive = atomicLoad(&aliveCounter.count);
  atomicStore(&indirectArgs.instanceCount, alive);
}

@compute @workgroup_size(1)
fn resetCounters(@builtin(global_invocation_id) id: vec3<u32>) {
  atomicStore(&indirectArgs.instanceCount, 0u);
}

@compute @workgroup_size(64)
fn initFreeList(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let maxParticles = arrayLength(&particles);
  if (idx >= maxParticles) {
    return;
  }
  freeList[idx] = idx;
  particles[idx].flags = 0u;
  if (idx == 0u) {
    atomicStore(&freeListCounter.count, maxParticles);
    atomicStore(&aliveCounter.count, 0u);
  }
}
