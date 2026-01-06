// Particle data structure
// position: vec2 (offset 0)
// velocity: vec2 (offset 8)
// age: float (offset 16)
// type: float (offset 20) - 0 = main, 1 = auxiliary

struct Particle {
    position: vec2<f32>,
    velocity: vec2<f32>,
    age: f32,
    particleType: f32,
    padding1: f32,
    padding2: f32,
    padding3: f32,
}

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

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> renderData: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

// Hash function for noise
fn hash(p: vec2<f32>) -> f32 {
    var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(443.8975, 397.2973, 491.1871));
    p3 += dot(p3.zxy, p3.yzx + 19.19);
    return fract(p3.x * p3.y * p3.z);
}

// 2D noise function
fn noise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let f2 = f * f * (3.0 - 2.0 * f);
    
    let a = hash(i);
    let b = hash(i + vec2<f32>(1.0, 0.0));
    let c = hash(i + vec2<f32>(0.0, 1.0));
    let d = hash(i + vec2<f32>(1.0, 1.0));
    
    return mix(
        mix(a, b, f2.x),
        mix(c, d, f2.x),
        f2.y
    );
}

// 2D curl noise - returns a 2D vector representing the curl
fn curlNoise(p: vec2<f32>, scale: f32) -> vec2<f32> {
    let eps = 0.01;
    let scaledP = p * scale;
    
    // Sample noise at nearby points to compute curl
    let n1 = noise(scaledP + vec2<f32>(0.0, eps));
    let n2 = noise(scaledP - vec2<f32>(0.0, eps));
    let n3 = noise(scaledP + vec2<f32>(eps, 0.0));
    let n4 = noise(scaledP - vec2<f32>(eps, 0.0));
    
    // Curl: (dN/dy, -dN/dx)
    let dx = (n3 - n4) / (2.0 * eps);
    let dy = (n1 - n2) / (2.0 * eps);
    
    return vec2<f32>(dy, -dx);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let index = globalId.x;
    if (index >= arrayLength(&particles)) {
        return;
    }
    
    var particle = particles[index];
    
    // Skip dead particles (age >= 1.0)
    if (particle.age >= 1.0) {
        return;
    }
    
    // Update age
    particle.age += uniforms.deltaTime / uniforms.fadeDuration;
    
    if (particle.age >= 1.0) {
        particle.age = 1.0;
    }
    
    // Apply curl noise to velocity (affects all particles)
    let curl = curlNoise(particle.position, uniforms.noiseScale);
    particle.velocity += curl * uniforms.noiseStrength * uniforms.deltaTime;
    
    // Damping
    particle.velocity *= 0.98;
    
    // Update position with speed multiplier
    particle.position += particle.velocity * uniforms.deltaTime * uniforms.particleSpeed;
    
    // Boundary check - wrap around
    if (particle.position.x > 1.0) {
        particle.position.x = -1.0;
    }
    if (particle.position.x < -1.0) {
        particle.position.x = 1.0;
    }
    if (particle.position.y > 1.0) {
        particle.position.y = -1.0;
    }
    if (particle.position.y < -1.0) {
        particle.position.y = 1.0;
    }
    
    // Write back
    particles[index] = particle;
    
    // Update render data - one entry per particle (used for instancing)
    renderData[index] = vec4<f32>(particle.position.x, particle.position.y, particle.age, particle.particleType);
}

