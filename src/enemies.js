'use strict';

/* ============================================================
   enemies.js — бесконечный режим TerraBattle.
   Пешки Devourer of Gods (зелёный неон) и ARES-07 (голубой/оранжевый),
   две элиты и директор волн `Swarm`, который реализует тот же интерфейс,
   что и боссы (segments / takeDamage / state / hpRatio ...), поэтому
   стрельба, самонаведение, Nova, контактный урон и HUD работают без дублирования.
   ============================================================ */

const ENEMY_DEFS = {
  larva:     { cls: 'Larva',     side: 'dog',  name: 'ЛИЧИНКА',          r: 16, hp: 55,   speed: 340, contact: 24, score: 10,  cost: 1, color: '#4dff8a', drop: 0.05 },
  crawler:   { cls: 'WormEnemy', side: 'dog',  name: 'ПОЛЗУН',           r: 19, hp: 240,  speed: 300, contact: 28, score: 60,  cost: 4, color: '#4dff8a', drop: 0.10, segs: 6, turn: 2.2 },
  spitter:   { cls: 'Spitter',   side: 'dog',  name: 'ПЛЮВАТЕЛЬ',        r: 24, hp: 150,  speed: 250, contact: 20, score: 40,  cost: 3, color: '#7dffb0', drop: 0.10 },
  sentinel:  { cls: 'Sentinel',  side: 'ares', name: 'СТРАЖ ARES',       r: 22, hp: 130,  speed: 310, contact: 20, score: 40,  cost: 3, color: '#35e0ff', drop: 0.10 },
  lancer:    { cls: 'Lancer',    side: 'ares', name: 'ЛАНСЕР ARES',      r: 22, hp: 170,  speed: 340, contact: 18, score: 50,  cost: 3, color: '#ff8a3d', drop: 0.10 },
  bomber:    { cls: 'Bomber',    side: 'ares', name: 'ПОДРЫВНИК ARES',   r: 27, hp: 210,  speed: 190, contact: 20, score: 60,  cost: 4, color: '#ffd24d', drop: 0.12 },
  commander: { cls: 'Commander', side: 'ares', name: 'КОМАНДИР ARES',    r: 44, hp: 2600, speed: 300, contact: 30, score: 600, cost: 0, color: '#35e0ff', elite: true },
  alpha:     { cls: 'WormEnemy', side: 'dog',  name: 'АЛЬФА DEVOURER',   r: 34, hp: 3000, speed: 300, contact: 40, score: 600, cost: 0, color: '#4dff8a', elite: true, segs: 11, turn: 1.7, shoots: true }
};

/* ---------- общие приёмы рисования ---------- */
function polyPath(ctx, pts) { ctx.beginPath(); for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]); ctx.closePath(); }
function regPoly(ctx, n, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath();
}

/* ============================================================
   Базовый враг
   ============================================================ */
class Enemy {
  constructor(dir, def, x, y, sc) {
    this.dir = dir; this.def = def; this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.angle = rand(0, TAU); this.t = rand(0, 3); this.ph = rand(0, TAU);
    this.r = def.r; this.color = def.color; this.elite = !!def.elite;
    this.maxHp = Math.round(def.hp * sc.hp); this.hp = this.maxHp;
    this.dmgMul = sc.dmg; this.spd = def.speed * sc.speed; this.contact = def.contact * sc.dmg;
    this.score = def.score; this.dead = false; this.spawn = 0; this.flash = 0; this.touched = false;
    this.wave = sc.wave;
    this.seg = { x, y, r: this.r, dead: false, a: 0, kind: 'pawn', owner: this };
    this.segs = [this.seg];
  }
  contactNow() { return this.contact; }

  hurt(amount) {
    if (this.dead || this.spawn < 1) return 0;
    const d = Math.max(1, Math.round(amount));
    this.hp -= d; this.flash = 1;
    if (this.hp <= 0) { this.hp = 0; this.kill(); }
    return d;
  }
  kill() { this.dead = true; this.dir.onEnemyKilled(this, false); }

  drive(tx, ty, speed, dt, acc) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
    this.vx = damp(this.vx, dx / d * speed, acc || 4, dt);
    this.vy = damp(this.vy, dy / d * speed, acc || 4, dt);
  }
  shoot(a, speed, o) {
    this.dir.game.spawnProjectile({
      x: this.x + Math.cos(a) * this.r, y: this.y + Math.sin(a) * this.r, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      r: o.r || 10, dmg: (o.dmg || 16) * this.dmgMul, life: o.life || 5, kind: o.kind || 'orb', color: o.color || this.color
    });
  }
  syncSegs() { this.seg.x = this.x; this.seg.y = this.y; }

  update(dt, g) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 5);
    if (this.spawn < 1) {
      this.spawn = Math.min(1, this.spawn + dt / 0.9);
      for (const s of this.segs) s.a = this.spawn * 0.45;          // < 0.5 — неуязвим и безвреден, пока «материализуется»
    } else {
      for (const s of this.segs) s.a = 1;
      this.think(dt, g);
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    const A = CFG.ARENA, m = 40;
    this.x = clamp(this.x, m, A.w - m); this.y = clamp(this.y, m, A.h - m);
    this.syncSegs();
  }
  think() {}

  /* обёртка: эффект появления + сам рендер */
  draw(ctx, t) {
    if (this.spawn < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(this.color, 0.8 * (1 - this.spawn)); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * (3.2 - 2.2 * this.spawn), 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.25 + 0.75 * this.spawn;
      this.render(ctx, t);
      ctx.restore();
    } else this.render(ctx, t);
    if (this.elite && this.spawn >= 1) this.hpBar(ctx);
  }
  hpBar(ctx) {
    const w = 130, x = this.x - w / 2, y = this.y - this.r - 26;
    ctx.fillStyle = 'rgba(3,8,13,0.8)'; ctx.fillRect(x - 2, y - 2, w + 4, 9);
    ctx.fillStyle = this.color; ctx.fillRect(x, y, w * clamp(this.hp / this.maxHp, 0, 1), 5);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, w * clamp(this.hp / this.maxHp, 0, 1), 2);
  }
  flashOverlay(ctx, size) {
    if (this.flash <= 0) return;
    ctx.globalAlpha = this.flash * 0.75; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, size, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
}

/* ============================================================
   DEVOURER: личинка — быстрый камикадзе-рой
   ============================================================ */
class Larva extends Enemy {
  think(dt, g) {
    const p = g.player;
    const want = Math.atan2(p.y - this.y, p.x - this.x) + Math.sin(this.t * 4 + this.ph) * 0.55;
    this.angle = approachAngle(this.angle, want, 7 * dt);
    const sp = this.spd * (0.85 + 0.15 * Math.sin(this.t * 3 + this.ph));
    this.vx = damp(this.vx, Math.cos(this.angle) * sp, 5, dt);
    this.vy = damp(this.vy, Math.sin(this.angle) * sp, 5, dt);
    if (this.touched) {                                    // врезалась в игрока — взрыв без награды
      this.dead = true;
      g.particles.burst(this.x, this.y, 16, 80, 360, 0.5, 6, this.color);
      this.dir.onEnemyKilled(this, true);
    }
  }
  render(ctx, t) {
    const r = this.r, pulse = 0.5 + 0.5 * Math.sin(t * 9 + this.ph);
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, this.color, 0, 0, r * 3, 0.28 + 0.15 * pulse);
    ctx.fillStyle = rgba(this.color, 0.5);
    ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.35); ctx.lineTo(-r * (1.4 + pulse * 0.6), 0); ctx.lineTo(-r * 0.6, r * 0.35); ctx.fill();   // двигатель
    ctx.globalCompositeOperation = 'source-over';
    polyPath(ctx, [[r * 1.3, 0], [r * 0.2, -r * 0.55], [-r * 0.9, -r * 0.95], [-r * 0.5, 0], [-r * 0.9, r * 0.95], [r * 0.2, r * 0.55]]);
    ctx.fillStyle = '#16222b'; ctx.fill(); ctx.strokeStyle = this.color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(r * 0.15, 0, r * 0.26, 0, TAU); ctx.fill();
    this.flashOverlay(ctx, r * 1.1);
    ctx.restore();
  }
}

/* ============================================================
   DEVOURER: сегментный червь-механоид (ползун и элита «Альфа»)
   ============================================================ */
class WormEnemy extends Enemy {
  constructor(dir, def, x, y, sc) {
    super(dir, def, x, y, sc);
    this.n = def.segs; this.turn = def.turn; this.shoots = !!def.shoots;
    this.gap = def.r * 1.45; this.boost = 0; this.cd = rand(1.5, 3); this.windup = 0; this.boostCd = rand(4, 7);
    this.segs = [];
    for (let i = 0; i < this.n; i++) {
      this.segs.push({ x: x - i * this.gap, y, r: def.r * (1 - 0.4 * i / (this.n - 1)), dead: false, a: 0, kind: 'pawn', owner: this });
    }
    this.seg = this.segs[0];
  }
  think(dt, g) {
    const p = g.player;
    const want = Math.atan2(p.y - this.y, p.x - this.x);
    this.angle = approachAngle(this.angle, want, this.turn * dt);
    this.boost = Math.max(0, this.boost - dt);
    const sp = this.spd * (this.boost > 0 ? 2.1 : 1) * (this.windup > 0 ? 0.35 : 1);
    this.vx = damp(this.vx, Math.cos(this.angle) * sp, 5, dt);
    this.vy = damp(this.vy, Math.sin(this.angle) * sp, 5, dt);
    if (this.shoots) {                                      // элита: веер плазмы и рывки
      this.cd -= dt; this.boostCd -= dt;
      if (this.windup > 0) {
        this.windup -= dt;
        if (this.windup <= 0) {
          const n = 7 + Math.min(4, (this.wave / 10) | 0), spread = 0.9;
          for (let i = 0; i < n; i++) this.shoot(this.angle + (i / (n - 1) - 0.5) * spread, 400, { r: 12, dmg: 18, color: '#4dff8a' });
          g.audio.plasma && g.audio.plasma();
          this.cd = 3.2;
        }
      } else if (this.cd <= 0) this.windup = 0.6;
      if (this.boostCd <= 0) { this.boost = 1.0; this.boostCd = rand(5, 8); }
    }
  }
  syncSegs() {
    const h = this.segs[0]; h.x = this.x; h.y = this.y;
    for (let i = 1; i < this.n; i++) {
      const a = this.segs[i - 1], b = this.segs[i];
      const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 1;
      if (d > this.gap) { b.x = a.x - dx / d * this.gap; b.y = a.y - dy / d * this.gap; }
    }
  }
  render(ctx, t) {
    const S = this.segs, charge = this.windup > 0 ? 1 - this.windup / 0.6 : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.n - 1; i >= 0; i--) {
      const s = S[i];
      Glow.draw(ctx, this.color, s.x, s.y, s.r * 2.4, 0.12 + 0.1 * Math.sin(t * 5 - i * 0.7) + charge * 0.2);
    }
    ctx.restore();
    for (let i = this.n - 1; i >= 0; i--) {
      const s = S[i], lead = S[Math.max(0, i - 1)];
      const ang = i === 0 ? this.angle : Math.atan2(lead.y - s.y, lead.x - s.x);
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(ang);
      if (i === 0) {
        // голова: клиновидный череп с визором
        const r = s.r;
        polyPath(ctx, [[r * 1.45, 0], [r * 0.5, -r * 0.8], [-r * 0.9, -r * 0.95], [-r * 1.0, 0], [-r * 0.9, r * 0.95], [r * 0.5, r * 0.8]]);
        ctx.fillStyle = '#1a2a34'; ctx.fill(); ctx.strokeStyle = this.color; ctx.lineWidth = 2.2; ctx.stroke();
        ctx.fillStyle = '#04090d'; polyPath(ctx, [[r * 1.0, 0], [r * 0.35, -r * 0.3], [r * 0.35, r * 0.3]]); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        Glow.draw(ctx, '#ffffff', r * 0.55, 0, r * 0.8, 0.5 + charge * 0.5);
        Glow.draw(ctx, this.color, -r * 0.1, 0, r * 1.2, 0.35 + charge * 0.4);
        ctx.globalCompositeOperation = 'source-over';
        this.flashOverlay(ctx, r * 1.1);
      } else {
        const r = s.r;
        regPoly(ctx, 6, r * 1.05, Math.PI / 6);
        ctx.fillStyle = '#16222b'; ctx.fill(); ctx.strokeStyle = this.color; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.95); ctx.lineTo(-r * 1.5, -r * 1.35); ctx.lineTo(-r * 0.4, -r * 1.0); ctx.fillStyle = '#243743'; ctx.fill();   // шип
        ctx.beginPath(); ctx.moveTo(-r * 0.9, r * 0.95); ctx.lineTo(-r * 1.5, r * 1.35); ctx.lineTo(-r * 0.4, r * 1.0); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        Glow.draw(ctx, this.color, 0, 0, r * 0.9, 0.55 + 0.3 * Math.sin(t * 6 - i));
        ctx.globalCompositeOperation = 'source-over';
        if (this.flash > 0) { ctx.globalAlpha = this.flash * 0.5; ctx.fillStyle = '#fff'; regPoly(ctx, 6, r * 1.05, Math.PI / 6); ctx.fill(); ctx.globalAlpha = 1; }
      }
      ctx.restore();
    }
  }
}

/* ============================================================
   DEVOURER: плеватель — держит дистанцию, стреляет веером
   ============================================================ */
class Spitter extends Enemy {
  constructor(...a) { super(...a); this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = rand(1.5, 3.5); this.cd = rand(1, 2.4); this.windup = 0; }
  think(dt, g) {
    const p = g.player, dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const want = d > 650 ? 1 : d < 430 ? -1 : 0;
    this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = rand(2, 4); }
    this.vx = damp(this.vx, ux * want * this.spd - uy * this.strafe * this.spd * 0.5, 3, dt);
    this.vy = damp(this.vy, uy * want * this.spd + ux * this.strafe * this.spd * 0.5, 3, dt);
    this.angle = Math.atan2(dy, dx);
    this.cd -= dt;
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) {
        const n = Math.min(7, 3 + ((this.wave / 8) | 0)), spread = 0.3 * (n - 1);
        for (let i = 0; i < n; i++) this.shoot(this.angle + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0), 370, { r: 11, dmg: 18, color: '#7dffb0' });
        this.cd = 2.6;
      }
    } else if (this.cd <= 0) this.windup = 0.45;
  }
  render(ctx, t) {
    const r = this.r, ch = this.windup > 0 ? 1 - this.windup / 0.45 : 0;
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, this.color, 0, 0, r * 3, 0.22 + ch * 0.4); ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(this.angle);
    ctx.fillStyle = '#0e1a22'; ctx.fillRect(r * 0.4, -r * 0.28, r * 1.1, r * 0.56);              // ствол
    ctx.strokeStyle = this.color; ctx.lineWidth = 1.6; ctx.strokeRect(r * 0.4, -r * 0.28, r * 1.1, r * 0.56);
    regPoly(ctx, 6, r, 0); ctx.fillStyle = '#16222b'; ctx.fill(); ctx.strokeStyle = this.color; ctx.lineWidth = 2.2; ctx.stroke();
    regPoly(ctx, 6, r * 0.55, 0); ctx.fillStyle = '#04090d'; ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, '#ffffff', 0, 0, r * (0.5 + ch * 0.7), 0.5 + ch * 0.5); ctx.globalCompositeOperation = 'source-over';
    this.flashOverlay(ctx, r);
    ctx.restore();
  }
}

/* ============================================================
   ARES: страж — кружит и стреляет прицельными дублетами
   ============================================================ */
class Sentinel extends Enemy {
  constructor(...a) { super(...a); this.orb = rand(0, TAU); this.orbDir = Math.random() < 0.5 ? 1 : -1; this.cd = rand(1, 2.2); this.windup = 0; this.burst = 0; this.burstT = 0; }
  think(dt, g) {
    const p = g.player;
    this.orb += dt * 0.55 * this.orbDir;
    this.drive(p.x + Math.cos(this.orb) * 540, p.y + Math.sin(this.orb) * 540, this.spd, dt, 3);
    this.angle = approachAngle(this.angle, Math.atan2(p.y - this.y, p.x - this.x), 8 * dt);
    this.cd -= dt;
    if (this.burst > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) { this.shoot(this.angle, 760, { r: 9, dmg: 15, kind: 'shard', color: '#35e0ff' }); this.burst--; this.burstT = 0.16; if (this.burst <= 0) this.cd = 2.1; }
    } else if (this.windup > 0) {
      this.windup -= dt; if (this.windup <= 0) { this.burst = 2; this.burstT = 0; }
    } else if (this.cd <= 0) this.windup = 0.4;
  }
  render(ctx, t) {
    const r = this.r, ch = this.windup > 0 ? 1 - this.windup / 0.4 : 0;
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, this.color, 0, 0, r * 3, 0.2 + ch * 0.4); ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(this.angle);
    polyPath(ctx, [[r * 1.4, 0], [0, -r * 0.9], [-r * 1.1, -r * 0.5], [-r * 0.7, 0], [-r * 1.1, r * 0.5], [0, r * 0.9]]);
    ctx.fillStyle = '#122430'; ctx.fill(); ctx.strokeStyle = this.color; ctx.lineWidth = 2.2; ctx.stroke();
    polyPath(ctx, [[r * 0.3, -r * 0.25], [r * 1.0, 0], [r * 0.3, r * 0.25]]); ctx.fillStyle = this.color; ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, '#ffffff', r * 0.6, 0, r * (0.4 + ch * 0.6), 0.5 + ch * 0.5); ctx.globalCompositeOperation = 'source-over';
    this.flashOverlay(ctx, r);
    ctx.restore();
  }
}

/* ============================================================
   ARES: ланс-дрон — прицеливается и совершает рывок по линии
   ============================================================ */
class Lancer extends Enemy {
  constructor(...a) { super(...a); this.mode = 'approach'; this.mt = 0; this.cd = rand(0.5, 2); this.lock = 0; }
  contactNow() { return this.mode === 'dash' ? this.contact * 2.2 : this.contact * 0.6; }
  think(dt, g) {
    const p = g.player, d = dist(this.x, this.y, p.x, p.y);
    this.mt += dt;
    if (this.mode === 'approach') {
      this.drive(p.x, p.y, this.spd, dt, 3);
      this.angle = approachAngle(this.angle, Math.atan2(p.y - this.y, p.x - this.x), 6 * dt);
      this.cd -= dt;
      if (d < 560 && this.cd <= 0) { this.mode = 'aim'; this.mt = 0; }
    } else if (this.mode === 'aim') {
      this.vx = damp(this.vx, 0, 8, dt); this.vy = damp(this.vy, 0, 8, dt);
      if (this.mt < 0.55) this.angle = approachAngle(this.angle, Math.atan2(p.y - this.y, p.x - this.x), 9 * dt);   // последние 0.35 с линия зафиксирована
      if (this.mt >= 0.9) { this.mode = 'dash'; this.mt = 0; this.lock = this.angle; g.audio.laserShot && g.audio.laserShot(); }
    } else if (this.mode === 'dash') {
      this.vx = Math.cos(this.lock) * 1500; this.vy = Math.sin(this.lock) * 1500;
      if (Math.random() < 0.7) g.particles.emit(this.x, this.y, rand(-40, 40), rand(-40, 40), 0.3, 8, this.color, { endSize: 0 });
      if (this.mt >= 0.45) { this.mode = 'cool'; this.mt = 0; }
    } else {
      this.vx = damp(this.vx, 0, 6, dt); this.vy = damp(this.vy, 0, 6, dt);
      if (this.mt >= 1.2) { this.mode = 'approach'; this.cd = 1.4; }
    }
  }
  render(ctx, t) {
    const r = this.r;
    if (this.mode === 'aim') {                         // линия-предупреждение
      const k = this.mt / 0.9, locked = this.mt > 0.55;
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(locked ? '#ff3d52' : '#ff8a3d', 0.12 + 0.22 * k + (locked ? 0.15 * Math.sin(t * 40) : 0));
      ctx.fillRect(0, -r * 0.6, 700, r * 1.2);
      ctx.restore();
    }
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, this.color, 0, 0, r * 3, this.mode === 'dash' ? 0.6 : 0.22); ctx.globalCompositeOperation = 'source-over';
    polyPath(ctx, [[r * 1.7, 0], [r * 0.2, -r * 0.5], [-r * 1.0, -r * 0.9], [-r * 0.6, 0], [-r * 1.0, r * 0.9], [r * 0.2, r * 0.5]]);
    ctx.fillStyle = '#241812'; ctx.fill(); ctx.strokeStyle = this.color; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.fillStyle = this.color; polyPath(ctx, [[r * 1.5, 0], [r * 0.5, -r * 0.15], [r * 0.5, r * 0.15]]); ctx.fill();
    this.flashOverlay(ctx, r);
    ctx.restore();
  }
}

/* ============================================================
   ARES: подрывник — медленный, взрывается кольцом снарядов
   ============================================================ */
class Bomber extends Enemy {
  constructor(...a) { super(...a); this.fuse = 0; }
  ring(n, speed) {
    for (let i = 0; i < n; i++) this.shoot(this.ph + i * TAU / n, speed, { r: 10, dmg: 17, color: '#ffb040', life: 4 });
  }
  think(dt, g) {
    const p = g.player, d = dist(this.x, this.y, p.x, p.y);
    this.angle = approachAngle(this.angle, Math.atan2(p.y - this.y, p.x - this.x), 3 * dt);
    this.drive(p.x, p.y, this.fuse > 0 ? this.spd * 0.3 : this.spd, dt, 3);
    if (this.fuse <= 0 && (d < 210 || this.touched)) this.fuse = 0.75;
    if (this.fuse > 0) {
      this.fuse -= dt;
      if (this.fuse <= 0) {                             // детонация: без награды
        this.ring(14, 340);
        g.particles.burst(this.x, this.y, 40, 100, 520, 0.7, 7, '#ffb040');
        g.effects.ring(this.x, this.y, 180, 0.4, '#ffb040', 8);
        g.camera.addTrauma(0.15);
        this.dead = true; this.dir.onEnemyKilled(this, true);
      }
    }
  }
  kill() { this.ring(8, 300); super.kill(); }           // убитый игроком — слабый осколочный залп
  render(ctx, t) {
    const r = this.r, hot = this.fuse > 0 && Math.sin(t * 30) > 0;
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, this.color, 0, 0, r * 3, this.fuse > 0 ? 0.55 : 0.2); ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(this.angle * 0.3);
    regPoly(ctx, 8, r, Math.PI / 8); ctx.fillStyle = hot ? '#5a3a10' : '#1d1a10'; ctx.fill(); ctx.strokeStyle = this.color; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,210,77,0.55)'; ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.7, i * r * 0.4 + r * 0.25); ctx.lineTo(r * 0.7, i * r * 0.4 - r * 0.25); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, hot ? '#ffffff' : this.color, 0, 0, r * 0.9, 0.7); ctx.globalCompositeOperation = 'source-over';
    this.flashOverlay(ctx, r);
    ctx.restore();
  }
}

/* ============================================================
   ARES: командир (элита) — кольцевые залпы, очереди, вызов стражей
   ============================================================ */
class Commander extends Enemy {
  constructor(...a) { super(...a); this.orb = rand(0, TAU); this.cd = 2.2; this.windup = 0; this.mode = 0; this.volleys = 0; this.vt = 0; this.summoned = false; this.spin = 0; }
  think(dt, g) {
    const p = g.player;
    this.orb += dt * 0.3; this.spin += dt * 1.2;
    this.drive(p.x + Math.cos(this.orb) * 640, p.y + Math.sin(this.orb) * 640, this.spd, dt, 2.5);
    this.angle = approachAngle(this.angle, Math.atan2(p.y - this.y, p.x - this.x), 5 * dt);
    if (!this.summoned && this.hp < this.maxHp * 0.5) {
      this.summoned = true;
      for (let i = 0; i < 2; i++) this.dir.spawnEnemy('sentinel', this.x + (i ? 90 : -90), this.y);
      g.effects.ring(this.x, this.y, 300, 0.6, '#35e0ff', 10);
    }
    if (this.volleys > 0) {
      this.vt -= dt;
      if (this.vt <= 0) {
        for (let i = -1; i <= 1; i++) this.shoot(this.angle + i * 0.16, 800, { r: 10, dmg: 18, kind: 'shard', color: '#35e0ff' });
        this.volleys--; this.vt = 0.28; if (this.volleys <= 0) this.cd = 2.4;
      }
    } else if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) {
        if (this.mode === 0) {
          const n = 20; for (let i = 0; i < n; i++) this.shoot(this.spin + i * TAU / n, 430, { r: 11, dmg: 17, kind: 'shard', color: '#35e0ff' });
          this.cd = 2.6;
        } else { this.volleys = 3; this.vt = 0; }
        this.mode ^= 1;
      }
    } else { this.cd -= dt; if (this.cd <= 0) this.windup = 0.7; }
  }
  render(ctx, t) {
    const r = this.r, ch = this.windup > 0 ? 1 - this.windup / 0.7 : 0;
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, this.color, 0, 0, r * 3.2, 0.25 + ch * 0.35); ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.rotate(this.spin);                         // вращающееся кольцо пластин
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate(i * TAU / 6);
      polyPath(ctx, [[r * 1.15, -r * 0.2], [r * 1.5, 0], [r * 1.15, r * 0.2], [r * 0.95, 0]]); ctx.fillStyle = '#122430'; ctx.fill(); ctx.strokeStyle = this.color; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.rotate(this.angle);
    polyPath(ctx, [[r * 1.1, 0], [r * 0.5, -r * 0.8], [-r * 0.6, -r * 0.9], [-r, -r * 0.4], [-r, r * 0.4], [-r * 0.6, r * 0.9], [r * 0.5, r * 0.8]]);
    ctx.fillStyle = '#122430'; ctx.fill(); ctx.strokeStyle = this.color; ctx.lineWidth = 3; ctx.stroke();
    regPoly(ctx, 6, r * 0.38, 0); ctx.fillStyle = '#04090d'; ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, '#ffffff', 0, 0, r * (0.45 + ch * 0.6), 0.55 + ch * 0.45);
    ctx.globalCompositeOperation = 'source-over';
    this.flashOverlay(ctx, r * 1.1);
    ctx.restore();
  }
}

const ENEMY_CLASSES = { Larva, WormEnemy, Spitter, Sentinel, Lancer, Bomber, Commander };

/* ============================================================
   Директор волн. Совместим с интерфейсом босса.
   ============================================================ */
class Swarm {
  constructor(game) {
    this.game = game; this.endless = true;
    this.name = 'ENDLESS PROTOCOL'; this.introSub = 'Бесконечный режим';
    this.victoryText = ''; this.defeatText = 'Рой поглотил тебя.';
    this.palettes = CFG.PALETTES; this.palIdx = 0; this.pal = this.palettes[0];
    this.state = 'intro'; this.invulnerable = false; this.alpha = 1; this.hitPulse = 0;
    this.attack = null; this.attackName = ''; this.attackNameT = 0;
    this.phase = { roman: '', name: '', contactMult: 1 };
    this.novaScale = 4;               // Nova — зачистка рядовых пешек (против элит остаётся сильным, но не решающим ударом)
    this.enemies = []; this.segments = []; this.head = { x: 0, y: 0, a: 0 };
    this.wave = 0; this.score = 0; this.kills = 0; this.eliteKills = 0;
    this.queue = []; this.spawnT = 0; this.waveTotal = 0; this.waveState = 'countdown'; this.countdown = 3.2;
    this.eliteWave = false; this.sc = null;
    const p = game.player; this.head.x = p.x; this.head.y = p.y;
  }
  get remaining() { return this.queue.length + this.enemies.length; }
  get hp() { return this.remaining; }
  get maxHp() { return this.waveTotal || 1; }
  get hpRatio() { return this.waveTotal ? clamp(this.remaining / this.waveTotal, 0, 1) : 0; }
  get scoreMul() { return 1 + (CFG.DIFFS.indexOf(this.game.diff) - 1) * 0.3; }

  begin() { this.state = 'fight'; }
  collide() {}
  contactDamage(seg) { seg.owner.touched = true; return seg.owner.contactNow(); }
  takeDamage(amount, seg) {
    if (!seg || !seg.owner) return 0;
    const d = seg.owner.hurt(amount);
    if (d > 0) { this.hitPulse = 1; this.game.stats.damage += d; }
    return d;
  }

  /* ---------- волны ---------- */
  scale(w) {
    const D = this.game.diff;
    return { hp: (1 + 0.075 * (w - 1)) * lerp(1, D.bossHp, 0.85), dmg: Math.min(2.2, 1 + 0.025 * (w - 1)), speed: Math.min(1.4, 1 + 0.012 * (w - 1)) * D.speed, wave: w };
  }
  compose(w) {
    const unlock = { larva: 1, spitter: 2, sentinel: 3, crawler: 4, lancer: 4, bomber: 6 };
    const pool = Object.keys(unlock).filter(k => unlock[k] <= w);
    const q = []; let budget = 4 + w * 2.4;
    this.eliteWave = w % 5 === 0;
    if (this.eliteWave) {
      const kind = (w / 5) % 2 === 1 ? 'commander' : 'alpha';
      for (let i = 0, n = 1 + Math.floor((w - 5) / 25); i < n; i++) q.push(kind);
      budget *= 0.55;
    }
    const rest = [];
    while (budget >= 1 && rest.length < 70) {
      const k = Loot.weighted(pool.map(id => [id, id === 'larva' ? Math.max(1, 4 - w * 0.15) : 2]));
      const cost = ENEMY_DEFS[k].cost;
      if (cost > budget) { rest.push('larva'); budget -= 1; continue; }
      const grp = k === 'larva' ? Math.min(4, Math.floor(budget)) : 1;
      for (let i = 0; i < grp; i++) rest.push(k);
      budget -= cost * grp;
    }
    for (let i = rest.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
    return q.concat(rest);
  }
  startWave() {
    const g = this.game;
    this.wave++;
    this.sc = this.scale(this.wave);
    this.queue = this.compose(this.wave);
    this.waveTotal = this.queue.length;
    this.waveState = 'active'; this.spawnT = 0.4;
    this.palIdx = Math.min(3, ((this.wave - 1) / 5) | 0); this.pal = this.palettes[this.palIdx];
    g.audio.setAmbientPhase && g.audio.setAmbientPhase(this.palIdx);
    g.stats.wave = this.wave;
    const first = ENEMY_DEFS[this.queue[0]];
    g.ui.banner(this.eliteWave ? 'ЭЛИТНАЯ ВОЛНА ' + this.wave : 'ВОЛНА ' + this.wave,
      this.eliteWave ? first.name : 'Врагов: ' + this.waveTotal, this.eliteWave ? '#ff3d71' : this.pal.accent, 2.4);
    if (this.eliteWave) g.audio.siren && g.audio.siren();
  }
  endWave() {
    const g = this.game, p = g.player, bonus = Math.round(this.wave * 150 * this.scoreMul);
    this.score += bonus;
    this.waveState = 'countdown'; this.countdown = 4;
    if (!p.dead) p.heal(Math.round(p.maxHp * 0.1));
    g.ui.banner('ВОЛНА ' + this.wave + ' ОЧИЩЕНА', '+' + fmtNum(bonus) + ' очков  •  подготовка к следующей', '#4dff8a', 2.8);
    g.audio.ready();
  }
  spawnPoint() {
    const p = this.game.player, A = CFG.ARENA;
    let x = p.x, y = p.y;
    for (let t = 0; t < 8; t++) {
      const a = rand(0, TAU), d = rand(720, 1100);
      x = clamp(p.x + Math.cos(a) * d, 90, A.w - 90); y = clamp(p.y + Math.sin(a) * d, 90, A.h - 90);
      if (dist(x, y, p.x, p.y) > 520) break;
    }
    return { x, y };
  }
  spawnEnemy(id, x, y) {
    const def = ENEMY_DEFS[id], C = ENEMY_CLASSES[def.cls];
    const e = new C(this, def, x, y, this.sc || this.scale(Math.max(1, this.wave)));
    this.enemies.push(e);
    return e;
  }

  /* ---------- события ---------- */
  onEnemyKilled(e, silent) {
    const g = this.game, p = g.player;
    if (!silent) {
      const pts = Math.round(e.score * this.scoreMul);
      this.score += pts; this.kills++; if (e.elite) this.eliteKills++;
      g.effects.text(e.x, e.y - e.r - 8, '+' + pts, e.elite ? '#ffe27a' : '#cfe8f4', e.elite ? 26 : 15);
      g.particles.burst(e.x, e.y, 16 + e.r * 0.5, 80, 480, 0.7, 6, e.color);
      g.particles.burst(e.x, e.y, 8 + e.r * 0.3, 40, 260, 0.5, 5, '#ffffff');
      g.effects.ring(e.x, e.y, e.r * 3.5, 0.35, e.color, 5);
      g.audio.explosion(e.elite ? 0.8 : 0.22);
      g.camera.addTrauma(e.elite ? 0.55 : 0.05);
      if (e.elite) { g.effects.flash(0.25, '#ffffff'); g.effects.ring(e.x, e.y, 600, 0.7, e.color, 12); }
      // трофеи
      const lm = p.mods ? p.mods.loot : 0;
      if (g.pickups.length < 40) {
        if (e.elite) {
          for (const d of Loot.elite(g.inventory)) g.pickups.push(new Pickup(e.x, e.y, d.id, d.n));
        } else {
          const d = Loot.drop(e.def.drop || 0.08, lm);
          if (d) g.pickups.push(new Pickup(e.x, e.y, d.id, d.n));
        }
      }
    }
  }

  /* ---------- обновление ---------- */
  update(dt) {
    const g = this.game, p = g.player;
    this.hitPulse = Math.max(0, this.hitPulse - dt * 4);
    this.head.x = p.x; this.head.y = p.y;          // камера следит за игроком
    if (this.state !== 'fight') return;

    if (this.waveState === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0 && !p.dead) this.startWave();
    } else {
      this.spawnT -= dt;
      const cap = 16 + Math.min(14, this.wave);
      if (this.spawnT <= 0 && this.queue.length && this.enemies.length < cap) {
        const pt = this.spawnPoint();
        this.spawnEnemy(this.queue.shift(), pt.x, pt.y);
        this.spawnT = Math.max(0.2, 0.7 - 0.015 * this.wave);
      }
    }

    const E = this.enemies;
    for (let i = 0; i < E.length; i++) E[i].update(dt, g);
    // расталкивание
    for (let i = 0; i < E.length; i++) {
      const a = E[i]; if (a.dead || a.spawn < 1) continue;
      for (let j = i + 1; j < E.length; j++) {
        const b = E[j]; if (b.dead || b.spawn < 1) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = (a.r + b.r) * 0.9;
        if (d < min && d > 0.01) { const k = (min - d) / d * 0.5; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
      }
    }
    for (let i = E.length - 1; i >= 0; i--) if (E[i].dead) E.splice(i, 1);
    this.segments.length = 0;
    for (const e of E) for (const s of e.segs) this.segments.push(s);

    if (this.waveState === 'active' && !this.queue.length && !E.length) this.endWave();
  }

  /* ---------- отрисовка ---------- */
  render(ctx) {
    const t = this.game.time;
    for (const e of this.enemies) e.draw(ctx, t);
  }
}
