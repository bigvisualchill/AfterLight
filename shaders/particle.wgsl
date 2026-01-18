// Particle rendering shader
// Supports 3D shapes (cube, sphere, icosahedron) and 2D billboards (square, circle)

struct Uniforms {
  viewProj: mat4x4<f32>,
  lightDirIntensity: vec4<f32>,
  lightColorTime: vec4<f32>,
  shapeParams: vec4<f32>,
  cameraRight: vec4<f32>,
  cameraUp: vec4<f32>,
  motionBlurPad: vec4<f32>,
  shadingParams: vec4<f32>, // x: flat shading, y: rim intensity, z: spec intensity, w: unused
  wireframeParams: vec4<f32>, // x: wireframe enabled, y: surface enabled, z: same color, w: unused
  wireframeColor: vec4<f32>, // rgb: wireframe color, a: unused
};

struct VertexIn {
  @location(0) pos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(11) bary: vec3<f32>,
  @location(2) instPos: vec3<f32>,
  @location(3) instSize: f32,
  @location(4) lifeT: f32,
  @location(5) seed: f32,
  @location(6) axis: vec3<f32>,
  @location(7) spin: f32,
  @location(8) instVel: vec3<f32>,
  @location(9) instOpacity: f32,
  @location(10) instColor: vec3<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) lifeT: f32,
  @location(2) localPos: vec3<f32>,
  @location(3) opacity: f32,
  @location(4) color: vec3<f32>,
  @location(5) worldPos: vec3<f32>,
  @location(6) bary: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var noiseTexture: texture_2d<f32>;
@group(0) @binding(2) var noiseSampler: sampler;

fn rotateByAxisAngle(v: vec3<f32>, axis: vec3<f32>, angle: f32) -> vec3<f32> {
  let c = cos(angle);
  let s = sin(angle);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}

@vertex
fn vs_main(input: VertexIn) -> VertexOut {
  var out: VertexOut;
  if (uniforms.shapeParams.x > 0.5) {
    let right = uniforms.cameraRight.xyz;
    let up = uniforms.cameraUp.xyz;
    let angle = input.seed + uniforms.lightColorTime.w * input.spin;
    let c = cos(angle);
    let s = sin(angle);
    let spinRight = right * c + up * s;
    let spinUp = -right * s + up * c;
    let billboard = (spinRight * input.pos.x + spinUp * input.pos.y) * input.instSize;
    let world = input.instPos + billboard;
    out.position = uniforms.viewProj * vec4<f32>(world, 1.0);
    out.normal = normalize(cross(right, up));
    out.localPos = vec3<f32>(input.pos.xy, 0.0);
    out.worldPos = world;
    out.bary = vec3<f32>(1.0, 1.0, 1.0); // No wireframe for 2D shapes
  } else {
  let axis = normalize(input.axis);
  let angle = input.seed + uniforms.lightColorTime.w * input.spin;
    let rotated = rotateByAxisAngle(input.pos, axis, angle);
    let velDir = normalize(input.instVel);
    let stretch = velDir * length(input.instVel) * uniforms.motionBlurPad.x;
    let world = input.instPos + rotated * input.instSize + stretch * dot(rotated, velDir);
    out.position = uniforms.viewProj * vec4<f32>(world, 1.0);
    out.normal = rotateByAxisAngle(input.normal, axis, angle);
    out.localPos = input.pos;
    out.worldPos = world;
    out.bary = input.bary;
  }
  out.lifeT = input.lifeT;
  out.opacity = input.instOpacity;
  out.color = input.instColor;
  return out;
}

// Wireframe edge detection using barycentric coordinates
fn wireframeEdge(bary: vec3<f32>, thickness: f32) -> f32 {
  let d = fwidth(bary);
  let a3 = smoothstep(vec3<f32>(0.0), d * thickness, bary);
  return min(min(a3.x, a3.y), a3.z);
}

@fragment
fn fs_main(input: VertexOut) -> @location(0) vec4<f32> {
  // Wireframe parameters
  let wireframeOn = uniforms.wireframeParams.x > 0.5;
  let surfaceOn = uniforms.wireframeParams.y > 0.5;
  let sameColor = uniforms.wireframeParams.z > 0.5;
  
  // Flat shading: compute face normal from screen-space derivatives
  let flatNormal = normalize(cross(dpdx(input.worldPos), dpdy(input.worldPos)));
  let smoothNormal = normalize(input.normal);
  
  // Choose normal based on shading style (shadingParams.x: 0=smooth, 1=flat)
  var normal = mix(smoothNormal, flatNormal, uniforms.shadingParams.x);
  
  let light = normalize(uniforms.lightDirIntensity.xyz);
  let intensity = uniforms.lightDirIntensity.w;
  let rimStrength = uniforms.shadingParams.y;
  let specStrength = uniforms.shadingParams.z;
  
  // Diffuse lighting - use standard Lambert for flat, half-Lambert for smooth
  let NdotL = dot(normal, light);
  let halfLambert = NdotL * 0.5 + 0.5;
  let lambertDiff = max(NdotL, 0.0);
  let smoothDiff = halfLambert * halfLambert;
  let diff = mix(smoothDiff, lambertDiff, uniforms.shadingParams.x) * intensity;
  
  // Fresnel rim lighting (highlights edges facing away from camera)
  let viewDir = normalize(vec3<f32>(0.0, 0.0, 1.0)); // Approximate view direction
  let fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
  let rim = pow(fresnel, 2.5) * rimStrength * intensity;
  
  // Specular highlight (Blinn-Phong)
  let halfVec = normalize(light + viewDir);
  let spec = pow(max(dot(normal, halfVec), 0.0), 32.0) * specStrength * intensity;
  
  let lifeT = clamp(input.lifeT, 0.0, 1.0);
  let base = input.color;
  
  // Combine lighting: ambient + diffuse + rim + specular
  let ambient = 0.35;
  let lighting = ambient + diff * 0.65 + rim + spec;
  let lit = base * uniforms.lightColorTime.xyz * lighting;
  let shaded = mix(base, lit, step(0.5, uniforms.motionBlurPad.y));
  // Triplanar sampling to avoid seam lines on spheres with planar UVs.
  let n = abs(normal);
  let w = n / (n.x + n.y + n.z);
  let scale = 0.75;
  let uvX = input.localPos.zy * scale + vec2<f32>(0.5);
  let uvY = input.localPos.xz * scale + vec2<f32>(0.5);
  let uvZ = input.localPos.xy * scale + vec2<f32>(0.5);
  let noiseX = textureSample(noiseTexture, noiseSampler, uvX).r;
  let noiseY = textureSample(noiseTexture, noiseSampler, uvY).r;
  let noiseZ = textureSample(noiseTexture, noiseSampler, uvZ).r;
  let noise = noiseX * w.x + noiseY * w.y + noiseZ * w.z;
  let noiseMix = mix(1.0, noise, uniforms.shapeParams.z);
  let alpha = input.opacity;
  let colorOut = shaded * noiseMix;
  if (uniforms.shapeParams.x > 1.5) {
    let edge = length(input.localPos.xy);
    if (uniforms.shapeParams.w > 0.001) {
      let shapeMask = 1.0 - smoothstep(1.0 - uniforms.shapeParams.w, 1.0, edge);
      if (shapeMask <= 0.001) {
        discard;
      }
      let outAlpha = alpha * shapeMask;
      return vec4<f32>(colorOut * outAlpha, outAlpha);
    }
    if (edge > 1.0) {
      discard;
    }
    let outAlpha = alpha;
    return vec4<f32>(colorOut * outAlpha, outAlpha);
  } else if (uniforms.shapeParams.x > 0.5) {
    let edge = max(abs(input.localPos.x), abs(input.localPos.y));
    if (uniforms.shapeParams.w > 0.001) {
      let shapeMask = 1.0 - smoothstep(1.0 - uniforms.shapeParams.w, 1.0, edge);
      if (shapeMask <= 0.001) {
        discard;
      }
      let outAlpha = alpha * shapeMask;
      return vec4<f32>(colorOut * outAlpha, outAlpha);
    }
    if (edge > 1.0) {
      discard;
    }
    let outAlpha = alpha;
    return vec4<f32>(colorOut * outAlpha, outAlpha);
  }
  
  // 3D shapes - apply wireframe if enabled
  var finalColor = colorOut;
  var finalAlpha = alpha;
  
  if (wireframeOn) {
    let wireColor = select(uniforms.wireframeColor.rgb, input.color, sameColor);
    let edgeFactor = wireframeEdge(input.bary, 1.5);
    
    if (surfaceOn) {
      // Both surface and wireframe
      finalColor = mix(wireColor, colorOut, edgeFactor);
    } else {
      // Wireframe only - discard interior pixels
      if (edgeFactor > 0.5) {
        discard;
      }
      finalColor = wireColor;
    }
  } else if (!surfaceOn) {
    // No surface and no wireframe - nothing to render
    discard;
  }
  
  let outAlpha = finalAlpha;
  return vec4<f32>(finalColor * outAlpha, outAlpha);
}
