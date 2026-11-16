'use strict';

/* ============================================================
   particles.js — пул частиц с фиксированным лимитом
   ============================================================ */
class ParticleSystem {
  constructor(max) {
    this.max = max;
    this.density = 1;      // адаптивное качество (0.4..1)
    this.cursor = 0;
    this.items = new Array(max);
    for (let i = 0; i < max; i++) {
      this.items[i] = { life: 0, maxLife: 1, x: 0, y: 0, vx: 0, vy: 0, size: 2, endSize: 0, color: '#fff', drag: 0, gy: 0, add: true };
    }
  }

  emit(x, y, vx, vy, life, size, color, o) {
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;   // кольцевой буфер: старые частицы перезаписываются
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = p.maxLife = life;
    p.size = size; p.color = color;
    if (o) {
      p.endSize = o.endSize === undefined ? 0 : o.endSize;
      p.drag = o.drag || 0; p.gy = o.gy || 0; p.add = o.add !== false;
    } else { p.endSize = 0; p.drag = 0; p.gy = 0; p.add = true; }
  }

  burst(x, y, count, smin, smax, life, size, color, o) {
    const n = Math.max(1, Math.round(count * this.density));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = smin + Math.random() * (smax - smin);
      this.emit(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.8),
        size * (0.6 + Math.random() * 0.8), color, o);
    }
  }

  cone(x, y, ang, spread, count, smin, smax, life, size, color, o) {
    const n = Math.max(1, Math.round(count * this.density));
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * spread, s = smin + Math.random() * (smax - smin);
      this.emit(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.8),
        size * (0.6 + Math.random() * 0.8), color, o);
    }
  }

  ring(x, y, count, speed, life, size, color, o) {
    const n = Math.max(2, Math.round(count * this.density));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.emit(x, y, Math.cos(a) * speed, Math.sin(a) * speed, life, size, color, o);
    }
  }

  update(dt) {
    const it = this.items;
    for (let i = 0; i < this.max; i++) {
      const p = it[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.drag) { const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; }
      p.vy += p.gy * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  render(ctx, view) {
    const it = this.items;
    const l = view.l - 30, r = view.r + 30, t = view.t - 30, b = view.b + 30;
    ctx.save();
    for (let pass = 0; pass < 2; pass++) {
      const additive = pass === 1;
      ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
      for (let i = 0; i < this.max; i++) {
        const p = it[i];
        if (p.life <= 0 || p.add !== additive) continue;
        if (p.x < l || p.x > r || p.y < t || p.y > b) continue;
        const k = p.life / p.maxLife;
        const s = p.endSize + (p.size - p.endSize) * k;
        if (s < 0.4) continue;
        ctx.globalAlpha = k > 0.66 ? 1 : k * 1.5;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.restore();
  }

  clear() { for (let i = 0; i < this.max; i++) this.items[i].life = 0; }
}
