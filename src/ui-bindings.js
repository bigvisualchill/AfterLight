// UI Bindings: DOM elements, event listeners, input synchronization

import { state } from './state.js';
import { hexToRgb, rgbToHex, clamp, roundToStep, formatWithStep, evalCurve, evalGradient } from './math.js';

// ============================================================================
// Initialization (no-op, kept for API compatibility)
// ============================================================================

export function initElements() {
  // Particle panel: group-level collapsibles only.
  // This matches the old UX where the Particles sidebar shows a few top-level rows.
  const particlePanel = document.querySelector('.panel[data-panel="particles"]');
  if (!particlePanel) return;

  const container = particlePanel.querySelector(".panel-content");
  if (!container) return;

  const makeGroup = (id, titleText, nodes) => {
    const setting = document.createElement("div");
    setting.className = "control setting";
    setting.id = id;

    const label = document.createElement("label");
    const left = document.createElement("span");
    left.className = "label-left";

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "collapse-indicator";
    const collapseIcon = document.createElement("span");
    collapseIcon.textContent = "+";
    collapseBtn.appendChild(collapseIcon);

    left.appendChild(collapseBtn);
    left.appendChild(document.createTextNode(titleText));
    label.appendChild(left);

    const body = document.createElement("div");
    body.className = "control-body";

    for (const n of nodes) body.appendChild(n);

    setting.appendChild(label);
    setting.appendChild(body);
    return setting;
  };

  const takeControlBySelector = (selector) => {
    const el = container.querySelector(selector);
    if (!el) return null;
    return el.closest(".control");
  };

  // Grab existing controls (we'll re-wrap them).
  const shapeControl = takeControlBySelector("#particleShape");
  const lifeControl = takeControlBySelector("#lifeSeconds");
  const sizeControl = takeControlBySelector("#particleSize");
  const colorControl = takeControlBySelector("#colorMode");
  const opacityControl = takeControlBySelector("#particleOpacity");

  const groups = [];
  if (shapeControl) groups.push(makeGroup("particleShapeGroup", "Particle Shape", [shapeControl]));
  if (lifeControl) groups.push(makeGroup("particleLifeGroup", "Particle Life", [lifeControl]));
  if (sizeControl) groups.push(makeGroup("particleSizeGroup", "Particle Size", [sizeControl]));
  if (colorControl) groups.push(makeGroup("particleColorGroup", "Particle Color", [colorControl]));
  if (opacityControl) groups.push(makeGroup("particleOpacityGroup", "Particle Opacity", [opacityControl]));

  // Remove grabbed controls from the container before inserting groups.
  for (const ctrl of [shapeControl, lifeControl, sizeControl, colorControl, opacityControl]) {
    if (ctrl && ctrl.parentElement === container) ctrl.remove();
  }

  // Insert groups at the top of the Particles panel in the desired order.
  for (let i = groups.length - 1; i >= 0; i--) {
    container.insertBefore(groups[i], container.firstChild);
  }

  // Emitter panel: group-level collapsibles only.
  const emitterPanel = document.querySelector('.panel[data-panel="emitter"]');
  if (emitterPanel) {
    const emitterContainer = emitterPanel.querySelector(".panel-content");
    if (emitterContainer) {
      const makeGroup = (id, titleText, nodes) => {
        const setting = document.createElement("div");
        setting.className = "control setting";
        setting.id = id;

        const label = document.createElement("label");
        const left = document.createElement("span");
        left.className = "label-left";

        const collapseBtn = document.createElement("button");
        collapseBtn.type = "button";
        collapseBtn.className = "collapse-indicator";
        const collapseIcon = document.createElement("span");
        collapseIcon.textContent = "+";
        collapseBtn.appendChild(collapseIcon);

        left.appendChild(collapseBtn);
        left.appendChild(document.createTextNode(titleText));
        label.appendChild(left);

        const body = document.createElement("div");
        body.className = "control-body";

        for (const n of nodes) body.appendChild(n);

        setting.appendChild(label);
        setting.appendChild(body);
        return setting;
      };

      const takeControlBySelector = (selector) => {
        const el = emitterContainer.querySelector(selector);
        if (!el) return null;
        return el.closest(".control");
      };

      const emitterShapeControl = takeControlBySelector("#emitterShape");
      const emitterSizeControl = takeControlBySelector("#emitterSize");
      const emitFromControl = takeControlBySelector("#emitFrom");

      const emissionRateControl = takeControlBySelector("#emissionRate");
      const emitterPosControl = takeControlBySelector("#emitterPosX");
      const emitterRotationControl = takeControlBySelector("#directionXWheel");
      const emissionDirectionControl = takeControlBySelector("#emissionDirection");
      const emissionAngleControl = takeControlBySelector("#coneAngle");
      const particleVelocityControl = takeControlBySelector("#initialSpeed");
      const particleSpinControl = takeControlBySelector("#spinRate2d") || takeControlBySelector("#spinRateX");

      const emitterGroups = [];
      const shapeNodes = [emitterShapeControl, emitterSizeControl, emitFromControl].filter(Boolean);
      if (shapeNodes.length) emitterGroups.push(makeGroup("emitterShapeGroup", "Emitter Shape", shapeNodes));
      if (emissionRateControl) emitterGroups.push(makeGroup("emissionRateGroup", "Emission Rate", [emissionRateControl]));
      if (emitterPosControl) emitterGroups.push(makeGroup("emitterPositionGroup", "Emitter Position", [emitterPosControl]));
      if (emitterRotationControl) emitterGroups.push(makeGroup("emitterRotationGroup", "Emitter Rotation", [emitterRotationControl]));
      if (emissionDirectionControl) emitterGroups.push(makeGroup("emissionDirectionGroup", "Emission Direction", [emissionDirectionControl]));
      if (emissionAngleControl) emitterGroups.push(makeGroup("emissionAngleGroup", "Emission Angle", [emissionAngleControl]));
      if (particleVelocityControl) emitterGroups.push(makeGroup("particleVelocityGroup", "Particle Velocity", [particleVelocityControl]));
      if (particleSpinControl) emitterGroups.push(makeGroup("particleSpinGroup", "Particle Spin", [particleSpinControl]));

      for (const ctrl of [
        emitterShapeControl,
        emitterSizeControl,
        emitFromControl,
        emissionRateControl,
        emitterPosControl,
        emitterRotationControl,
        emissionDirectionControl,
        emissionAngleControl,
        particleVelocityControl,
        particleSpinControl,
      ]) {
        if (ctrl && ctrl.parentElement === emitterContainer) ctrl.remove();
      }

      // Remove empty wrapper stacks if they exist (prevents blank gaps).
      const maybeRemoveIfEmpty = (id) => {
        const el = emitterContainer.querySelector(`#${id}`);
        if (el && el.children.length === 0) el.remove();
      };
      maybeRemoveIfEmpty("emitterShapeControls");

      for (let i = emitterGroups.length - 1; i >= 0; i--) {
        emitterContainer.insertBefore(emitterGroups[i], emitterContainer.firstChild);
      }
    }
  }

  // Forces panel: collapsible groups for Gravity / Wind / Drag.
  const forcesPanel = document.querySelector('.panel[data-panel="forces"]');
  if (forcesPanel) {
    const forcesContainer = forcesPanel.querySelector("#forcesControls");
    if (forcesContainer) {
      const makeGroup = (id, titleText, nodes) => {
        const setting = document.createElement("div");
        setting.className = "control setting";
        setting.id = id;

        const label = document.createElement("label");
        const left = document.createElement("span");
        left.className = "label-left";

        const collapseBtn = document.createElement("button");
        collapseBtn.type = "button";
        collapseBtn.className = "collapse-indicator";
        const collapseIcon = document.createElement("span");
        collapseIcon.textContent = "+";
        collapseBtn.appendChild(collapseIcon);

        left.appendChild(collapseBtn);
        left.appendChild(document.createTextNode(titleText));
        label.appendChild(left);

        const body = document.createElement("div");
        body.className = "control-body";
        for (const n of nodes) body.appendChild(n);

        setting.appendChild(label);
        setting.appendChild(body);
        return setting;
      };

      const takeControlBySelector = (selector) => {
        const el = forcesContainer.querySelector(selector);
        if (!el) return null;
        return el.closest(".control");
      };

      const wrapControlAsGroup = (groupId, titleText, controlEl) => {
        if (!controlEl) return;
        const placeholder = document.createComment("setting-placeholder");
        const parent = controlEl.parentElement;
        if (!parent) return;
        parent.insertBefore(placeholder, controlEl);
        const group = makeGroup(groupId, titleText, [controlEl]);
        placeholder.replaceWith(group);
      };

      wrapControlAsGroup("gravityGroup", "Gravity", takeControlBySelector("#gravity"));
      wrapControlAsGroup("windGroup", "Wind", takeControlBySelector("#windX"));
      wrapControlAsGroup("dragGroup", "Drag", takeControlBySelector("#drag"));
    }
  }

  // Shading panel: group-level collapsibles for common lighting controls.
  const shadingPanel = document.querySelector('.panel[data-panel="shading"]');
  if (shadingPanel) {
    const shadingContainer = shadingPanel.querySelector("#shadingControls");
    if (shadingContainer) {
      const makeGroup = (id, titleText, nodes) => {
        const setting = document.createElement("div");
        setting.className = "control setting";
        setting.id = id;

        const label = document.createElement("label");
        const left = document.createElement("span");
        left.className = "label-left";

        const collapseBtn = document.createElement("button");
        collapseBtn.type = "button";
        collapseBtn.className = "collapse-indicator";
        const collapseIcon = document.createElement("span");
        collapseIcon.textContent = "+";
        collapseBtn.appendChild(collapseIcon);

        left.appendChild(collapseBtn);
        left.appendChild(document.createTextNode(titleText));
        label.appendChild(left);

        const body = document.createElement("div");
        body.className = "control-body";
        for (const n of nodes) body.appendChild(n);

        setting.appendChild(label);
        setting.appendChild(body);
        return setting;
      };

      const takeControlBySelector = (selector) => {
        const el = shadingContainer.querySelector(selector);
        if (!el) return null;
        return el.closest(".control");
      };

      const wrapControlAsGroup = (groupId, titleText, controlEl) => {
        if (!controlEl) return;
        const placeholder = document.createComment("setting-placeholder");
        const parent = controlEl.parentElement;
        if (!parent) return;
        parent.insertBefore(placeholder, controlEl);
        const group = makeGroup(groupId, titleText, [controlEl]);
        placeholder.replaceWith(group);
      };

      wrapControlAsGroup("lightPositionGroup", "Light Position", takeControlBySelector("#lightPosX"));
      wrapControlAsGroup("lightColorGroup", "Light Color", takeControlBySelector("#baseColor"));
      wrapControlAsGroup("lightIntensityGroup", "Light Intensity", takeControlBySelector("#lightIntensity"));
      wrapControlAsGroup("shadingStyleGroup", "Shading Style", takeControlBySelector("#shadingStyle"));
      wrapControlAsGroup("rimLightingGroup", "Rim Lighting", takeControlBySelector("#rimIntensity"));
      wrapControlAsGroup("specularGroup", "Specular", takeControlBySelector("#specIntensity"));
    }
  }

  // Camera panel: group-level collapsibles for position/rotation/DOF.
  const cameraPanel = document.querySelector('.panel[data-panel="camera"]');
  if (cameraPanel) {
    const cameraContainer = cameraPanel.querySelector("#dofControls");
    if (cameraContainer) {
      const makeGroup = (id, titleText, nodes) => {
        const setting = document.createElement("div");
        setting.className = "control setting";
        setting.id = id;

        const label = document.createElement("label");
        const left = document.createElement("span");
        left.className = "label-left";

        const collapseBtn = document.createElement("button");
        collapseBtn.type = "button";
        collapseBtn.className = "collapse-indicator";
        const collapseIcon = document.createElement("span");
        collapseIcon.textContent = "+";
        collapseBtn.appendChild(collapseIcon);

        left.appendChild(collapseBtn);
        left.appendChild(document.createTextNode(titleText));
        label.appendChild(left);

        const body = document.createElement("div");
        body.className = "control-body";
        for (const n of nodes) body.appendChild(n);

        setting.appendChild(label);
        setting.appendChild(body);
        return setting;
      };

      const takeControlBySelector = (selector) => {
        const el = cameraContainer.querySelector(selector);
        if (!el) return null;
        return el.closest(".control");
      };

      const wrapControlAsGroup = (groupId, titleText, controlEl) => {
        if (!controlEl) return;
        const placeholder = document.createComment("setting-placeholder");
        const parent = controlEl.parentElement;
        if (!parent) return;
        parent.insertBefore(placeholder, controlEl);
        const group = makeGroup(groupId, titleText, [controlEl]);
        placeholder.replaceWith(group);
      };

      wrapControlAsGroup("cameraPositionGroup", "Camera Position", takeControlBySelector("#cameraPosX"));
      wrapControlAsGroup("cameraRotationGroup", "Camera Rotation", takeControlBySelector("#cameraRotXWheel"));
      wrapControlAsGroup("depthOfFieldGroup", "Depth of Field", takeControlBySelector("#focusDepth"));
    }
  }

  // Convert `...Val` spans (for range inputs) into editable numeric fields.
  const settingsRoot = document.querySelector(".settings-panel-container");
  if (!settingsRoot) return;

  const spans = Array.from(settingsRoot.querySelectorAll('span[id$="Val"]'));
  for (const span of spans) {
    const spanId = span.getAttribute("id") || "";
    const baseId = spanId.endsWith("Val") ? spanId.slice(0, -3) : null;
    if (!baseId) continue;

    const input = document.getElementById(baseId);
    if (!(input instanceof HTMLInputElement)) continue;
    if (input.type !== "range") continue;

    // Skip if already converted.
    if (span instanceof HTMLInputElement) continue;

    const step = parseFloat(input.step || "1");
    const min = parseFloat(input.min || "0");
    const max = parseFloat(input.max || "1");

    const field = document.createElement("input");
    field.type = "text";
    field.inputMode = "decimal";
    field.className = "editable-value";
    field.id = spanId;
    field.autocomplete = "off";
    field.spellcheck = false;
    const formatField = (v) => {
      const s = formatWithStep(v, step);
      return s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "").replace(/\.$/, "");
    };
    field.value = formatField(parseFloat(input.value));
    field.dataset.for = baseId;

    span.replaceWith(field);

    const commit = () => {
      const raw = field.value.trim();
      let v = parseFloat(raw);
      if (!Number.isFinite(v)) {
        field.value = formatField(parseFloat(input.value));
        return;
      }
      // Only clamp to minimum (prevent negative values), allow exceeding slider max via text input
      v = Math.max(min, v);
      v = roundToStep(v, step, min);
      input.value = String(v);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
        field.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        field.value = formatField(parseFloat(input.value));
        field.blur();
      }
    });
    field.addEventListener("blur", commit);
    field.addEventListener("focus", () => {
      field.select();
    });
  }
}

// ============================================================================
// UI Synchronization
// ============================================================================

export function syncUIFromState() {
  const setSlider = (id, value, decimals = 0) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(id + "Val");
    if (slider) slider.value = value;
    if (display) {
      const step = slider instanceof HTMLInputElement ? parseFloat(slider.step || "1") : 1;
      const s = decimals > 0 ? Number(value).toFixed(decimals) : formatWithStep(Number(value), step);
      const formatted = s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "").replace(/\.$/, "");
      if (display instanceof HTMLInputElement) display.value = formatted;
      else display.textContent = formatted;
    }
  };

  const setSelect = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };

  const setColor = (id, rgb) => {
    const el = document.getElementById(id);
    const hex = rgbToHex(rgb);
    if (el) el.value = hex;
    const display = document.getElementById(id + "Val");
    if (display) {
      if (display instanceof HTMLInputElement) display.value = hex;
      else display.textContent = hex;
    }
  };

  const setPill = (id, on) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.state = on ? "on" : "off";
    el.textContent = on ? "On" : "Off";
  };

  // Particles
  setSelect("particleShape", state.particle.shape);
  setSlider("softness", state.particle.softness, 2);
  setSlider("sphereDetail", state.particle.sphereSubdivisions);
  setSlider("lifeSeconds", state.particle.lifeSeconds, 1);
  setSlider("lifeRandom", state.particle.lifeRandom, 2);
  setSlider("particleSize", state.particle.size);
  setSlider("sizeRandom", state.particle.sizeRandom, 2);
  setSelect("colorMode", state.particle.colorMode);
  setColor("solidColor", state.particle.solidColor);
  setSelect("blendMode", state.particle.blendMode === "normal" ? "alpha" : state.particle.blendMode);
  setSlider("particleOpacity", state.particle.opacity, 2);

  // Emitter
  setSelect("emitterShape", state.emitter.shape);
  setSlider("emitterSize", state.emitter.size, 2);
  setSelect("emitFrom", state.emitter.emitFrom === "surface" ? "edge" : "volume");
  setSelect(
    "emissionDirection",
    state.emitter.direction === "outward" ? "outwards" : state.emitter.direction === "spherical" ? "bidirectional" : "directional"
  );
  setSlider("emissionRate", state.particle.emissionRate);
  setSlider("emitterPosX", state.emitter.pos[0], 2);
  setSlider("emitterPosY", state.emitter.pos[1], 2);
  setSlider("emitterPosZ", state.emitter.pos[2], 2);
  setPill("emitterGizmo", state.gizmos.emitterEnabled);
  setSlider("coneAngle", state.emitter.coneAngle);
  setSlider("initialSpeed", state.particle.initialSpeed, 2);
  setSlider("speedRandom", state.emitter.speedRandom, 2);
  setSlider("spinRate2d", state.particle.spinRateX, 1);
  setSlider("spinRateX", state.particle.spinRateX, 1);
  setSlider("spinRateY", state.particle.spinRateY, 1);
  setSlider("spinRateZ", state.particle.spinRateZ, 1);
  setSlider("spinRandom", state.particle.spinRandom, 1);

  // Forces
  setPill("noiseEnabled", state.forces.noiseEnabled);
  setSelect("forceMode", state.forces.mode);
  setSlider("turbulence", state.forces.turbulenceStrength, 1);
  setSlider("turbulenceScale", state.forces.turbulenceScale, 1);
  setSlider("curlStrength", state.forces.curlStrength, 1);
  setSlider("curlScale", state.forces.curlScale, 1);
  setSlider("gravity", state.forces.gravity, 2);
  setSlider("windX", state.forces.wind[0], 2);
  setSlider("windY", state.forces.wind[1], 2);
  setSlider("windZ", state.forces.wind[2], 2);
  setSlider("drag", state.forces.drag, 2);
  setPill("groundEnabled", state.forces.groundEnabled);
  setSlider("groundLevel", state.forces.groundLevel, 2);
  setSlider("bounce", state.forces.bounce, 2);

  setPill("vortexEnabled", state.vortex.enabled);
  setSlider("vortexStrength", state.vortex.strength, 1);
  setSlider("vortexRadius", state.vortex.radius, 1);
  setSlider("vortexPosX", state.vortex.pos[0], 2);
  setSlider("vortexPosY", state.vortex.pos[1], 2);
  setSlider("vortexPosZ", state.vortex.pos[2], 2);
  setPill("vortexGizmo", state.gizmos.vortexEnabled);

  setPill("attractorEnabled", state.attractor.enabled);
  setSlider("attractorStrength", state.attractor.strength, 1);
  setSlider("attractorRadius", state.attractor.radius, 1);
  setSlider("attractorPosX", state.attractor.pos[0], 2);
  setSlider("attractorPosY", state.attractor.pos[1], 2);
  setSlider("attractorPosZ", state.attractor.pos[2], 2);
  setPill("attractorGizmo", state.gizmos.attractorEnabled);

  // Shading
  setPill("shadingEnabled", state.shading.enabled);
  setPill("surfaceEnabled", state.shading.surfaceEnabled);
  setPill("wireframeEnabled", state.shading.wireframeEnabled);
  setPill("wireframeSameColor", state.shading.wireframeSameColor);
  setColor("wireframeColor", state.shading.wireframeColor);
  setSlider("lightPosX", state.shading.lightPos[0], 2);
  setSlider("lightPosY", state.shading.lightPos[1], 2);
  setSlider("lightPosZ", state.shading.lightPos[2], 2);
  setPill("lightGizmo", state.gizmos.lightEnabled);
  setColor("baseColor", state.shading.lightColor);
  setSlider("lightIntensity", state.shading.lightIntensity, 1);
  setSelect("shadingStyle", state.shading.style);
  setSlider("rimIntensity", state.shading.rimIntensity, 2);
  setSlider("specIntensity", state.shading.specIntensity, 2);

  // Camera + DOF
  setPill("cameraViewEnabled", state.camera.viewEnabled);
  setSlider("cameraPosX", state.camera.eye[0], 2);
  setSlider("cameraPosY", state.camera.eye[1], 2);
  setSlider("cameraPosZ", state.camera.eye[2], 2);
  setPill("cameraGizmo", state.gizmos.cameraEnabled);
  setSlider("focusDepth", state.dof.depthSlider, 2);
  setSlider("aperture", state.dof.apertureSlider, 2);
  setPill("focusNavigator", state.gizmos.focusNavigatorEnabled);

  // Background
  setSelect("bgMode", state.background.mode);
  setColor("bgSolidColor", state.background.solidColor);
  setSelect("bgLinearDirection", state.background.linearDirection);
  setSlider("bgRadialCenterX", state.background.radialCenter[0], 2);
  setSlider("bgRadialCenterY", state.background.radialCenter[1], 2);

  // Rotation wheels
  setAngleWheelUI("directionXWheel", "directionXDot", "directionXVal", state.emitter.directionRotX);
  setAngleWheelUI("directionYWheel", "directionYDot", "directionYVal", state.emitter.directionRotY);
  setAngleWheelUI("directionZWheel", "directionZDot", "directionZVal", state.emitter.directionRotZ);
  setAngleWheelUI("vortexRotXWheel", "vortexRotXDot", "vortexRotXVal", state.vortex.rotX);
  setAngleWheelUI("vortexRotYWheel", "vortexRotYDot", "vortexRotYVal", state.vortex.rotY);
  setAngleWheelUI("vortexRotZWheel", "vortexRotZDot", "vortexRotZVal", state.vortex.rotZ);
  setAngleWheelUI("cameraRotXWheel", "cameraRotXDot", "cameraRotXVal", state.camera.rotX);
  setAngleWheelUI("cameraRotYWheel", "cameraRotYDot", "cameraRotYVal", state.camera.rotY);
  setAngleWheelUI("cameraRotZWheel", "cameraRotZDot", "cameraRotZVal", state.camera.rotZ);

  // Animation
  setPill("emitterAnimEnabled", state.animation.emitterEnabled);
  setPill("emitterVelocityAffected", state.animation.emitterVelocityAffected);
  setSlider("emitterVelocityAmount", state.animation.emitterVelocityAmount, 1);
  setPill("emitterAnimX", state.animation.emitterX.enabled);
  setPill("emitterAnimY", state.animation.emitterY.enabled);
  setPill("emitterAnimZ", state.animation.emitterZ.enabled);
  setSlider("emitterAnimXSpeed", state.animation.emitterX.speed, 1);
  setSlider("emitterAnimYSpeed", state.animation.emitterY.speed, 1);
  setSlider("emitterAnimZSpeed", state.animation.emitterZ.speed, 1);
  setSelect("emitterAnimXType", state.animation.emitterX.type);
  setSelect("emitterAnimYType", state.animation.emitterY.type);
  setSelect("emitterAnimZType", state.animation.emitterZ.type);

  setPill("vortexAnimEnabled", state.animation.vortexEnabled);
  setPill("vortexAnimX", state.animation.vortexX.enabled);
  setPill("vortexAnimY", state.animation.vortexY.enabled);
  setPill("vortexAnimZ", state.animation.vortexZ.enabled);
  setSlider("vortexAnimXSpeed", state.animation.vortexX.speed, 1);
  setSlider("vortexAnimYSpeed", state.animation.vortexY.speed, 1);
  setSlider("vortexAnimZSpeed", state.animation.vortexZ.speed, 1);
  setSelect("vortexAnimXType", state.animation.vortexX.type);
  setSelect("vortexAnimYType", state.animation.vortexY.type);
  setSelect("vortexAnimZType", state.animation.vortexZ.type);

  setPill("attractorAnimEnabled", state.animation.attractorEnabled);
  setPill("attractorAnimX", state.animation.attractorX.enabled);
  setPill("attractorAnimY", state.animation.attractorY.enabled);
  setPill("attractorAnimZ", state.animation.attractorZ.enabled);
  setSlider("attractorAnimXSpeed", state.animation.attractorX.speed, 1);
  setSlider("attractorAnimYSpeed", state.animation.attractorY.speed, 1);
  setSlider("attractorAnimZSpeed", state.animation.attractorZ.speed, 1);
  setSelect("attractorAnimXType", state.animation.attractorX.type);
  setSelect("attractorAnimYType", state.animation.attractorY.type);
  setSelect("attractorAnimZType", state.animation.attractorZ.type);

  updateShapeVisibility();
  updateColorModeVisibility();
  updateDirectionVisibility();
  updateNoiseVisibility();
  updateForceModeVisibility();
  updateVortexVisibility();
  updateAttractorVisibility();
  updateGroundVisibility();
  updateCameraViewDependencies();
  updateShadingVisibility();
  updateWireframeVisibility();
  updateBackgroundVisibility();
}

// ============================================================================
// Visibility Toggles
// ============================================================================

function setDisplay(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? "" : "none";
}

function normalizeDegrees(deg) {
  if (!Number.isFinite(deg)) return 0;
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function setAngleWheelUI(wheelId, dotId, valueId, degrees) {
  const wheel = document.getElementById(wheelId);
  const dot = document.getElementById(dotId);
  const valueEl = document.getElementById(valueId);
  if (!wheel || !dot) return;

  const deg = normalizeDegrees(degrees);
  if (valueEl) valueEl.textContent = `${Math.round(deg)}°`;

  const rect = wheel.getBoundingClientRect();
  // If the wheel isn't laid out yet (e.g., inside a collapsed group), don't
  // stomp the CSS default dot position (which is at 12 o'clock).
  if (rect.width < 2 || rect.height < 2) return;

  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const r = Math.max(0, Math.min(cx, cy) - 6);
  const theta = ((deg - 90) * Math.PI) / 180;
  dot.style.left = `${cx + Math.cos(theta) * r}px`;
  dot.style.top = `${cy + Math.sin(theta) * r}px`;
}

function setupAngleWheel({ wheelId, dotId, valueId, resetBtnId, getDegrees, setDegrees }) {
  const wheel = document.getElementById(wheelId);
  if (!wheel) return;

  const applyFromState = () => {
    setAngleWheelUI(wheelId, dotId, valueId, getDegrees());
  };

  // Ensure initial dot placement happens after layout and whenever the wheel
  // becomes visible (e.g., expanding a collapsible group).
  {
    let tries = 0;
    const tryApply = () => {
      applyFromState();
      tries += 1;
      const rect = wheel.getBoundingClientRect();
      if ((rect.width < 2 || rect.height < 2) && tries < 8) {
        requestAnimationFrame(tryApply);
      }
    };
    requestAnimationFrame(tryApply);

    if (!wheel.dataset.angleWheelObserved && typeof ResizeObserver !== "undefined") {
      wheel.dataset.angleWheelObserved = "1";
      const ro = new ResizeObserver(() => applyFromState());
      ro.observe(wheel);
    }
  }

  const setFromPointerEvent = (e) => {
    const rect = wheel.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const raw = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180 (0 at right)
    const deg = normalizeDegrees(raw + 90); // 0 at top
    setDegrees(deg);
    setAngleWheelUI(wheelId, dotId, valueId, deg);
  };

  wheel.addEventListener("pointerdown", (e) => {
    wheel.setPointerCapture(e.pointerId);
    setFromPointerEvent(e);
  });
  wheel.addEventListener("pointermove", (e) => {
    if (!wheel.hasPointerCapture(e.pointerId)) return;
    setFromPointerEvent(e);
  });
  wheel.addEventListener("pointerup", (e) => {
    if (!wheel.hasPointerCapture(e.pointerId)) return;
    wheel.releasePointerCapture(e.pointerId);
  });
  wheel.addEventListener("pointercancel", (e) => {
    if (!wheel.hasPointerCapture(e.pointerId)) return;
    wheel.releasePointerCapture(e.pointerId);
  });

  if (resetBtnId) {
    const btn = document.getElementById(resetBtnId);
    if (btn) {
      btn.addEventListener("click", () => {
        setDegrees(0);
        applyFromState();
      });
    }
  }

  applyFromState();
}

function updateShapeVisibility() {
  const isSphere = state.particle.shape === "sphere";
  const is2D = ["circle", "square"].includes(state.particle.shape);
  setDisplay("sphereDetailControl", isSphere);
  setDisplay("softnessControl", is2D);
  setDisplay("spin2dControls", is2D);
  setDisplay("spin3dControls", !is2D);
}

function updateColorModeVisibility() {
  const isSolid = state.particle.colorMode === "solid";
  setDisplay("solidColorControl", isSolid);
  setDisplay("gradientControl", !isSolid);
}

function updateDirectionVisibility() {
  const showCone = state.emitter.direction === "directional";
  const cone = document.getElementById("coneAngle");
  if (!cone) return;
  const coneControl = cone.closest(".control");

  // Keep the group content visible (so expanding the row shows something),
  // but disable the slider when it doesn't apply.
  if (coneControl) coneControl.style.display = "";
  cone.disabled = !showCone;
  if (coneControl) coneControl.style.opacity = showCone ? "" : "0.55";
}

function updateForcesVisibility() {
  const el = document.getElementById("forcesControls");
  if (el) el.classList.remove("hidden-controls");
}

function updateNoiseVisibility() {
  const el = document.getElementById("noiseControls");
  if (el) el.style.display = state.forces.noiseEnabled ? "" : "none";
}

function updateForceModeVisibility() {
  if (!state.forces.noiseEnabled) {
    setDisplay("turbulenceControls", false);
    setDisplay("curlControls", false);
    return;
  }
  const isTurbulence = state.forces.mode === "turbulence";
  setDisplay("turbulenceControls", isTurbulence);
  setDisplay("curlControls", !isTurbulence);
}

function updateVortexVisibility() {
  setDisplay("vortexControls", state.vortex.enabled);
}

function updateAttractorVisibility() {
  setDisplay("attractorControls", state.attractor.enabled);
}

function updateGroundVisibility() {
  setDisplay("groundControls", state.forces.groundEnabled);
}

function updateCameraViewDependencies() {
  setDisplay("depthOfFieldGroup", state.camera.viewEnabled);
}

function updateShadingVisibility() {
  const el = document.getElementById("shadingControls");
  if (el) el.classList.toggle("hidden-controls", !state.shading.enabled);
}

function updateWireframeVisibility() {
  setDisplay("wireframeColorControls", state.shading.wireframeEnabled);
  setDisplay("wireframeColorPicker", state.shading.wireframeEnabled && !state.shading.wireframeSameColor);
}

function updateBackgroundVisibility() {
  const mode = state.background.mode;
  setDisplay("bgSolidControls", mode === "solid");
  setDisplay("bgGradientControls", mode === "linear" || mode === "radial");
  setDisplay("bgLinearControls", mode === "linear");
  setDisplay("bgRadialControls", mode === "radial");
}

// ============================================================================
// Event Listener Setup
// ============================================================================

export function setupEventListeners(callbacks = {}) {
  const setupPill = (id, getter, setter, onChange) => {
    const el = document.getElementById(id);
    if (!el) return;
    const apply = (on) => {
      el.dataset.state = on ? "on" : "off";
      el.textContent = on ? "On" : "Off";
    };
    apply(Boolean(getter()));
    el.addEventListener("click", () => {
      const next = !Boolean(getter());
      setter(next);
      apply(next);
      if (onChange) onChange(next);
    });
  };

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
    const display = document.getElementById(id + "Val");
    if (display) {
      if (display instanceof HTMLInputElement) display.value = el.value;
      else display.textContent = el.value;
    }
    el.addEventListener("input", (e) => {
      const hex = e.target.value;
      setter(hexToRgb(hex));
      if (display) {
        if (display instanceof HTMLInputElement) display.value = hex;
        else display.textContent = hex;
      }
    });

    if (display instanceof HTMLInputElement) {
      const normalizeHex = (s) => {
        if (typeof s !== "string") return null;
        const raw = s.trim();
        const m = raw.match(/^#?[0-9a-fA-F]{6}$/);
        if (!m) return null;
        return raw.startsWith("#") ? raw.toLowerCase() : `#${raw.toLowerCase()}`;
      };

      const commit = () => {
        const normalized = normalizeHex(display.value);
        if (!normalized) {
          display.value = el.value;
          return;
        }
        el.value = normalized;
        setter(hexToRgb(normalized));
        display.value = normalized;
      };

      display.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          commit();
          display.blur();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          display.value = el.value;
          display.blur();
        }
      });
      display.addEventListener("blur", commit);
    }
  };
  
  // Helper to setup buttons
  const setupButton = (id, callback) => {
    const el = document.getElementById(id);
    if (el && callback) el.addEventListener("click", callback);
  };

  // Sidebar panel switching
  const sidebarButtons = document.querySelectorAll(".sidebar-btn");
  const panelGroups = document.querySelectorAll(".panel");
  const settingsContainer = document.querySelector(".settings-panel-container");

  const setSettingsOpen = (open) => {
    if (!settingsContainer) return;
    settingsContainer.style.display = open ? "" : "none";
    if (!open) {
      sidebarButtons.forEach((b) => b.classList.remove("active"));
      panelGroups.forEach((p) => p.classList.remove("active"));
    }
  };

  const isSettingsOpen = () => {
    if (!settingsContainer) return true;
    return settingsContainer.style.display !== "none";
  };

  const setActivePanel = (panelKey) => {
    if (!panelKey) return;
    sidebarButtons.forEach((b) => b.classList.toggle("active", b.dataset.panel === panelKey));
    panelGroups.forEach((p) => p.classList.toggle("active", p.dataset.panel === panelKey));
  };

  sidebarButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const panelKey = btn.dataset.panel;
      if (!panelKey) return;

      // Clicking the active panel button toggles settings closed.
      if (btn.classList.contains("active") && isSettingsOpen()) {
        setSettingsOpen(false);
        return;
      }

      // Otherwise open settings and switch to the requested panel.
      setSettingsOpen(true);
      setActivePanel(panelKey);
    });
  });

  // Default to the first panel if none are active yet
  if (!document.querySelector(".sidebar-btn.active")) {
    const first = Array.from(sidebarButtons).find((b) => b.dataset.panel);
    if (first) {
      setSettingsOpen(true);
      setActivePanel(first.dataset.panel);
    }
  } else {
    const active = document.querySelector(".sidebar-btn.active");
    setSettingsOpen(true);
    setActivePanel(active?.dataset?.panel);
  }

  // Collapsible settings (the +/- buttons)
  document.addEventListener("click", (e) => {
    const toggle = e.target.closest(".collapse-indicator");
    if (!toggle) return;

    const setting = toggle.closest(".setting");
    if (!setting) return;

    e.preventDefault();
    e.stopPropagation();

    const willExpand = !setting.classList.contains("expanded");

    // Collapse siblings in the same group for predictable UI behavior
    const parent = setting.parentElement;
    if (parent) {
      for (const child of Array.from(parent.children)) {
        if (child !== setting && child.classList?.contains("setting")) {
          child.classList.remove("expanded");
          const span = child.querySelector(".collapse-indicator span");
          if (span) span.textContent = "+";
        }
      }
    }

    setting.classList.toggle("expanded", willExpand);
    const indicatorSpan = setting.querySelector(".collapse-indicator span");
    if (indicatorSpan) indicatorSpan.textContent = willExpand ? "−" : "+";
  });
  
  // Particle settings
  setupSelect("particleShape", (v) => { state.particle.shape = v; }, updateShapeVisibility);
  setupSlider("softness", (v) => { state.particle.softness = v; }, 2);
  setupSlider("sphereDetail", (v) => { state.particle.sphereSubdivisions = v; });
  setupSlider("lifeSeconds", (v) => { state.particle.lifeSeconds = v; }, 1);
  setupSlider("lifeRandom", (v) => { state.particle.lifeRandom = v; }, 2);
  setupSlider("particleSize", (v) => { state.particle.size = v; });
  setupSlider("sizeRandom", (v) => { state.particle.sizeRandom = v; }, 2);
  setupSelect("colorMode", (v) => { state.particle.colorMode = v; }, updateColorModeVisibility);
  setupColor("solidColor", (v) => { state.particle.solidColor = v; });
  setupSelect("blendMode", (v) => { state.particle.blendMode = v === "alpha" ? "normal" : v; });
  setupSlider("particleOpacity", (v) => { state.particle.opacity = v; }, 2);
  
  // Emitter settings
  setupSelect("emitterShape", (v) => { state.emitter.shape = v; });
  setupSlider("emitterSize", (v) => { state.emitter.size = v; }, 2);
  setupSelect("emitFrom", (v) => { state.emitter.emitFrom = v === "edge" ? "surface" : "volume"; });
  setupSelect("emissionDirection", (v) => {
    state.emitter.direction = v === "outwards" ? "outward" : v === "bidirectional" ? "spherical" : "directional";
  }, updateDirectionVisibility);
  setupSlider("emissionRate", (v) => { state.particle.emissionRate = v; });
  setupSlider("emitterPosX", (v) => { state.emitter.pos[0] = v; }, 2);
  setupSlider("emitterPosY", (v) => { state.emitter.pos[1] = v; }, 2);
  setupSlider("emitterPosZ", (v) => { state.emitter.pos[2] = v; }, 2);
  setupPill("emitterGizmo", () => state.gizmos.emitterEnabled, (v) => { state.gizmos.emitterEnabled = v; });
  setupSlider("coneAngle", (v) => { state.emitter.coneAngle = v; });
  setupSlider("initialSpeed", (v) => { state.particle.initialSpeed = v; }, 2);
  setupSlider("speedRandom", (v) => { state.emitter.speedRandom = v; }, 2);
  setupSlider("spinRate2d", (v) => { state.particle.spinRateX = v; state.particle.spinRateY = v; state.particle.spinRateZ = v; }, 1);
  setupSlider("spinRateX", (v) => { state.particle.spinRateX = v; }, 1);
  setupSlider("spinRateY", (v) => { state.particle.spinRateY = v; }, 1);
  setupSlider("spinRateZ", (v) => { state.particle.spinRateZ = v; }, 1);
  setupSlider("spinRandom", (v) => { state.particle.spinRandom = v; }, 1);
  
  updateForcesVisibility();

  // Noise
  setupPill("noiseEnabled", () => state.forces.noiseEnabled, (v) => { state.forces.noiseEnabled = v; }, () => {
    updateNoiseVisibility();
    updateForceModeVisibility();
  });
  setupSelect("forceMode", (v) => { state.forces.mode = v; }, updateForceModeVisibility);
  setupSlider("turbulence", (v) => { state.forces.turbulenceStrength = v; }, 1);
  setupSlider("turbulenceScale", (v) => { state.forces.turbulenceScale = v; }, 1);
  setupSlider("curlStrength", (v) => { state.forces.curlStrength = v; }, 1);
  setupSlider("curlScale", (v) => { state.forces.curlScale = v; }, 1);
  setupSlider("gravity", (v) => { state.forces.gravity = v; }, 2);
  setupSlider("windX", (v) => { state.forces.wind[0] = v; }, 2);
  setupSlider("windY", (v) => { state.forces.wind[1] = v; }, 2);
  setupSlider("windZ", (v) => { state.forces.wind[2] = v; }, 2);
  setupSlider("drag", (v) => { state.forces.drag = v; }, 2);
  setupPill("groundEnabled", () => state.forces.groundEnabled, (v) => { state.forces.groundEnabled = v; }, () => updateGroundVisibility());
  setupSlider("groundLevel", (v) => { state.forces.groundLevel = v; }, 2);
  setupSlider("bounce", (v) => { state.forces.bounce = v; }, 2);
  
  // Vortex
  setupPill("vortexEnabled", () => state.vortex.enabled, (v) => { state.vortex.enabled = v; }, () => updateVortexVisibility());
  setupSlider("vortexStrength", (v) => { state.vortex.strength = v; }, 1);
  setupSlider("vortexRadius", (v) => { state.vortex.radius = v; }, 1);
  setupSlider("vortexPosX", (v) => { state.vortex.pos[0] = v; }, 2);
  setupSlider("vortexPosY", (v) => { state.vortex.pos[1] = v; }, 2);
  setupSlider("vortexPosZ", (v) => { state.vortex.pos[2] = v; }, 2);
  setupPill("vortexGizmo", () => state.gizmos.vortexEnabled, (v) => { state.gizmos.vortexEnabled = v; });
  
  // Attractor
  setupPill("attractorEnabled", () => state.attractor.enabled, (v) => { state.attractor.enabled = v; }, () => updateAttractorVisibility());
  setupSlider("attractorStrength", (v) => { state.attractor.strength = v; }, 1);
  setupSlider("attractorRadius", (v) => { state.attractor.radius = v; }, 1);
  setupSlider("attractorPosX", (v) => { state.attractor.pos[0] = v; }, 2);
  setupSlider("attractorPosY", (v) => { state.attractor.pos[1] = v; }, 2);
  setupSlider("attractorPosZ", (v) => { state.attractor.pos[2] = v; }, 2);
  setupPill("attractorGizmo", () => state.gizmos.attractorEnabled, (v) => { state.gizmos.attractorEnabled = v; });
  
  // Shading
  setupPill("shadingEnabled", () => state.shading.enabled, (v) => { state.shading.enabled = v; }, () => updateShadingVisibility());
  setupPill("surfaceEnabled", () => state.shading.surfaceEnabled, (v) => { state.shading.surfaceEnabled = v; });
  setupPill("wireframeEnabled", () => state.shading.wireframeEnabled, (v) => { state.shading.wireframeEnabled = v; }, () => updateWireframeVisibility());
  setupPill("wireframeSameColor", () => state.shading.wireframeSameColor, (v) => { state.shading.wireframeSameColor = v; }, () => updateWireframeVisibility());
  setupColor("wireframeColor", (v) => { state.shading.wireframeColor = v; });
  setupSlider("lightPosX", (v) => { state.shading.lightPos[0] = v; }, 2);
  setupSlider("lightPosY", (v) => { state.shading.lightPos[1] = v; }, 2);
  setupSlider("lightPosZ", (v) => { state.shading.lightPos[2] = v; }, 2);
  setupPill("lightGizmo", () => state.gizmos.lightEnabled, (v) => { state.gizmos.lightEnabled = v; });
  setupColor("baseColor", (v) => { state.shading.lightColor = v; });
  setupSlider("lightIntensity", (v) => { state.shading.lightIntensity = v; }, 1);
  setupSelect("shadingStyle", (v) => { state.shading.style = v; });
  setupSlider("rimIntensity", (v) => { state.shading.rimIntensity = v; }, 2);
  setupSlider("specIntensity", (v) => { state.shading.specIntensity = v; }, 2);

  // Camera + DOF
  setupPill("cameraViewEnabled", () => state.camera.viewEnabled, (v) => { state.camera.viewEnabled = v; }, () => updateCameraViewDependencies());
  setupSlider("cameraPosX", (v) => { state.camera.eye[0] = v; }, 2);
  setupSlider("cameraPosY", (v) => { state.camera.eye[1] = v; }, 2);
  setupSlider("cameraPosZ", (v) => { state.camera.eye[2] = v; }, 2);
  setupPill("cameraGizmo", () => state.gizmos.cameraEnabled, (v) => { state.gizmos.cameraEnabled = v; });
  setupSlider("focusDepth", (v) => { state.dof.depthSlider = v; }, 2);
  setupSlider("aperture", (v) => { state.dof.apertureSlider = v; }, 2);
  setupPill("focusNavigator", () => state.gizmos.focusNavigatorEnabled, (v) => { state.gizmos.focusNavigatorEnabled = v; });
  
  // Background
  setupSelect("bgMode", (v) => { state.background.mode = v; }, updateBackgroundVisibility);
  setupColor("bgSolidColor", (v) => { state.background.solidColor = v; });
  setupSelect("bgLinearDirection", (v) => { state.background.linearDirection = v; });
  setupSlider("bgRadialCenterX", (v) => { state.background.radialCenter[0] = v; }, 2);
  setupSlider("bgRadialCenterY", (v) => { state.background.radialCenter[1] = v; }, 2);

  // Animation
  setupPill("emitterAnimEnabled", () => state.animation.emitterEnabled, (v) => { state.animation.emitterEnabled = v; });
  setupPill("emitterVelocityAffected", () => state.animation.emitterVelocityAffected, (v) => { state.animation.emitterVelocityAffected = v; });
  setupSlider("emitterVelocityAmount", (v) => { state.animation.emitterVelocityAmount = v; }, 1);
  setupPill("emitterAnimX", () => state.animation.emitterX.enabled, (v) => { state.animation.emitterX.enabled = v; });
  setupPill("emitterAnimY", () => state.animation.emitterY.enabled, (v) => { state.animation.emitterY.enabled = v; });
  setupPill("emitterAnimZ", () => state.animation.emitterZ.enabled, (v) => { state.animation.emitterZ.enabled = v; });
  setupSlider("emitterAnimXSpeed", (v) => { state.animation.emitterX.speed = v; }, 1);
  setupSlider("emitterAnimYSpeed", (v) => { state.animation.emitterY.speed = v; }, 1);
  setupSlider("emitterAnimZSpeed", (v) => { state.animation.emitterZ.speed = v; }, 1);
  setupSelect("emitterAnimXType", (v) => { state.animation.emitterX.type = v; });
  setupSelect("emitterAnimYType", (v) => { state.animation.emitterY.type = v; });
  setupSelect("emitterAnimZType", (v) => { state.animation.emitterZ.type = v; });

  setupPill("vortexAnimEnabled", () => state.animation.vortexEnabled, (v) => { state.animation.vortexEnabled = v; });
  setupPill("vortexAnimX", () => state.animation.vortexX.enabled, (v) => { state.animation.vortexX.enabled = v; });
  setupPill("vortexAnimY", () => state.animation.vortexY.enabled, (v) => { state.animation.vortexY.enabled = v; });
  setupPill("vortexAnimZ", () => state.animation.vortexZ.enabled, (v) => { state.animation.vortexZ.enabled = v; });
  setupSlider("vortexAnimXSpeed", (v) => { state.animation.vortexX.speed = v; }, 1);
  setupSlider("vortexAnimYSpeed", (v) => { state.animation.vortexY.speed = v; }, 1);
  setupSlider("vortexAnimZSpeed", (v) => { state.animation.vortexZ.speed = v; }, 1);
  setupSelect("vortexAnimXType", (v) => { state.animation.vortexX.type = v; });
  setupSelect("vortexAnimYType", (v) => { state.animation.vortexY.type = v; });
  setupSelect("vortexAnimZType", (v) => { state.animation.vortexZ.type = v; });

  setupPill("attractorAnimEnabled", () => state.animation.attractorEnabled, (v) => { state.animation.attractorEnabled = v; });
  setupPill("attractorAnimX", () => state.animation.attractorX.enabled, (v) => { state.animation.attractorX.enabled = v; });
  setupPill("attractorAnimY", () => state.animation.attractorY.enabled, (v) => { state.animation.attractorY.enabled = v; });
  setupPill("attractorAnimZ", () => state.animation.attractorZ.enabled, (v) => { state.animation.attractorZ.enabled = v; });
  setupSlider("attractorAnimXSpeed", (v) => { state.animation.attractorX.speed = v; }, 1);
  setupSlider("attractorAnimYSpeed", (v) => { state.animation.attractorY.speed = v; }, 1);
  setupSlider("attractorAnimZSpeed", (v) => { state.animation.attractorZ.speed = v; }, 1);
  setupSelect("attractorAnimXType", (v) => { state.animation.attractorX.type = v; });
  setupSelect("attractorAnimYType", (v) => { state.animation.attractorY.type = v; });
  setupSelect("attractorAnimZType", (v) => { state.animation.attractorZ.type = v; });
  
  // Export buttons
  setupButton("recordVideoBtn", callbacks.onRecordVideo);
  setupButton("exportHtmlBtn", callbacks.onExportHtml);

  // Slider reset buttons (use input[data-default])
  const resetMap = [
    ["softnessReset", "softness"],
    ["sphereDetailReset", "sphereDetail"],
  ];
  for (const [btnId, inputId] of resetMap) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) continue;
    btn.addEventListener("click", () => {
      const def = input.dataset.default;
      if (def !== undefined) input.value = def;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  // Fullscreen toggle (optional)
  const fullscreenBtn = document.getElementById("fullscreenToggle");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch {
        // Ignore
      }
    });
  }

  // Angle wheels (rotation controls)
  setupAngleWheel({
    wheelId: "directionXWheel",
    dotId: "directionXDot",
    valueId: "directionXVal",
    resetBtnId: "directionXReset",
    getDegrees: () => state.emitter.directionRotX,
    setDegrees: (v) => { state.emitter.directionRotX = v; },
  });
  setupAngleWheel({
    wheelId: "directionYWheel",
    dotId: "directionYDot",
    valueId: "directionYVal",
    resetBtnId: "directionYReset",
    getDegrees: () => state.emitter.directionRotY,
    setDegrees: (v) => { state.emitter.directionRotY = v; },
  });
  setupAngleWheel({
    wheelId: "directionZWheel",
    dotId: "directionZDot",
    valueId: "directionZVal",
    resetBtnId: "directionZReset",
    getDegrees: () => state.emitter.directionRotZ,
    setDegrees: (v) => { state.emitter.directionRotZ = v; },
  });

  setupAngleWheel({
    wheelId: "vortexRotXWheel",
    dotId: "vortexRotXDot",
    valueId: "vortexRotXVal",
    resetBtnId: "vortexRotXReset",
    getDegrees: () => state.vortex.rotX,
    setDegrees: (v) => { state.vortex.rotX = v; },
  });
  setupAngleWheel({
    wheelId: "vortexRotYWheel",
    dotId: "vortexRotYDot",
    valueId: "vortexRotYVal",
    resetBtnId: "vortexRotYReset",
    getDegrees: () => state.vortex.rotY,
    setDegrees: (v) => { state.vortex.rotY = v; },
  });
  setupAngleWheel({
    wheelId: "vortexRotZWheel",
    dotId: "vortexRotZDot",
    valueId: "vortexRotZVal",
    resetBtnId: "vortexRotZReset",
    getDegrees: () => state.vortex.rotZ,
    setDegrees: (v) => { state.vortex.rotZ = v; },
  });

  setupAngleWheel({
    wheelId: "cameraRotXWheel",
    dotId: "cameraRotXDot",
    valueId: "cameraRotXVal",
    resetBtnId: "cameraRotXReset",
    getDegrees: () => state.camera.rotX,
    setDegrees: (v) => { state.camera.rotX = v; },
  });
  setupAngleWheel({
    wheelId: "cameraRotYWheel",
    dotId: "cameraRotYDot",
    valueId: "cameraRotYVal",
    resetBtnId: "cameraRotYReset",
    getDegrees: () => state.camera.rotY,
    setDegrees: (v) => { state.camera.rotY = v; },
  });
  setupAngleWheel({
    wheelId: "cameraRotZWheel",
    dotId: "cameraRotZDot",
    valueId: "cameraRotZVal",
    resetBtnId: "cameraRotZReset",
    getDegrees: () => state.camera.rotZ,
    setDegrees: (v) => { state.camera.rotZ = v; },
  });
}

// ============================================================================
// Slider and Checkbox Helpers
// ============================================================================

function setupSlider(name, setter, decimals = 0) {
  const slider = document.getElementById(name);
  const valueDisplay = document.getElementById(name + "Val");
  if (!slider) return;

  const formatDisplay = (v) => {
    const step = parseFloat(slider.step || "1");
    const s = decimals > 0 ? v.toFixed(decimals) : formatWithStep(v, step);
    return s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "").replace(/\.$/, "");
  };
  
  slider.addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    setter(value);
    if (valueDisplay) {
      const formatted = formatDisplay(value);
      if (valueDisplay instanceof HTMLInputElement) valueDisplay.value = formatted;
      else valueDisplay.textContent = formatted;
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
  const fpsEl = document.getElementById("perfFps");
  const particleEl = document.getElementById("perfParticles");
  const cpuEl = document.getElementById("perfCpu");
  const gpuEl = document.getElementById("perfGpu");
  const modeEl = document.getElementById("perfMode");
  const pmsEl = document.getElementById("perfPms");
  const lowEl = document.getElementById("perfLow");
  const cpuBar = document.getElementById("perfCpuBar");
  const gpuBar = document.getElementById("perfGpuBar");

  if (fpsEl) fpsEl.textContent = Number.isFinite(fps) ? fps.toFixed(0) : "--";
  if (particleEl) particleEl.textContent = String(particleCount ?? 0);
  if (modeEl) modeEl.textContent = state.perf.hudMode === "gpu" ? "gpu" : "basic";
  if (lowEl) lowEl.textContent = state.perf.lowCostRender ? "on" : "off";

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const barColorCpu = (t) => (t < 0.55 ? "#22c55e" : t < 0.85 ? "#f59e0b" : "#ef4444");
  const barColorGpu = (t) => (t < 0.7 ? "#22c55e" : t < 1.0 ? "#f59e0b" : "#ef4444");

  // Normalize against 60 FPS frame budget
  const budgetMs = 1000 / 60;
  const cpuT = clamp01(cpuMs / budgetMs);

  if (cpuEl) cpuEl.textContent = Number.isFinite(cpuMs) ? `${cpuMs.toFixed(1)}ms` : "--";
  if (cpuBar) {
    cpuBar.style.width = `${Math.max(2, cpuT * 100)}%`;
    cpuBar.style.backgroundColor = barColorCpu(cpuT);
  }

  const gpuBase = state.perf.hudMode === "gpu" ? (state.perf.gpuEmaMs || gpuMs) : gpuMs;
  const gpuKnown = gpuBase !== null && gpuBase !== undefined && Number.isFinite(gpuBase) && gpuBase > 0;
  const gpuT = clamp01((gpuKnown ? gpuBase : 0) / budgetMs);
  if (gpuEl) {
    if (gpuKnown) {
      const prefix = state.perf.gpuMsEstimated ? "~" : "";
      gpuEl.textContent = `${prefix}${gpuBase.toFixed(1)}ms`;
    } else if (typeof state.perf.gpuLabel === "string" && state.perf.gpuLabel.trim()) {
      const label = state.perf.gpuLabel.trim();
      gpuEl.textContent = label.length > 14 ? `${label.slice(0, 13)}…` : label;
    } else {
      gpuEl.textContent = "--";
    }
  }
  if (gpuBar) {
    gpuBar.style.width = `${Math.max(2, (gpuKnown ? gpuT : 0) * 100)}%`;
    gpuBar.style.backgroundColor = gpuKnown ? barColorGpu(gpuT) : "rgba(255,255,255,0.25)";
  }

  if (pmsEl) {
    if (gpuKnown) {
      const denom = Math.max(0.1, gpuBase);
      const v = (particleCount ?? 0) / denom;
      pmsEl.textContent = v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2);
    } else {
      pmsEl.textContent = "--";
    }
  }
}

export function setPerfHudVisible(visible) {
  const hud = document.getElementById("perfHud");
  if (!hud) return;
  hud.setAttribute("aria-hidden", visible ? "false" : "true");
  state.perf.hudVisible = Boolean(visible);
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
  let activePointerId = null;

  const toCanvasCoords = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };
  
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
  
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const { x: mx, y: my } = toCanvasCoords(e);

    selectedPoint = getPointAt(mx, my);
    if (selectedPoint >= 0) {
      isDragging = true;
      activePointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener("dblclick", (e) => {
    const { x: mx, y: my } = toCanvasCoords(e);

    const idx = getPointAt(mx, my);
    if (idx >= 0) {
      // Double click a point -> delete (but keep endpoints)
      if (idx > 0 && idx < points.length - 1) {
        points.splice(idx, 1);
        selectedPoint = -1;
        isDragging = false;
        activePointerId = null;
        onChange(points);
        draw();
      }
      return;
    }

    // Double click empty space -> add point
    const x = mx / canvas.width;
    const y = 1 - my / canvas.height;
    points.push({ x: clamp(x, 0, 1), y: clamp(y, 0, 1) });
    points.sort((a, b) => a.x - b.x);
    onChange(points);
    draw();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!isDragging || selectedPoint < 0) return;
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    if (!canvas.hasPointerCapture(e.pointerId)) return;

    const { x: mx, y: my } = toCanvasCoords(e);

    const p = points[selectedPoint];
    if (selectedPoint > 0 && selectedPoint < points.length - 1) {
      p.x = clamp(mx / canvas.width, 0.01, 0.99);
    }
    p.y = clamp(1 - my / canvas.height, 0, 1);

    onChange(points);
    draw();
  });
  
  const endDrag = (e) => {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    isDragging = false;
    activePointerId = null;
  };

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const { x: mx, y: my } = toCanvasCoords(e);
    
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
  let activePointerId = null;
  let didMove = false;
  let dragStart = null;
  let lastTapMs = 0;
  let lastTapIdx = -1;

  const MARKER_HEIGHT = 20;
  const POINT_R = 4;
  const HIT_RADIUS = 8;
  const EPS = 0.001;

  const addBtn = document.querySelector(`[data-gradient="${canvasId}"][data-action="add"]`);
  const removeBtn = document.querySelector(`[data-gradient="${canvasId}"][data-action="remove"]`);

  const colorPicker = document.createElement("input");
  colorPicker.type = "color";
  colorPicker.style.position = "fixed";
  colorPicker.style.width = "24px";
  colorPicker.style.height = "24px";
  colorPicker.style.border = "none";
  colorPicker.style.padding = "0";
  colorPicker.style.visibility = "hidden";
  document.body.appendChild(colorPicker);

  const cleanup = () => {
    if (colorPicker.parentElement) colorPicker.parentElement.removeChild(colorPicker);
  };
  window.addEventListener("beforeunload", cleanup, { once: true });

  const toCanvasCoords = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };
  
  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? rect.width / w : 1;
    const scaleY = rect.height > 0 ? rect.height / h : 1;
    
    // Draw gradient
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    for (const p of points) {
      gradient.addColorStop(p.x, rgbToHex(p.color));
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h - MARKER_HEIGHT);
    
    // Draw markers
    ctx.fillStyle = "#222";
    ctx.fillRect(0, h - MARKER_HEIGHT, w, MARKER_HEIGHT);
    
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const px = p.x * w;
      
      const cy = h - MARKER_HEIGHT / 2;
      ctx.beginPath();
      if (Math.abs(scaleX - scaleY) < 0.01) {
        ctx.arc(px, cy, POINT_R, 0, Math.PI * 2);
      } else {
        // Compensate for non-uniform CSS scaling so points look circular on screen.
        const ry = POINT_R * (scaleX / (scaleY || 1));
        ctx.ellipse(px, cy, POINT_R, ry, 0, 0, Math.PI * 2);
      }
      ctx.fillStyle = rgbToHex(p.color);
      ctx.fill();
      ctx.strokeStyle = i === selectedPoint ? "#7dd3fc" : "#fff";
      ctx.lineWidth = i === selectedPoint ? 2 : 1;
      ctx.stroke();
    }
    updateButtons();
  }
  
  function getPointAt(mx, my) {
    for (let i = 0; i < points.length; i++) {
      const px = points[i].x * canvas.width;
      if (Math.abs(mx - px) < HIT_RADIUS) return i;
    }
    return -1;
  }

  function updateButtons() {
    if (removeBtn instanceof HTMLButtonElement) {
      const canDelete = selectedPoint > 0 && selectedPoint < points.length - 1 && points.length > 2;
      removeBtn.disabled = !canDelete;
    }
  }

  let activeColorIdx = -1;
  
  colorPicker.addEventListener("input", (e) => {
    if (activeColorIdx >= 0 && activeColorIdx < points.length) {
      points[activeColorIdx].color = hexToRgb(e.target.value);
      onChange(points);
      draw();
    }
  });
  
  colorPicker.addEventListener("change", (e) => {
    if (activeColorIdx >= 0 && activeColorIdx < points.length) {
      points[activeColorIdx].color = hexToRgb(e.target.value);
      onChange(points);
      draw();
    }
  });

  function openColorChooser(idx, clickX, clickY) {
    if (idx < 0 || idx >= points.length) return;
    activeColorIdx = idx;
    colorPicker.value = rgbToHex(points[idx].color);

    // Position near the click, offset so picker opens over the panel
    const x = clickX ?? 100;
    const y = clickY ?? 100;
    colorPicker.style.left = `${x - 12}px`;
    colorPicker.style.top = `${y - 12}px`;
    
    // Make visible so browser positions picker correctly, then hide after opening
    colorPicker.style.visibility = "visible";
    
    // Open the picker
    try {
      if (typeof colorPicker.showPicker === "function") {
        colorPicker.showPicker();
      } else {
        colorPicker.click();
      }
    } catch (err) {
      colorPicker.click();
    }
    
    // Hide the input element after a brief moment (picker stays open)
    setTimeout(() => {
      colorPicker.style.visibility = "hidden";
    }, 50);
  }

  function addPoint() {
    const idx = selectedPoint;
    let x;

    if (idx >= 0) {
      const left = idx === points.length - 1 ? points[idx - 1].x : points[idx].x;
      const right = idx === points.length - 1 ? points[idx].x : points[idx + 1].x;
      x = clamp((left + right) * 0.5, 0, 1);
    } else {
      x = 0.5;
    }

    const color = evalGradient(points, x);
    points.push({ x: clamp(x, 0, 1), color });
    points.sort((a, b) => a.x - b.x);
    selectedPoint = points.reduce((bestIdx, p, i) => (Math.abs(p.x - x) < Math.abs(points[bestIdx].x - x) ? i : bestIdx), 0);
    onChange(points);
    draw();
  }

  function removeSelected() {
    if (!(selectedPoint > 0 && selectedPoint < points.length - 1)) return;
    if (points.length <= 2) return;
    points.splice(selectedPoint, 1);
    selectedPoint = Math.max(0, Math.min(selectedPoint - 1, points.length - 1));
    onChange(points);
    draw();
  }

  if (addBtn) addBtn.addEventListener("click", addPoint);
  if (removeBtn) removeBtn.addEventListener("click", removeSelected);
  
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const { x: mx, y: my } = toCanvasCoords(e);
    
    selectedPoint = getPointAt(mx, my);
    if (selectedPoint >= 0) {
      const nowMs = performance.now();
      const isDoubleTap = nowMs - lastTapMs < 350 && selectedPoint === lastTapIdx;
      lastTapMs = nowMs;
      lastTapIdx = selectedPoint;

      if (isDoubleTap) {
        openColorChooser(selectedPoint, e.clientX, e.clientY);
        draw();
        return;
      }

      isDragging = true;
      activePointerId = e.pointerId;
      didMove = false;
      dragStart = { x: mx, y: my };
      canvas.setPointerCapture(e.pointerId);
      draw();
    } else if (my >= canvas.height - (MARKER_HEIGHT + 5) && e.detail === 2) {
      // Double click - add point
      const x = mx / canvas.width;
      const color = evalGradient(points, x);
      points.push({ x: clamp(x, 0, 1), color });
      points.sort((a, b) => a.x - b.x);
      onChange(points);
      draw();
    }
  });
  
  canvas.addEventListener("pointermove", (e) => {
    if (!isDragging || selectedPoint < 0) return;
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    if (!canvas.hasPointerCapture(e.pointerId)) return;

    const { x: mx } = toCanvasCoords(e);

    if (dragStart && Math.abs(mx - dragStart.x) > 2) didMove = true;
    
    const leftBound = selectedPoint === 0 ? 0 : Math.min(1, points[selectedPoint - 1].x + EPS);
    const rightBound = selectedPoint === points.length - 1 ? 1 : Math.max(0, points[selectedPoint + 1].x - EPS);
    points[selectedPoint].x = clamp(mx / canvas.width, leftBound, rightBound);
    
    onChange(points);
    draw();
  });
  
  const endDrag = (e) => {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    isDragging = false;
    activePointerId = null;
    dragStart = null;
  };

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const { x: mx, y: my } = toCanvasCoords(e);
    
    const idx = getPointAt(mx, my);
    if (idx > 0 && idx < points.length - 1) {
      points.splice(idx, 1);
      selectedPoint = -1;
      onChange(points);
      draw();
    }
  });
  
  // Double-click on a gradient point opens color picker
  canvas.addEventListener("dblclick", (e) => {
    const { x: mx, y: my } = toCanvasCoords(e);
    const idx = getPointAt(mx, my);
    if (idx >= 0) {
      e.preventDefault();
      selectedPoint = idx;
      openColorChooser(idx, e.clientX, e.clientY);
      draw();
    }
  });
  
  draw();
  // Ensure points render as circles even after initial layout (canvas width is CSS-driven).
  requestAnimationFrame(draw);
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
  } else {
    window.addEventListener("resize", draw);
  }
  return {
    draw,
    setPoints: (newPoints) => { points.length = 0; points.push(...newPoints); draw(); },
    addPoint,
    removeSelected,
  };
}
