'use strict';

/* ============================================================
   effects.js — свечение, камера, фон (параллакс), порталы,
   барьер арены, кольца, всплывающий урон, вспышки
   ============================================================ */

/* ---------- кэш спрайтов свечения ---------- */
const Glow = {
  cache: Object.create(null),
  get(color) {
    let c = this.cache[color];
    if (c) return c;
    const S = 128;
    c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const rgb = hexToRgb(color);
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, rgbStr(rgb, 1));
    gr.addColorStop(0.2, rgbStr(rgb, 0.55));
    gr.addColorStop(0.55, rgbStr(rgb, 0.14));
    gr.addColorStop(1, rgbStr(rgb, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    this.cache[color] = c;
    return c;
  },
  draw(ctx, color, x, y, radius, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.drawImage(this.get(color), x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }
};

/* ---------- камера ---------- */
class Camera {
  constructor() {
    this.x = CFG.ARENA.w / 2; this.y = CFG.ARENA.h / 2;
    this.w = 1280; this.h = 720; this.zoom = 1;
    this.trauma = 0; this.ox = 0; this.oy = 0;
    this._view = { l: 0, t: 0, r: 0, b: 0 };
  }
  resize(w, h) {
    this.w = w; this.h = h;
    const A = CFG.ARENA;
    this.zoom = Math.max(h / CFG.VIEW_H, w / A.w, h / A.h);
  }
  addTrauma(a) { this.trauma = Math.min(1, this.trauma + a); }
  snap(x, y) { this.x = x; this.y = y; this.clampToArena(); }
  clampToArena() {
    const A = CFG.ARENA;
    const hw = this.w / this.zoom / 2, hh = this.h / this.zoom / 2;
    this.x = hw * 2 >= A.w ? A.w / 2 : clamp(this.x, hw, A.w - hw);
    this.y = hh * 2 >= A.h ? A.h / 2 : clamp(this.y, hh, A.h - hh);
  }
  follow(tx, ty, dt) {
    const k = 1 - Math.exp(-5.5 * dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.clampToArena();
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    const m = this.trauma * this.trauma * 34;
    this.ox = (Math.random() * 2 - 1) * m;
    this.oy = (Math.random() * 2 - 1) * m;
  }
  apply(ctx) {
    const z = this.zoom;
    ctx.setTransform(z, 0, 0, z, Math.round(this.w / 2 - this.x * z + this.ox), Math.round(this.h / 2 - this.y * z + this.oy));
  }
  view() {
    const hw = this.w / this.zoom / 2, hh = this.h / this.zoom / 2, v = this._view;
    v.l = this.x - hw; v.r = this.x + hw; v.t = this.y - hh; v.b = this.y + hh;
    return v;
  }
  screenToWorld(sx, sy) {
    return { x: (sx - this.w / 2) / this.zoom + this.x, y: (sy - this.h / 2) / this.zoom + this.y };
  }
  worldToScreen(wx, wy) {
    return { x: (wx - this.x) * this.zoom + this.w / 2, y: (wy - this.y) * this.zoom + this.h / 2 };
  }
}

/* ---------- фон: звёзды, галактики, туманности ---------- */
class Background {
  constructor() {
    this.layers = [
      { f: 0.035, n: 170, size: 1.0 },
      { f: 0.10, n: 100, size: 1.6 },
      { f: 0.24, n: 56, size: 2.4 }
    ];
    this.stars = [];
    for (let li = 0; li < this.layers.length; li++) {
      for (let i = 0; i < this.layers[li].n; i++) {
        this.stars.push({
          l: li, u: Math.random(), v: Math.random(), cls: (Math.random() * 3) | 0,
          tw: rand(0.6, 2.6), ph: rand(0, TAU), big: li === 2 && Math.random() < 0.18
        });
      }
    }
    this.galaxies = [this.makeGalaxy('#7fa8ff'), this.makeGalaxy('#d68cff'), this.makeGalaxy('#6fffe0')];
    this.gpos = [
      { u: 0.18, v: 0.28, s: 360, rot: 0.5, f: 0.02 },
      { u: 0.78, v: 0.62, s: 440, rot: -0.9, f: 0.03 },
      { u: 0.5, v: 0.88, s: 280, rot: 2.0, f: 0.015 }
    ];
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      this.clouds.push({ u: Math.random(), v: Math.random(), r: rand(0.35, 0.85), f: rand(0.07, 0.2), cls: i % 3, a: rand(0.1, 0.2), ph: rand(0, TAU) });
    }
  }

  makeGalaxy(color) {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const rgb = hexToRgb(color);
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.12, rgbStr(rgb, 0.55));
    gr.addColorStop(0.5, rgbStr(rgb, 0.12));
    gr.addColorStop(1, rgbStr(rgb, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 1100; i++) {
      const arm = i % 3;
      const rr = Math.pow(Math.random(), 0.7) * S * 0.46;
      const ang = arm * TAU / 3 + rr * 0.035 + (Math.random() - 0.5) * 0.5 * (1.2 - rr / (S * 0.46));
      const x = S / 2 + Math.cos(ang) * rr, y = S / 2 + Math.sin(ang) * rr;
      const a = 0.15 + Math.random() * 0.5 * (1 - rr / (S * 0.5));
      g.fillStyle = rgbStr(rgb, Math.round(a * 100) / 100);
      g.fillRect(x, y, 1.5, 1.5);
    }
    return c;
  }

  render(ctx, cam, t, blend, darken, pals) {
    const W = cam.w, H = cam.h;
    pals = pals || CFG.PALETTES;
    const a = Math.min(3, Math.floor(blend)), b = Math.min(3, a + 1), f = clamp(blend - a, 0, 1);
    const PA = pals[a], PB = pals[b];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, rgbStr(mixRgb(PA.bgTop, PB.bgTop, f)));
    grad.addColorStop(1, rgbStr(mixRgb(PA.bgBot, PB.bgBot, f)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const z = cam.zoom;
    ctx.globalCompositeOperation = 'lighter';

    // далёкие галактики
    for (let i = 0; i < this.galaxies.length; i++) {
      const gp = this.gpos[i], size = gp.s * z * 0.9;
      const px = wrap(gp.u * W - cam.x * gp.f * z, W + size * 2) - size;
      const py = wrap(gp.v * H - cam.y * gp.f * z, H + size * 2) - size;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(gp.rot + t * 0.01);
      ctx.scale(1, 0.55);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(this.galaxies[i], -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // светящиеся облака
    for (let i = 0; i < this.clouds.length; i++) {
      const cl = this.clouds[i];
      const r = cl.r * Math.min(W, H) * (1 + 0.04 * Math.sin(t * 0.25 + cl.ph));
      const px = wrap(cl.u * W - cam.x * cl.f * z, W + 2 * r) - r;
      const py = wrap(cl.v * H - cam.y * cl.f * z, H + 2 * r) - r;
      const col = mixRgb(PA.nebula[cl.cls], PB.nebula[cl.cls], f);
      const al = cl.a * (1 + blend * 0.12);
      const gr = ctx.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, rgbStr(col, al));
      gr.addColorStop(0.5, rgbStr(col, al * 0.35));
      gr.addColorStop(1, rgbStr(col, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }

    // звёзды (3 слоя параллакса)
    ctx.globalCompositeOperation = 'source-over';
    const cols = [0, 1, 2].map(i => rgbStr(mixRgb(PA.stars[i], PB.stars[i], f)));
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i], L = this.layers[s.l];
      const px = wrap(s.u * W - cam.x * L.f * z, W);
      const py = wrap(s.v * H - cam.y * L.f * z, H);
      ctx.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
      ctx.fillStyle = cols[s.cls];
      const sz = Math.max(1, Math.round(L.size * Math.min(1.5, z)));
      ctx.fillRect(px, py, sz, sz);
      if (s.big) {
        ctx.globalCompositeOperation = 'lighter';
        Glow.draw(ctx, '#ffffff', px, py, 9, 0.35);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalAlpha = 1;

    if (darken > 0.01) {
      ctx.fillStyle = 'rgba(0,0,8,' + darken.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }
}

/* ---------- барьер арены ---------- */
function drawBarrier(ctx, cam, time, color, player) {
  const A = CFG.ARENA, v = cam.view(), depth = 190;
  const pulse = 0.55 + 0.25 * Math.sin(time * 2.2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const px = player ? player.x : -9999, py = player ? player.y : -9999;
  const edge = (d) => 0.3 + 0.7 * clamp(1 - d / 420, 0, 1);

  if (v.l < depth) {
    const k = edge(px) * pulse;
    const g = ctx.createLinearGradient(0, 0, depth, 0);
    g.addColorStop(0, rgba(color, 0.5 * k)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(0, v.t, depth, v.b - v.t);
    ctx.fillStyle = rgba(color, 0.9 * k); ctx.fillRect(-2, v.t, 5, v.b - v.t);
  }
  if (v.r > A.w - depth) {
    const k = edge(A.w - px) * pulse;
    const g = ctx.createLinearGradient(A.w, 0, A.w - depth, 0);
    g.addColorStop(0, rgba(color, 0.5 * k)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(A.w - depth, v.t, depth, v.b - v.t);
    ctx.fillStyle = rgba(color, 0.9 * k); ctx.fillRect(A.w - 3, v.t, 5, v.b - v.t);
  }
  if (v.t < depth) {
    const k = edge(py) * pulse;
    const g = ctx.createLinearGradient(0, 0, 0, depth);
    g.addColorStop(0, rgba(color, 0.5 * k)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(v.l, 0, v.r - v.l, depth);
    ctx.fillStyle = rgba(color, 0.9 * k); ctx.fillRect(v.l, -2, v.r - v.l, 5);
  }
  if (v.b > A.h - depth) {
    const k = edge(A.h - py) * pulse;
    const g = ctx.createLinearGradient(0, A.h, 0, A.h - depth);
    g.addColorStop(0, rgba(color, 0.5 * k)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(v.l, A.h - depth, v.r - v.l, depth);
    ctx.fillStyle = rgba(color, 0.9 * k); ctx.fillRect(v.l, A.h - 3, v.r - v.l, 5);
  }
  ctx.restore();
}

/* ---------- портал (воронка) ---------- */
class Portal {
  constructor(x, y, maxR, color, color2) {
    this.x = x; this.y = y; this.r = 0; this.maxR = maxR;
    this.color = color; this.color2 = color2 || color;
    this.state = 'opening';
    this.rot = rand(0, TAU);
    this.dead = false;
  }
  close() { if (this.state !== 'closing') this.state = 'closing'; }
  update(dt, game) {
    this.rot += dt * (1.6 + this.r / this.maxR * 1.8);
    if (this.state === 'opening') {
      this.r = damp(this.r, this.maxR, 3.2, dt);
      if (this.r > this.maxR * 0.97) this.state = 'open';
    } else if (this.state === 'closing') {
      this.r -= (this.maxR * 1.6) * dt;
      if (this.r <= 2) { this.r = 0; this.dead = true; }
    }
    // частицы, втягиваемые в воронку
    if (this.r > 20 && Math.random() < 0.9) {
      const a = Math.random() * TAU, d = this.r * rand(1.1, 1.8);
      const px = this.x + Math.cos(a) * d, py = this.y + Math.sin(a) * d;
      game.particles.emit(px, py, -Math.cos(a) * d * 1.2 + Math.cos(a + 1.57) * d * 0.9,
        -Math.sin(a) * d * 1.2 + Math.sin(a + 1.57) * d * 0.9, 0.55, 5, Math.random() < 0.5 ? this.color : this.color2, { endSize: 1 });
    }
  }
  render(ctx) {
    if (this.r < 2) return;
    const r = this.r;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(0,0,0,0.96)');
    g.addColorStop(0.55, 'rgba(5,0,20,0.9)');
    g.addColorStop(1, 'rgba(5,0,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, this.color, 0, 0, r * 1.9, 0.5);
    ctx.lineCap = 'round';
    for (let a = 0; a < 5; a++) {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const s = i / 24, ang = this.rot + a * TAU / 5 + s * 4.2, rad = r * (1 - s * 0.9);
        const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(a % 2 ? this.color2 : this.color, 0.55);
      ctx.lineWidth = Math.max(1.5, r * 0.05);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    ctx.strokeStyle = rgba(this.color, 0.9);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}

/* ---------- эффекты: кольца, текст урона, вспышки ---------- */
class Effects {
  constructor(game) {
    this.game = game;
    this.rings = [];
    this.texts = [];
    this.flashA = 0; this.flashColor = '#ffffff';
    this.darken = 0; this.darkenTarget = 0;
  }
  reset() { this.rings.length = 0; this.texts.length = 0; this.flashA = 0; this.darken = 0; this.darkenTarget = 0; }
  ring(x, y, maxR, life, color, width) {
    if (this.rings.length > 40) this.rings.shift();
    this.rings.push({ x, y, maxR, life, maxLife: life, color, width: width || 8 });
  }
  text(x, y, str, color, size) {
    if (this.texts.length > 70) this.texts.shift();
    this.texts.push({ x: x + rand(-14, 14), y, str, color, size: size || 18, life: 0.9, maxLife: 0.9 });
  }
  flash(a, color) {
    if (a > this.flashA) { this.flashA = a; this.flashColor = color || '#ffffff'; }
  }
  update(dt) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 80 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    this.flashA = Math.max(0, this.flashA - dt * 1.6);
    this.darken = damp(this.darken, this.darkenTarget, 1.5, dt);
  }
  renderWorld(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const t = 1 - r.life / r.maxLife;
      const rad = r.maxR * (1 - Math.pow(1 - t, 3));
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(1, rad), 0, TAU);
      ctx.strokeStyle = rgba(r.color, 1 - t);
      ctx.lineWidth = r.width * (1 - t) + 1;
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const k = t.life / t.maxLife;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = '800 ' + Math.round(t.size) + 'px ' + CFG.FONT;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  }
  renderScreen(ctx, w, h) {
    if (this.flashA > 0.01) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = Math.min(1, this.flashA);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}
