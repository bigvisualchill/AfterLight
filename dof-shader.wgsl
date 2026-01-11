struct VertexInput {
  @location(0) position: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

struct Uniforms {
  resolution: vec2<f32>,
  focusDistance: f32,
  focusRange: f32,
  maxBlur: f32,
  near: f32,
  far: f32,
  _pad: vec4<f32>,
};

@group(0) @binding(0) var colorTexture: texture_2d<f32>;
@group(0) @binding(1) var depthTexture: texture_depth_2d;
@group(0) @binding(2) var colorSampler: sampler;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

fn linearizeDepth(depth: f32, near: f32, far: f32) -> f32 {
  return (near * far) / (far - depth * (far - near));
}

fn getCoC(linearDepth: f32) -> f32 {
  let coc = abs(linearDepth - uniforms.focusDistance);
  var blurPhysical = smoothstep(0.0, uniforms.focusRange, coc);
  blurPhysical = blurPhysical * blurPhysical;
  return blurPhysical;
}

@vertex
fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 0.0, 1.0);
  output.uv = input.position * 0.5 + 0.5;
  output.uv.y = 1.0 - output.uv.y;
  return output;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;
  let res = uniforms.resolution;
  let texelSize = 1.0 / res;
  
  // Get center pixel depth and CoC
  let texel = vec2<i32>(
    clamp(i32(uv.x * res.x), 0, i32(res.x) - 1),
    clamp(i32(uv.y * res.y), 0, i32(res.y) - 1)
  );
  let centerDepth = textureLoad(depthTexture, texel, 0);
  let centerLinearDepth = linearizeDepth(centerDepth, uniforms.near, uniforms.far);
  let centerCoC = getCoC(centerLinearDepth);
  let radius = centerCoC * uniforms.maxBlur;
  
  // Early out for in-focus pixels
  if (radius < 0.5) {
    return vec4<f32>(textureSample(colorTexture, colorSampler, uv).rgb, 1.0);
  }
  
  // High quality disc blur with multiple rings
  let centerColor = textureSample(colorTexture, colorSampler, uv).rgb;
  var sum = centerColor;
  var weightSum = 1.0;
  
  // Golden angle for uniform disc distribution
  let goldenAngle = 2.39996323;
  
  // Adaptive sample count based on blur radius
  let baseSamples = 48u;
  let sampleCount = baseSamples;
  
  // Aspect ratio correction for circular bokeh
  let aspect = res.x / res.y;
  
  for (var i = 1u; i < sampleCount; i = i + 1u) {
    // Sunflower/Vogel disc sampling for uniform coverage
    let t = f32(i) / f32(sampleCount);
    let r = sqrt(t) * radius;
    let theta = f32(i) * goldenAngle;
    
    var offset = vec2<f32>(cos(theta), sin(theta)) * r * texelSize;
    offset.x = offset.x / aspect * aspect; // Keep circular
    
    let sampleUV = uv + offset;
    
    // Skip samples outside texture bounds
    if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || sampleUV.y < 0.0 || sampleUV.y > 1.0) {
      continue;
    }
    
    // Get sample depth and CoC
    let sampleTexel = vec2<i32>(
      clamp(i32(sampleUV.x * res.x), 0, i32(res.x) - 1),
      clamp(i32(sampleUV.y * res.y), 0, i32(res.y) - 1)
    );
    let sampleDepth = textureLoad(depthTexture, sampleTexel, 0);
    let sampleLinearDepth = linearizeDepth(sampleDepth, uniforms.near, uniforms.far);
    let sampleCoC = getCoC(sampleLinearDepth);
    let sampleRadius = sampleCoC * uniforms.maxBlur;
    
    // Depth-aware weighting to prevent sharp foreground bleeding into background
    // A sample contributes if:
    // 1. It's in front and blurry enough to reach this pixel
    // 2. It's behind and the center pixel is blurry enough
    let distFromCenter = r;
    var depthWeight = 1.0;
    
    if (sampleLinearDepth < centerLinearDepth) {
      // Sample is in front - only contribute if its blur reaches here
      depthWeight = smoothstep(0.0, max(sampleRadius, 0.5), distFromCenter + sampleRadius * 0.5);
    } else {
      // Sample is behind - contribute based on center's blur
      depthWeight = smoothstep(0.0, max(radius, 0.5), distFromCenter);
    }
    
    // Soft circular falloff for bokeh shape
    let normalizedDist = distFromCenter / max(radius, 0.001);
    var bokehWeight = 1.0 - smoothstep(0.7, 1.0, normalizedDist);
    bokehWeight = bokehWeight * bokehWeight; // Softer falloff
    
    let weight = bokehWeight * depthWeight;
    
    if (weight > 0.001) {
      let sampleColor = textureSample(colorTexture, colorSampler, sampleUV).rgb;
      sum += sampleColor * weight;
      weightSum += weight;
    }
  }
  
  let color = sum / max(weightSum, 0.001);
  return vec4<f32>(color, 1.0);
}
