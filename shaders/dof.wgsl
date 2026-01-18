// ============================================================================
// Realistic Depth of Field Shader System
// ============================================================================
// This DOF system implements physically-based bokeh blur with:
// - Signed Circle of Confusion (CoC) computation
// - Separate near/far layer blur with occlusion handling
// - Polygonal bokeh (6-blade aperture)
// - Resolution-aware blur radius
// - ACES tonemapping
// ============================================================================

// Shared vertex output for fullscreen triangle passes
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

// Generate fullscreen triangle from vertex index (no vertex buffer needed)
fn fullscreenTrianglePosition(vertexIndex: u32) -> vec4<f32> {
  // Generate a triangle that covers the entire screen
  // Vertices at: (-1,-1), (3,-1), (-1,3) - covers [-1,1] range
  let x = f32(i32(vertexIndex) / 2) * 4.0 - 1.0;
  let y = f32(i32(vertexIndex) % 2) * 4.0 - 1.0;
  return vec4<f32>(x, y, 0.0, 1.0);
}

fn fullscreenTriangleUV(vertexIndex: u32) -> vec2<f32> {
  let x = f32(i32(vertexIndex) / 2) * 2.0;
  let y = 1.0 - f32(i32(vertexIndex) % 2) * 2.0;
  return vec2<f32>(x, y);
}

// ============================================================================
// PASS 1: CoC Prepass - Compute signed Circle of Confusion
// ============================================================================
struct CoCUniforms {
  resolution: vec2<f32>,
  focusDistance: f32,     // Focus distance in world units
  fNumber: f32,           // F-number (aperture)
  focalLengthMm: f32,     // Focal length in mm (35mm or 50mm)
  sensorWidthMm: f32,     // Sensor width in mm (36mm for full-frame)
  near: f32,              // Camera near plane
  far: f32,               // Camera far plane
  maxBlurPx: f32,         // Maximum blur radius in pixels
  _pad: vec3<f32>,
}

@group(0) @binding(0) var depthTexture: texture_depth_2d;
@group(0) @binding(1) var<uniform> cocUniforms: CoCUniforms;

// Linearize depth from depth buffer (reverse-Z or standard)
fn linearizeDepth(depth: f32, near: f32, far: f32) -> f32 {
  // Standard depth buffer linearization
  return (near * far) / (far - depth * (far - near));
}

// Compute signed CoC in pixels
// Negative = foreground (near blur), Positive = background (far blur)
fn computeCoC(linearDepth: f32) -> f32 {
  let focusZ = max(cocUniforms.focusDistance, 0.1);
  let fNumber = max(cocUniforms.fNumber, 1.0);
  let focalLengthMm = cocUniforms.focalLengthMm;
  let sensorWidthMm = cocUniforms.sensorWidthMm;
  
  // Convert focal length to world units (assuming meters, 1mm = 0.001m)
  let focalLength = focalLengthMm * 0.001;
  
  // Simplified physically-inspired CoC formula
  let depthDiff = linearDepth - focusZ;
  let sign = select(-1.0, 1.0, depthDiff >= 0.0);
  
  // Simpler CoC calculation: blur increases with distance from focus plane
  // and decreases with f-number (higher f-number = smaller aperture = less blur)
  let apertureRadius = focalLength / (2.0 * fNumber);
  let relativeDepth = abs(depthDiff) / max(focusZ, 0.1);
  
  // CoC in world units, scaled by aperture
  let cocWorld = relativeDepth * apertureRadius * 2.0;
  
  // Convert to pixels (approximate: 1 world unit = some pixels at focus distance)
  let fovScale = 1.0 / tan(0.39269908); // ~45 degree FOV / 2
  let pixelsPerUnit = cocUniforms.resolution.y * fovScale / focusZ;
  var cocPx = cocWorld * pixelsPerUnit;
  
  // Scale by screen height for resolution independence
  cocPx = cocPx * (cocUniforms.resolution.y / 1080.0);
  
  // Apply sign and clamp - ensure we don't get NaN or huge values
  cocPx = sign * min(cocPx, cocUniforms.maxBlurPx);
  
  // Final clamp and NaN protection
  if (cocPx != cocPx) { // NaN check
    return 0.0;
  }
  return clamp(cocPx, -cocUniforms.maxBlurPx, cocUniforms.maxBlurPx);
}

@vertex
fn vs_coc(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  output.position = fullscreenTrianglePosition(vertexIndex);
  output.uv = fullscreenTriangleUV(vertexIndex);
  return output;
}

@fragment
fn fs_coc(input: VertexOutput) -> @location(0) f32 {
  let uv = input.uv;
  let res = cocUniforms.resolution;
  let texel = vec2<i32>(i32(uv.x * res.x), i32(uv.y * res.y));
  
  let depth = textureLoad(depthTexture, texel, 0);
  let linearDepth = linearizeDepth(depth, cocUniforms.near, cocUniforms.far);
  
  return computeCoC(linearDepth);
}

// ============================================================================
// PASS 2 & 3: Bokeh Blur Passes (Far and Near)
// ============================================================================
struct BlurUniforms {
  resolution: vec2<f32>,
  maxBlurPx: f32,
  bladeCount: f32,        // Number of aperture blades (6 for hexagonal)
  isNearPass: f32,        // 0 = far pass, 1 = near pass
  near: f32,
  far: f32,
  _pad: f32,
}

@group(0) @binding(0) var colorTexture: texture_2d<f32>;
@group(0) @binding(1) var cocTexture: texture_2d<f32>;
@group(0) @binding(2) var depthTextureBlur: texture_depth_2d;
@group(0) @binding(3) var linearSampler: sampler;
@group(0) @binding(4) var<uniform> blurUniforms: BlurUniforms;

// Ring sample offsets for bokeh blur (3 rings for high quality bokeh)
const RING1_COUNT: u32 = 6u;   // Inner ring
const RING2_COUNT: u32 = 12u;  // Middle ring
const RING3_COUNT: u32 = 18u;  // Outer ring
const TOTAL_SAMPLES: u32 = 36u;

// Generate sample offset on a disk
fn diskSample(index: u32, count: u32, radius: f32) -> vec2<f32> {
  let angle = 2.0 * 3.14159265 * f32(index) / f32(count);
  return vec2<f32>(cos(angle), sin(angle)) * radius;
}

// Transform disk sample to polygon (n-gon) shape
fn polygonWarp(p: vec2<f32>, blades: f32) -> vec2<f32> {
  let angle = atan2(p.y, p.x);
  let r = length(p);
  
  // Angle per blade
  let bladeAngle = 2.0 * 3.14159265 / blades;
  
  // Which blade sector are we in?
  let sector = floor(angle / bladeAngle + 0.5);
  let localAngle = angle - sector * bladeAngle;
  
  // Distance to polygon edge at this angle
  let polygonR = cos(bladeAngle * 0.5) / max(cos(localAngle), 0.001);
  
  // Scale radius to fit polygon
  return p * min(polygonR, 1.0);
}

fn linearizeDepthBlur(depth: f32) -> f32 {
  return (blurUniforms.near * blurUniforms.far) / (blurUniforms.far - depth * (blurUniforms.far - blurUniforms.near));
}

@vertex
fn vs_blur(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  output.position = fullscreenTrianglePosition(vertexIndex);
  output.uv = fullscreenTriangleUV(vertexIndex);
  return output;
}

@fragment
fn fs_blur_far(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;
  let res = blurUniforms.resolution;
  let texelSize = 1.0 / res;
  let texel = vec2<i32>(i32(uv.x * res.x), i32(uv.y * res.y));
  
  // Sample center CoC and depth
  let centerCoc = textureLoad(cocTexture, texel, 0).r;
  let centerDepth = linearizeDepthBlur(textureLoad(depthTextureBlur, texel, 0));
  
  // Far pass only processes positive CoC (background blur)
  if (centerCoc <= 0.5) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  
  let blurRadius = min(centerCoc, blurUniforms.maxBlurPx);
  
  // Early out for very small blur
  if (blurRadius < 0.5) {
    let color = textureSampleLevel(colorTexture, linearSampler, uv, 0.0);
    return vec4<f32>(color.rgb, 1.0);
  }
  
  var colorSum = vec3<f32>(0.0);
  var weightSum = 0.0;
  let blades = blurUniforms.bladeCount;
  
  // Add center sample
  let centerColor = textureSampleLevel(colorTexture, linearSampler, uv, 0.0).rgb;
  colorSum += centerColor;
  weightSum += 1.0;
  
  // Ring 1: 6 samples at 0.3 radius (inner)
  for (var i = 0u; i < RING1_COUNT; i++) {
    var offset = diskSample(i, RING1_COUNT, 0.3);
    offset = polygonWarp(offset, blades);
    let sampleUV = uv + offset * blurRadius * texelSize;
    
    if (sampleUV.x >= 0.0 && sampleUV.x <= 1.0 && sampleUV.y >= 0.0 && sampleUV.y <= 1.0) {
      let sampleTexel = vec2<i32>(i32(sampleUV.x * res.x), i32(sampleUV.y * res.y));
      let sampleCoc = textureLoad(cocTexture, sampleTexel, 0).r;
      let sampleDepth = linearizeDepthBlur(textureLoad(depthTextureBlur, sampleTexel, 0));
      
      // Occlusion: prefer samples at similar or greater depth (background)
      let depthDiff = sampleDepth - centerDepth;
      let occlusionWeight = smoothstep(-0.5, 0.2, depthDiff);
      // Prefer samples with positive CoC (background)
      let cocWeight = smoothstep(-0.5, 1.0, sampleCoc);
      let weight = max(occlusionWeight * cocWeight, 0.1); // Always contribute a bit
      
      let sampleColor = textureSampleLevel(colorTexture, linearSampler, sampleUV, 0.0).rgb;
      colorSum += sampleColor * weight;
      weightSum += weight;
    }
  }
  
  // Ring 2: 12 samples at 0.6 radius (middle)
  for (var i = 0u; i < RING2_COUNT; i++) {
    var offset = diskSample(i, RING2_COUNT, 0.6);
    offset = polygonWarp(offset, blades);
    let sampleUV = uv + offset * blurRadius * texelSize;
    
    if (sampleUV.x >= 0.0 && sampleUV.x <= 1.0 && sampleUV.y >= 0.0 && sampleUV.y <= 1.0) {
      let sampleTexel = vec2<i32>(i32(sampleUV.x * res.x), i32(sampleUV.y * res.y));
      let sampleCoc = textureLoad(cocTexture, sampleTexel, 0).r;
      let sampleDepth = linearizeDepthBlur(textureLoad(depthTextureBlur, sampleTexel, 0));
      
      let depthDiff = sampleDepth - centerDepth;
      let occlusionWeight = smoothstep(-0.5, 0.2, depthDiff);
      let cocWeight = smoothstep(-0.5, 1.0, sampleCoc);
      let weight = max(occlusionWeight * cocWeight, 0.1);
      
      let sampleColor = textureSampleLevel(colorTexture, linearSampler, sampleUV, 0.0).rgb;
      colorSum += sampleColor * weight;
      weightSum += weight;
    }
  }
  
  // Ring 3: 18 samples at 1.0 radius (outer) - defines bokeh edge
  for (var i = 0u; i < RING3_COUNT; i++) {
    var offset = diskSample(i, RING3_COUNT, 1.0);
    offset = polygonWarp(offset, blades);
    let sampleUV = uv + offset * blurRadius * texelSize;
    
    if (sampleUV.x >= 0.0 && sampleUV.x <= 1.0 && sampleUV.y >= 0.0 && sampleUV.y <= 1.0) {
      let sampleTexel = vec2<i32>(i32(sampleUV.x * res.x), i32(sampleUV.y * res.y));
      let sampleCoc = textureLoad(cocTexture, sampleTexel, 0).r;
      let sampleDepth = linearizeDepthBlur(textureLoad(depthTextureBlur, sampleTexel, 0));
      
      let depthDiff = sampleDepth - centerDepth;
      let occlusionWeight = smoothstep(-0.5, 0.2, depthDiff);
      let cocWeight = smoothstep(-0.5, 1.0, sampleCoc);
      let weight = max(occlusionWeight * cocWeight, 0.1);
      
      let sampleColor = textureSampleLevel(colorTexture, linearSampler, sampleUV, 0.0).rgb;
      colorSum += sampleColor * weight;
      weightSum += weight;
    }
  }
  
  return vec4<f32>(colorSum / weightSum, 1.0);
}

@fragment
fn fs_blur_near(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;
  let res = blurUniforms.resolution;
  let texelSize = 1.0 / res;
  let texel = vec2<i32>(i32(uv.x * res.x), i32(uv.y * res.y));
  
  // Sample center CoC and depth
  let centerCoc = textureLoad(cocTexture, texel, 0).r;
  let centerDepth = linearizeDepthBlur(textureLoad(depthTextureBlur, texel, 0));
  
  // Near pass only processes negative CoC (foreground blur)
  if (centerCoc >= -0.5) {
    // In-focus or background - return transparent
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  
  let blurRadius = min(abs(centerCoc), blurUniforms.maxBlurPx);
  
  // Early out for very small blur
  if (blurRadius < 0.5) {
    let color = textureSampleLevel(colorTexture, linearSampler, uv, 0.0);
    return vec4<f32>(color.rgb, abs(centerCoc) / blurUniforms.maxBlurPx);
  }
  
  var colorSum = vec3<f32>(0.0);
  var weightSum = 0.0;
  let blades = blurUniforms.bladeCount;
  
  // Add center sample
  let centerColor = textureSampleLevel(colorTexture, linearSampler, uv, 0.0).rgb;
  colorSum += centerColor;
  weightSum += 1.0;

  // Ring 1: 6 samples at 0.3 radius (inner)
  for (var i = 0u; i < RING1_COUNT; i++) {
    var offset = diskSample(i, RING1_COUNT, 0.3);
    offset = polygonWarp(offset, blades);
    let sampleUV = uv + offset * blurRadius * texelSize;
    
    if (sampleUV.x >= 0.0 && sampleUV.x <= 1.0 && sampleUV.y >= 0.0 && sampleUV.y <= 1.0) {
      let sampleTexel = vec2<i32>(i32(sampleUV.x * res.x), i32(sampleUV.y * res.y));
      let sampleCoc = textureLoad(cocTexture, sampleTexel, 0).r;
      let sampleDepth = linearizeDepthBlur(textureLoad(depthTextureBlur, sampleTexel, 0));
      
      // Occlusion: prefer samples at similar or lesser depth (foreground)
      let depthDiff = centerDepth - sampleDepth;
      let occlusionWeight = smoothstep(-0.5, 0.2, depthDiff);
      // Prefer samples with negative CoC (foreground)
      let cocWeight = smoothstep(0.5, -1.0, sampleCoc);
      let weight = max(occlusionWeight * cocWeight, 0.1);
      
      let sampleColor = textureSampleLevel(colorTexture, linearSampler, sampleUV, 0.0).rgb;
      colorSum += sampleColor * weight;
      weightSum += weight;
    }
  }
  
  // Ring 2: 12 samples at 0.6 radius (middle)
  for (var i = 0u; i < RING2_COUNT; i++) {
    var offset = diskSample(i, RING2_COUNT, 0.6);
    offset = polygonWarp(offset, blades);
    let sampleUV = uv + offset * blurRadius * texelSize;
    
    if (sampleUV.x >= 0.0 && sampleUV.x <= 1.0 && sampleUV.y >= 0.0 && sampleUV.y <= 1.0) {
      let sampleTexel = vec2<i32>(i32(sampleUV.x * res.x), i32(sampleUV.y * res.y));
      let sampleCoc = textureLoad(cocTexture, sampleTexel, 0).r;
      let sampleDepth = linearizeDepthBlur(textureLoad(depthTextureBlur, sampleTexel, 0));
      
      let depthDiff = centerDepth - sampleDepth;
      let occlusionWeight = smoothstep(-0.5, 0.2, depthDiff);
      let cocWeight = smoothstep(0.5, -1.0, sampleCoc);
      let weight = max(occlusionWeight * cocWeight, 0.1);
      
      let sampleColor = textureSampleLevel(colorTexture, linearSampler, sampleUV, 0.0).rgb;
      colorSum += sampleColor * weight;
      weightSum += weight;
    }
  }
  
  // Ring 3: 18 samples at 1.0 radius (outer)
  for (var i = 0u; i < RING3_COUNT; i++) {
    var offset = diskSample(i, RING3_COUNT, 1.0);
    offset = polygonWarp(offset, blades);
    let sampleUV = uv + offset * blurRadius * texelSize;
    
    if (sampleUV.x >= 0.0 && sampleUV.x <= 1.0 && sampleUV.y >= 0.0 && sampleUV.y <= 1.0) {
      let sampleTexel = vec2<i32>(i32(sampleUV.x * res.x), i32(sampleUV.y * res.y));
      let sampleCoc = textureLoad(cocTexture, sampleTexel, 0).r;
      let sampleDepth = linearizeDepthBlur(textureLoad(depthTextureBlur, sampleTexel, 0));
      
      let depthDiff = centerDepth - sampleDepth;
      let occlusionWeight = smoothstep(-0.5, 0.2, depthDiff);
      let cocWeight = smoothstep(0.5, -1.0, sampleCoc);
      let weight = max(occlusionWeight * cocWeight, 0.1);
      
      let sampleColor = textureSampleLevel(colorTexture, linearSampler, sampleUV, 0.0).rgb;
      colorSum += sampleColor * weight;
      weightSum += weight;
    }
  }
  
  if (weightSum < 0.001) {
    let color = textureSampleLevel(colorTexture, linearSampler, uv, 0.0);
    return vec4<f32>(color.rgb, abs(centerCoc) / blurUniforms.maxBlurPx);
  }
  
  // Return with alpha for compositing
  let alpha = saturate(abs(centerCoc) / blurUniforms.maxBlurPx);
  return vec4<f32>(colorSum / weightSum, alpha);
}

// ============================================================================
// PASS 4: Composite + Tonemapping
// ============================================================================
struct CompositeUniforms {
  resolution: vec2<f32>,
  maxBlurPx: f32,
  exposure: f32,
  debugMode: f32,         // 0 = normal, 1 = show CoC
  _pad: vec3<f32>,
}

@group(0) @binding(0) var sharpTexture: texture_2d<f32>;      // Original HDR color
@group(0) @binding(1) var farBlurTexture: texture_2d<f32>;   // Far blur result
@group(0) @binding(2) var nearBlurTexture: texture_2d<f32>;  // Near blur result
@group(0) @binding(3) var cocTextureComp: texture_2d<f32>;    // CoC texture
@group(0) @binding(4) var compositeSampler: sampler;
@group(0) @binding(5) var<uniform> compositeUniforms: CompositeUniforms;

// ACES Filmic Tonemapping (for reference, not used currently)
fn acesFilm(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return saturate((x * (a * x + b)) / (x * (c * x + d) + e));
}

// Soft tonemapping that preserves colors better for stylized content
// Only compresses values > 1.0, leaves darker values unchanged
fn softTonemap(x: vec3<f32>) -> vec3<f32> {
  // Attempt softer compression: for each channel, if > 1, compress gently
  return x / (1.0 + x * 0.15);
}

// sRGB gamma encoding
fn linearToSrgb(linear: vec3<f32>) -> vec3<f32> {
  let cutoff = linear < vec3<f32>(0.0031308);
  let higher = 1.055 * pow(linear, vec3<f32>(1.0 / 2.4)) - 0.055;
  let lower = linear * 12.92;
  return select(higher, lower, cutoff);
}

@vertex
fn vs_composite(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  output.position = fullscreenTrianglePosition(vertexIndex);
  output.uv = fullscreenTriangleUV(vertexIndex);
  return output;
}

@fragment
fn fs_composite(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;
  let res = compositeUniforms.resolution;
  let texel = vec2<i32>(i32(uv.x * res.x), i32(uv.y * res.y));
  
  // Sample all textures
  let sharp = textureSample(sharpTexture, compositeSampler, uv).rgb;
  let farBlur = textureSample(farBlurTexture, compositeSampler, uv);
  let nearBlur = textureSample(nearBlurTexture, compositeSampler, uv);
  let coc = textureLoad(cocTextureComp, texel, 0).r;
  
  // Debug mode: visualize CoC
  if (compositeUniforms.debugMode > 0.5) {
    let cocNorm = coc / compositeUniforms.maxBlurPx;
    var debugColor: vec3<f32>;
    if (cocNorm < 0.0) {
      // Near (foreground) - blue
      debugColor = vec3<f32>(0.2, 0.4, 1.0) * abs(cocNorm);
    } else {
      // Far (background) - red
      debugColor = vec3<f32>(1.0, 0.3, 0.2) * cocNorm;
    }
    // Mix with grayscale sharp image
    let gray = dot(sharp, vec3<f32>(0.299, 0.587, 0.114));
    let output = mix(vec3<f32>(gray), debugColor + vec3<f32>(gray * 0.3), 0.8);
    return vec4<f32>(output, 1.0);
  }
  
  // Start with sharp color
  var color = sharp;
  
  // Apply far blur (background) - only if CoC is significantly positive
  let absCoc = abs(coc);
  if (coc > 1.0 && farBlur.a > 0.01) {
    let farAlpha = saturate(absCoc / compositeUniforms.maxBlurPx) * 0.8;
    color = mix(sharp, farBlur.rgb, farAlpha);
  }
  
  // Composite near blur on top (foreground always wins)
  if (coc < -1.0 && nearBlur.a > 0.01) {
    let nearAlpha = saturate(absCoc / compositeUniforms.maxBlurPx) * nearBlur.a;
    color = mix(color, nearBlur.rgb, nearAlpha);
  }
  
  // Simple pass-through without aggressive tonemapping for now
  // Just clamp to valid range
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
  
  return vec4<f32>(color, 1.0);
}
