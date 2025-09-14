import * as PIXI from "pixi.js";

// Continuous electric outline around a rectangle, with animated jitter and glow.
export class ElectricOutlineEffect {
  constructor({ app, stage, frameSprite, options = {} }) {
    this.app = app;
    this.stage = stage;
    this.frameSprite = frameSprite;
    this.opts = {
      margin: 24, // distance outside frame
      segmentsPerEdge: 48, // resolution per edge
      amplitude: 16, // max displacement outward/inward from the path
      speed: 2.0, // animation speed multiplier
      colorCore: 0xffffff,
      colorGlow: 0x33ccff,
      lineWidthCore: 2,
      lineWidthGlow: 10,
      blur: 10,
      flickerAlphaMin: 0.6,
      flickerAlphaMax: 1.0,
      closeLoop: true,
      ...options,
    };

    this.container = new PIXI.Container();
    this.gGlow = new PIXI.Graphics();
    this.gCore = new PIXI.Graphics();
    this.gGlow.blendMode = PIXI.BLEND_MODES.ADD;
    this.gCore.blendMode = PIXI.BLEND_MODES.ADD;
    if (PIXI.BlurFilter) this.gGlow.filters = [new PIXI.BlurFilter(this.opts.blur)];
    if (typeof this.opts.zIndex === "number") this.container.zIndex = this.opts.zIndex;
    this.container.addChild(this.gGlow);
    this.container.addChild(this.gCore);
    this.stage.addChild(this.container);

    // Pre-generate random phase per vertex for stable noise over time
    this._reseedNoise();

    this._time = 0;
    this._tickerFn = (delta) => this.update(delta);
    this.app.ticker.add(this._tickerFn);
  }

  destroy() {
    if (this._tickerFn) this.app.ticker.remove(this._tickerFn);
    this.container.destroy({ children: true });
  }

  setOptions(partial) {
    Object.assign(this.opts, partial);
    if (partial.segmentsPerEdge || partial.margin) {
      this._reseedNoise();
    }
  }

  _reseedNoise() {
    const total = this.totalSegments();
    this._noisePhase = new Float32Array(total);
    this._noiseAmp = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      this._noisePhase[i] = Math.random() * Math.PI * 2;
      // Slight per-vertex amplitude variance for more organic look
      this._noiseAmp[i] = 0.6 + Math.random() * 0.8; // 0.6..1.4
    }
  }

  totalSegments() {
    return Math.max(4, (this.opts.segmentsPerEdge | 0) * 4);
  }

  getOuterRect() {
    const b = this.frameSprite.getBounds();
    const m = this.opts.margin;
    return new PIXI.Rectangle(b.x - m, b.y - m, b.width + m * 2, b.height + m * 2);
  }

  update(delta) {
    this._time += (delta || 1) * 0.016 * this.opts.speed; // approx seconds

    // Flicker alpha subtly each frame
    const alpha = this.opts.flickerAlphaMin + Math.random() * (this.opts.flickerAlphaMax - this.opts.flickerAlphaMin);
    this.gGlow.alpha = alpha;
    this.gCore.alpha = alpha;

    const rect = this.getOuterRect();
    const pts = this._buildPerimeter(rect);

    // Draw
    this.gGlow.clear();
    this.gCore.clear();
    const lwg = Math.max(1, this.opts.lineWidthGlow);
    const lwc = Math.max(1, this.opts.lineWidthCore);
    this.gGlow.lineStyle(lwg, this.opts.colorGlow, 0.9);
    this._traceClosed(this.gGlow, pts, this.opts.closeLoop);
    this.gCore.lineStyle(lwc, this.opts.colorCore, 1.0);
    this._traceClosed(this.gCore, pts, this.opts.closeLoop);
  }

  _traceClosed(g, points, close) {
    if (!points.length) return;
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    if (close) g.lineTo(points[0].x, points[0].y);
  }

  _buildPerimeter(rect) {
    const nPerEdge = Math.max(1, this.opts.segmentsPerEdge | 0);
    const total = this.totalSegments();
    const pts = new Array(total);
    let k = 0;

    // Helper adds a point with jitter based on tangent/normal
    const pushPoint = (x, y, tx, ty, edgeIndex, tOnEdge) => {
      // Normalize tangent to get outward normal
      const tlen = Math.hypot(tx, ty) || 1;
      const nx = -ty / tlen;
      const ny = tx / tlen;

      // Continuous pseudo-noise per index
      const idx = k; // stable index along the loop
      const basePhase = this._noisePhase[idx % this._noisePhase.length];
      const ampMul = this._noiseAmp[idx % this._noiseAmp.length];

      // Mix a few sine layers for organic motion
      const u = (edgeIndex + tOnEdge) / 4; // 0..1 along loop
      const t = this._time;
      const n1 = Math.sin(6.283 * (u * 1.0 + t * 0.90) + basePhase);
      const n2 = Math.sin(6.283 * (u * 2.7 + t * 1.35) + basePhase * 1.7);
      const n3 = Math.sin(6.283 * (u * 5.1 + t * 2.2) + basePhase * 2.3);
      const noise = (0.6 * n1 + 0.3 * n2 + 0.1 * n3) * ampMul;
      // Taper jitter near corners slightly
      const taper = 0.85 + 0.15 * Math.cos(Math.PI * (tOnEdge - 0.5));
      const disp = this.opts.amplitude * noise * taper;

      pts[k++] = new PIXI.Point(x + nx * disp, y + ny * disp);
    };

    const x0 = rect.x, y0 = rect.y, x1 = rect.x + rect.width, y1 = rect.y + rect.height;
    // Top edge: left->right
    for (let i = 0; i < nPerEdge; i++) {
      const t = i / nPerEdge;
      const x = x0 + (x1 - x0) * t;
      const y = y0;
      pushPoint(x, y, 1, 0, 0, t);
    }
    // Right edge: top->bottom
    for (let i = 0; i < nPerEdge; i++) {
      const t = i / nPerEdge;
      const x = x1;
      const y = y0 + (y1 - y0) * t;
      pushPoint(x, y, 0, 1, 1, t);
    }
    // Bottom edge: right->left
    for (let i = 0; i < nPerEdge; i++) {
      const t = i / nPerEdge;
      const x = x1 - (x1 - x0) * t;
      const y = y1;
      pushPoint(x, y, -1, 0, 2, t);
    }
    // Left edge: bottom->top
    for (let i = 0; i < nPerEdge; i++) {
      const t = i / nPerEdge;
      const x = x0;
      const y = y1 - (y1 - y0) * t;
      pushPoint(x, y, 0, -1, 3, t);
    }
    return pts;
  }
}

export default ElectricOutlineEffect;
