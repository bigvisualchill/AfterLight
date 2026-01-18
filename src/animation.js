// Animation system for emitter, vortex, and attractor motion
// Supports sine, bounce, noise, and random motion types

import { state } from './state.js';

// ============================================================================
// Animation Motion Functions
// ============================================================================

export function animSine(time, speed, phase) {
  return Math.sin(time * speed + phase);
}

export function animBounce(time, speed, phase) {
  // Triangle wave (ping-pong between -1 and 1)
  const t = (time * speed + phase) / Math.PI;
  return 2 * Math.abs(2 * (t - Math.floor(t + 0.5))) - 1;
}

export function animNoise(time, speed, noiseOffset) {
  // Simple smooth noise using multiple sine waves
  const t = time * speed * 0.5 + noiseOffset;
  return (
    Math.sin(t * 1.0) * 0.5 +
    Math.sin(t * 2.3 + 1.5) * 0.25 +
    Math.sin(t * 4.1 + 3.2) * 0.15 +
    Math.sin(t * 7.9 + 5.4) * 0.1
  );
}

export function animRandom(time, speed, animObj) {
  // Random walk with momentum
  if (animObj.randomTarget === undefined) {
    animObj.randomTarget = 0;
    animObj.randomCurrent = 0;
    animObj.randomNextChange = 0;
  }
  if (time > animObj.randomNextChange) {
    animObj.randomTarget = (Math.random() - 0.5) * 2;
    animObj.randomNextChange = time + 0.5 + Math.random() * 1.5 / speed;
  }
  // Smooth interpolation to target
  animObj.randomCurrent += (animObj.randomTarget - animObj.randomCurrent) * 0.02 * speed;
  return animObj.randomCurrent;
}

export function getAnimValue(time, animObj) {
  const amplitude = 1.5; // Range: -1.5 to 1.5
  let value = 0;
  switch (animObj.type) {
    case "sine":
      value = animSine(time, animObj.speed, animObj.phase);
      break;
    case "bounce":
      value = animBounce(time, animObj.speed, animObj.phase);
      break;
    case "noise":
      value = animNoise(time, animObj.speed, animObj.noiseOffset);
      break;
    case "random":
      value = animRandom(time, animObj.speed, animObj);
      break;
    default:
      value = animSine(time, animObj.speed, animObj.phase);
  }
  return value * amplitude;
}

// ============================================================================
// Animation Update
// ============================================================================

/**
 * Update all position animations for a frame
 * @param {number} dt - Delta time in seconds
 * @param {Function} onEmitterPosUpdate - Callback when emitter position changes
 * @param {Function} onVortexPosUpdate - Callback when vortex position changes
 * @param {Function} onAttractorPosUpdate - Callback when attractor position changes
 */
export function updateAnimations(dt, onEmitterPosUpdate, onVortexPosUpdate, onAttractorPosUpdate) {
  // Update animation time
  state.animation.time += dt;
  const time = state.animation.time;

  // Store frame start position for particle interpolation
  state.emitter.frameStartPos[0] = state.emitter.pos[0];
  state.emitter.frameStartPos[1] = state.emitter.pos[1];
  state.emitter.frameStartPos[2] = state.emitter.pos[2];

  // Emitter animation
  if (state.animation.emitterEnabled) {
    // Store previous position for velocity calculation
    const prevX = state.emitter.pos[0];
    const prevY = state.emitter.pos[1];
    const prevZ = state.emitter.pos[2];

    if (state.animation.emitterX.enabled) {
      state.emitter.pos[0] = getAnimValue(time, state.animation.emitterX);
    }
    if (state.animation.emitterY.enabled) {
      state.emitter.pos[1] = getAnimValue(time, state.animation.emitterY);
    }
    if (state.animation.emitterZ.enabled) {
      state.emitter.pos[2] = getAnimValue(time, state.animation.emitterZ);
    }

    // Calculate emitter velocity (change per second)
    if (dt > 0) {
      state.emitter.velocity[0] = (state.emitter.pos[0] - prevX) / dt;
      state.emitter.velocity[1] = (state.emitter.pos[1] - prevY) / dt;
      state.emitter.velocity[2] = (state.emitter.pos[2] - prevZ) / dt;
    }

    if (onEmitterPosUpdate) onEmitterPosUpdate();
  } else {
    // Reset velocity when animation is off
    state.emitter.velocity[0] = 0;
    state.emitter.velocity[1] = 0;
    state.emitter.velocity[2] = 0;
  }

  // Vortex animation
  if (state.animation.vortexEnabled && state.vortex.enabled) {
    let changed = false;
    if (state.animation.vortexX.enabled) {
      state.vortex.pos[0] = getAnimValue(time, state.animation.vortexX);
      changed = true;
    }
    if (state.animation.vortexY.enabled) {
      state.vortex.pos[1] = getAnimValue(time, state.animation.vortexY);
      changed = true;
    }
    if (state.animation.vortexZ.enabled) {
      state.vortex.pos[2] = getAnimValue(time, state.animation.vortexZ);
      changed = true;
    }
    if (changed && onVortexPosUpdate) onVortexPosUpdate();
  }

  // Attractor animation
  if (state.animation.attractorEnabled && state.attractor.enabled) {
    let changed = false;
    if (state.animation.attractorX.enabled) {
      state.attractor.pos[0] = getAnimValue(time, state.animation.attractorX);
      changed = true;
    }
    if (state.animation.attractorY.enabled) {
      state.attractor.pos[1] = getAnimValue(time, state.animation.attractorY);
      changed = true;
    }
    if (state.animation.attractorZ.enabled) {
      state.attractor.pos[2] = getAnimValue(time, state.animation.attractorZ);
      changed = true;
    }
    if (changed && onAttractorPosUpdate) onAttractorPosUpdate();
  }
}
