// Particle system: spawning, physics simulation, and data management

import { 
  rand, 
  normalizeVec3, 
  clamp,
  noise3, 
  curlNoise,
  quatFromAxisAngle,
  quatMul,
  quatNormalize,
  randomInSphere,
  randomSphereDirection,
  randomOnBox,
  randomOnPlane,
  randomInPlane,
  randomInLine,
  randomConeDirection,
  rotateX,
  rotateY,
  rotateZ,
  evalCurve,
  evalGradient,
  lerp
} from './math.js';

import { state, particles, spawnAccum, setSpawnAccum } from './state.js';

// ============================================================================
// Emitter Helpers
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
  let dir = [0, 1, 0]; // Default up
  dir = applyEmitterRotation(dir);
  return normalizeVec3(dir);
}

// ============================================================================
// Particle Spawning
// ============================================================================

/**
 * Spawn particles at a given position
 * @param {number} mx - Mouse X (unused in continuous emission)
 * @param {number} my - Mouse Y (unused in continuous emission)
 * @param {number} count - Number of particles to spawn
 * @param {number} lerpFactor - Interpolation factor for position (0-1)
 * @param {number} dt - Delta time
 */
export function spawnAt(mx, my, count = 1, lerpFactor = 0, dt = 0) {
  const capacity = state.particle.capacity;
  if (particles.length >= capacity) return;

  for (let i = 0; i < count; i++) {
    if (particles.length >= capacity) break;
    const t = count > 1 ? (i + 0.5) / count : lerpFactor;
    // Interpolate emitter position for smooth trails
    const emitPos = [
      lerp(state.emitter.frameStartPos[0], state.emitter.pos[0], t),
      lerp(state.emitter.frameStartPos[1], state.emitter.pos[1], t),
      lerp(state.emitter.frameStartPos[2], state.emitter.pos[2], t),
    ];

    // Get spawn offset based on emitter shape
    let offset = [0, 0, 0];
    const onSurface = state.emitter.emitFrom === "surface";
    const size = state.emitter.size;

    switch (state.emitter.shape) {
      case "sphere":
        offset = randomInSphere(size, onSurface);
        break;
      case "box":
        offset = onSurface ? randomOnBox(size) : [
          rand(-size, size),
          rand(-size, size),
          rand(-size, size)
        ];
        break;
      case "plane":
        offset = onSurface ? randomOnPlane(size) : randomInPlane(size);
        break;
      case "line":
        offset = randomInLine(size * 2, onSurface);
        break;
      default: // point
        offset = [0, 0, 0];
    }

    // Apply emitter rotation to offset
    offset = applyEmitterRotation(offset);

    const pos = [
      emitPos[0] + offset[0],
      emitPos[1] + offset[1],
      emitPos[2] + offset[2],
    ];

    // Determine velocity direction
    let velDir;
    if (state.emitter.direction === "spherical") {
      velDir = randomSphereDirection();
    } else if (state.emitter.direction === "outward") {
      const len = Math.hypot(offset[0], offset[1], offset[2]);
      velDir = len > 1e-6 ? [offset[0] / len, offset[1] / len, offset[2] / len] : randomSphereDirection();
    } else {
      // Directional emission with cone
      const baseDir = getEmissionDirection();
      velDir = randomConeDirection(baseDir, state.emitter.coneAngle);
    }

    // Calculate speed with randomness
    const speedMult = 1 + (Math.random() - 0.5) * 2 * state.emitter.speedRandom;
    const speed = state.particle.initialSpeed * speedMult;

    const vel = [
      velDir[0] * speed,
      velDir[1] * speed,
      velDir[2] * speed,
    ];

    // Add emitter velocity if affected
    if (state.animation.emitterVelocityAffected) {
      const amount = state.animation.emitterVelocityAmount;
      vel[0] += state.emitter.velocity[0] * amount;
      vel[1] += state.emitter.velocity[1] * amount;
      vel[2] += state.emitter.velocity[2] * amount;
    }

    // Calculate life with randomness
    const lifeMult = 1 + (Math.random() - 0.5) * 2 * state.particle.lifeRandom;
    const life = state.particle.lifeSeconds * Math.max(0.1, lifeMult);

    // Calculate size with randomness
    const sizeMult = 1 + (Math.random() - 0.5) * 2 * state.particle.sizeRandom;

    // Random spin axis and rate
    const axis = normalizeVec3([
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    ]);
    const spinBase = (state.particle.spinRateX + state.particle.spinRateY + state.particle.spinRateZ) / 3;
    const spinRate = spinBase * (1 + (Math.random() - 0.5) * state.particle.spinRandom * 2);

    // Random color for random color mode
    let color = null;
    if (state.particle.colorMode === "random") {
      color = [Math.random(), Math.random(), Math.random()];
    }

    particles.push({
      pos,
      vel,
      age: 0,
      life,
      seed: Math.random() * Math.PI * 2,
      axis,
      spin: spinRate,
      size: sizeMult,
      color,
      sortDepth: 0,
    });
  }
}

// ============================================================================
// Particle Physics Update
// ============================================================================

/**
 * Update all particles for one frame
 * @param {number} dt - Delta time in seconds
 * @param {number} now - Current timestamp in milliseconds
 */
export function updateParticles(dt, now) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.age += dt;
    
    if (p.age >= p.life) {
      particles.splice(i, 1);
      continue;
    }

    {
      const t = now * 0.0003 + p.seed;
      
      // Turbulence or curl noise (optional)
      if (state.forces.noiseEnabled) {
        if (state.forces.mode === "turbulence") {
          const nx = noise3(
            p.pos[0] * state.forces.turbulenceScale + t,
            p.pos[1] * state.forces.turbulenceScale,
            p.pos[2] * state.forces.turbulenceScale,
          );
          const ny = noise3(
            p.pos[0] * state.forces.turbulenceScale,
            p.pos[1] * state.forces.turbulenceScale - t,
            p.pos[2] * state.forces.turbulenceScale,
          );
          const nz = noise3(
            p.pos[0] * state.forces.turbulenceScale,
            p.pos[1] * state.forces.turbulenceScale,
            p.pos[2] * state.forces.turbulenceScale + t,
          );
          p.vel[0] += (nx * 2 - 1) * state.forces.turbulenceStrength * dt;
          p.vel[1] += (ny * 2 - 1) * state.forces.turbulenceStrength * dt;
          p.vel[2] += (nz * 2 - 1) * state.forces.turbulenceStrength * dt;
        } else if (state.forces.mode === "curl") {
          const c = curlNoise(
            p.pos[0] * state.forces.curlScale + t, 
            p.pos[1] * state.forces.curlScale, 
            p.pos[2] * state.forces.curlScale - t
          );
          p.vel[0] += c[0] * state.forces.curlStrength * dt;
          p.vel[1] += c[1] * state.forces.curlStrength * dt;
          p.vel[2] += c[2] * state.forces.curlStrength * dt;
        }
      }

      // Vortex force
      if (state.vortex.enabled) {
        const ax = (state.vortex.rotX * Math.PI) / 180;
        const ay = (state.vortex.rotY * Math.PI) / 180;
        const az = (state.vortex.rotZ * Math.PI) / 180;
        let axis = [0, 1, 0];
        axis = rotateX(axis, ax);
        axis = rotateY(axis, ay);
        axis = rotateZ(axis, az);
        axis = normalizeVec3(axis);

        const rel = [
          p.pos[0] - state.vortex.pos[0], 
          p.pos[1] - state.vortex.pos[1], 
          p.pos[2] - state.vortex.pos[2]
        ];
        const proj = rel[0] * axis[0] + rel[1] * axis[1] + rel[2] * axis[2];
        const radial = [
          rel[0] - axis[0] * proj,
          rel[1] - axis[1] * proj,
          rel[2] - axis[2] * proj,
        ];
        const dist = Math.hypot(radial[0], radial[1], radial[2]);
        
        if (dist < state.vortex.radius && dist > 1e-4) {
          const falloff = 1 - dist / state.vortex.radius;
          const tangent = normalizeVec3([
            axis[1] * radial[2] - axis[2] * radial[1],
            axis[2] * radial[0] - axis[0] * radial[2],
            axis[0] * radial[1] - axis[1] * radial[0],
          ]);
          p.vel[0] += tangent[0] * state.vortex.strength * falloff * dt;
          p.vel[1] += tangent[1] * state.vortex.strength * falloff * dt;
          p.vel[2] += tangent[2] * state.vortex.strength * falloff * dt;
        }
      }

      // Attractor force
      if (state.attractor.enabled && state.attractor.strength > 0 && state.attractor.radius > 0) {
        const dx = state.attractor.pos[0] - p.pos[0];
        const dy = state.attractor.pos[1] - p.pos[1];
        const dz = state.attractor.pos[2] - p.pos[2];
        const dist = Math.hypot(dx, dy, dz) || 1;
        
        if (dist < state.attractor.radius) {
          const force = (1 - dist / state.attractor.radius) * state.attractor.strength;
          p.vel[0] += (dx / dist) * force * dt;
          p.vel[1] += (dy / dist) * force * dt;
          p.vel[2] += (dz / dist) * force * dt;
        }
      }

      // Gravity
      p.vel[1] += state.forces.gravity * dt;

      // Wind
      p.vel[0] += state.forces.wind[0] * dt;
      p.vel[1] += state.forces.wind[1] * dt;
      p.vel[2] += state.forces.wind[2] * dt;

      // Drag
      if (state.forces.drag > 0) {
        const damp = Math.max(0, 1 - state.forces.drag * dt);
        p.vel[0] *= damp;
        p.vel[1] *= damp;
        p.vel[2] *= damp;
      }
    }

    // Update position
    p.pos[0] += p.vel[0] * dt;
    p.pos[1] += p.vel[1] * dt;
    p.pos[2] += p.vel[2] * dt;

    // Ground collision
    if (state.forces.groundEnabled && 
        state.emitter.pos[1] >= state.forces.groundLevel && 
        p.pos[1] < state.forces.groundLevel) {
      p.pos[1] = state.forces.groundLevel;
      if (p.vel[1] < 0) {
        p.vel[1] = -p.vel[1] * state.forces.bounce;
        p.vel[0] *= 1 - state.forces.bounce * 0.2;
        p.vel[2] *= 1 - state.forces.bounce * 0.2;
      }
    }
  }
}

// ============================================================================
// Particle Emission
// ============================================================================

/**
 * Handle continuous particle emission
 * @param {number} dt - Delta time in seconds
 */
export function emitParticles(dt) {
  // Important: don't "catch up" emission when frames are slow, or emission can
  // become a positive feedback loop (slow frame -> big dt -> huge spawn burst -> slower).
  const dtEmit = Math.min(dt, 1 / 60);
  const lambda = state.particle.emissionRate * dtEmit;
  let accum = spawnAccum + lambda;
  let spawnNow = Math.floor(accum);
  spawnNow = Math.min(spawnNow, 2000);

  // Never exceed capacity and never bank "missed" spawns while full.
  const capacity = state.particle.capacity;
  const available = Math.max(0, capacity - particles.length);
  if (available <= 0) {
    setSpawnAccum(0);
    return;
  }

  if (spawnNow > available) {
    spawnNow = available;
    // Discard remainder to keep emission steady (no catch-up bursts).
    accum = 0;
  }
  
  if (spawnNow > 0) {
    accum -= spawnNow;
    spawnAt(0, 0, spawnNow, 0, dtEmit);
  }
  
  setSpawnAccum(accum);
}

// ============================================================================
// Particle Sorting and Instance Data
// ============================================================================

/**
 * Sort particles by depth for proper alpha blending
 * @param {number[]} cameraEye - Camera position
 * @param {number[]} cameraForward - Camera forward vector
 */
export function sortParticlesByDepth(cameraEye, cameraForward) {
  if (particles.length <= 1) return;
  
  const ex = cameraEye[0];
  const ey = cameraEye[1];
  const ez = cameraEye[2];
  const fx = cameraForward[0];
  const fy = cameraForward[1];
  const fz = cameraForward[2];
  
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const dx = p.pos[0] - ex;
    const dy = p.pos[1] - ey;
    const dz = p.pos[2] - ez;
    p.sortDepth = dx * fx + dy * fy + dz * fz;
  }
  
  particles.sort((a, b) => b.sortDepth - a.sortDepth);
}

/**
 * Build instance data for GPU rendering
 * @param {Float32Array} instanceData - Pre-allocated instance buffer
 * @param {number} particleSize - Base particle size
 * @param {number} baseUnitsPerPixel - World units per pixel
 * @returns {number} Number of particles to render
 */
export function buildInstanceData(instanceData, particleSize, baseUnitsPerPixel) {
  const count = Math.min(particles.length, Math.floor(instanceData.length / 17));
  
  for (let i = 0; i < count; i++) {
    const p = particles[i];
    const lifeT = p.age / p.life;
    const sizePixels = particleSize * 5 * p.size;
    const size = evalCurve(state.curves.size, lifeT) * sizePixels * baseUnitsPerPixel;
    const opacity = clamp(evalCurve(state.curves.opacity, lifeT) * state.particle.opacity, 0, 1);
    
    let color;
    if (state.particle.colorMode === "solid") {
      color = state.particle.solidColor;
    } else if (state.particle.colorMode === "random") {
      color = p.color || state.particle.solidColor;
    } else {
      color = evalGradient(state.curves.colorGradient, lifeT);
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
  
  return count;
}
