struct Uniforms {
    time: f32,
    deltaTime: f32,
    noiseStrength: f32,
    noiseScale: f32,
    fadeDuration: f32,
    particleSpeed: f32,
    auxiliaryRatio: f32,
    spawnAuxiliaryChance: f32,
    particleSize: f32,
    canvasWidth: f32,
    canvasHeight: f32,
    aspectRatio: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) quadCorner: vec2<f32>,  // Quad vertex position (-1 to 1)
    @location(1) particlePos: vec2<f32>,  // Particle center
    @location(2) age: f32,
    @location(3) particleType: f32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) age: f32,
    @location(1) particleType: f32,
    @location(2) particleCenter: vec2<f32>,
    @location(3) quadUV: vec2<f32>,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Particle size in screen space (NDC)
    // Adjust for aspect ratio to keep particles circular
    let size = uniforms.particleSize;
    let aspectAdjustedSize = vec2<f32>(size / uniforms.aspectRatio, size);
    
    // Expand quad corner to world space with aspect ratio correction
    let worldPos = input.particlePos + input.quadCorner * aspectAdjustedSize;
    
    // Convert from normalized device coordinates to clip space
    output.position = vec4<f32>(worldPos, 0.0, 1.0);
    output.age = input.age;
    output.particleType = input.particleType;
    output.particleCenter = input.particlePos;
    output.quadUV = input.quadCorner; // For circular fade
    
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Skip rendering dead particles (age >= 1.0)
    if (input.age >= 1.0) {
        discard;
    }
    
    // White particles
    let color = vec3<f32>(1.0, 1.0, 1.0);
    
    // Fade out based on age
    let alpha = 1.0 - input.age;
    
    // All particles have same brightness (no auxiliary particles)
    let brightness = 1.0;
    
    // Create a circular fade at edges for smoother, round particles
    // Use aspect-corrected distance for circular particles
    let aspectCorrectedUV = vec2<f32>(input.quadUV.x * uniforms.aspectRatio, input.quadUV.y);
    let distFromCenter = length(aspectCorrectedUV);
    let edgeFade = 1.0 - smoothstep(0.6, 1.0, distFromCenter);
    
    return vec4<f32>(color * brightness, alpha * edgeFade);
}

