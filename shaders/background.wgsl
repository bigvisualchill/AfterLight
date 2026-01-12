// Background shader for solid colors and gradients
// Supports: solid, linear gradient (H/V), radial gradient

struct BackgroundUniforms {
    mode: u32,              // 0=transparent, 1=solid, 2=linear, 3=radial
    linearDirection: u32,   // 0=vertical, 1=horizontal
    radialCenter: vec2f,    // Center point for radial gradient (0-1)
    solidColor: vec4f,      // Solid color (RGBA)
    // Gradient stops: up to 8 stops
    // Each stop: vec4f(r, g, b, position)
    stop0: vec4f,
    stop1: vec4f,
    stop2: vec4f,
    stop3: vec4f,
    stop4: vec4f,
    stop5: vec4f,
    stop6: vec4f,
    stop7: vec4f,
    numStops: u32,
    _pad: vec3u,
}

@group(0) @binding(0) var<uniform> uniforms: BackgroundUniforms;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // Full-screen quad
    var positions = array<vec2f, 6>(
        vec2f(-1.0, -1.0),
        vec2f( 1.0, -1.0),
        vec2f(-1.0,  1.0),
        vec2f(-1.0,  1.0),
        vec2f( 1.0, -1.0),
        vec2f( 1.0,  1.0)
    );
    
    let pos = positions[vertexIndex];
    var output: VertexOutput;
    output.position = vec4f(pos, 0.0, 1.0);
    // UV: (0,0) at top-left, (1,1) at bottom-right
    output.uv = pos * 0.5 + 0.5;
    output.uv.y = 1.0 - output.uv.y; // Flip Y so 0 is top
    return output;
}

fn getGradientStop(index: u32) -> vec4f {
    switch(index) {
        case 0u: { return uniforms.stop0; }
        case 1u: { return uniforms.stop1; }
        case 2u: { return uniforms.stop2; }
        case 3u: { return uniforms.stop3; }
        case 4u: { return uniforms.stop4; }
        case 5u: { return uniforms.stop5; }
        case 6u: { return uniforms.stop6; }
        case 7u: { return uniforms.stop7; }
        default: { return uniforms.stop0; }
    }
}

fn sampleGradient(t: f32) -> vec3f {
    let numStops = uniforms.numStops;
    
    if (numStops == 0u) {
        return vec3f(0.0);
    }
    
    if (numStops == 1u) {
        return getGradientStop(0u).rgb;
    }
    
    // Find the two stops to interpolate between
    var prevStop = getGradientStop(0u);
    var nextStop = getGradientStop(0u);
    
    for (var i = 0u; i < numStops; i = i + 1u) {
        let stop = getGradientStop(i);
        if (stop.a <= t) {
            prevStop = stop;
        }
        if (stop.a >= t) {
            nextStop = stop;
            break;
        }
    }
    
    // Handle edge cases
    if (t <= prevStop.a) {
        return prevStop.rgb;
    }
    if (t >= nextStop.a) {
        return nextStop.rgb;
    }
    
    // Interpolate
    let range = nextStop.a - prevStop.a;
    if (range <= 0.0) {
        return prevStop.rgb;
    }
    
    let localT = (t - prevStop.a) / range;
    return mix(prevStop.rgb, nextStop.rgb, localT);
}

fn hash12(p: vec2f) -> f32 {
    let h = dot(p, vec2f(127.1, 311.7));
    return fract(sin(h) * 43758.5453);
}

fn ditherColor(color: vec3f, uv: vec2f) -> vec3f {
    let noise = hash12(uv * 1024.0) - 0.5;
    let amount = 1.0 / 255.0;
    return clamp(color + noise * amount, vec3f(0.0), vec3f(1.0));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
    let mode = uniforms.mode;
    
    // Transparent
    if (mode == 0u) {
        return vec4f(0.0, 0.0, 0.0, 0.0);
    }
    
    // Solid color
    if (mode == 1u) {
        return uniforms.solidColor;
    }
    
    // Linear gradient
    if (mode == 2u) {
        var t: f32;
        if (uniforms.linearDirection == 0u) {
            // Vertical (top to bottom)
            t = input.uv.y;
        } else {
            // Horizontal (left to right)
            t = input.uv.x;
        }
        let color = ditherColor(sampleGradient(t), input.uv);
        return vec4f(color, 1.0);
    }
    
    // Radial gradient
    if (mode == 3u) {
        let center = uniforms.radialCenter;
        let dist = distance(input.uv, center);
        // Normalize distance so edge of screen is ~1.0
        let maxDist = max(
            max(distance(vec2f(0.0, 0.0), center), distance(vec2f(1.0, 0.0), center)),
            max(distance(vec2f(0.0, 1.0), center), distance(vec2f(1.0, 1.0), center))
        );
        let t = clamp(dist / maxDist, 0.0, 1.0);
        let color = ditherColor(sampleGradient(t), input.uv);
        return vec4f(color, 1.0);
    }
    
    return vec4f(0.0, 0.0, 0.0, 1.0);
}
