// UI Bindings: DOM elements, event listeners, input synchronization

import { state, applySnapshot, serializeState } from './state.js';
import { hexToRgb, rgbToHex, clamp, roundToStep, formatWithStep, evalCurve, evalGradient } from './math.js';

// ============================================================================
// Initialization (no-op, kept for API compatibility)
// ============================================================================

export function initElements() {
  // All elements are now accessed via document.getElementById directly
  // This function is kept for backwards compatibility
}

// ============================================================================
// UI Synchronization
// ============================================================================

export function syncUIFromState() {
  // Helper to safely set slider value and display
  const setSlider = (id, value, decimals = 0) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(id + "Val");
    if (slider) slider.value = value;
    if (display) display.textContent = decimals > 0 ? value.toFixed(decimals) : value;
  };
  
  const setCheckbox = (id, checked) => {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  };
  
  const setSelect = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };
  
  const setColor = (id, rgb) => {
    const el = document.getElementById(id);
    if (el) el.value = rgbToHex(rgb);
  };

  // Particle settings
  setSlider("emissionRate", state.particle.emissionRate);
  setSlider("particleSize", state.particle.size);
  setSlider("particleOpacity", state.particle.opacity, 2);
  setSelect("particleShape", state.particle.shape);
  setSelect("blendMode", state.particle.blendMode);
  setSelect("particleColorMode", state.particle.colorMode);
  setColor("solidColor", state.particle.solidColor);
  
  // Emitter settings  
  setSelect("emitterShape", state.emitter.shape);
  setSelect("emitFrom", state.emitter.emitFrom);
  setSelect("emissionDirection", state.emitter.direction);
  
  // DOF settings
  setCheckbox("dofEnabled", state.dof.enabled);
  
  // Forces
  setCheckbox("forcesEnabled", state.forces.enabled);
  setSelect("forceMode", state.forces.mode);
  
  // Vortex
  setCheckbox("vortexEnabled", state.vortex.enabled);
  
  // Attractor
  setCheckbox("attractorEnabled", state.attractor.enabled);
  
  // Shading
  setCheckbox("shadingEnabled", state.shading.enabled);
  setColor("lightColor", state.shading.lightColor);
  
  // Background
  setSelect("bgMode", state.background.mode);
  setColor("bgSolidColor", state.background.solidColor);
  
  // Update visibility
  updateShapeVisibility();
  updateColorModeVisibility();
  updateDirectionVisibility();
  updateDofVisibility();
  updateForcesVisibility();
  updateForceModeVisibility();
  updateVortexVisibility();
  updateAttractorVisibility();
  updateShadingVisibility();
  updateBackgroundVisibility();
}

// ============================================================================
// Visibility Toggles
// ============================================================================

function setDisplay(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? "" : "none";
}

function updateShapeVisibility() {
  const isSphere = state.particle.shape === "sphere";
  const is2D = ["circle", "square"].includes(state.particle.shape);
  setDisplay("sphereSubdivisionsGroup", isSphere);
  setDisplay("softnessGroup", is2D);
}

function updateColorModeVisibility() {
  setDisplay("solidColorGroup", state.particle.colorMode === "solid");
  setDisplay("gradientEditorGroup", state.particle.colorMode === "gradient");
}

function updateDirectionVisibility() {
  setDisplay("coneAngleGroup", state.emitter.direction === "directional");
}

function updateDofVisibility() {
  setDisplay("dofSection", state.dof.enabled);
}

function updateForcesVisibility() {
  setDisplay("forcesSection", state.forces.enabled);
}

function updateForceModeVisibility() {
  const isTurbulence = state.forces.mode === "turbulence";
  setDisplay("turbulenceGroup", isTurbulence);
  setDisplay("curlGroup", !isTurbulence);
}

function updateVortexVisibility() {
  setDisplay("vortexSection", state.vortex.enabled);
}

function updateAttractorVisibility() {
  setDisplay("attractorSection", state.attractor.enabled);
}

function updateShadingVisibility() {
  setDisplay("shadingSection", state.shading.enabled);
}

function updateBackgroundVisibility() {
  const mode = state.background.mode;
  setDisplay("bgSolidGroup", mode === "solid");
  setDisplay("bgGradientGroup", mode !== "solid");
  setDisplay("bgLinearDirectionGroup", mode === "linear-gradient");
  setDisplay("bgRadialCenterGroup", mode === "radial-gradient");
}

// ============================================================================
// Event Listener Setup
// ============================================================================

export function setupEventListeners(callbacks = {}) {
  // Helper to setup select elements
  const setupSelect = (id, setter, onChangeCallback) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", (e) => {
      setter(e.target.value);
      if (onChangeCallback) onChangeCallback();
    });
  };
  
  // Helper to setup color inputs
  const setupColor = (id, setter) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", (e) => {
      setter(hexToRgb(e.target.value));
    });
  };
  
  // Helper to setup buttons
  const setupButton = (id, callback) => {
    const el = document.getElementById(id);
    if (el && callback) el.addEventListener("click", callback);
  };

  // Sidebar panel switching
  const sidebarButtons = document.querySelectorAll(".sidebar-btn");
  const panelGroups = document.querySelectorAll(".panel");
  sidebarButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const panelId = btn.dataset.panel;
      sidebarButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      panelGroups.forEach(p => {
        p.classList.toggle("active", p.id === panelId);
      });
    });
  });
  
  // Particle settings
  setupSlider("emissionRate", (v) => { state.particle.emissionRate = v; });
  setupSlider("particleSize", (v) => { state.particle.size = v; });
  setupSlider("particleOpacity", (v) => { state.particle.opacity = v; }, 2);
  setupSelect("particleShape", (v) => { state.particle.shape = v; }, updateShapeVisibility);
  setupSelect("particleColorMode", (v) => { state.particle.colorMode = v; }, updateColorModeVisibility);
  setupColor("solidColor", (v) => { state.particle.solidColor = v; });
  setupSelect("blendMode", (v) => { state.particle.blendMode = v; });
  
  // Emitter settings
  setupSelect("emitterShape", (v) => { state.emitter.shape = v; });
  setupSelect("emitFrom", (v) => { state.emitter.emitFrom = v; });
  setupSelect("emissionDirection", (v) => { state.emitter.direction = v; }, updateDirectionVisibility);
  
  // Forces
  setupCheckbox("forcesEnabled", (v) => { 
    state.forces.enabled = v;
    updateForcesVisibility();
  });
  setupSelect("forceMode", (v) => { state.forces.mode = v; }, updateForceModeVisibility);
  
  // Vortex
  setupCheckbox("vortexEnabled", (v) => { 
    state.vortex.enabled = v;
    updateVortexVisibility();
  });
  
  // Attractor
  setupCheckbox("attractorEnabled", (v) => { 
    state.attractor.enabled = v;
    updateAttractorVisibility();
  });
  
  // Shading
  setupCheckbox("shadingEnabled", (v) => { 
    state.shading.enabled = v;
    updateShadingVisibility();
  });
  setupSelect("shadingStyle", (v) => { state.shading.style = v; });
  setupColor("lightColor", (v) => { state.shading.lightColor = v; });
  
  // DOF
  setupCheckbox("dofEnabled", (v) => { 
    state.dof.enabled = v;
    updateDofVisibility();
  });
  
  // Background
  setupSelect("bgMode", (v) => { state.background.mode = v; }, updateBackgroundVisibility);
  setupColor("bgSolidColor", (v) => { state.background.solidColor = v; });
  
  // Export buttons
  setupButton("recordVideoBtn", callbacks.onRecordVideo);
  setupButton("exportHtmlBtn", callbacks.onExportHtml);
}

// ============================================================================
// Slider and Checkbox Helpers
// ============================================================================

function setupSlider(name, setter, decimals = 0) {
  const slider = document.getElementById(name);
  const valueDisplay = document.getElementById(name + "Val");
  if (!slider) return;
  
  slider.addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    setter(value);
    if (valueDisplay) {
      valueDisplay.textContent = decimals > 0 ? value.toFixed(decimals) : value;
    }
  });
}

function setupCheckbox(name, setter) {
  const checkbox = document.getElementById(name);
  if (!checkbox) return;
  
  checkbox.addEventListener("change", (e) => {
    setter(e.target.checked);
  });
}

// ============================================================================
// Performance HUD Update
// ============================================================================

export function updatePerfHud(fps, particleCount, cpuMs, gpuMs) {
  const fpsEl = document.getElementById("fpsDisplay");
  const countEl = document.getElementById("particleCount");
  const cpuEl = document.getElementById("cpuTime");
  const gpuEl = document.getElementById("gpuTime");
  
  if (fpsEl) fpsEl.textContent = fps.toFixed(0);
  if (countEl) countEl.textContent = particleCount;
  if (cpuEl) cpuEl.textContent = cpuMs.toFixed(1);
  if (gpuEl) gpuEl.textContent = gpuMs !== null ? gpuMs.toFixed(1) : "--";
}

// ============================================================================
// Curve Editor Setup
// ============================================================================

export function setupCurveEditor(canvasId, points, onChange) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  
  const ctx = canvas.getContext("2d");
  let selectedPoint = -1;
  let isDragging = false;
  
  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    
    // Clear
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, w, h);
    
    // Grid
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = (i / 4) * w;
      const y = (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    
    // Curve
    ctx.strokeStyle = "#88ff88";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px <= w; px++) {
      const t = px / w;
      const y = evalCurve(points, t);
      const py = h - y * h;
      if (px === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    
    // Points
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const px = p.x * w;
      const py = h - p.y * h;
      
      ctx.beginPath();
      ctx.arc(px, py, i === selectedPoint ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = i === selectedPoint ? "#ffff00" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  
  function getPointAt(mx, my) {
    const w = canvas.width;
    const h = canvas.height;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const px = p.x * w;
      const py = h - p.y * h;
      if (Math.hypot(mx - px, my - py) < 12) return i;
    }
    return -1;
  }
  
  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    selectedPoint = getPointAt(mx, my);
    if (selectedPoint >= 0) {
      isDragging = true;
    } else if (e.detail === 2) {
      // Double click - add point
      const x = mx / canvas.width;
      const y = 1 - my / canvas.height;
      points.push({ x: clamp(x, 0, 1), y: clamp(y, 0, 1) });
      points.sort((a, b) => a.x - b.x);
      onChange(points);
      draw();
    }
  });
  
  canvas.addEventListener("mousemove", (e) => {
    if (!isDragging || selectedPoint < 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const p = points[selectedPoint];
    // First and last points can't move horizontally
    if (selectedPoint > 0 && selectedPoint < points.length - 1) {
      p.x = clamp(mx / canvas.width, 0.01, 0.99);
    }
    p.y = clamp(1 - my / canvas.height, 0, 1);
    
    onChange(points);
    draw();
  });
  
  canvas.addEventListener("mouseup", () => {
    isDragging = false;
  });
  
  canvas.addEventListener("mouseleave", () => {
    isDragging = false;
  });
  
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const idx = getPointAt(mx, my);
    if (idx > 0 && idx < points.length - 1) {
      points.splice(idx, 1);
      selectedPoint = -1;
      onChange(points);
      draw();
    }
  });
  
  draw();
  return { draw, setPoints: (newPoints) => { points.length = 0; points.push(...newPoints); draw(); } };
}

// ============================================================================
// Gradient Editor Setup
// ============================================================================

export function setupGradientEditor(canvasId, points, onChange) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  
  const ctx = canvas.getContext("2d");
  let selectedPoint = -1;
  let isDragging = false;
  
  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    
    // Draw gradient
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    for (const p of points) {
      gradient.addColorStop(p.x, rgbToHex(p.color));
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h - 20);
    
    // Draw markers
    ctx.fillStyle = "#222";
    ctx.fillRect(0, h - 20, w, 20);
    
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const px = p.x * w;
      
      ctx.beginPath();
      ctx.moveTo(px, h - 20);
      ctx.lineTo(px - 6, h);
      ctx.lineTo(px + 6, h);
      ctx.closePath();
      ctx.fillStyle = rgbToHex(p.color);
      ctx.fill();
      ctx.strokeStyle = i === selectedPoint ? "#ffff00" : "#fff";
      ctx.lineWidth = i === selectedPoint ? 2 : 1;
      ctx.stroke();
    }
  }
  
  function getPointAt(mx, my) {
    const h = canvas.height;
    if (my < h - 25) return -1;
    
    for (let i = 0; i < points.length; i++) {
      const px = points[i].x * canvas.width;
      if (Math.abs(mx - px) < 10) return i;
    }
    return -1;
  }
  
  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    selectedPoint = getPointAt(mx, my);
    if (selectedPoint >= 0) {
      isDragging = true;
    } else if (my >= canvas.height - 25 && e.detail === 2) {
      // Double click - add point
      const x = mx / canvas.width;
      const color = evalGradient(points, x);
      points.push({ x: clamp(x, 0.01, 0.99), color });
      points.sort((a, b) => a.x - b.x);
      onChange(points);
      draw();
    }
  });
  
  canvas.addEventListener("mousemove", (e) => {
    if (!isDragging || selectedPoint < 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    
    // First and last points can't move
    if (selectedPoint > 0 && selectedPoint < points.length - 1) {
      points[selectedPoint].x = clamp(mx / canvas.width, 0.01, 0.99);
      points.sort((a, b) => a.x - b.x);
      // Re-find selected point after sort
      selectedPoint = points.findIndex(p => p === points[selectedPoint]);
    }
    
    onChange(points);
    draw();
  });
  
  canvas.addEventListener("mouseup", () => {
    isDragging = false;
  });
  
  canvas.addEventListener("dblclick", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const idx = getPointAt(mx, my);
    if (idx >= 0) {
      // Open color picker for this point
      const input = document.createElement("input");
      input.type = "color";
      input.value = rgbToHex(points[idx].color);
      input.style.position = "absolute";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      
      input.addEventListener("input", (e) => {
        points[idx].color = hexToRgb(e.target.value);
        onChange(points);
        draw();
      });
      
      input.addEventListener("change", () => {
        document.body.removeChild(input);
      });
      
      input.click();
    }
  });
  
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const idx = getPointAt(mx, my);
    if (idx > 0 && idx < points.length - 1) {
      points.splice(idx, 1);
      selectedPoint = -1;
      onChange(points);
      draw();
    }
  });
  
  draw();
  return { draw, setPoints: (newPoints) => { points.length = 0; points.push(...newPoints); draw(); } };
}
