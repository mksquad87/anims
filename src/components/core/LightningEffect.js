import * as PIXI from "pixi.js";

// Electric lightning effect around a rectangular frame.
// Draws fast, flickering jagged bolts with faux glow using blur and additive blending.
export class ElectricFrameEffect {
  constructor({ app, stage, frameSprite, options = {} }) {
    this.app = app;
    this.stage = stage;
    this.frameSprite = frameSprite;
    this.opts = {
      // How far outside the frame to originate effects
      margin: 24,
      // Number of max simultaneous bolts
      maxBolts: 8,
      // Chance per frame to spawn a bolt (0..1)
      spawnChance: 0.25,
      // Lifetime in ms
      minLife: 60,
      maxLife: 160,
      // Jaggedness
      segments: 18,
      amplitude: 18,
      // Visuals
      colorCore: 0xffffff,
      colorGlow: 0x33ccff,
      lineWidthCore: 2,
      lineWidthGlow: 8,
      blur: 8,
      // Slight hue shift flicker
      flickerAlphaMin: 0.5,
      flickerAlphaMax: 1.0,
      ...options,
    };

    this.container = new PIXI.Container();
    this.container.sortableChildren = false;
    if (typeof this.opts.zIndex === "number") this.container.zIndex = this.opts.zIndex;
    this.stage.addChild(this.container);

    // Two layered graphics: blurred/thick glow + sharp core, both additive
    this.gGlow = new PIXI.Graphics();
    this.gCore = new PIXI.Graphics();
    this.gGlow.blendMode = PIXI.BLEND_MODES.ADD;
    this.gCore.blendMode = PIXI.BLEND_MODES.ADD;
    // Blur to fake glow
    if (PIXI.BlurFilter) {
      this.gGlow.filters = [new PIXI.BlurFilter(this.opts.blur)];
    }

    this.container.addChild(this.gGlow);
    this.container.addChild(this.gCore);

    this.bolts = []; // { points: [PIXI.Point], bornAt: ms, life: ms }

    this._tickerFn = (delta) => this.update(delta);
    this.app.ticker.add(this._tickerFn);
  }

  destroy() {
    if (this._tickerFn) this.app.ticker.remove(this._tickerFn);
    this.container.destroy({ children: true });
    this.bolts.length = 0;
  }

  // Public: allow runtime option tweaks
  setOptions(partial) {
    Object.assign(this.opts, partial);
  }

  getFrameOuterRect() {
    // Use local transform for stable coordinates; getBounds gives global, but stage is same space
    const b = this.frameSprite.getBounds();
    const m = this.opts.margin;
    return new PIXI.Rectangle(b.x - m, b.y - m, b.width + m * 2, b.height + m * 2);
  }

  update() {
    // Randomly spawn bolts
    if (this.bolts.length < this.opts.maxBolts && Math.random() < this.opts.spawnChance) {
      this.spawnBolt();
    }

    const now = performance.now();
    // Cull expired
    this.bolts = this.bolts.filter((b) => now - b.bornAt < b.life);

    // Flicker alpha
    const alpha = this.opts.flickerAlphaMin + Math.random() * (this.opts.flickerAlphaMax - this.opts.flickerAlphaMin);
    this.gGlow.alpha = alpha;
    this.gCore.alpha = alpha;

    // Redraw
    this.gGlow.clear();
    this.gCore.clear();

    for (const bolt of this.bolts) {
      // Progress fade based on age
      const t = (now - bolt.bornAt) / bolt.life; // 0..1
      const falloff = 1.0 - t;
      const widthGlow = Math.max(1, this.opts.lineWidthGlow * falloff);
      const widthCore = Math.max(1, this.opts.lineWidthCore * falloff);

      // Glow layer
      this.gGlow.lineStyle(widthGlow, this.opts.colorGlow, 0.9 * falloff);
      this.tracePolyline(this.gGlow, bolt.points);
      // Core layer on top
      this.gCore.lineStyle(widthCore, this.opts.colorCore, 1.0 * falloff);
      this.tracePolyline(this.gCore, bolt.points);
    }
  }

  tracePolyline(g, points) {
    if (!points || points.length === 0) return;
    const [p0, ...rest] = points;
    g.moveTo(p0.x, p0.y);
    for (const p of rest) g.lineTo(p.x, p.y);
  }

  spawnBolt() {
    const outer = this.getFrameOuterRect();
    // Choose a random side of the outer rect as start, then shoot outward normal for end
    const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
    const jitter = (n) => (Math.random() - 0.5) * n;

    let start = new PIXI.Point();
    let end = new PIXI.Point();
    const outward = this.opts.margin * (1.5 + Math.random() * 1.5);
    switch (side) {
      case 0: // top edge
        start.x = outer.x + Math.random() * outer.width;
        start.y = outer.y;
        end.x = start.x + jitter(30);
        end.y = start.y - outward;
        break;
      case 1: // right edge
        start.x = outer.x + outer.width;
        start.y = outer.y + Math.random() * outer.height;
        end.x = start.x + outward;
        end.y = start.y + jitter(30);
        break;
      case 2: // bottom edge
        start.x = outer.x + Math.random() * outer.width;
        start.y = outer.y + outer.height;
        end.x = start.x + jitter(30);
        end.y = start.y + outward;
        break;
      case 3: // left edge
      default:
        start.x = outer.x;
        start.y = outer.y + Math.random() * outer.height;
        end.x = start.x - outward;
        end.y = start.y + jitter(30);
        break;
    }

    const points = this.generateJaggedPath(start, end, this.opts.segments, this.opts.amplitude);
    const life = this.opts.minLife + Math.random() * (this.opts.maxLife - this.opts.minLife);
    this.bolts.push({ points, bornAt: performance.now(), life });
  }

  generateJaggedPath(start, end, segments, amplitude) {
    const points = [];
    const dx = (end.x - start.x) / segments;
    const dy = (end.y - start.y) / segments;
    const len = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    const nx = -(end.y - start.y) / len; // perpendicular normal x
    const ny = (end.x - start.x) / len; // perpendicular normal y

    for (let i = 0; i <= segments; i++) {
      const t = i / segments; // 0..1
      const baseX = start.x + dx * i;
      const baseY = start.y + dy * i;
      // Stronger displacement in middle, softer near ends
      const falloff = Math.sin(Math.PI * t);
      const jitter = (Math.random() * 2 - 1) * amplitude * falloff;
      const x = baseX + nx * jitter;
      const y = baseY + ny * jitter;
      points.push(new PIXI.Point(x, y));
    }
    return points;
  }
}

export default ElectricFrameEffect;
