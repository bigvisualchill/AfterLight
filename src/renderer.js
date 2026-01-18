// WebGPU Renderer: Pipeline setup, buffer management, and render passes

import { state } from './state.js';

// ============================================================================
// Mesh Geometry Builders
// ============================================================================

export function buildCube() {
  const p = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
  ];
  const faces = [
    [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7],
    [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0],
  ];
  const normals = [
    [0, 0, -1], [0, 0, 1], [-1, 0, 0],
    [1, 0, 0], [0, 1, 0], [0, -1, 0],
  ];
  const barys = [
    [1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0],
    [0, 0, 1], [1, 0, 0],
  ];
  const vertices = [];
  const indices = [];
  for (let fi = 0; fi < 6; fi++) {
    const [a, b, c, d] = faces[fi];
    const n = normals[fi];
    const base = vertices.length / 9;
    [a, b, c, d].forEach((vi, bi) => {
      vertices.push(...p[vi], ...n, ...barys[bi % 3]);
    });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

export function buildIcosahedron() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const len = Math.hypot(1, phi);
  const a = 1 / len, b = phi / len;
  const base = [
    [-a, b, 0], [a, b, 0], [-a, -b, 0], [a, -b, 0],
    [0, -a, b], [0, a, b], [0, -a, -b], [0, a, -b],
    [b, 0, -a], [b, 0, a], [-b, 0, -a], [-b, 0, a],
  ];
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const vertices = [];
  const indices = [];
  for (let fi = 0; fi < faces.length; fi++) {
    const [i0, i1, i2] = faces[fi];
    const v0 = base[i0], v1 = base[i1], v2 = base[i2];
    const ax = v1[0] - v0[0], ay = v1[1] - v0[1], az = v1[2] - v0[2];
    const bx = v2[0] - v0[0], by = v2[1] - v0[1], bz = v2[2] - v0[2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const n = [nx / nl, ny / nl, nz / nl];
    const vi = vertices.length / 9;
    vertices.push(...v0, ...n, 1, 0, 0);
    vertices.push(...v1, ...n, 0, 1, 0);
    vertices.push(...v2, ...n, 0, 0, 1);
    indices.push(vi, vi + 1, vi + 2);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

export function buildSphere(divs) {
  const vertices = [];
  const indices = [];
  for (let lat = 0; lat <= divs; lat++) {
    const theta = (lat * Math.PI) / divs;
    const sinT = Math.sin(theta), cosT = Math.cos(theta);
    for (let lon = 0; lon <= divs; lon++) {
      const phi = (lon * 2 * Math.PI) / divs;
      const x = Math.cos(phi) * sinT;
      const y = cosT;
      const z = Math.sin(phi) * sinT;
      const baryIndex = (lat * (divs + 1) + lon) % 3;
      const bary = baryIndex === 0 ? [1, 0, 0] : baryIndex === 1 ? [0, 1, 0] : [0, 0, 1];
      vertices.push(x, y, z, x, y, z, ...bary);
    }
  }
  for (let lat = 0; lat < divs; lat++) {
    for (let lon = 0; lon < divs; lon++) {
      const a = lat * (divs + 1) + lon;
      const b = a + divs + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

function midpoint(a, b) {
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const len = Math.hypot(m[0], m[1], m[2]) || 1;
  return [m[0] / len, m[1] / len, m[2] / len];
}

export function buildIcosphere(subdivisions) {
  const phi = (1 + Math.sqrt(5)) / 2;
  const len = Math.hypot(1, phi);
  const a = 1 / len, b = phi / len;
  let verts = [
    [-a, b, 0], [a, b, 0], [-a, -b, 0], [a, -b, 0],
    [0, -a, b], [0, a, b], [0, -a, -b], [0, a, -b],
    [b, 0, -a], [b, 0, a], [-b, 0, -a], [-b, 0, a],
  ];
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  for (let s = 0; s < subdivisions; s++) {
    const cache = {};
    const getMid = (i0, i1) => {
      const key = i0 < i1 ? `${i0}_${i1}` : `${i1}_${i0}`;
      if (cache[key] !== undefined) return cache[key];
      const m = midpoint(verts[i0], verts[i1]);
      cache[key] = verts.length;
      verts.push(m);
      return cache[key];
    };
    const newFaces = [];
    for (const [i0, i1, i2] of faces) {
      const a = getMid(i0, i1);
      const b = getMid(i1, i2);
      const c = getMid(i2, i0);
      newFaces.push([i0, a, c], [i1, b, a], [i2, c, b], [a, b, c]);
    }
    faces = newFaces;
  }
  const vertices = [];
  const indices = [];
  for (let fi = 0; fi < faces.length; fi++) {
    const [i0, i1, i2] = faces[fi];
    const v0 = verts[i0], v1 = verts[i1], v2 = verts[i2];
    const vi = vertices.length / 9;
    vertices.push(...v0, ...v0, 1, 0, 0);
    vertices.push(...v1, ...v1, 0, 1, 0);
    vertices.push(...v2, ...v2, 0, 0, 1);
    indices.push(vi, vi + 1, vi + 2);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

export function buildQuad() {
  const vertices = new Float32Array([
    -1, -1, 0, 0, 0, 1, 1, 0, 0,
     1, -1, 0, 0, 0, 1, 0, 1, 0,
     1,  1, 0, 0, 0, 1, 0, 0, 1,
    -1,  1, 0, 0, 0, 1, 0, 1, 0,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  return { vertices, indices };
}

// ============================================================================
// Renderer Class
// ============================================================================

export class Renderer {
  constructor() {
    this.device = null;
    this.context = null;
    this.format = null;
    this.canvas = null;
    
    // Pipelines
    this.particlePipeline = null;
    this.backgroundPipeline = null;
    this.cocPipeline = null;
    this.blurFarPipeline = null;
    this.blurNearPipeline = null;
    this.compositePipeline = null;
    
    // Buffers
    this.uniformBuffer = null;
    this.instanceBuffer = null;
    this.meshBuffers = {};
    this.backgroundUniformBuffer = null;
    this.bgGradientBuffer = null;
    
    // DOF resources
    this.cocBuffer = null;
    this.blurBuffer = null;
    this.compositeBuffer = null;
    this.hdrTexture = null;
    this.depthTexture = null;
    this.cocTexture = null;
    this.blurFarTexture = null;
    this.blurNearTexture = null;
    
    // Bind groups
    this.particleBindGroup = null;
    this.backgroundBindGroup = null;
    this.cocBindGroup = null;
    this.blurFarBindGroup = null;
    this.blurNearBindGroup = null;
    this.compositeBindGroup = null;
    
    // Noise texture for particle effects
    this.noiseTexture = null;
    this.noiseSampler = null;
    this.linearSampler = null;
    
    // Timestamp queries
    this.timestampSupported = false;
    this.timestampQuerySet = null;
    this.timestampBuffer = null;
    this.timestampReadBuffer = null;
    
    // Size tracking
    this.width = 0;
    this.height = 0;

    // Instance capacity (for dynamic stress testing)
    this.instanceCapacity = 0;
  }

  /**
   * Initialize the WebGPU renderer
   * @param {HTMLCanvasElement} canvas - The canvas element
   * @returns {Promise<boolean>} Whether initialization succeeded
   */
  async init(canvas) {
    if (!navigator.gpu) {
      console.error("WebGPU not supported");
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.error("No WebGPU adapter found");
      return false;
    }

    // Record basic GPU label when available (timing queries may be unsupported).
    try {
      const info = adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : adapter.info;
      const label =
        (info && (info.description || info.device || info.architecture || info.vendor)) ||
        "";
      if (typeof label === "string") state.perf.gpuLabel = label;
    } catch {
      // Adapter info may be blocked by the browser for privacy reasons.
    }

    // Check for timestamp query support
    this.timestampSupported = adapter.features.has("timestamp-query");
    const requiredFeatures = this.timestampSupported ? ["timestamp-query"] : [];

    this.device = await adapter.requestDevice({ requiredFeatures });
    this.canvas = canvas;
    this.context = canvas.getContext("webgpu");
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });

    // Timestamp queries disabled - API changed in recent WebGPU versions
    this.timestampSupported = false;
    state.perf.gpuTimingSupported = Boolean(this.timestampSupported);

    await this.createResources();
    return true;
  }

  /**
   * Create all GPU resources (buffers, textures, pipelines)
   */
  async createResources() {
    // Create uniform buffer
    this.uniformBuffer = this.device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create instance buffer for particles
    const maxParticles = state.particle.capacity;
    this.instanceCapacity = maxParticles;
    this.instanceBuffer = this.device.createBuffer({
      size: maxParticles * 17 * 4, // 17 floats per instance
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Create mesh buffers
    await this.createMeshBuffers();

    // Create noise texture
    await this.createNoiseTexture();

    // Create samplers
    this.noiseSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
    });

    this.linearSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });

    // Create background resources - struct needs 192 bytes (12 vec4f aligned)
    this.backgroundUniformBuffer = this.device.createBuffer({
      size: 192,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create DOF resources
    this.cocBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.blurBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.compositeBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Load shaders and create pipelines
    await this.createPipelines();
  }

  async createMeshBuffers() {
    const meshes = {
      cube: buildCube(),
      icosahedron: buildIcosahedron(),
      sphere: buildSphere(16),
      quad: buildQuad(),
    };

    // Build icospheres with different subdivision levels
    for (let i = 0; i <= 4; i++) {
      meshes[`icosphere${i}`] = buildIcosphere(i);
    }

    for (const [name, mesh] of Object.entries(meshes)) {
      const vertexBuffer = this.device.createBuffer({
        size: mesh.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(vertexBuffer, 0, mesh.vertices);

      const indexBuffer = this.device.createBuffer({
        size: mesh.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(indexBuffer, 0, mesh.indices);

      this.meshBuffers[name] = {
        vertex: vertexBuffer,
        index: indexBuffer,
        indexCount: mesh.indices.length,
      };
    }
  }

  async createNoiseTexture() {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const v = Math.floor(Math.random() * 256);
      data[i * 4 + 0] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }

    this.noiseTexture = this.device.createTexture({
      size: [size, size],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    this.device.queue.writeTexture(
      { texture: this.noiseTexture },
      data,
      { bytesPerRow: size * 4 },
      { width: size, height: size }
    );
  }

  async createPipelines() {
    // Load particle shader
    const particleShaderCode = await fetch("shaders/particle.wgsl").then(r => r.text());
    const particleModule = this.device.createShaderModule({ code: particleShaderCode });

    // Particle pipeline bind group layout
    const particleBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      ],
    });

    const vertexBufferLayouts = [
      // Mesh vertex data
      {
        arrayStride: 36,
        stepMode: "vertex",
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },  // position
          { shaderLocation: 1, offset: 12, format: "float32x3" }, // normal
          { shaderLocation: 11, offset: 24, format: "float32x3" }, // barycentric
        ],
      },
      // Instance data
      {
        arrayStride: 68,
        stepMode: "instance",
        attributes: [
          { shaderLocation: 2, offset: 0, format: "float32x3" },  // instPos
          { shaderLocation: 3, offset: 12, format: "float32" },   // instSize
          { shaderLocation: 4, offset: 16, format: "float32" },   // lifeT
          { shaderLocation: 5, offset: 20, format: "float32" },   // seed
          { shaderLocation: 6, offset: 24, format: "float32x3" }, // axis
          { shaderLocation: 7, offset: 36, format: "float32" },   // spin
          { shaderLocation: 8, offset: 40, format: "float32x3" }, // instVel
          { shaderLocation: 9, offset: 52, format: "float32" },   // instOpacity
          { shaderLocation: 10, offset: 56, format: "float32x3" }, // instColor
        ],
      },
    ];

    // Create three particle pipelines: additive, screen, normal
    const blendModes = {
      additive: {
        // Premultiplied additive.
        color: { srcFactor: "one", dstFactor: "one", operation: "add" },
        alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
      },
      screen: {
        // Approximate screen blend: use one-minus-src for color
        color: { srcFactor: "one", dstFactor: "one-minus-src", operation: "add" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      },
      normal: {
        color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      },
      multiply: {
        // Multiply: src * dst (approx) using destination color factor.
        color: { srcFactor: "dst", dstFactor: "zero", operation: "add" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      },
    };

    this.particlePipelines = {};
    for (const [mode, blend] of Object.entries(blendModes)) {
      this.particlePipelines[mode] = this.device.createRenderPipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [particleBindGroupLayout] }),
        vertex: {
          module: particleModule,
          entryPoint: "vs_main",
          buffers: vertexBufferLayouts,
        },
        fragment: {
          module: particleModule,
          entryPoint: "fs_main",
          targets: [{
            format: "rgba16float",
            blend,
          }],
        },
        primitive: { topology: "triangle-list", cullMode: "none" },
        depthStencil: {
          depthWriteEnabled: true,
          depthCompare: "less",
          format: "depth24plus",
        },
      });
    }

    // Background pipeline
    const bgShaderCode = await fetch("shaders/background.wgsl").then(r => r.text());
    const bgModule = this.device.createShaderModule({ code: bgShaderCode });

    const bgBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });

    this.backgroundPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgBindGroupLayout] }),
      vertex: { module: bgModule, entryPoint: "vs_main" },
      fragment: {
        module: bgModule,
        entryPoint: "fs_main",
        targets: [{ format: "rgba16float" }],
      },
      primitive: { topology: "triangle-list" },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "always",
        format: "depth24plus",
      },
    });

    // DOF pipelines
    const dofShaderCode = await fetch("shaders/dof.wgsl").then(r => r.text());
    const dofModule = this.device.createShaderModule({ code: dofShaderCode });

    // CoC pipeline - binding 0: depth texture, binding 1: uniform
    const cocLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });

    this.cocPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [cocLayout] }),
      vertex: { module: dofModule, entryPoint: "vs_coc" },
      fragment: {
        module: dofModule,
        entryPoint: "fs_coc",
        // `fs_coc` outputs a single `f32` (CoC), so use a single-channel target.
        targets: [{ format: "r16float" }],
      },
      primitive: { topology: "triangle-list" },
    });

    // Blur pipelines - bindings: color(0), coc(1), depth(2), sampler(3), uniform(4)
    const blurLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });

    this.blurFarPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [blurLayout] }),
      vertex: { module: dofModule, entryPoint: "vs_coc" },
      fragment: {
        module: dofModule,
        entryPoint: "fs_blur_far",
        targets: [{ format: "rgba16float" }],
      },
      primitive: { topology: "triangle-list" },
    });

    this.blurNearPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [blurLayout] }),
      vertex: { module: dofModule, entryPoint: "vs_coc" },
      fragment: {
        module: dofModule,
        entryPoint: "fs_blur_near",
        targets: [{ format: "rgba16float" }],
      },
      primitive: { topology: "triangle-list" },
    });

    // Composite pipeline - bindings: sharp(0), far(1), near(2), coc(3), sampler(4), uniform(5)
    const compositeLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });

    this.compositePipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [compositeLayout] }),
      vertex: { module: dofModule, entryPoint: "vs_coc" },
      fragment: {
        module: dofModule,
        entryPoint: "fs_composite",
        targets: [{ format: this.format }],
      },
      primitive: { topology: "triangle-list" },
    });

    // Store layouts for bind group creation
    this.particleBindGroupLayout = particleBindGroupLayout;
    this.bgBindGroupLayout = bgBindGroupLayout;
    this.cocLayout = cocLayout;
    this.blurLayout = blurLayout;
    this.compositeLayout = compositeLayout;
  }

  /**
   * Resize all resolution-dependent resources
   * @param {number} width - New width in pixels
   * @param {number} height - New height in pixels
   */
  resize(width, height) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;

    // Recreate textures
    if (this.hdrTexture) this.hdrTexture.destroy();
    if (this.depthTexture) this.depthTexture.destroy();
    if (this.cocTexture) this.cocTexture.destroy();
    if (this.blurFarTexture) this.blurFarTexture.destroy();
    if (this.blurNearTexture) this.blurNearTexture.destroy();

    this.hdrTexture = this.device.createTexture({
      size: [width, height],
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.depthTexture = this.device.createTexture({
      size: [width, height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.cocTexture = this.device.createTexture({
      size: [width, height],
      format: "r16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.blurFarTexture = this.device.createTexture({
      size: [width, height],
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.blurNearTexture = this.device.createTexture({
      size: [width, height],
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    // Recreate bind groups
    this.createBindGroups();
  }

  createBindGroups() {
    // Particle bind group
    this.particleBindGroup = this.device.createBindGroup({
      layout: this.particleBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.noiseTexture.createView() },
        { binding: 2, resource: this.noiseSampler },
      ],
    });

    // Background bind group
    this.backgroundBindGroup = this.device.createBindGroup({
      layout: this.bgBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.backgroundUniformBuffer } },
      ],
    });

    // CoC bind group - binding 0: depth, binding 1: uniform
    this.cocBindGroup = this.device.createBindGroup({
      layout: this.cocLayout,
      entries: [
        { binding: 0, resource: this.depthTexture.createView() },
        { binding: 1, resource: { buffer: this.cocBuffer } },
      ],
    });

    // Blur bind groups - bindings: color(0), coc(1), depth(2), sampler(3), uniform(4)
    this.blurFarBindGroup = this.device.createBindGroup({
      layout: this.blurLayout,
      entries: [
        { binding: 0, resource: this.hdrTexture.createView() },
        { binding: 1, resource: this.cocTexture.createView() },
        { binding: 2, resource: this.depthTexture.createView() },
        { binding: 3, resource: this.linearSampler },
        { binding: 4, resource: { buffer: this.blurBuffer } },
      ],
    });

    this.blurNearBindGroup = this.device.createBindGroup({
      layout: this.blurLayout,
      entries: [
        { binding: 0, resource: this.hdrTexture.createView() },
        { binding: 1, resource: this.cocTexture.createView() },
        { binding: 2, resource: this.depthTexture.createView() },
        { binding: 3, resource: this.linearSampler },
        { binding: 4, resource: { buffer: this.blurBuffer } },
      ],
    });

    // Composite bind group - bindings: sharp(0), far(1), near(2), coc(3), sampler(4), uniform(5)
    this.compositeBindGroup = this.device.createBindGroup({
      layout: this.compositeLayout,
      entries: [
        { binding: 0, resource: this.hdrTexture.createView() },
        { binding: 1, resource: this.blurFarTexture.createView() },
        { binding: 2, resource: this.blurNearTexture.createView() },
        { binding: 3, resource: this.cocTexture.createView() },
        { binding: 4, resource: this.linearSampler },
        { binding: 5, resource: { buffer: this.compositeBuffer } },
      ],
    });
  }

  /**
   * Get the mesh buffer for the current particle shape
   * @returns {Object} Mesh buffer with vertex, index, and indexCount
   */
  getCurrentMeshBuffer() {
    if (state.perf.lowCostRender) return this.meshBuffers.quad;
    const shape = state.particle.shape;
    if (shape === "sphere") {
      const subdiv = Math.min(4, Math.max(0, state.particle.sphereSubdivisions));
      return this.meshBuffers[`icosphere${subdiv}`];
    }
    if (shape === "icosahedron") return this.meshBuffers.icosahedron;
    if (shape === "cube") return this.meshBuffers.cube;
    return this.meshBuffers.quad;
  }

  /**
   * Update uniform buffers with new data
   */
  updateUniforms(uniformData, bgUniformData, cocData, blurData, compositeData, dofEnabled) {
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    this.device.queue.writeBuffer(this.backgroundUniformBuffer, 0, bgUniformData);
    
    if (dofEnabled) {
      this.device.queue.writeBuffer(this.cocBuffer, 0, cocData);
      this.device.queue.writeBuffer(this.blurBuffer, 0, blurData);
      this.device.queue.writeBuffer(this.compositeBuffer, 0, compositeData);
    }
  }

  /**
   * Update instance buffer with particle data
   */
  updateInstances(instanceData, particleCount) {
    if (particleCount > 0) {
      this.device.queue.writeBuffer(
        this.instanceBuffer, 
        0, 
        instanceData.buffer, 
        0, 
        particleCount * 17 * 4
      );
    }
  }

  ensureInstanceCapacity(requiredParticles) {
    if (!Number.isFinite(requiredParticles) || requiredParticles <= this.instanceCapacity) return;
    if (!this.device) return;

    const nextCapacity = Math.max(
      requiredParticles,
      this.instanceCapacity > 0 ? this.instanceCapacity * 2 : requiredParticles
    );

    this.instanceCapacity = nextCapacity;
    if (this.instanceBuffer) this.instanceBuffer.destroy();
    this.instanceBuffer = this.device.createBuffer({
      size: nextCapacity * 17 * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }

  /**
   * Render a frame
   * @param {number} particleCount - Number of particles to render
   * @param {boolean} dofEnabled - Whether DOF is enabled
   * @param {Float32Array} blurNearData - Near blur uniform data
   */
  render(particleCount, dofEnabled, blurNearData) {
    const commandEncoder = this.device.createCommandEncoder();

    // Get mesh buffer
    const mesh = this.getCurrentMeshBuffer();

    // Main render pass (to HDR texture)
    {
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: this.hdrTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        }],
        depthStencilAttachment: {
          view: this.depthTexture.createView(),
          depthClearValue: 1.0,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      // Render background (6 vertices for fullscreen quad)
      pass.setPipeline(this.backgroundPipeline);
      pass.setBindGroup(0, this.backgroundBindGroup);
      pass.draw(6);

      // Render particles
      if (particleCount > 0) {
        const pipeline = this.particlePipelines[state.particle.blendMode] || this.particlePipelines.screen;
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, this.particleBindGroup);
        pass.setVertexBuffer(0, mesh.vertex);
        pass.setVertexBuffer(1, this.instanceBuffer);
        pass.setIndexBuffer(mesh.index, "uint16");
        pass.drawIndexed(mesh.indexCount, particleCount);
      }

      pass.end();
    }

    if (dofEnabled) {
      // CoC pass
      {
        const pass = commandEncoder.beginRenderPass({
          colorAttachments: [{
            view: this.cocTexture.createView(),
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        pass.setPipeline(this.cocPipeline);
        pass.setBindGroup(0, this.cocBindGroup);
        pass.draw(3);
        pass.end();
      }

      // Blur far pass
      {
        const pass = commandEncoder.beginRenderPass({
          colorAttachments: [{
            view: this.blurFarTexture.createView(),
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        pass.setPipeline(this.blurFarPipeline);
        pass.setBindGroup(0, this.blurFarBindGroup);
        pass.draw(3);
        pass.end();
      }

      // Blur near pass (update uniform for near pass)
      this.device.queue.writeBuffer(this.blurBuffer, 0, blurNearData);
      {
        const pass = commandEncoder.beginRenderPass({
          colorAttachments: [{
            view: this.blurNearTexture.createView(),
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        pass.setPipeline(this.blurNearPipeline);
        pass.setBindGroup(0, this.blurNearBindGroup);
        pass.draw(3);
        pass.end();
      }

      // Composite pass (to swapchain)
      {
        const pass = commandEncoder.beginRenderPass({
          colorAttachments: [{
            view: this.context.getCurrentTexture().createView(),
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        pass.setPipeline(this.compositePipeline);
        pass.setBindGroup(0, this.compositeBindGroup);
        pass.draw(3);
        pass.end();
      }
    } else {
      // Direct copy to swapchain (simple tonemap)
      // For now, just render particles directly to swapchain without DOF
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: this.context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      pass.setPipeline(this.compositePipeline);
      pass.setBindGroup(0, this.compositeBindGroup);
      pass.draw(3);
      pass.end();
    }

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Read GPU timing results (disabled - API changed)
   * @returns {Promise<number|null>} Always returns null
   */
  async readGpuTime() {
    return null;
  }

  /**
   * Estimate GPU work time by waiting for submitted work to complete.
   * This is not as accurate as timestamp queries, but avoids vsync-wait artifacts.
   * @returns {Promise<number|null>} Estimated GPU time in ms
   */
  async readGpuWorkDoneMs() {
    if (!this.device) return null;
    const t0 = performance.now();
    try {
      await this.device.queue.onSubmittedWorkDone();
      return Math.max(0, performance.now() - t0);
    } catch {
      return null;
    }
  }
}
