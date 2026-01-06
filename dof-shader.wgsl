struct VertexInput {
  @location(0) position: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

struct Uniforms {
  resolution: vec2<f32>,
  focusDistance: f32,
  focusRange: f32,
  maxBlur: f32,
  near: f32,
  far: f32,
  mode: f32,
  focusOverlay: f32,
  bloomStrength: f32,
  bloomThreshold: f32,
  exposure: f32,
  _pad: vec3<f32>,
}

@group(0) @binding(0) var colorTexture: texture_2d<f32>;
@group(0) @binding(1) var depthTexture: texture_depth_2d;
@group(0) @binding(2) var colorSampler: sampler;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

fn linearizeDepth(depth: f32, near: f32, far: f32) -> f32 {
  return (near * far) / (far - depth * (far - near));
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
  let texel = vec2<i32>(
    clamp(i32(uv.x * res.x), 0, i32(res.x) - 1),
    clamp(i32(uv.y * res.y), 0, i32(res.y) - 1)
  );
  let depth = textureLoad(depthTexture, texel, 0);
  let linearDepth = linearizeDepth(depth, uniforms.near, uniforms.far);
  let blurBokeh = clamp(abs(linearDepth - uniforms.focusDistance) / uniforms.focusRange, 0.0, 1.0);
  let blurPhysical = clamp(abs(linearDepth - uniforms.focusDistance) / max(linearDepth, 0.001), 0.0, 1.0);
  let blurFactor = mix(blurBokeh, blurPhysical, step(0.5, uniforms.mode));
  let radius = blurFactor * uniforms.maxBlur;
  let texelSize = 1.0 / res;

  let offsets = array<vec2<f32>, 8>(
    vec2<f32>(1.0, 0.0),
    vec2<f32>(-1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, -1.0)
  );

  var sum = textureSample(colorTexture, colorSampler, uv).rgb;
  for (var i = 0u; i < 8u; i = i + 1u) {
    let offset = offsets[i] * radius * texelSize;
    sum += textureSample(colorTexture, colorSampler, uv + offset).rgb;
  }
  var color = sum / 9.0;
  let bloom = max(color - vec3<f32>(uniforms.bloomThreshold), vec3<f32>(0.0));
  color = color + bloom * uniforms.bloomStrength;
  color = vec3<f32>(1.0) - exp(-color * uniforms.exposure);
  if (uniforms.focusOverlay > 0.5 && blurFactor < 0.1) {
    color = mix(color, vec3<f32>(0.2, 1.0, 0.6), 0.25);
  }

  return vec4<f32>(color, 1.0);
}
