'use strict';

/* ============================================================
   attacks.js — снаряды и 8 атак босса.
   У каждой атаки: подготовка -> предупреждение -> активная фаза -> восстановление.
   ============================================================ */

/* ---------- общие помощники рисования ---------- */

/* Опасный коридор (рывок, удар из портала) */
function drawCorridor(ctx, x, y, ang, len, width, color, alpha, locked, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, rgba(color, alpha * 0.55));
  g.addColorStop(1, rgba(color, alpha * 0.1));
  ctx.fillStyle = g;
  ctx.fillRect(0, -width / 2, len, width);
  ctx.strokeStyle = rgba(locked ? '#ffffff' : color, Math.min(1, alpha * (locked ? 1.2 : 0.85)));
  ctx.lineWidth = locked ? 3 : 2;
  ctx.setLineDash(locked ? [] : [26, 16]);
  ctx.lineDashOffset = -time * 120;
  ctx.beginPath();
  ctx.moveTo(0, -width / 2); ctx.lineTo(len, -width / 2);
  ctx.moveTo(0, width / 2); ctx.lineTo(len, width / 2);
  ctx.stroke();
  ctx.restore();
}

/* Мощный луч; k — интенсивность 0..1 */
function drawBeam(ctx, x, y, ang, len, width, pal, time, k) {
  const w = width * k * (1 + 0.06 * Math.sin(time * 40));
  if (w < 1) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, -w * 1.6, 0, w * 1.6);
  g.addColorStop(0, rgba(pal.glow, 0));
  g.addColorStop(0.5, rgba(pal.glow, 0.55));
  g.addColorStop(1, rgba(pal.glow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, -w * 1.6, len, w * 3.2);
  ctx.fillStyle = rgba(pal.light, 0.8);
  ctx.fillRect(0, -w * 0.5, len, w);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(0, -w * 0.22, len, w * 0.44);
  // бегущие импульсы
  ctx.setLineDash([60, 90]);
  ctx.lineDashOffset = -time * 1400;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = w * 0.3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  Glow.draw(ctx, pal.glow, x, y, w * 1.8, 0.9 * k);
  ctx.restore();
}

function beamHitsPlayer(x, y, ang, len, width, p) {
  return Physics.rayDist(p.x, p.y, x, y, ang, len) < width * 0.42 + p.radius * 0.7;
}

/* ============================================================
   Снаряд босса
   ============================================================ */
class Projectile {
  constructor(o) {
    this.x = o.x; this.y = o.y; this.vx = o.vx; this.vy = o.vy;
    this.r = o.r || 14; this.dmg = o.dmg || 30; this.life = o.life || 6;
    this.kind = o.kind || 'orb'; this.color = o.color || '#9a6bff';
    this.alive = true; this.trail = 0; this.spin = rand(0, TAU);
  }
  update(dt, game) {
    this.life -= dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.spin += dt * 6;
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = this.kind === 'meteor' ? 0.016 : 0.04;
      game.particles.emit(this.x + rand(-4, 4), this.y + rand(-4, 4), -this.vx * 0.04 + rand(-20, 20), -this.vy * 0.04 + rand(-20, 20),
        0.45, this.r * 0.9, this.color, { endSize: 0 });
    }
    const A = CFG.ARENA, m = 700;
    if (this.life <= 0 || this.x < -m || this.x > A.w + m || this.y < -m - 400 || this.y > A.h + m) this.alive = false;
  }
  render(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, this.color, this.x, this.y, this.r * 3.4, 0.85);
    if (this.kind === 'shard') {
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.atan2(this.vy, this.vx));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(this.r * 2.4, 0); ctx.lineTo(0, -this.r * 0.7); ctx.lineTo(-this.r * 1.2, 0); ctx.lineTo(0, this.r * 0.7);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.55, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(this.color, 0.95);
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}

/* ============================================================
   Базовый класс атаки
   ============================================================ */
class Attack {
  constructor(boss, game) {
    this.boss = boss; this.game = game;
    this.t = 0; this.done = false; this.name = '';
  }
  get P() { return this.boss.phase; }
  get player() { return this.game.player; }
  start() {}
  update(dt) { return this.done; }
  render(ctx) {}
  collide(player) {}
  cancel() {}                    // должен быть идемпотентным
}

/* ============================================================
   1 + 7. Cosmic Dash / Devouring Rush
   ============================================================ */
class CosmicDash extends Attack {
  constructor(boss, game, opts) {
    super(boss, game);
    this.rush = !!(opts && opts.rush);
    this.rounds = this.rush ? this.P.rush : 1;
    this.name = this.rush ? 'DEVOURING RUSH' : 'COSMIC DASH';
    this.round = 0; this.stage = 'position'; this.retries = 0;
    this.pos = { x: 0, y: 0 };
    this.locked = false; this.sx = 0; this.sy = 0; this.dashLen = 1900;
  }
  start() { this.beginRound(); }

  pickPos() {
    const p = this.player, h = this.boss.head, A = CFG.ARENA, m = 520;
    const d = this.rush ? 840 : 980;
    let best = null, bd = Infinity;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * TAU;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (x < -m || x > A.w + m || y < -m || y > A.h + m) continue;
      const dd = Math.hypot(x - h.x, y - h.y);
      if (dd < bd) { bd = dd; best = { x, y }; }
    }
    if (!best) {
      const a = Math.atan2(A.h / 2 - p.y, A.w / 2 - p.x);
      best = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
    }
    this.pos.x = best.x; this.pos.y = best.y;
  }

  beginRound() {
    this.stage = 'position'; this.t = 0; this.locked = false; this.retries = 0;
    this.pickPos();
  }
  windupTime() { return this.P.dashWindup * (this.rush ? 0.62 : 1); }

  update(dt) {
    this.t += dt;
    const b = this.boss, p = this.player, P = this.P, hd = b.head, g = this.game;
    switch (this.stage) {
      case 'position': {                         // подготовка: занять позицию
        b.steer(this.pos, P.dashSpeed * 0.78, P.idleTurn * 1.7 + 0.6, 1800);
        const arrived = dist(hd.x, hd.y, this.pos.x, this.pos.y) < 170;
        if (arrived || this.t > 2.2) {
          if (dist(hd.x, hd.y, p.x, p.y) < 450 && this.retries < 2) { this.retries++; this.t = 0; this.pickPos(); }
          else { this.stage = 'windup'; this.t = 0; this.locked = false; g.audio.warn(); }
        }
        break;
      }
      case 'windup': {                           // предупреждение: коридор, прицеливание, блокировка
        const W = this.windupTime();
        b.charge = Math.min(1, this.t / W);
        if (this.t < W - P.dashLock) b.steer(p, 110, 7.5, 2500);
        else {
          if (!this.locked) { this.locked = true; g.audio.warn(); }
          b.lockHeading(60, 3000);
        }
        if (this.t >= W) {
          this.stage = 'dash'; this.t = 0;
          b.lockHeading(P.dashSpeed, 7000);
          this.sx = hd.x; this.sy = hd.y;
          this.dashLen = this.rush ? 1500 : 1900;
          g.audio.dash();
          g.camera.addTrauma(0.35);
          g.effects.flash(0.12, b.pal.glow);
          g.effects.ring(hd.x, hd.y, 260, 0.5, b.pal.glow, 6);
          g.particles.burst(hd.x, hd.y, 40, 100, 600, 0.6, 9, b.pal.glow);
        }
        break;
      }
      case 'dash': {                             // активная фаза
        b.charge = 0.6;
        if (Math.random() < 0.7) {
          g.particles.emit(hd.x + rand(-40, 40), hd.y + rand(-40, 40), -Math.cos(b.angle) * 500, -Math.sin(b.angle) * 500, 0.35, 7, b.pal.light, { endSize: 0 });
        }
        const travelled = dist(hd.x, hd.y, this.sx, this.sy);
        if (travelled >= this.dashLen || this.t > 3) { this.stage = 'recover'; this.t = 0; }
        break;
      }
      case 'recover': {                          // завершение
        b.steer(p, P.idleSpeed * 0.9, P.idleTurn * 1.4, 1800);
        const wait = (this.rush && this.round < this.rounds - 1) ? 0.1 : 0.55;
        if (this.t >= wait) {
          this.round++;
          if (this.round >= this.rounds) this.done = true; else this.beginRound();
        }
        break;
      }
    }
    return this.done;
  }

  render(ctx) {
    const b = this.boss, hd = b.head, time = this.game.time;
    if (this.stage === 'windup') {
      const k = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(time * 18));
      drawCorridor(ctx, hd.x, hd.y, b.angle, 2400, CFG.BOSS.headRadius * 2, CFG.WARN, k, this.locked, time);
    } else if (this.stage === 'dash' && this.t < 0.25) {
      drawCorridor(ctx, hd.x, hd.y, b.angle, 2400, CFG.BOSS.headRadius * 2, CFG.WARN, 0.5 * (1 - this.t / 0.25), true, time);
    }
  }
}

/* ============================================================
   2. Void Projectiles
   ============================================================ */
class VoidProjectiles extends Attack {
  constructor(boss, game) {
    super(boss, game);
    this.name = 'VOID PROJECTILES';
    this.stage = 'orbit'; this.volley = 0;
    this.orbitDir = randSign(); this.orbitAng = 0;
    this.pt = { x: 0, y: 0 };
    this.aim = 0; this.vType = 'fan'; this.dirs = [];
  }
  start() {
    const h = this.boss.head, p = this.player;
    this.orbitAng = Math.atan2(h.y - p.y, h.x - p.x);
  }
  warnTime() { return Math.max(0.38, 0.62 - this.boss.phaseIdx * 0.06); }
  volleyType(v) {
    const i = this.boss.phaseIdx;
    if (i === 0) return 'fan';
    if (i === 1) return v % 2 ? 'ring' : 'fan';
    return ['fan', 'ring', 'wide'][v % 3];
  }
  computeDirs() {
    const P = this.P, hd = this.boss.head, p = this.player;
    this.dirs.length = 0;
    this.aim = Math.atan2(p.y + p.vy * 0.25 - hd.y, p.x + p.vx * 0.25 - hd.x);
  }
  fanDirs(n, spread) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.aim + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread));
    return out;
  }
  update(dt) {
    this.t += dt;
    const b = this.boss, p = this.player, P = this.P, g = this.game;
    this.orbitAng += dt * 0.5 * this.orbitDir;
    const R = 760;
    this.pt.x = clamp(p.x + Math.cos(this.orbitAng) * R, -500, CFG.ARENA.w + 500);
    this.pt.y = clamp(p.y + Math.sin(this.orbitAng) * R, -500, CFG.ARENA.h + 500);
    if (this.stage !== 'recover') b.steer(this.pt, P.idleSpeed * 1.15, P.idleTurn * 1.4, 1200);
    const W = this.warnTime();

    switch (this.stage) {
      case 'orbit':
        if (this.t > 0.7) { this.beginWarn(); }
        break;
      case 'warn':
        b.charge = this.t / W;
        if (this.t < W - 0.15) this.computeAimOnly();
        if (this.t >= W) {
          this.fire();
          this.volley++;
          if (this.volley >= P.volleys) { this.stage = 'recover'; this.t = 0; }
          else { this.stage = 'gap'; this.t = 0; }
        }
        break;
      case 'gap':
        if (this.t > 0.3) this.beginWarn();
        break;
      case 'recover':
        b.steer(p, P.idleSpeed, P.idleTurn, 900);
        if (this.t > 0.7) this.done = true;
        break;
    }
    return this.done;
  }
  computeAimOnly() {
    const hd = this.boss.head, p = this.player;
    this.aim = Math.atan2(p.y + p.vy * 0.25 - hd.y, p.x + p.vx * 0.25 - hd.x);
  }
  beginWarn() {
    this.stage = 'warn'; this.t = 0;
    this.vType = this.volleyType(this.volley);
    this.computeAimOnly();
    this.game.audio.warn();
  }
  currentDirs() {
    const P = this.P;
    if (this.vType === 'fan') return this.fanDirs(P.projCount, Math.min(1.2, 0.13 * (P.projCount - 1)));
    if (this.vType === 'wide') return this.fanDirs(P.projCount + 4, 1.9);
    return [];
  }
  fire() {
    const g = this.game, b = this.boss, P = this.P, hd = b.head;
    g.audio.projectile();
    g.camera.addTrauma(0.12);
    const col = b.pal.glow;
    const mk = (a, sp) => g.spawnProjectile({
      x: hd.x + Math.cos(a) * 60, y: hd.y + Math.sin(a) * 60,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 15, dmg: P.projDmg, life: 7, kind: 'orb', color: col
    });
    if (this.vType === 'ring') {
      const n = 12 + b.phaseIdx * 2, off = rand(0, TAU);
      for (let i = 0; i < n; i++) mk(off + i * TAU / n, P.projSpeed * 0.8);
    } else {
      const dirs = this.currentDirs();
      for (const a of dirs) mk(a, P.projSpeed);
    }
    g.particles.burst(hd.x, hd.y, 24, 80, 380, 0.5, 8, col);
    g.effects.ring(hd.x, hd.y, 180, 0.4, col, 5);
  }
  render(ctx) {
    if (this.stage !== 'warn') return;
    const hd = this.boss.head, W = this.warnTime(), k = clamp(this.t / W, 0, 1);
    ctx.save();
    if (this.vType === 'ring') {
      ctx.strokeStyle = rgba(CFG.WARN, 0.3 + 0.5 * k);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(hd.x, hd.y, 70 + k * 80, 0, TAU); ctx.stroke();
    } else {
      ctx.strokeStyle = rgba(CFG.WARN, 0.15 + 0.4 * k);
      ctx.lineWidth = 2;
      for (const a of this.currentDirs()) {
        ctx.beginPath();
        ctx.moveTo(hd.x + Math.cos(a) * 60, hd.y + Math.sin(a) * 60);
        ctx.lineTo(hd.x + Math.cos(a) * 900, hd.y + Math.sin(a) * 900);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/* ============================================================
   3. Serpent Sweep — широкая дуга
   ============================================================ */
class SerpentSweep extends Attack {
  constructor(boss, game) {
    super(boss, game);
    this.name = 'SERPENT SWEEP';
    this.sweeps = this.P.sweepCount;
    this.idx = 0; this.stage = 'position';
    this.C = { x: 0, y: 0 }; this.R = 820; this.span = 3.4; this.a0 = 0; this.s = 1; this.dur = 3;
    this.startPt = { x: 0, y: 0 }; this.total = 0; this.armed = false;
  }
  start() { this.plan(); }

  plan() {
    const p = this.player, A = CFG.ARENA;
    this.R = 820 + rand(-60, 60);
    this.span = this.P.sweepSpan;
    let phi = null;
    for (let i = 0; i < 12; i++) {
      const f = rand(0, TAU);
      const cx = p.x + Math.cos(f) * this.R, cy = p.y + Math.sin(f) * this.R;
      if (cx > 250 && cx < A.w - 250 && cy > 250 && cy < A.h - 250) { phi = f; break; }
    }
    if (phi === null) phi = Math.atan2(A.h / 2 - p.y, A.w / 2 - p.x);
    this.C.x = p.x + Math.cos(phi) * this.R;
    this.C.y = p.y + Math.sin(phi) * this.R;
    this.s = randSign();
    const aP = phi + Math.PI;
    this.a0 = aP - this.s * this.span / 2;
    this.startPt.x = this.C.x + Math.cos(this.a0) * this.R;
    this.startPt.y = this.C.y + Math.sin(this.a0) * this.R;
    this.dur = this.R * this.span / this.P.sweepSpeed;
    this.stage = 'position'; this.t = 0;
    this.game.audio.warn();
  }

  pathPoint(u) {
    const ang = this.a0 + this.s * this.span * clamp(u, 0, 1);
    return { x: this.C.x + Math.cos(ang) * this.R, y: this.C.y + Math.sin(ang) * this.R, ang: ang + this.s * Math.PI / 2 };
  }

  update(dt) {
    this.t += dt;
    const b = this.boss, p = this.player, P = this.P, hd = b.head, g = this.game;
    switch (this.stage) {
      case 'position': {
        b.steer(this.startPt, P.sweepSpeed * 1.1, P.idleTurn * 1.8 + 0.5, 1500);
        b.charge = clamp(this.t / 1.2, 0, 1);
        const arrived = dist(hd.x, hd.y, this.startPt.x, this.startPt.y) < 140;
        if (this.t > 1.1 && (arrived || this.t > 2.4)) {
          this.stage = 'sweep'; this.t = 0;
          const self = this;
          b.followPath((tt) => self.pathPoint(tt / self.dur));
          g.audio.dash();
          g.camera.addTrauma(0.3);
        }
        break;
      }
      case 'sweep': {
        b.charge = 0.5;
        if (Math.random() < 0.6) g.particles.emit(hd.x + rand(-30, 30), hd.y + rand(-30, 30), rand(-60, 60), rand(-60, 60), 0.5, 8, b.pal.glow, { endSize: 0 });
        if (b.pathT >= this.dur) {
          b.pathFn = null;
          const e = this.pathPoint(1);
          b.angle = e.ang;
          b.speed = P.sweepSpeed;
          this.stage = 'recover'; this.t = 0;
        }
        break;
      }
      case 'recover': {
        b.steer(p, P.idleSpeed, P.idleTurn * 1.3, 1500);
        if (this.t > 0.5) {
          this.idx++;
          if (this.idx >= this.sweeps) this.done = true; else this.plan();
        }
        break;
      }
    }
    return this.done;
  }

  cancel() { if (this.boss.pathFn) this.boss.pathFn = null; }

  render(ctx) {
    if (this.stage === 'recover') return;
    const time = this.game.time;
    let u0 = 0;
    if (this.stage === 'sweep') u0 = clamp(this.boss.pathT / this.dur, 0, 1);
    const aStart = this.a0 + this.s * this.span * u0, aEnd = this.a0 + this.s * this.span;
    if (Math.abs(aEnd - aStart) < 0.02) return;
    const k = this.stage === 'position' ? 0.5 + 0.3 * Math.sin(time * 14) : 0.35;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(this.C.x, this.C.y, this.R, aStart, aEnd, this.s < 0);
    ctx.strokeStyle = rgba(CFG.WARN, 0.1 + 0.08 * k);
    ctx.lineWidth = CFG.BOSS.bodyRadius * 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.C.x, this.C.y, this.R, aStart, aEnd, this.s < 0);
    ctx.strokeStyle = rgba(CFG.WARN, 0.55 + 0.3 * k);
    ctx.lineWidth = 3;
    ctx.setLineDash([30, 22]);
    ctx.lineDashOffset = -time * 160 * this.s;
    ctx.stroke();
    ctx.restore();
  }
}

/* ============================================================
   4. Cosmic Rain — метеоры сверху
   ============================================================ */
class CosmicRain extends Attack {
  constructor(boss, game) {
    super(boss, game);
    this.name = 'COSMIC RAIN';
    this.wave = 0; this.stage = 'prep';
    this.cols = []; this.orbitAng = 0; this.pt = { x: 0, y: 0 };
    this.tilt = 0; this.topY = 0;
  }
  start() {
    const h = this.boss.head, p = this.player;
    this.orbitAng = Math.atan2(h.y - p.y, h.x - p.x);
  }
  planWave() {
    const p = this.player, P = this.P, g = this.game;
    const view = g.camera.view();
    this.topY = view.t - 150;
    const spacing = 92, half = 820;
    const gapX = p.x + rand(-300, 300);
    this.tilt = P.rainTilt ? rand(-P.rainTilt, P.rainTilt) : 0;
    const shift = Math.tan(this.tilt) * (p.y - this.topY);
    this.cols.length = 0;
    for (let x = p.x - half; x <= p.x + half; x += spacing) {
      if (Math.abs(x - gapX) < spacing * 1.1) continue;
      this.cols.push({ x: x + rand(-8, 8) - shift, y: this.topY });
    }
    this.stage = 'warn'; this.t = 0;
    g.audio.warn();
  }
  update(dt) {
    this.t += dt;
    const b = this.boss, p = this.player, P = this.P, g = this.game;
    this.orbitAng += dt * 0.45;
    const R = 950;
    this.pt.x = clamp(p.x + Math.cos(this.orbitAng) * R, -500, CFG.ARENA.w + 500);
    this.pt.y = clamp(p.y + Math.sin(this.orbitAng) * R, -500, CFG.ARENA.h + 500);
    if (this.stage !== 'recover') b.steer(this.pt, P.idleSpeed * 1.2, P.idleTurn * 1.4, 1200);

    switch (this.stage) {
      case 'prep':
        b.charge = this.t / 0.8;
        if (this.t > 0.8) this.planWave();
        break;
      case 'warn':
        b.charge = 0.7;
        if (this.t >= P.rainWarn) {
          // огонь!
          for (const c of this.cols) {
            g.spawnProjectile({
              x: c.x, y: c.y, vx: Math.sin(this.tilt) * P.rainSpeed, vy: Math.cos(this.tilt) * P.rainSpeed,
              r: 30, dmg: P.rainDmg, life: 5, kind: 'meteor', color: b.pal.light
            });
          }
          g.audio.projectile();
          g.camera.addTrauma(0.2);
          this.wave++;
          this.stage = this.wave >= P.rainWaves ? 'recover' : 'gap';
          this.t = 0;
        }
        break;
      case 'gap':
        if (this.t > 0.55) this.planWave();
        break;
      case 'recover':
        b.steer(p, P.idleSpeed, P.idleTurn, 900);
        if (this.t > 0.9) this.done = true;
        break;
    }
    return this.done;
  }
  render(ctx) {
    if (this.stage !== 'warn') return;
    const P = this.P, k = clamp(this.t / P.rainWarn, 0, 1), time = this.game.time;
    const a = 0.12 + 0.35 * k * (0.7 + 0.3 * Math.sin(time * 25));
    ctx.save();
    ctx.fillStyle = rgba(CFG.WARN, a);
    for (const c of this.cols) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.PI / 2 - this.tilt);
      ctx.fillRect(0, -30, 2400, 60);
      ctx.restore();
    }
    ctx.restore();
  }
}

/* ============================================================
   5. Portal Strike
   ============================================================ */
class PortalStrike extends Attack {
  constructor(boss, game) {
    super(boss, game);
    this.name = 'PORTAL STRIKE';
    this.stage = 'open'; this.portal = null;
    this.locked = false; this.aim = 0; this.sx = 0; this.sy = 0;
  }
  start() {
    const p = this.player, A = CFG.ARENA, g = this.game;
    let x = p.x, y = p.y;
    for (let i = 0; i < 10; i++) {
      const a = rand(0, TAU), d = rand(560, 720);
      const px = p.x + Math.cos(a) * d, py = p.y + Math.sin(a) * d;
      if (px > 200 && px < A.w - 200 && py > 200 && py < A.h - 200) { x = px; y = py; break; }
    }
    if (x === p.x && y === p.y) { x = A.w / 2; y = A.h / 2; }
    this.portal = new Portal(x, y, 150, this.boss.pal.accent, this.boss.pal.glow);
    g.portals.push(this.portal);
    g.audio.portal();
    g.particles.burst(this.boss.head.x, this.boss.head.y, 40, 100, 500, 0.8, 9, this.boss.pal.glow);
  }
  update(dt) {
    this.t += dt;
    const b = this.boss, p = this.player, P = this.P, g = this.game, pr = this.portal;
    switch (this.stage) {
      case 'open': {
        b.alpha = clamp(1 - this.t / 0.7, 0, 1);       // старое тело исчезает
        b.steer(p, P.idleSpeed, P.idleTurn, 800);
        if (b.alpha > 0 && Math.random() < 0.5) {
          const s = pick(b.segments);
          g.particles.burst(s.x, s.y, 4, 60, 260, 0.6, 7, b.pal.glow);
        }
        const T = P.portalOpen;
        if (this.t < T - P.dashLock) this.aim = Math.atan2(p.y + p.vy * 0.35 - pr.y, p.x + p.vx * 0.35 - pr.x);
        else if (!this.locked) { this.locked = true; g.audio.warn(); }
        if (this.t >= T) this.emerge();
        break;
      }
      case 'emerge': {
        b.charge = 0.7;
        if (dist(b.head.x, b.head.y, pr.x, pr.y) > 1700 || this.t > 2.2) {
          this.stage = 'exit'; this.t = 0;
          b.steer(p, P.idleSpeed, P.idleTurn * 1.2, 1500);
        }
        break;
      }
      case 'exit': {
        b.steer(p, P.idleSpeed, P.idleTurn * 1.2, 1500);
        const out = dist(b.tail.x, b.tail.y, pr.x, pr.y) > pr.r * 0.9 + 60;
        if (out || this.t > 3.5) {
          pr.close();
          b.emergePortal = null;
          this.stage = 'recover'; this.t = 0;
        }
        break;
      }
      case 'recover':
        b.steer(p, P.idleSpeed, P.idleTurn, 900);
        if (this.t > 0.5) this.done = true;
        break;
    }
    return this.done;
  }
  emerge() {
    const b = this.boss, pr = this.portal, g = this.game, P = this.P;
    b.teleport(pr.x, pr.y, this.aim);
    b.alpha = 1;
    b.emergePortal = pr;
    b.speed = P.dashSpeed * 0.6;
    b.lockHeading(P.dashSpeed, 8000);
    this.stage = 'emerge'; this.t = 0;
    g.audio.dash();
    g.camera.addTrauma(0.5);
    g.effects.flash(0.2, b.pal.accent);
    g.effects.ring(pr.x, pr.y, 360, 0.6, b.pal.accent, 8);
    g.particles.burst(pr.x, pr.y, 60, 100, 700, 0.7, 9, b.pal.accent);
  }
  cancel() {
    const b = this.boss;
    if (b.alpha < 1) b.alpha = 1;
    if (this.portal && this.portal.state !== 'closing') this.portal.close();
    if (b.emergePortal === this.portal) b.emergePortal = null;
  }
  render(ctx) {
    if (this.stage !== 'open' || !this.portal) return;
    const k = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(this.game.time * 18));
    drawCorridor(ctx, this.portal.x, this.portal.y, this.aim, 2400, 100, CFG.WARN, k * clamp(this.t / 0.6, 0, 1), this.locked, this.game.time);
  }
}

/* ============================================================
   6. Energy Beam
   ============================================================ */
class EnergyBeam extends Attack {
  constructor(boss, game) {
    super(boss, game);
    this.name = 'ENERGY BEAM';
    this.stage = 'position'; this.pos = { x: 0, y: 0 };
    this.aimAng = 0; this.locked = false; this.k = 0; this.looping = false;
    this.len = 3400;
  }
  start() {
    const p = this.player, h = this.boss.head, A = CFG.ARENA, m = 450;
    let best = null, bd = Infinity;
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU), x = p.x + Math.cos(a) * 880, y = p.y + Math.sin(a) * 880;
      if (x < -m || x > A.w + m || y < -m || y > A.h + m) continue;
      const d = Math.hypot(x - h.x, y - h.y);
      if (d < bd) { bd = d; best = { x, y }; }
    }
    if (!best) best = { x: A.w / 2, y: A.h / 2 };
    this.pos = best;
  }
  origin() {
    const hd = this.boss.head, a = this.aimAng;
    return { x: hd.x + Math.cos(a) * 40, y: hd.y + Math.sin(a) * 40 };
  }
  update(dt) {
    this.t += dt;
    const b = this.boss, p = this.player, P = this.P, hd = b.head, g = this.game;
    const desired = Math.atan2(p.y - hd.y, p.x - hd.x);
    switch (this.stage) {
      case 'position': {
        b.steer(this.pos, P.idleSpeed * 1.4, P.idleTurn * 1.6, 1600);
        if (dist(hd.x, hd.y, this.pos.x, this.pos.y) < 170 || this.t > 2.2) {
          this.stage = 'aim'; this.t = 0; this.aimAng = b.angle; this.locked = false;
          g.audio.beamCharge();
        }
        break;
      }
      case 'aim': {
        b.lockHeading(0, 2500);
        const T = P.beamAim, lockT = 0.4;
        if (this.t < T - lockT) this.aimAng = approachAngle(this.aimAng, desired, 3.2 * dt);
        else if (!this.locked) { this.locked = true; g.audio.warn(); }
        b.angle = this.aimAng;
        b.charge = this.t / T;
        if (Math.random() < 0.6) {
          const o = this.origin();
          g.particles.emit(o.x + Math.cos(this.aimAng) * 140 + rand(-60, 60), o.y + Math.sin(this.aimAng) * 140 + rand(-60, 60), 0, 0, 0.35, 6, b.pal.glow, { endSize: 0 });
        }
        if (this.t >= T) {
          this.stage = 'fire'; this.t = 0;
          g.audio.beamLoop(true); this.looping = true;
          g.camera.addTrauma(0.5);
          g.effects.flash(0.2, b.pal.glow);
        }
        break;
      }
      case 'fire': {
        b.lockHeading(0, 2500);
        this.aimAng = approachAngle(this.aimAng, desired, P.beamTurn * dt);
        b.angle = this.aimAng;
        b.charge = 1;
        this.k = Math.min(1, this.t / 0.12, (P.beamTime - this.t) / 0.2 + 0.001);
        this.k = clamp(this.k, 0, 1);
        g.camera.addTrauma(dt * 0.9);
        if (Math.random() < 0.8) {
          const o = this.origin(), d = rand(100, 1400);
          g.particles.emit(o.x + Math.cos(this.aimAng) * d + rand(-30, 30), o.y + Math.sin(this.aimAng) * d + rand(-30, 30), rand(-80, 80), rand(-80, 80), 0.4, 7, b.pal.light, { endSize: 0 });
        }
        if (this.t >= P.beamTime) { this.stage = 'recover'; this.t = 0; this.stopLoop(); }
        break;
      }
      case 'recover': {
        b.steer(p, P.idleSpeed, P.idleTurn, 1500);
        if (this.t > 0.8) this.done = true;
        break;
      }
    }
    return this.done;
  }
  stopLoop() { if (this.looping) { this.game.audio.beamLoop(false); this.looping = false; } }
  cancel() { this.stopLoop(); }
  collide(player) {
    if (this.stage !== 'fire' || this.k < 0.5) return;
    const P = this.P, o = this.origin();
    for (const off of P.beamOffsets) {
      if (beamHitsPlayer(o.x, o.y, this.aimAng + off, this.len, P.beamWidth, player)) {
        player.hurt(P.beamDmg, o.x, o.y);
        return;
      }
    }
  }
  render(ctx) {
    const P = this.P, time = this.game.time, pal = this.boss.pal;
    const o = this.origin();
    if (this.stage === 'aim') {
      const k = this.t / P.beamAim;
      for (const off of P.beamOffsets) {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(this.aimAng + off);
        ctx.strokeStyle = this.locked ? 'rgba(255,255,255,0.95)' : rgba(CFG.WARN, 0.35 + 0.4 * k);
        ctx.lineWidth = this.locked ? 4 + 4 * Math.sin(time * 40) : 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(this.len, 0); ctx.stroke();
        if (this.locked) {
          ctx.fillStyle = rgba(CFG.WARN, 0.16);
          ctx.fillRect(0, -P.beamWidth * 0.5, this.len, P.beamWidth);
        }
        ctx.restore();
      }
    } else if (this.stage === 'fire') {
      for (const off of P.beamOffsets) drawBeam(ctx, o.x, o.y, this.aimAng + off, this.len, P.beamWidth, pal, time, this.k);
    }
  }
}

/* ============================================================
   8. Final Annihilation
   ============================================================ */
class FinalAnnihilation extends Attack {
  constructor(boss, game) {
    super(boss, game);
    this.name = 'FINAL ANNIHILATION';
    this.stage = 'gather';
    this.center = { x: CFG.ARENA.w / 2, y: CFG.ARENA.h / 2 };
    this.cx = this.center.x; this.cy = this.center.y;
    this.beamAng = rand(0, TAU); this.omega = 0; this.omegaDir = randSign(); this.flipped = false;
    this.rings = []; this.ringIdx = 0; this.spiralA = 0; this.fireT = 0; this.coreR = 0;
    this.finalSpawned = false; this.looping = false;
  }
  start() {
    const g = this.game;
    g.ui.banner('FINAL ANNIHILATION', 'ВСЁ ЗАКОНЧИТСЯ ЗДЕСЬ', CFG.WARN, 3.2);
    g.effects.darkenTarget = 0.62;
    g.projectilesToParticles();
    g.audio.beamCharge();
    g.camera.addTrauma(0.5);
  }
  beamsActive() { return this.stage === 'spiral' && this.t > 0.8; }

  spawnRing(delay, speed, th, gaps) {
    this.rings.push({ r: 70, delay, v: speed, th, gaps, t: 0, dead: false });
  }

  update(dt) {
    this.t += dt;
    const b = this.boss, p = this.player, g = this.game, hd = b.head, pal = b.pal;
    switch (this.stage) {
      case 'gather': {
        const near = dist(hd.x, hd.y, this.center.x, this.center.y) < 140;
        if (!near) b.steer(this.center, 900, 3.8, 1500); else b.lockHeading(0, 2500);
        this.coreR = lerp(0, 140, clamp(this.t / 3.2, 0, 1));
        b.charge = clamp(this.t / 3.2, 0, 1);
        g.camera.addTrauma(dt * 0.35);
        if (Math.random() < 0.9) {
          const a = rand(0, TAU), d = rand(250, 500);
          g.particles.emit(hd.x + Math.cos(a) * d, hd.y + Math.sin(a) * d, -Math.cos(a) * d * 1.6, -Math.sin(a) * d * 1.6, 0.3, 7, pal.glow, { endSize: 1 });
        }
        if (this.t > 3.2) {
          this.stage = 'spiral'; this.t = 0;
          this.cx = hd.x; this.cy = hd.y;
          b.lockHeading(0, 3000);
          g.audio.beamLoop(true); this.looping = true;
          g.effects.flash(0.4, pal.glow);
        }
        break;
      }
      case 'spiral': {
        b.lockHeading(0, 3000);
        this.cx = hd.x; this.cy = hd.y;
        if (!this.flipped && this.t > 3.6) { this.flipped = true; this.omegaDir *= -1; g.audio.warn(); }
        this.omega = approach(this.omega, this.omegaDir * 0.55, 1.3 * dt);
        this.beamAng += this.omega * dt;
        b.angle = this.beamAng;
        b.charge = 1;
        g.camera.addTrauma(dt * 0.6);
        this.fireT -= dt;
        if (this.fireT <= 0 && this.t > 0.8) {
          this.fireT = 0.28;
          g.audio.projectile();
          for (let k = 0; k < 2; k++) {
            const a = this.spiralA + k * Math.PI;
            g.spawnProjectile({
              x: hd.x + Math.cos(a) * 70, y: hd.y + Math.sin(a) * 70, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380,
              r: 14, dmg: this.P.projDmg, life: 7, kind: 'orb', color: pal.glow
            });
          }
          this.spiralA += 0.45;
        }
        if (this.t > 7.5) {
          this.stage = 'collapse'; this.t = 0; this.ringIdx = 0;
          this.stopLoop();
        }
        break;
      }
      case 'collapse': {
        b.lockHeading(0, 3000);
        b.charge = 0.8;
        if (this.ringIdx < 3 && this.t >= this.ringIdx * 1.4) {
          const n = this.ringIdx === 2 ? 1 : 2, gaps = [], base = rand(0, TAU);
          for (let i = 0; i < n; i++) gaps.push({ a: base + i * TAU / n, w: n === 1 ? 0.5 : 0.42 });
          this.spawnRing(0.9, 650, 46, gaps);
          g.audio.warn();
          this.ringIdx++;
        }
        if (this.ringIdx >= 3 && this.t > 3 * 1.4 + 0.9) { this.stage = 'detonate'; this.t = 0; }
        break;
      }
      case 'detonate': {
        b.lockHeading(0, 3000);
        b.charge = 1;
        g.camera.addTrauma(dt * 0.8);
        if (!this.finalSpawned && this.t > 1.2) {
          this.finalSpawned = true;
          const toP = Math.atan2(p.y - hd.y, p.x - hd.x);
          this.cx = hd.x; this.cy = hd.y;
          this.spawnRing(1.0, 900, 70, [{ a: toP + rand(-0.7, 0.7), w: 0.4 }]);
          g.audio.beamCharge();
        }
        if (this.finalSpawned && this.rings.length === 0) { this.stage = 'end'; this.t = 0; }
        break;
      }
      case 'end': {
        g.effects.darkenTarget = 0;
        this.coreR = Math.max(0, this.coreR - 300 * dt);
        b.finalDone = true;
        b.steer(p, this.P.idleSpeed, this.P.idleTurn, 1200);
        if (this.t > 1.2) this.done = true;
        break;
      }
    }

    // кольца-волны
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.delay > 0) {
        r.delay -= dt;
        if (r.delay <= 0) {
          g.camera.addTrauma(0.4);
          g.effects.flash(r.v > 800 ? 0.6 : 0.2, pal.light);
          g.audio.explosion(r.v > 800 ? 1 : 0.5);
        }
      } else {
        r.r += r.v * dt;
        if (r.r > 3100) { this.rings.splice(i, 1); }
      }
    }
    return this.done;
  }

  stopLoop() { if (this.looping) { this.game.audio.beamLoop(false); this.looping = false; } }
  cancel() {
    this.stopLoop();
    this.game.effects.darkenTarget = 0;
    this.rings.length = 0;
  }

  collide(player) {
    const P = this.P;
    if (this.beamsActive()) {
      for (let i = 0; i < 3; i++) {
        if (beamHitsPlayer(this.cx, this.cy, this.beamAng + i * TAU / 3, 3400, 64, player)) {
          player.hurt(P.beamDmg + 10, this.cx, this.cy);
          return;
        }
      }
    }
    for (const r of this.rings) {
      if (r.delay > 0) continue;
      const d = dist(player.x, player.y, this.cx, this.cy);
      if (Math.abs(d - r.r) < r.th / 2 + 8) {
        const ang = Math.atan2(player.y - this.cy, player.x - this.cx);
        let safe = false;
        for (const gp of r.gaps) if (Math.abs(angleDiff(gp.a, ang)) < gp.w) { safe = true; break; }
        if (!safe) { player.hurt(110, this.cx, this.cy); return; }
      }
    }
  }

  render(ctx) {
    const b = this.boss, hd = b.head, pal = b.pal, time = this.game.time;
    // ядро пустоты
    if (this.coreR > 2) {
      ctx.save();
      ctx.translate(hd.x, hd.y);
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, pal.glow, 0, 0, this.coreR * 3, 0.7);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(0, 0, this.coreR * (0.9 + 0.05 * Math.sin(time * 20)), 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(pal.light, 0.9);
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, this.coreR, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // лучи спирали
    if (this.stage === 'spiral') {
      const k = clamp((this.t - 0.8) / 0.25, 0, 1);
      for (let i = 0; i < 3; i++) {
        const a = this.beamAng + i * TAU / 3;
        if (this.t < 0.8) {
          ctx.save();
          ctx.strokeStyle = rgba(CFG.WARN, 0.3 + 0.5 * Math.sin(time * 30) * 0.5 + 0.25);
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(this.cx, this.cy); ctx.lineTo(this.cx + Math.cos(a) * 3400, this.cy + Math.sin(a) * 3400); ctx.stroke();
          ctx.restore();
        } else drawBeam(ctx, this.cx, this.cy, a, 3400, 64, pal, time, k);
      }
    }
    // кольца
    for (const r of this.rings) this.renderRing(ctx, r, pal, time);
  }

  renderRing(ctx, r, pal, time) {
    ctx.save();
    ctx.lineCap = 'butt';
    const gaps = r.gaps.slice().sort((a, b) => normAngle(a.a) - normAngle(b.a));
    if (r.delay > 0) {
      // телеграф: безопасные клинья
      const k = 1 - r.delay / 0.9;
      for (const gp of gaps) {
        ctx.fillStyle = rgba(CFG.SAFE, 0.08 + 0.1 * k);
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.arc(this.cx, this.cy, 2000, gp.a - gp.w, gp.a + gp.w);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = rgba(CFG.SAFE, 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy); ctx.lineTo(this.cx + Math.cos(gp.a - gp.w) * 2000, this.cy + Math.sin(gp.a - gp.w) * 2000);
        ctx.moveTo(this.cx, this.cy); ctx.lineTo(this.cx + Math.cos(gp.a + gp.w) * 2000, this.cy + Math.sin(gp.a + gp.w) * 2000);
        ctx.stroke();
      }
    } else {
      ctx.globalCompositeOperation = 'lighter';
      const n = gaps.length;
      for (let pass = 0; pass < 3; pass++) {
        ctx.strokeStyle = pass === 0 ? rgba(pal.glow, 0.35) : pass === 1 ? rgba(pal.light, 0.8) : 'rgba(255,255,255,0.95)';
        ctx.lineWidth = pass === 0 ? r.th * 1.8 : pass === 1 ? r.th : r.th * 0.35;
        for (let i = 0; i < n; i++) {
          const g0 = gaps[i], g1 = gaps[(i + 1) % n];
          const s = g0.a + g0.w;
          let e = g1.a - g1.w;
          while (e < s) e += TAU;
          ctx.beginPath();
          ctx.arc(this.cx, this.cy, r.r, s, e);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}

/* ---------- фабрика ---------- */
function createAttack(key, boss, game) {
  switch (key) {
    case 'dash': return new CosmicDash(boss, game, { rush: false });
    case 'rush': return new CosmicDash(boss, game, { rush: true });
    case 'projectiles': return new VoidProjectiles(boss, game);
    case 'sweep': return new SerpentSweep(boss, game);
    case 'rain': return new CosmicRain(boss, game);
    case 'portal': return new PortalStrike(boss, game);
    case 'beam': return new EnergyBeam(boss, game);
    case 'final': return new FinalAnnihilation(boss, game);
    default: return new CosmicDash(boss, game, { rush: false });
  }
}
