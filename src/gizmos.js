// Gizmo system: 3D manipulators for emitter, vortex, attractor, light, camera
// Renders to 2D canvas overlay

import { state, GIZMO_HANDLE_SIZE } from './state.js';
import { worldToScreen, worldUnitsPerPixelAt, invViewProj } from './camera.js';
import { normalizeVec3, unproject, rotateX, rotateY, rotateZ, cross, clamp } from './math.js';

// ============================================================================
// Gizmo Constants
// ============================================================================

const AXIS_COLORS = {
  x: "#ff4444",
  y: "#44ff44", 
  z: "#4488ff",
};

const HOVER_COLORS = {
  x: "#ff8888",
  y: "#88ff88",
  z: "#88bbff",
};

// ============================================================================
// Drawing Utilities
// ============================================================================

function setStroke(ctx, axis, isHovered) {
  ctx.strokeStyle = isHovered ? HOVER_COLORS[axis] : AXIS_COLORS[axis];
  ctx.lineWidth = isHovered ? 3 : 2;
}

// ============================================================================
// Wireframe Drawing
// ============================================================================

export function drawWireframeSphere(ctx, center, radius, width, height, color = "#888", segments = 24) {
  const screen = worldToScreen(center, width, height);
  if (!screen) return;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;

  // Draw three orthogonal circles
  for (const axis of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    ctx.beginPath();
    let firstPoint = null;
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      
      let point;
      if (axis[0] === 1) {
        point = [center[0], center[1] + c * radius, center[2] + s * radius];
      } else if (axis[1] === 1) {
        point = [center[0] + c * radius, center[1], center[2] + s * radius];
      } else {
        point = [center[0] + c * radius, center[1] + s * radius, center[2]];
      }
      
      const sp = worldToScreen(point, width, height);
      if (!sp) continue;
      
      if (!firstPoint) {
        ctx.moveTo(sp[0], sp[1]);
        firstPoint = sp;
      } else {
        ctx.lineTo(sp[0], sp[1]);
      }
    }
    ctx.stroke();
  }
  
  ctx.globalAlpha = 1;
}

export function drawWireframeRing(ctx, center, radius, axis, width, height, color = "#888", segments = 32) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  // Get perpendicular vectors
  const up = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const right = normalizeVec3(cross(axis, up));
  const forward = normalizeVec3(cross(right, axis));
  
  let firstPoint = null;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    const point = [
      center[0] + (right[0] * c + forward[0] * s) * radius,
      center[1] + (right[1] * c + forward[1] * s) * radius,
      center[2] + (right[2] * c + forward[2] * s) * radius,
    ];
    
    const sp = worldToScreen(point, width, height);
    if (!sp) continue;
    
    if (!firstPoint) {
      ctx.moveTo(sp[0], sp[1]);
      firstPoint = sp;
    } else {
      ctx.lineTo(sp[0], sp[1]);
    }
  }
  ctx.stroke();
}

export function drawEmitterWireframe(ctx, pos, size, shape, width, height) {
  const rotX = (state.emitter.directionRotX * Math.PI) / 180;
  const rotY = (state.emitter.directionRotY * Math.PI) / 180;
  const rotZ = (state.emitter.directionRotZ * Math.PI) / 180;
  
  ctx.strokeStyle = "#88ff88";
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;

  if (shape === "sphere") {
    drawWireframeSphere(ctx, pos, size, width, height, "#88ff88", 24);
  } else if (shape === "box") {
    // Draw box edges
    const corners = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
    ].map(c => {
      let p = [c[0] * size, c[1] * size, c[2] * size];
      p = rotateX(p, rotX);
      p = rotateY(p, rotY);
      p = rotateZ(p, rotZ);
      return [p[0] + pos[0], p[1] + pos[1], p[2] + pos[2]];
    });
    
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    
    for (const [a, b] of edges) {
      const sa = worldToScreen(corners[a], width, height);
      const sb = worldToScreen(corners[b], width, height);
      if (sa && sb) {
        ctx.beginPath();
        ctx.moveTo(sa[0], sa[1]);
        ctx.lineTo(sb[0], sb[1]);
        ctx.stroke();
      }
    }
  } else if (shape === "plane") {
    const corners = [
      [-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0],
    ].map(c => {
      let p = [c[0] * size, c[1] * size, c[2] * size];
      p = rotateX(p, rotX);
      p = rotateY(p, rotY);
      p = rotateZ(p, rotZ);
      return [p[0] + pos[0], p[1] + pos[1], p[2] + pos[2]];
    });
    
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const sp = worldToScreen(corners[i % 4], width, height);
      if (sp) {
        if (i === 0) ctx.moveTo(sp[0], sp[1]);
        else ctx.lineTo(sp[0], sp[1]);
      }
    }
    ctx.stroke();
  } else if (shape === "line") {
    let p1 = [-size, 0, 0];
    let p2 = [size, 0, 0];
    p1 = rotateX(p1, rotX);
    p1 = rotateY(p1, rotY);
    p1 = rotateZ(p1, rotZ);
    p2 = rotateX(p2, rotX);
    p2 = rotateY(p2, rotY);
    p2 = rotateZ(p2, rotZ);
    
    const s1 = worldToScreen([p1[0] + pos[0], p1[1] + pos[1], p1[2] + pos[2]], width, height);
    const s2 = worldToScreen([p2[0] + pos[0], p2[1] + pos[1], p2[2] + pos[2]], width, height);
    if (s1 && s2) {
      ctx.beginPath();
      ctx.moveTo(s1[0], s1[1]);
      ctx.lineTo(s2[0], s2[1]);
      ctx.stroke();
    }
  }
  
  ctx.globalAlpha = 1;
}

// ============================================================================
// Axis Handle Drawing
// ============================================================================

export function drawAxisHandles(ctx, center, width, height, hoverAxis, hoverTarget, target) {
  const screen = worldToScreen(center, width, height);
  if (!screen) return;
  
  const handleLength = 60;
  const arrowSize = 8;
  
  for (const axis of ["x", "y", "z"]) {
    const isHovered = hoverAxis === axis && hoverTarget === target;
    setStroke(ctx, axis, isHovered);
    
    // Get axis direction in screen space
    const dir = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
    const endWorld = [
      center[0] + dir[0] * 0.5,
      center[1] + dir[1] * 0.5,
      center[2] + dir[2] * 0.5,
    ];
    const endScreen = worldToScreen(endWorld, width, height);
    
    if (!endScreen) continue;
    
    // Calculate screen direction
    const dx = endScreen[0] - screen[0];
    const dy = endScreen[1] - screen[1];
    const len = Math.hypot(dx, dy) || 1;
    const ndx = dx / len;
    const ndy = dy / len;
    
    // Draw axis line
    const tipX = screen[0] + ndx * handleLength;
    const tipY = screen[1] + ndy * handleLength;
    
    ctx.beginPath();
    ctx.moveTo(screen[0], screen[1]);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    
    // Draw arrowhead
    const perpX = -ndy;
    const perpY = ndx;
    
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - ndx * arrowSize + perpX * arrowSize * 0.5, tipY - ndy * arrowSize + perpY * arrowSize * 0.5);
    ctx.lineTo(tipX - ndx * arrowSize - perpX * arrowSize * 0.5, tipY - ndy * arrowSize - perpY * arrowSize * 0.5);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }
}

export function drawDirectionArrow(ctx, center, direction, width, height, color = "#ffff00") {
  const screen = worldToScreen(center, width, height);
  if (!screen) return;
  
  const endWorld = [
    center[0] + direction[0] * 0.8,
    center[1] + direction[1] * 0.8,
    center[2] + direction[2] * 0.8,
  ];
  const endScreen = worldToScreen(endWorld, width, height);
  if (!endScreen) return;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(screen[0], screen[1]);
  ctx.lineTo(endScreen[0], endScreen[1]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Arrowhead
  const dx = endScreen[0] - screen[0];
  const dy = endScreen[1] - screen[1];
  const len = Math.hypot(dx, dy) || 1;
  const ndx = dx / len;
  const ndy = dy / len;
  const size = 10;
  
  ctx.beginPath();
  ctx.moveTo(endScreen[0], endScreen[1]);
  ctx.lineTo(endScreen[0] - ndx * size - ndy * size * 0.5, endScreen[1] - ndy * size + ndx * size * 0.5);
  ctx.lineTo(endScreen[0] - ndx * size + ndy * size * 0.5, endScreen[1] - ndy * size - ndx * size * 0.5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// ============================================================================
// Complete Gizmo Drawing
// ============================================================================

export function drawEmitterGizmo(ctx, width, height) {
  const pos = state.emitter.pos;
  
  // Draw emitter shape wireframe
  drawEmitterWireframe(ctx, pos, state.emitter.size, state.emitter.shape, width, height);
  
  // Draw axis handles
  drawAxisHandles(ctx, pos, width, height, state.gizmos.hoverAxis, state.gizmos.hoverTarget, "emitter");
  
  // Draw emission direction arrow
  if (state.emitter.direction === "directional") {
    const ax = (state.emitter.directionRotX * Math.PI) / 180;
    const ay = (state.emitter.directionRotY * Math.PI) / 180;
    const az = (state.emitter.directionRotZ * Math.PI) / 180;
    let dir = [0, 1, 0];
    dir = rotateX(dir, ax);
    dir = rotateY(dir, ay);
    dir = rotateZ(dir, az);
    drawDirectionArrow(ctx, pos, normalizeVec3(dir), width, height, "#ffff44");
  }
}

export function drawVortexGizmo(ctx, width, height) {
  if (!state.vortex.enabled) return;
  
  const pos = state.vortex.pos;
  
  // Get vortex axis
  const ax = (state.vortex.rotX * Math.PI) / 180;
  const ay = (state.vortex.rotY * Math.PI) / 180;
  const az = (state.vortex.rotZ * Math.PI) / 180;
  let axis = [0, 1, 0];
  axis = rotateX(axis, ax);
  axis = rotateY(axis, ay);
  axis = rotateZ(axis, az);
  axis = normalizeVec3(axis);
  
  // Draw vortex ring
  drawWireframeRing(ctx, pos, state.vortex.radius, axis, width, height, "#ff88ff", 32);
  
  // Draw axis handles
  drawAxisHandles(ctx, pos, width, height, state.gizmos.hoverAxis, state.gizmos.hoverTarget, "vortex");
  
  // Draw axis direction
  drawDirectionArrow(ctx, pos, axis, width, height, "#ff88ff");
}

export function drawAttractorGizmo(ctx, width, height) {
  if (!state.attractor.enabled) return;
  
  const pos = state.attractor.pos;
  
  // Draw attractor sphere
  drawWireframeSphere(ctx, pos, state.attractor.radius, width, height, "#88ffff", 16);
  
  // Draw axis handles
  drawAxisHandles(ctx, pos, width, height, state.gizmos.hoverAxis, state.gizmos.hoverTarget, "attractor");
}

export function drawLightGizmo(ctx, width, height) {
  // Light is directional, show at a fixed distance
  const lightDir = normalizeVec3(state.shading.lightPos);
  const displayPos = [lightDir[0] * 3, lightDir[1] * 3, lightDir[2] * 3];
  
  // Draw sun symbol
  const screen = worldToScreen(displayPos, width, height);
  if (!screen) return;
  
  ctx.strokeStyle = "#ffcc00";
  ctx.fillStyle = "#ffcc00";
  ctx.lineWidth = 2;
  
  // Center circle
  ctx.beginPath();
  ctx.arc(screen[0], screen[1], 10, 0, Math.PI * 2);
  ctx.fill();
  
  // Rays
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const innerR = 14;
    const outerR = 22;
    ctx.beginPath();
    ctx.moveTo(screen[0] + Math.cos(angle) * innerR, screen[1] + Math.sin(angle) * innerR);
    ctx.lineTo(screen[0] + Math.cos(angle) * outerR, screen[1] + Math.sin(angle) * outerR);
    ctx.stroke();
  }
  
  // Draw axis handles
  drawAxisHandles(ctx, displayPos, width, height, state.gizmos.hoverAxis, state.gizmos.hoverTarget, "light");
}

export function drawCameraGizmo(ctx, width, height) {
  const pos = state.camera.eye;
  
  // Draw camera icon
  const screen = worldToScreen(pos, width, height);
  if (!screen) return;
  
  ctx.strokeStyle = "#aaaaaa";
  ctx.fillStyle = "#666666";
  ctx.lineWidth = 2;
  
  // Camera body
  ctx.beginPath();
  ctx.rect(screen[0] - 12, screen[1] - 8, 24, 16);
  ctx.fill();
  ctx.stroke();
  
  // Lens
  ctx.beginPath();
  ctx.arc(screen[0] + 14, screen[1], 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Draw axis handles
  drawAxisHandles(ctx, pos, width, height, state.gizmos.hoverAxis, state.gizmos.hoverTarget, "camera");
}

// ============================================================================
// Focus Navigator (2D DOF visualization)
// ============================================================================

export function drawFocusNavigator(ctx, width, height) {
  const navWidth = 200;
  const navHeight = 100;
  const padding = 20;
  const x = width - navWidth - padding;
  const y = height - navHeight - padding;
  
  // Background
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(x, y, navWidth, navHeight);
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, navWidth, navHeight);
  
  // DOF range visualization
  const focusZ = state.dof.smoothedFocusZ;
  const aperture = state.dof.aperture;
  
  // Calculate DOF near/far distances (simplified)
  const focalLength = 0.035; // 35mm
  const hyperfocal = (focalLength * focalLength) / (aperture * 0.03); // Approximate CoC
  const nearDist = (focusZ * hyperfocal) / (hyperfocal + (focusZ - focalLength));
  const farDist = (focusZ * hyperfocal) / (hyperfocal - (focusZ - focalLength));
  
  // Map distances to navigator space (0-25 units range)
  const mapZ = (z) => x + clamp(z / 25, 0, 1) * navWidth;
  
  // Draw DOF range
  const nearX = mapZ(Math.max(0, nearDist));
  const farX = mapZ(Math.min(25, farDist));
  const focusX = mapZ(focusZ);
  
  // Focus range fill
  ctx.fillStyle = "rgba(100, 200, 100, 0.3)";
  ctx.fillRect(nearX, y, farX - nearX, navHeight);
  
  // Focus plane line
  ctx.strokeStyle = "#88ff88";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(focusX, y);
  ctx.lineTo(focusX, y + navHeight);
  ctx.stroke();
  
  // Camera position
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x + 5, y + navHeight / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Emitter position
  const emitterX = mapZ(Math.hypot(
    state.emitter.pos[0] - state.camera.activeViewEye[0],
    state.emitter.pos[1] - state.camera.activeViewEye[1],
    state.emitter.pos[2] - state.camera.activeViewEye[2]
  ));
  ctx.fillStyle = "#44ff44";
  ctx.beginPath();
  ctx.arc(emitterX, y + navHeight / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Labels
  ctx.fillStyle = "#888";
  ctx.font = "10px sans-serif";
  ctx.fillText("0m", x + 2, y + navHeight - 4);
  ctx.fillText("25m", x + navWidth - 20, y + navHeight - 4);
  ctx.fillText(`f/${aperture.toFixed(1)}`, x + 4, y + 12);
  ctx.fillText(`${focusZ.toFixed(1)}m`, focusX - 12, y + 12);
}

// ============================================================================
// All Gizmos Render
// ============================================================================

export function renderAllGizmos(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  
  if (state.gizmos.emitterEnabled) {
    drawEmitterGizmo(ctx, width, height);
  }
  
  if (state.gizmos.vortexEnabled) {
    drawVortexGizmo(ctx, width, height);
  }
  
  if (state.gizmos.attractorEnabled) {
    drawAttractorGizmo(ctx, width, height);
  }
  
  if (state.gizmos.lightEnabled) {
    drawLightGizmo(ctx, width, height);
  }
  
  if (state.gizmos.cameraEnabled) {
    drawCameraGizmo(ctx, width, height);
  }
  
  if (state.gizmos.focusNavigatorEnabled && state.dof.enabled) {
    drawFocusNavigator(ctx, width, height);
  }
}

// ============================================================================
// Gizmo Interaction
// ============================================================================

function getGizmoTarget(targetName) {
  switch (targetName) {
    case "emitter": return state.emitter.pos;
    case "vortex": return state.vortex.pos;
    case "attractor": return state.attractor.pos;
    case "camera": return state.camera.eye;
    case "light": {
      const dir = normalizeVec3(state.shading.lightPos);
      return [dir[0] * 3, dir[1] * 3, dir[2] * 3];
    }
    default: return null;
  }
}

export function getGizmoHandleCandidates() {
  const candidates = [];
  
  if (state.gizmos.emitterEnabled) {
    candidates.push({ target: "emitter", pos: state.emitter.pos });
  }
  if (state.gizmos.vortexEnabled && state.vortex.enabled) {
    candidates.push({ target: "vortex", pos: state.vortex.pos });
  }
  if (state.gizmos.attractorEnabled && state.attractor.enabled) {
    candidates.push({ target: "attractor", pos: state.attractor.pos });
  }
  if (state.gizmos.lightEnabled) {
    const dir = normalizeVec3(state.shading.lightPos);
    candidates.push({ target: "light", pos: [dir[0] * 3, dir[1] * 3, dir[2] * 3] });
  }
  if (state.gizmos.cameraEnabled) {
    candidates.push({ target: "camera", pos: state.camera.eye });
  }
  
  return candidates;
}

export function isPointInHandle(px, py, center, axis, width, height) {
  const screen = worldToScreen(center, width, height);
  if (!screen) return false;
  
  const handleLength = 60;
  const handleSize = GIZMO_HANDLE_SIZE;
  
  const dir = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
  const endWorld = [
    center[0] + dir[0] * 0.5,
    center[1] + dir[1] * 0.5,
    center[2] + dir[2] * 0.5,
  ];
  const endScreen = worldToScreen(endWorld, width, height);
  if (!endScreen) return false;
  
  const dx = endScreen[0] - screen[0];
  const dy = endScreen[1] - screen[1];
  const len = Math.hypot(dx, dy) || 1;
  const ndx = dx / len;
  const ndy = dy / len;
  
  const tipX = screen[0] + ndx * handleLength;
  const tipY = screen[1] + ndy * handleLength;
  
  // Check distance to line segment
  const ax = px - screen[0];
  const ay = py - screen[1];
  const bx = tipX - screen[0];
  const by = tipY - screen[1];
  
  const t = clamp((ax * bx + ay * by) / (bx * bx + by * by), 0, 1);
  const nearX = screen[0] + bx * t;
  const nearY = screen[1] + by * t;
  const dist = Math.hypot(px - nearX, py - nearY);
  
  return dist < handleSize;
}

export function findHandleAtPoint(px, py, width, height) {
  const candidates = getGizmoHandleCandidates();
  
  for (const { target, pos } of candidates) {
    for (const axis of ["x", "y", "z"]) {
      if (isPointInHandle(px, py, pos, axis, width, height)) {
        return { target, axis };
      }
    }
  }
  
  return null;
}

export function updateGizmoHover(px, py, width, height) {
  const handle = findHandleAtPoint(px, py, width, height);
  if (handle) {
    state.gizmos.hoverTarget = handle.target;
    state.gizmos.hoverAxis = handle.axis;
  } else {
    state.gizmos.hoverTarget = null;
    state.gizmos.hoverAxis = null;
  }
}

export function startGizmoDrag(px, py, width, height) {
  const handle = findHandleAtPoint(px, py, width, height);
  if (!handle) return false;
  
  state.gizmos.dragging = true;
  state.gizmos.dragTarget = handle.target;
  state.gizmos.dragAxis = handle.axis;
  state.gizmos.dragStartPointer = [px, py];
  
  const pos = getGizmoTarget(handle.target);
  if (pos) {
    state.gizmos.dragStartPos = [...pos];
    state.gizmos.dragStartDisplayPos = worldToScreen(pos, width, height);
  }
  
  return true;
}

export function updateGizmoDrag(px, py, width, height, cssHeight) {
  if (!state.gizmos.dragging || !state.gizmos.dragStartPos) return;
  
  const pos = getGizmoTarget(state.gizmos.dragTarget);
  if (!pos) return;
  
  const axis = state.gizmos.dragAxis;
  const axisDir = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
  
  // Calculate screen-space movement along axis
  const startScreen = state.gizmos.dragStartDisplayPos;
  if (!startScreen) return;
  
  const endWorld = [
    state.gizmos.dragStartPos[0] + axisDir[0],
    state.gizmos.dragStartPos[1] + axisDir[1],
    state.gizmos.dragStartPos[2] + axisDir[2],
  ];
  const endScreen = worldToScreen(endWorld, width, height);
  if (!endScreen) return;
  
  const axisDirScreen = [endScreen[0] - startScreen[0], endScreen[1] - startScreen[1]];
  const axisLen = Math.hypot(axisDirScreen[0], axisDirScreen[1]) || 1;
  const axisNorm = [axisDirScreen[0] / axisLen, axisDirScreen[1] / axisLen];
  
  const dragDelta = [px - state.gizmos.dragStartPointer[0], py - state.gizmos.dragStartPointer[1]];
  const projection = dragDelta[0] * axisNorm[0] + dragDelta[1] * axisNorm[1];
  
  // Convert screen pixels to world units
  const worldPerPixel = worldUnitsPerPixelAt(state.gizmos.dragStartPos, cssHeight);
  const worldDelta = projection * worldPerPixel;
  
  // Update position
  const axisIdx = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  
  if (state.gizmos.dragTarget === "light") {
    // For light, update direction instead of position
    const newDir = [...normalizeVec3(state.shading.lightPos)];
    newDir[axisIdx] = state.gizmos.dragStartPos[axisIdx] / 3 + worldDelta / 3;
    state.shading.lightPos = normalizeVec3(newDir);
  } else {
    pos[axisIdx] = state.gizmos.dragStartPos[axisIdx] + worldDelta;
  }
}

export function endGizmoDrag() {
  state.gizmos.dragging = false;
  state.gizmos.dragTarget = null;
  state.gizmos.dragAxis = null;
  state.gizmos.dragStartPointer = null;
  state.gizmos.dragStartPos = null;
  state.gizmos.dragStartDisplayPos = null;
}
