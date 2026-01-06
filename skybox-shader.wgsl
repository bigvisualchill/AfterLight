// Skybox Shader

struct VertexInput {
    @location(0) position: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) screenPos: vec2<f32>,
}

@vertex
fn vs(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Render as full-screen quad
    // Input position is in clip space (-1 to 1)
    output.position = vec4<f32>(input.position.xy, 0.999, 1.0);
    output.screenPos = input.position.xy;
    
    return output;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    // Use screen Y position for gradient (top to bottom)
    // screenPos.y ranges from -1 (bottom) to 1 (top)
    // We want horizon in the middle, so invert and adjust
    let horizon = -input.screenPos.y; // Now -1 is top, 1 is bottom
    
    // Sun position (near horizon, slightly to the right)
    // Sun is at screen position (0.3, -0.2) - slightly right, slightly above center
    let sunPos = vec2<f32>(0.3, -0.2);
    let sunDist = distance(input.screenPos, sunPos);
    let sun = exp(-sunDist * 8.0) * 2.0;
    
    // Sky gradient colors
    let topColor = vec3<f32>(0.1, 0.1, 0.2); // Dark blue/purple at top
    let horizonColor = vec3<f32>(1.0, 0.6, 0.3); // Warm orange at horizon
    let sunColor = vec3<f32>(1.0, 0.8, 0.4); // Bright yellow sun
    
    // Mix based on vertical position
    let t = smoothstep(-0.3, 0.3, horizon);
    var color = mix(topColor, horizonColor, t);
    
    // Add sun
    color += sunColor * sun;
    
    // Add some atmospheric scattering
    let scatter = max(0.0, horizon) * 0.3;
    color += vec3<f32>(0.8, 0.5, 0.3) * scatter;
    
    return vec4<f32>(color, 1.0);
}

