import * as PIXI from "pixi.js";

export default class NeonParticleFlow {
  constructor({ app, stage, frameSprite, options = {} }) {
    this.app = app;
    this.stage = stage;
    this.frameSprite = frameSprite;
    this.opts = {
      zIndex: 18,
      spawnRate: 140, // particles per second
      maxParticles: 220,
      minLife: 0.6, // seconds
      maxLife: 1.4,
      minSpeed: 120,
      maxSpeed: 260,
      sizeMin: 2,
      sizeMax: 6,
      blur: 3,
      inwardChance: 0.5, // chance to flow inward vs outward
      tangentialJitter: 60, // px/s added along tangent
      fadeDistance: 220, // px for distance-based fading
      // Base drag fallback if direction-specific not provided
      drag: 0.92, // per second drag
      inward: {
        speedMul: 0.85,
        lifeMul: 1.2,
        sizeMul: 0.95,
        color: 0x66eeff,
        drag: 0.93,
        alphaBias: 0.10,
        alphaMul: 1.0,
        fadeDistMul: 0.8,
      },
      outward: {
        speedMul: 1.1,
        lifeMul: 0.9,
        sizeMul: 1.0,
        color: 0x33ccff,
        drag: 0.88,
        alphaBias: 0.05,
        alphaMul: 0.9,
        fadeDistMul: 1.0,
      },
      ...options,
    };

    this.container = new PIXI.Container();
    if (typeof this.opts.zIndex === "number") this.container.zIndex = this.opts.zIndex;
    // slight blur for glow
    if (PIXI.BlurFilter) this.container.filters = [new PIXI.BlurFilter(this.opts.blur)];
    this.stage.addChild(this.container);

    this.texture = this._makeParticleTexture();
    this.particles = [];
    this.deadPool = [];
    this._accum = 0; // spawn accumulator

    this._ticker = (delta) => this.update(delta);
    this.app.ticker.add(this._ticker);
  }

  destroy() {
    if (this._ticker) this.app.ticker.remove(this._ticker);
    for (const p of this.particles) this.container.removeChild(p.sprite);
    for (const s of this.deadPool) s.destroy();
    this.particles.length = 0;
    this.deadPool.length = 0;
    if (this.texture) this.texture.destroy(true);
    this.container.destroy({ children: true });
  }

  getFrameRect() {
    return this.frameSprite.getBounds();
  }

  _makeParticleTexture() {
    // Simple white circle that we tint neon blue; blur on container provides glow
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 1);
    g.drawCircle(8, 8, 8);
    g.endFill();
    const tex = this.app.renderer.generateTexture(g);
    g.destroy();
    return tex;
  }

  spawn(dt) {
    const rate = this.opts.spawnRate;
    this._accum += rate * dt;
    const n = Math.floor(this._accum);
    this._accum -= n;
    for (let i = 0; i < n; i++) this._spawnOne();
  }

  _spawnOne() {
    if (this.particles.length >= this.opts.maxParticles) return;

    const rect = this.getFrameRect();
    const side = Math.floor(Math.random() * 4); // 0 top, 1 right, 2 bottom, 3 left
    const t = Math.random();
    let x, y, nx, ny, tx, ty;
    if (side === 0) {
      x = rect.x + rect.width * t;
      y = rect.y;
      nx = 0; ny = -1; tx = 1; ty = 0;
    } else if (side === 1) {
      x = rect.x + rect.width;
      y = rect.y + rect.height * t;
      nx = 1; ny = 0; tx = 0; ty = 1;
    } else if (side === 2) {
      x = rect.x + rect.width * (1 - t);
      y = rect.y + rect.height;
      nx = 0; ny = 1; tx = -1; ty = 0;
    } else {
      x = rect.x;
      y = rect.y + rect.height * (1 - t);
      nx = -1; ny = 0; tx = 0; ty = -1;
    }

    // Decide inward vs outward direction
    const inward = Math.random() < this.opts.inwardChance;
    const dirx = inward ? -nx : nx;
    const diry = inward ? -ny : ny;

    const speed = this.opts.minSpeed + Math.random() * (this.opts.maxSpeed - this.opts.minSpeed);
    // Add small tangential component for flow
    const tang = (Math.random() * 2 - 1) * this.opts.tangentialJitter;

    let sprite = this.deadPool.pop();
    if (!sprite) sprite = new PIXI.Sprite(this.texture);
    sprite.anchor.set(0.5);
    const dirOpts = inward ? this.opts.inward : this.opts.outward;
    sprite.tint = dirOpts.color ?? 0x4dd9ff;
    sprite.blendMode = PIXI.BLEND_MODES.ADD;
    sprite.position.set(x, y);

    const sizeBase = this.opts.sizeMin + Math.random() * (this.opts.sizeMax - this.opts.sizeMin);
    const size = sizeBase * (dirOpts.sizeMul ?? 1);
    sprite.scale.set(size / 16); // texture radius 8px → diameter 16
    sprite.alpha = 1.0;

    this.container.addChild(sprite);

    const lifeBase = this.opts.minLife + Math.random() * (this.opts.maxLife - this.opts.minLife);
    const life = lifeBase * (dirOpts.lifeMul ?? 1);
    const p = {
      sprite,
      vx: dirx * (speed * (dirOpts.speedMul ?? 1)) + tx * tang,
      vy: diry * (speed * (dirOpts.speedMul ?? 1)) + ty * tang,
      age: 0,
      life,
      inward,
      drag: dirOpts.drag ?? this.opts.drag,
      fadeDistMul: dirOpts.fadeDistMul ?? 1,
      alphaBias: dirOpts.alphaBias ?? 0,
      alphaMul: dirOpts.alphaMul ?? 1,
    };
    this.particles.push(p);
  }

  update(delta) {
    const dt = (delta || 1) / 60; // seconds assuming 60fps baseline
    this.spawn(dt);

    const rect = this.getFrameRect();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        // recycle
        this.container.removeChild(p.sprite);
        this.deadPool.push(p.sprite);
        this.particles.splice(i, 1);
        continue;
      }

      // Integrate motion with light curl
      // Curl adds slight perpendicular oscillation for organic movement
      const curl = Math.sin((p.age * 6.283) * 1.2) * 18;
      const vx = p.vx;
      const vy = p.vy;
      // perpendicular to velocity
      const len = Math.hypot(vx, vy) || 1;
      const cx = -vy / len;
      const cy = vx / len;
      p.vx += cx * curl * dt;
      p.vy += cy * curl * dt;

      const drag = Math.pow(p.drag ?? this.opts.drag, dt * 60);
      p.vx *= drag;
      p.vy *= drag;

      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;

      // Fade with age and distance to the frame perimeter: stronger near the frame
      const kAge = 1.0 - p.age / p.life; // 1→0
      const dist = distanceToRectPerimeter(p.sprite.x, p.sprite.y, rect);
      const fadeD = Math.max(1e-3, this.opts.fadeDistance * (p.fadeDistMul ?? 1));
      const kDist = Math.max(0, 1 - dist / fadeD); // 1 near frame edge, 0 far
      const alpha = (p.alphaBias ?? 0) + (p.alphaMul ?? 1) * kAge * kDist;
      p.sprite.alpha = Math.max(0, Math.min(1, alpha));
    }
  }
}

function distanceToRectPerimeter(x, y, rect) {
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.width;
  const y1 = rect.y + rect.height;
  const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (inside) {
    const dx = Math.min(x - x0, x1 - x);
    const dy = Math.min(y - y0, y1 - y);
    return Math.min(dx, dy);
  } else {
    const dx = (x < x0) ? (x0 - x) : ((x > x1) ? (x - x1) : 0);
    const dy = (y < y0) ? (y0 - y) : ((y > y1) ? (y - y1) : 0);
    return Math.hypot(dx, dy);
  }
}
