export class ParticleSystem {
    constructor(device) {
        this.device = device;
        this.maxParticles = 100000; // Support up to 100k particles
        this.nextWriteIndex = 0; // Next index to write particles (circular buffer)
        
        // Particle data: position (vec2), velocity (vec2), age (float), type (float)
        // Each particle = 8 floats = 32 bytes
        this.particleBufferSize = this.maxParticles * 8 * 4;
        
        // Create buffers
        this.particleBuffer = device.createBuffer({
            size: this.particleBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        // Render buffer - one entry per particle (used for instancing)
        // Each particle: position vec2, age float, type float = 4 floats = 16 bytes
        this.renderBufferSize = this.maxParticles * 4 * 4;
        this.renderBuffer = device.createBuffer({
            size: this.renderBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        // Initialize with empty particles
        this.initializeParticles();
        
        // Create bind groups
        this.computeBindGroup = null;
        this.renderBindGroup = null;
        this.createBindGroups();
    }

    initializeParticles() {
        // Initialize all particles as inactive (age = 1.0 means dead)
        const particleData = new Float32Array(this.maxParticles * 8);
        for (let i = 0; i < this.maxParticles; i++) {
            const idx = i * 8;
            // position (vec2) - set to 0
            particleData[idx] = 0;
            particleData[idx + 1] = 0;
            // velocity (vec2) - set to 0
            particleData[idx + 2] = 0;
            particleData[idx + 3] = 0;
            // age - set to 1.0 (dead)
            particleData[idx + 4] = 1.0;
            // type - 0 = main, 1 = auxiliary
            particleData[idx + 5] = 0;
            // padding
            particleData[idx + 6] = 0;
            particleData[idx + 7] = 0;
        }
        
        this.device.queue.writeBuffer(this.particleBuffer, 0, particleData);
        
        // Initialize render buffer - one entry per particle
        const renderData = new Float32Array(this.maxParticles * 4);
        for (let i = 0; i < this.maxParticles; i++) {
            const idx = i * 4;
            renderData[idx] = 0;     // pos.x
            renderData[idx + 1] = 0; // pos.y
            renderData[idx + 2] = 1.0; // age (dead)
            renderData[idx + 3] = 0;   // type
        }
        
        this.device.queue.writeBuffer(this.renderBuffer, 0, renderData);
    }

    createBindGroups() {
        // Compute bind group layout will be created by pipeline
        // For now, we'll create it when we have the pipeline
    }

    updateBindGroups(computePipeline, uniformBuffer) {
        // Compute bind group
        this.computeBindGroup = this.device.createBindGroup({
            layout: computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.particleBuffer } },
                { binding: 1, resource: { buffer: this.renderBuffer } },
                { binding: 2, resource: { buffer: uniformBuffer } },
            ],
        });
    }

    spawnParticles(x, y, count, particleSpeed, device) {
        const newParticles = [];
        
        // Spawn particles from the click point
        for (let i = 0; i < count; i++) {
            // Very small random spread around the spawn point
            const spread = 0.003;
            
            // Give particles a slight outward velocity with random variation
            const angle = (Math.random() - 0.5) * 0.5; // Small angle variation
            const speed = (0.2 + Math.random() * 0.3) * particleSpeed;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            newParticles.push({
                x: x + (Math.random() - 0.5) * spread,
                y: y + (Math.random() - 0.5) * spread,
                vx,
                vy,
                age: 0.0,
                particleType: 0, // All particles are main particles
            });
        }
        
        // Write new particles to buffer
        this.writeParticlesToBuffer(newParticles, device);
    }

    writeParticlesToBuffer(particles, device) {
        if (particles.length === 0) return;
        
        const particleData = new Float32Array(particles.length * 8);
        const renderData = new Float32Array(particles.length * 4);
        
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const idx = i * 8;
            particleData[idx] = p.x;
            particleData[idx + 1] = p.y;
            particleData[idx + 2] = p.vx;
            particleData[idx + 3] = p.vy;
            particleData[idx + 4] = p.age;
            particleData[idx + 5] = p.particleType;
            particleData[idx + 6] = 0; // padding
            particleData[idx + 7] = 0; // padding
            
            // Also update render buffer
            const renderIdx = i * 4;
            renderData[renderIdx] = p.x;
            renderData[renderIdx + 1] = p.y;
            renderData[renderIdx + 2] = p.age;
            renderData[renderIdx + 3] = p.particleType;
        }
        
        // Use staging buffers for upload
        const particleStagingBuffer = device.createBuffer({
            size: particleData.byteLength,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        
        new Float32Array(particleStagingBuffer.getMappedRange()).set(particleData);
        particleStagingBuffer.unmap();
        
        const renderStagingBuffer = device.createBuffer({
            size: renderData.byteLength,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        
        new Float32Array(renderStagingBuffer.getMappedRange()).set(renderData);
        renderStagingBuffer.unmap();
        
        // Find write offset - use circular buffer, always write at nextWriteIndex
        // This allows particles to naturally expire and their slots to be reused
        let writeOffset = this.nextWriteIndex * 8 * 4;
        let renderWriteOffset = this.nextWriteIndex * 4 * 4;
        
        // If we exceed buffer size, wrap around (circular buffer)
        if (writeOffset + particleData.byteLength > this.particleBufferSize) {
            writeOffset = 0;
            renderWriteOffset = 0;
            this.nextWriteIndex = 0;
        }
        
        // Copy to main buffers
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(
            particleStagingBuffer,
            0,
            this.particleBuffer,
            writeOffset,
            particleData.byteLength
        );
        commandEncoder.copyBufferToBuffer(
            renderStagingBuffer,
            0,
            this.renderBuffer,
            renderWriteOffset,
            renderData.byteLength
        );
        device.queue.submit([commandEncoder.finish()]);
        
        // Update next write index for circular buffer
        this.nextWriteIndex = (this.nextWriteIndex + particles.length) % this.maxParticles;
    }

    getParticleCount() {
        // Return max particles - we'll let the shader skip dead ones
        // The actual active count is tracked but we render all slots and let shader discard dead ones
        return this.maxParticles;
    }

    getComputeBindGroup(uniformBuffer) {
        return this.computeBindGroup;
    }

    getRenderBindGroup() {
        return this.renderBindGroup;
    }

    getRenderBuffer() {
        return this.renderBuffer;
    }
}

