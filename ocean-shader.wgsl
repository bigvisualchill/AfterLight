// Ocean Shader

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) viewDir: vec3<f32>,
}

struct Uniforms {
    viewProjection: mat4x4<f32>,
    model: mat4x4<f32>,
    cameraPos: vec3<f32>,
    time: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// Simple noise function for wave variation
fn noise(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

// Smooth noise
fn smoothNoise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    var f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    let a = noise(i);
    let b = noise(i + vec2<f32>(1.0, 0.0));
    let c = noise(i + vec2<f32>(0.0, 1.0));
    let d = noise(i + vec2<f32>(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

fn fbm(p: vec2<f32>) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var freq = 1.0;
    for (var i = 0; i < 4; i++) {
        value += smoothNoise(p * freq) * amplitude;
        freq *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// Wave height calculation using multiple directional waves
fn waveHeight(pos: vec2<f32>, time: f32) -> f32 {
    let d1 = normalize(vec2<f32>(1.0, 0.2));
    let d2 = normalize(vec2<f32>(-0.6, 0.8));
    let d3 = normalize(vec2<f32>(0.3, -1.0));
    let d4 = normalize(vec2<f32>(-1.0, -0.2));
    
    let w1 = sin(dot(pos, d1) * 0.12 + time * 0.6) * 0.45;
    let w2 = sin(dot(pos, d2) * 0.18 + time * 0.4) * 0.25;
    let w3 = sin(dot(pos, d3) * 0.07 + time * 0.8) * 0.35;
    let w4 = sin(dot(pos, d4) * 0.25 + time * 0.2) * 0.15;
    let w5 = smoothNoise(pos * 0.08 + time * 0.05) * 0.2;
    
    return w1 + w2 + w3 + w4 + w5;
}

@vertex
fn vs(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Animate vertex position with waves
    let time = uniforms.time;
    let height = waveHeight(input.position.xz, time);
    let worldPos = vec3<f32>(input.position.x, height, input.position.z);
    
    output.worldPos = worldPos;
    output.uv = input.uv;
    output.viewDir = normalize(uniforms.cameraPos - worldPos);
    
    let mvp = uniforms.viewProjection * uniforms.model;
    output.position = mvp * vec4<f32>(worldPos, 1.0);
    
    return output;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate normal from wave derivatives
    let eps = 0.2;
    let pos = input.worldPos.xz;
    let time = uniforms.time;
    
    let hL = waveHeight(pos + vec2<f32>(eps, 0.0), time);
    let hR = waveHeight(pos - vec2<f32>(eps, 0.0), time);
    let hD = waveHeight(pos + vec2<f32>(0.0, eps), time);
    let hU = waveHeight(pos - vec2<f32>(0.0, eps), time);
    
    var normal = normalize(vec3<f32>(hL - hR, 2.0 * eps, hD - hU));
    let viewDir = normalize(input.viewDir);

    // Add small-scale ripples to the normal for more realistic detail
    let rippleUv = pos * 0.6 + vec2<f32>(time * 0.15, -time * 0.1);
    let ripple = fbm(rippleUv * 6.0);
    let rippleDx = fbm(rippleUv * 6.0 + vec2<f32>(0.01, 0.0)) - ripple;
    let rippleDy = fbm(rippleUv * 6.0 + vec2<f32>(0.0, 0.01)) - ripple;
    let rippleNormal = normalize(vec3<f32>(-rippleDx * 1.5, 1.0, -rippleDy * 1.5));
    normal = normalize(mix(normal, rippleNormal, 0.35));
    
    // Sunset ocean colors
    let deepBlue = vec3<f32>(0.03, 0.08, 0.16);
    let shallowTeal = vec3<f32>(0.05, 0.18, 0.22);
    let sunsetOrange = vec3<f32>(0.95, 0.55, 0.25);
    let horizonColor = vec3<f32>(0.8, 0.45, 0.25);
    
    // Fresnel effect for water
    let fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 4.0);
    
    // Mix colors based on view angle
    let depthFactor = clamp((input.worldPos.z + 50.0) / 80.0, 0.0, 1.0);
    let baseColor = mix(shallowTeal, deepBlue, depthFactor);
    var finalColor = baseColor;

    // Approximate sky reflection based on view direction
    let skyT = clamp(viewDir.y * 0.5 + 0.5, 0.0, 1.0);
    let skyTop = vec3<f32>(0.08, 0.08, 0.16);
    let skyHorizon = vec3<f32>(0.9, 0.55, 0.28);
    let skyColor = mix(skyHorizon, skyTop, skyT);
    finalColor = mix(finalColor, skyColor, fresnel * 0.9);
    
    // Add some sparkle from sun reflection
    let sunDir = normalize(vec3<f32>(0.3, -0.4, -1.0));
    let halfDir = normalize(viewDir + sunDir);
    let specular = pow(max(dot(normal, halfDir), 0.0), 96.0);
    let glint = pow(max(dot(reflect(-viewDir, normal), sunDir), 0.0), 24.0);
    let specColor = mix(vec3<f32>(1.0, 0.85, 0.6), sunsetOrange, 0.3);
    finalColor += specColor * (specular * 0.5 + glint * 0.25);
    
    // Fresnel reflection tint
    finalColor = mix(finalColor, horizonColor, fresnel * 0.25);
    
    return vec4<f32>(finalColor, 1.0);
}
