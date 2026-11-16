'use strict';

/* ============================================================
   ares_attacks.js — опасные объекты и атаки босса ARES-07
   Объекты (hazards) живут в боссе и не пропадают с концом атаки.
   У атак те же этапы: подготовка -> предупреждение -> активная фаза -> восстановление.
   ============================================================ */

const LASER_PAL = { glow: '#ff4d6d', light: '#ffc0cc' };

/* ---------- плазменная сфера: самонаводится, при распаде разлетается осколками ---------- */
class PlasmaOrb extends Projectile {
  constructor(o) {
    super(o);
    this.homing = o.homing || 0; this.shards = o.shards || 0; this.shardDmg = o.shardDmg || 20;
    this.speed = Math.hypot(o.vx, o.vy); this.age = 0; this.burstDone = false;
  }
  update(dt, game) {
    this.age += dt;
    const p = game.player;
    if (this.homing > 0 && this.age < 2.2 && !p.dead) {
      const cur = Math.atan2(this.vy, this.vx);
      const a = approachAngle(cur, Math.atan2(p.y - this.y, p.x - this.x), this.homing * dt);
      this.vx = Math.cos(a) * this.speed; this.vy = Math.sin(a) * this.speed;
    }
    super.update(dt, game);
    if (!this.alive && this.life <= 0 && this.shards > 0 && !this.burstDone) this.burst(game);
  }
  burst(game) {
    this.burstDone = true;
    const off = rand(0, TAU);
    for (let i = 0; i < this.shards; i++) {
      const a = off + i * TAU / this.shards;
      game.spawnProjectile({ x: this.x, y: this.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, r: 8, dmg: this.shardDmg, life: 1.7, kind: 'shard', color: this.color });
    }
    game.particles.burst(this.x, this.y, 18, 60, 340, 0.6, 8, this.color);
    game.effects.ring(this.x, this.y, 150, 0.4, this.color, 6);
    game.audio.hit(false);
  }
  render(ctx) {
    const t = this.age * 9;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, this.color, this.x, this.y, this.r * 4, 0.9);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(this.color, 0.95); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r * (1 + 0.12 * Math.sin(t)), 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(this.color, 0.9);
    for (let k = 0; k < 3; k++) {
      const a = t * 0.7 + k * 2.094;
      ctx.beginPath(); ctx.arc(this.x + Math.cos(a) * this.r * 0.85, this.y + Math.sin(a) * this.r * 0.85, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

/* ---------- сфера Теслы: пронзает всё, между соседями вспыхивают дуги ---------- */
class TeslaSphere {
  constructor(x, y, vx, vy, life, dmg, color) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.life = life; this.dmg = dmg; this.color = color;
    this.layer = 1; this.tesla = true; this.clearable = true; this.shootable = false; this.r = 24; this.age = 0; this.dead = false;
  }
  update(dt, g) {
    this.age += dt; this.life -= dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const A = CFG.ARENA, m = 1100;
    if (this.life <= 0 || this.x < -m || this.x > A.w + m || this.y < -m || this.y > A.h + m) { this.destroy(g); return; }
    if (Math.random() < 0.6) g.particles.emit(this.x + rand(-16, 16), this.y + rand(-16, 16), rand(-60, 60), rand(-60, 60), 0.3, 6, Math.random() < 0.5 ? this.color : '#ffffff', { endSize: 0 });
  }
  collide(p, g) {
    if (Physics.circleHit(p.x, p.y, p.radius, this.x, this.y, this.r * 0.9)) p.hurt(this.dmg, this.x, this.y);
  }
  destroy(g) {
    if (this.dead) return;
    this.dead = true;
    g.particles.burst(this.x, this.y, 16, 60, 320, 0.5, 7, this.color);
    g.effects.ring(this.x, this.y, 110, 0.3, this.color, 5);
  }
  render(ctx, time) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.8 + 0.2 * Math.sin(time * 18 + this.x);
    Glow.draw(ctx, this.color, this.x, this.y, 70 * pulse, 0.95);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const a = Math.random() * TAU, l = this.r * rand(0.7, 1.5);
      ctx.beginPath(); ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(a) * l * 0.6 + rand(-5, 5), this.y + Math.sin(a) * l * 0.6 + rand(-5, 5));
      ctx.lineTo(this.x + Math.cos(a) * l, this.y + Math.sin(a) * l); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(this.x, this.y, 9, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

/* ---------- ядерный заряд Гаусса: наводится, затем зажигается запал; можно сбить ---------- */
class GaussNuke {
  constructor(x, y, ang, P, rm) {
    this.x = x; this.y = y; this.ang = ang;
    this.speed = 140; this.maxSpeed = P.nukeSpeed; this.turn = P.nukeTurn;
    this.fly = P.nukeFly; this.fuseT = P.nukeFuse; this.R = P.nukeRadius * rm; this.dmg = P.nukeDmg;
    this.hp = 80; this.hitR = 32; this.state = 'fly'; this.age = 0; this.fuse = 0; this.dead = false;
    this.layer = 1; this.shootable = true; this.clearable = true; this.color = '#ffb040'; this.trail = 0;
  }
  update(dt, g) {
    const p = g.player;
    if (this.state === 'fly') {
      this.age += dt;
      this.speed = Math.min(this.maxSpeed, this.speed + 560 * dt);
      if (!p.dead) this.ang = approachAngle(this.ang, Math.atan2(p.y - this.y, p.x - this.x), this.turn * dt * (this.age < 0.4 ? 0.35 : 1));
      this.x += Math.cos(this.ang) * this.speed * dt; this.y += Math.sin(this.ang) * this.speed * dt;
      this.trail -= dt;
      if (this.trail <= 0) {
        this.trail = 0.02;
        g.particles.emit(this.x - Math.cos(this.ang) * 30, this.y - Math.sin(this.ang) * 30, rand(-40, 40), rand(-40, 40), 0.5, 12, Math.random() < 0.5 ? '#ffb040' : '#ff5a2a', { endSize: 0 });
      }
      if (this.age > this.fly || (!p.dead && this.age > 0.7 && dist(this.x, this.y, p.x, p.y) < 250)) {
        this.state = 'fuse'; this.fuse = this.fuseT;
        g.audio.warn();
      }
    } else {
      this.speed = Math.max(0, this.speed - 1100 * dt);
      this.x += Math.cos(this.ang) * this.speed * dt; this.y += Math.sin(this.ang) * this.speed * dt;
      this.fuse -= dt;
      if (this.fuse <= 0) this.explode(g, false);
    }
  }
  collide(p, g) {
    if (this.state === 'fly' && Physics.circleHit(p.x, p.y, p.radius, this.x, this.y, 26)) this.explode(g, false);
  }
  hit(d, g) {
    this.hp -= d;
    g.particles.burst(this.x, this.y, 4, 40, 220, 0.3, 5, '#ffffff');
    if (this.hp <= 0) this.explode(g, true);
  }
  destroy(g) { this.explode(g, true); }
  explode(g, harmless) {
    if (this.dead) return;
    this.dead = true;
    const R = this.R;
    g.effects.ring(this.x, this.y, R * 1.15, 0.75, this.color, 18);
    g.effects.ring(this.x, this.y, R * 0.6, 0.55, '#ffffff', 10);
    g.effects.flash(harmless ? 0.1 : 0.4, this.color);
    g.particles.burst(this.x, this.y, harmless ? 50 : 130, 80, harmless ? 450 : 900, 1.0, 11, this.color);
    g.particles.burst(this.x, this.y, harmless ? 20 : 50, 60, 500, 0.8, 8, '#ffffff');
    g.camera.addTrauma(harmless ? 0.2 : 0.65);
    g.audio.explosion(harmless ? 0.5 : 1);
    const p = g.player;
    if (!harmless && !p.dead && dist(p.x, p.y, this.x, this.y) <= R + p.radius) p.hurt(this.dmg, this.x, this.y);
  }
  render(ctx, time) {
    ctx.save();
    if (this.state === 'fuse') {
      const k = 1 - this.fuse / this.fuseT;
      ctx.fillStyle = rgba(CFG.WARN, 0.07 + 0.22 * k);
      ctx.beginPath(); ctx.arc(this.x, this.y, this.R, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(CFG.WARN, 0.6 + 0.4 * Math.sin(time * 30));
      ctx.lineWidth = 4; ctx.setLineDash([22, 14]); ctx.lineDashOffset = -time * 90;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.R, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = rgba('#ffffff', 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.R * k, 0, TAU); ctx.stroke();
    }
    ctx.translate(this.x, this.y);
    ctx.rotate(this.ang);
    ctx.globalCompositeOperation = 'lighter';
    if (this.state === 'fly') {                                 // пламя двигателя
      const f = 30 + Math.sin(time * 50) * 8;
      const gr = ctx.createLinearGradient(-30, 0, -30 - f, 0);
      gr.addColorStop(0, 'rgba(255,240,200,0.95)'); gr.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(-30, -8); ctx.lineTo(-30 - f, 0); ctx.lineTo(-30, 8); ctx.fill();
    }
    Glow.draw(ctx, this.color, 0, 0, 56, 0.55);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#10131c'; ctx.fillRect(-32, -12, 52, 24);                // корпус
    ctx.fillStyle = '#5a6482'; ctx.fillRect(-30, -10, 48, 8);
    ctx.fillStyle = '#ffb040';
    for (let i = 0; i < 3; i++) ctx.fillRect(-26 + i * 14, -12, 7, 24);        // полосы
    ctx.fillStyle = (this.state === 'fuse' && Math.sin(time * 40) > 0) ? '#ff3d71' : '#e8ecff';
    ctx.beginPath(); ctx.moveTo(20, -12); ctx.lineTo(40, 0); ctx.lineTo(20, 12); ctx.fill();   // боеголовка
    ctx.fillStyle = '#10131c';
    ctx.beginPath(); ctx.moveTo(-32, -12); ctx.lineTo(-40, -22); ctx.lineTo(-22, -12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-32, 12); ctx.lineTo(-40, 22); ctx.lineTo(-22, 12); ctx.fill();
    ctx.restore();
  }
}

/* ---------- удар с орбиты: метка, затем столб света ---------- */
class StrikeMarker {
  constructor(x, y, r, warn, dmg) {
    this.x = x; this.y = y; this.r = r; this.warn = warn; this.dmg = dmg;
    this.t = 0; this.fired = false; this.dead = false; this.layer = 0; this.color = '#ffb040';
  }
  update(dt, g) {
    this.t += dt;
    if (!this.fired && this.t >= this.warn) {
      this.fired = true;
      g.effects.ring(this.x, this.y, this.r * 1.5, 0.5, this.color, 12);
      g.particles.burst(this.x, this.y, 40, 80, 600, 0.7, 9, this.color);
      g.particles.burst(this.x, this.y, 16, 40, 300, 0.5, 7, '#ffffff');
      g.camera.addTrauma(0.22);
      g.audio.explosion(0.45);
      const p = g.player;
      if (!p.dead && dist(p.x, p.y, this.x, this.y) <= this.r + p.radius) p.hurt(this.dmg, this.x, this.y);
    }
    if (this.fired && this.t >= this.warn + 0.45) this.dead = true;
  }
  render(ctx, time) {
    ctx.save();
    if (!this.fired) {
      const k = clamp(this.t / this.warn, 0, 1);
      ctx.fillStyle = rgba(CFG.WARN, 0.06 + 0.22 * k);
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(CFG.WARN, 0.55 + 0.4 * k);
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.35 + 0.5 * k);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * (1 - k * 0.9), 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.x - this.r * 1.2, this.y); ctx.lineTo(this.x + this.r * 1.2, this.y);
      ctx.moveTo(this.x, this.y - this.r * 1.2); ctx.lineTo(this.x, this.y + this.r * 1.2);
      ctx.strokeStyle = rgba(CFG.WARN, 0.4); ctx.stroke();
    } else {
      const f = 1 - (this.t - this.warn) / 0.45;
      ctx.globalCompositeOperation = 'lighter';
      const w = this.r * (0.35 + 0.35 * f);
      const gr = ctx.createLinearGradient(this.x - w, 0, this.x + w, 0);
      gr.addColorStop(0, rgba(this.color, 0)); gr.addColorStop(0.5, rgba('#ffffff', f)); gr.addColorStop(1, rgba(this.color, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(this.x - w, this.y - 2200, w * 2, 2200);
      Glow.draw(ctx, this.color, this.x, this.y, this.r * 2.4, f);
    }
    ctx.restore();
  }
}

/* ============================================================
   Атаки
   ============================================================ */

/* линия прицеливания от дула руки */
function drawAimLine(ctx, m, ang, len, color, alpha, w) {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = w || 2;
  ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(ang) * len, m.y + Math.sin(ang) * len); ctx.stroke();
  ctx.restore();
}

/* ---------- 1. Plasma Barrage ---------- */
class AresPlasma extends Attack {
  constructor(b, g) {
    super(b, g);
    this.name = 'PLASMA BARRAGE'; this.stage = 'pos'; this.salvo = 0;
    this.ang = rand(0, TAU); this.dir = randSign(); this.pt = { x: 0, y: 0 };
  }
  update(dt) {
    this.t += dt;
    const b = this.boss, P = this.P, g = this.game, arm = b.arms[0];
    this.ang += dt * 0.4 * this.dir;
    b.orbit(this.pt, this.ang, P.hoverDist, 0.6); b.steerTo(this.pt, P.moveSpeed, P.accel);
    if (this.stage !== 'recover') b.aimArm(0, b.aimAngle(0, 0.15), 7);
    switch (this.stage) {
      case 'pos':
        if (this.t > 0.5) { this.stage = 'warn'; this.t = 0; g.audio.warn(); }
        break;
      case 'warn': {
        const W = this.salvo === 0 ? P.plasmaWarn : P.plasmaWarn * 0.65;
        arm.charge = this.t / W;
        if (this.t >= W) {
          b.firePlasma(0, P.plasmaCount, 0.4 + 0.07 * P.plasmaCount);
          this.salvo++; arm.charge = 0; this.t = 0;
          this.stage = this.salvo >= P.plasmaSalvos ? 'recover' : 'warn';
          if (this.stage === 'warn') g.audio.warn();
        }
        break;
      }
      case 'recover':
        b.armRest(0);
        if (this.t > 0.7) this.done = true;
        break;
    }
    return this.done;
  }
  render(ctx) {
    if (this.stage !== 'warn') return;
    const b = this.boss, W = this.salvo === 0 ? this.P.plasmaWarn : this.P.plasmaWarn * 0.65, k = clamp(this.t / W, 0, 1);
    drawAimLine(ctx, b.muzzle(0), b.arms[0].aim, 1000, b.arms[0].color, 0.15 + 0.5 * k, 2);
  }
}

/* ---------- 2. Tesla Web ---------- */
class AresTesla extends Attack {
  constructor(b, g) {
    super(b, g);
    this.name = 'TESLA WEB'; this.stage = 'pos'; this.vol = 0;
    this.ang = rand(0, TAU); this.dir = randSign(); this.pt = { x: 0, y: 0 };
  }
  update(dt) {
    this.t += dt;
    const b = this.boss, P = this.P, g = this.game, arm = b.arms[1];
    this.ang += dt * 0.35 * this.dir;
    b.orbit(this.pt, this.ang, P.hoverDist * 1.05, 0.6); b.steerTo(this.pt, P.moveSpeed, P.accel);
    if (this.stage !== 'recover') b.aimArm(1, b.aimAngle(1, 0.3), 7);
    switch (this.stage) {
      case 'pos':
        if (this.t > 0.5) { this.stage = 'warn'; this.t = 0; g.audio.warn(); }
        break;
      case 'warn':
        arm.charge = this.t / P.teslaWarn;
        if (this.t >= P.teslaWarn) {
          b.fireTesla(1, P.teslaCount, 0.95 + 0.08 * P.teslaCount);
          this.vol++; arm.charge = 0; this.t = 0;
          this.stage = this.vol >= P.teslaVolleys ? 'recover' : 'gap';
        }
        break;
      case 'gap':
        arm.charge = this.t / 0.7;
        if (this.t >= 0.7) { this.stage = 'warn'; this.t = P.teslaWarn * 0.5; g.audio.warn(); }
        break;
      case 'recover':
        b.armRest(1);
        if (this.t > 1.0) this.done = true;
        break;
    }
    return this.done;
  }
  render(ctx) {
    if (this.stage !== 'warn') return;
    const b = this.boss, k = clamp(this.t / this.P.teslaWarn, 0, 1);
    const half = (0.95 + 0.08 * this.P.teslaCount) / 2, a = b.arms[1].aim, m = b.muzzle(1);
    drawAimLine(ctx, m, a - half, 900, b.arms[1].color, 0.1 + 0.4 * k, 2);
    drawAimLine(ctx, m, a + half, 900, b.arms[1].color, 0.1 + 0.4 * k, 2);
  }
}

/* ---------- 3. Laser Volley (+ луч из орудия) ---------- */
class AresLaser extends Attack {
  constructor(b, g) {
    super(b, g);
    this.name = 'LASER VOLLEY'; this.stage = 'pos'; this.shots = 0; this.shotT = 0;
    this.ang = rand(0, TAU); this.dir = randSign(); this.pt = { x: 0, y: 0 };
    this.beamAng = 0; this.locked = false; this.k = 0; this.looping = false; this.len = 3200;
  }
  origin() { return this.boss.muzzle(2); }
  update(dt) {
    this.t += dt;
    const b = this.boss, P = this.P, g = this.game, arm = b.arms[2];
    this.ang += dt * 0.4 * this.dir;
    b.orbit(this.pt, this.ang, P.hoverDist, 0.6);
    if (this.stage === 'beam' || this.stage === 'bwarn') b.holdPosition(); else b.steerTo(this.pt, P.moveSpeed, P.accel);
    switch (this.stage) {
      case 'pos':
        b.aimArm(2, b.aimAngle(2, 0.2), 7);
        if (this.t > 0.5) { this.stage = 'warn'; this.t = 0; g.audio.warn(); }
        break;
      case 'warn':
        b.aimArm(2, b.aimAngle(2, 0.2), 8);
        arm.charge = this.t / P.laserWarn;
        if (this.t >= P.laserWarn) { this.stage = 'bolts'; this.t = 0; this.shots = 0; this.shotT = 0; }
        break;
      case 'bolts':
        b.aimArm(2, b.aimAngle(2, 0.2), 8);
        arm.charge = 0.6;
        this.shotT -= dt;
        if (this.shotT <= 0 && this.shots < P.laserBolts) {
          this.shotT = 0.17;
          b.fireBolt(2, b.aimAngle(2, 0.22) + rand(-0.05, 0.05));
          this.shots++;
        }
        if (this.shots >= P.laserBolts && this.t > P.laserBolts * 0.17 + 0.25) {
          if (P.laserBeam) { this.stage = 'bwarn'; this.t = 0; this.beamAng = b.arms[2].aim; this.locked = false; g.audio.beamCharge(); }
          else { this.stage = 'recover'; this.t = 0; }
        }
        break;
      case 'bwarn': {
        const T = P.beamWarn, lockT = 0.4;
        arm.charge = this.t / T;
        if (this.t < T - lockT) this.beamAng = approachAngle(this.beamAng, b.aimAngle(2, 0), 3.0 * dt);
        else if (!this.locked) { this.locked = true; g.audio.warn(); }
        b.aimArm(2, this.beamAng, 12);
        if (this.t >= T) { this.stage = 'beam'; this.t = 0; g.audio.beamLoop(true); this.looping = true; g.camera.addTrauma(0.4); }
        break;
      }
      case 'beam': {
        this.beamAng = approachAngle(this.beamAng, b.aimAngle(2, 0), P.beamTurn * dt);
        b.aimArm(2, this.beamAng, 12);
        arm.charge = 1;
        this.k = clamp(Math.min(this.t / 0.12, (P.beamTime - this.t) / 0.2 + 0.001), 0, 1);
        g.camera.addTrauma(dt * 0.7);
        if (this.t >= P.beamTime) { this.stage = 'recover'; this.t = 0; this.stopLoop(); }
        break;
      }
      case 'recover':
        b.armRest(2);
        if (this.t > 0.8) this.done = true;
        break;
    }
    return this.done;
  }
  stopLoop() { if (this.looping) { this.game.audio.beamLoop(false); this.looping = false; } }
  cancel() { this.stopLoop(); }
  collide(p) {
    if (this.stage !== 'beam' || this.k < 0.5) return;
    const o = this.origin();
    if (beamHitsPlayer(o.x, o.y, this.beamAng, this.len, this.P.beamWidth, p)) p.hurt(this.P.beamDmg, o.x, o.y);
  }
  render(ctx) {
    const b = this.boss, P = this.P, time = this.game.time, o = this.origin();
    if (this.stage === 'warn') drawAimLine(ctx, o, b.arms[2].aim, 1400, '#ff4d6d', 0.15 + 0.5 * clamp(this.t / P.laserWarn, 0, 1), 2);
    else if (this.stage === 'bwarn') {
      const k = this.t / P.beamWarn;
      ctx.save();
      ctx.translate(o.x, o.y); ctx.rotate(this.beamAng);
      ctx.strokeStyle = this.locked ? 'rgba(255,255,255,0.95)' : rgba(CFG.WARN, 0.35 + 0.4 * k);
      ctx.lineWidth = this.locked ? 4 + 4 * Math.sin(time * 40) : 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(this.len, 0); ctx.stroke();
      if (this.locked) { ctx.fillStyle = rgba(CFG.WARN, 0.16); ctx.fillRect(0, -P.beamWidth * 0.5, this.len, P.beamWidth); }
      ctx.restore();
    } else if (this.stage === 'beam') drawBeam(ctx, o.x, o.y, this.beamAng, this.len, P.beamWidth, LASER_PAL, time, this.k);
  }
}

/* ---------- 4. Gauss Strike ---------- */
class AresGauss extends Attack {
  constructor(b, g) {
    super(b, g);
    this.name = 'GAUSS NUKE'; this.stage = 'pos'; this.fired = 0; this.gap = 0;
    this.ang = rand(0, TAU); this.dir = randSign(); this.pt = { x: 0, y: 0 };
  }
  update(dt) {
    this.t += dt;
    const b = this.boss, P = this.P, g = this.game, arm = b.arms[3];
    this.ang += dt * 0.3 * this.dir;
    b.orbit(this.pt, this.ang, P.hoverDist * 1.15, 0.6); b.steerTo(this.pt, P.moveSpeed * 0.8, P.accel);
    if (this.stage !== 'recover') b.aimArm(3, b.aimAngle(3, 0), 6);
    switch (this.stage) {
      case 'pos':
        if (this.t > 0.5) { this.stage = 'warn'; this.t = 0; g.audio.siren(); }
        break;
      case 'warn':
        arm.charge = this.t / P.gaussWarn;
        if (this.t >= P.gaussWarn) { this.stage = 'launch'; this.t = 0; this.gap = 0; }
        break;
      case 'launch':
        this.gap -= dt;
        arm.charge = 0.7;
        if (this.gap <= 0 && this.fired < P.nukeCount) { b.fireNuke(3, 1); this.fired++; this.gap = 0.65; }
        if (this.fired >= P.nukeCount && this.t > P.nukeCount * 0.65 + 0.2) { this.stage = 'recover'; this.t = 0; }
        break;
      case 'recover':
        b.armRest(3);
        if (this.t > 1.0) this.done = true;
        break;
    }
    return this.done;
  }
  render(ctx) {
    if (this.stage !== 'warn') return;
    const b = this.boss, k = clamp(this.t / this.P.gaussWarn, 0, 1);
    drawAimLine(ctx, b.muzzle(3), b.arms[3].aim, 800, '#ffb040', 0.15 + 0.5 * k, 3);
  }
}

/* ---------- 5. Orbital Strike ---------- */
class AresStrike extends Attack {
  constructor(b, g) {
    super(b, g);
    this.name = 'ORBITAL STRIKE'; this.spawned = 0; this.timer = 0.6;
    this.ang = rand(0, TAU); this.dir = randSign(); this.pt = { x: 0, y: 0 };
  }
  update(dt) {
    this.t += dt;
    const b = this.boss, p = this.player, P = this.P, g = this.game, A = CFG.ARENA;
    this.ang += dt * 0.35 * this.dir;
    b.orbit(this.pt, this.ang, P.hoverDist * 1.1, 0.6); b.steerTo(this.pt, P.moveSpeed, P.accel);
    b.charge = 0.7;
    for (const a of b.arms) { a.mode = 'custom'; a.cust.x = a.def.rest[0] * 0.8; a.cust.y = a.def.rest[1] * 0.8 - 90; a.aimTarget = -Math.PI / 2; a.turn = 5; a.charge = 0.5; }
    this.timer -= dt;
    if (this.spawned < P.strikeCount && this.timer <= 0) {
      this.timer = P.strikeGap;
      let x, y;
      if (this.spawned % 2 === 0) { x = p.x + p.vx * 0.5; y = p.y + p.vy * 0.5; }
      else { const a = rand(0, TAU), d = rand(180, 380); x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d; }
      b.addStrike(clamp(x, 80, A.w - 80), clamp(y, 80, A.h - 80));
      this.spawned++;
      g.audio.warn();
    }
    if (this.spawned >= P.strikeCount && this.t > P.strikeCount * P.strikeGap + P.strikeWarn + 0.8) this.done = true;
    return this.done;
  }
}

/* ---------- 6 + 7. Mech Charge / Rush ---------- */
class AresCharge extends Attack {
  constructor(b, g, rush) {
    super(b, g);
    this.rush = !!rush; this.rounds = rush ? this.P.rushCount : 1;
    this.name = rush ? 'MECH RUSH' : 'MECH CHARGE';
    this.round = 0; this.stage = 'position'; this.pos = { x: 0, y: 0 };
    this.dashAng = 0; this.locked = false; this.sx = 0; this.sy = 0; this.retries = 0; this.width = 260;
  }
  start() { this.beginRound(); }
  pickPos() { this.boss.orbit(this.pos, rand(0, TAU), 1000, 0.55); }
  beginRound() { this.stage = 'position'; this.t = 0; this.locked = false; this.retries = 0; this.pickPos(); }
  windupTime() { return this.P.dashWindup * (this.rush ? 0.62 : 1); }
  update(dt) {
    this.t += dt;
    const b = this.boss, p = this.player, P = this.P, g = this.game, c = b.core;
    switch (this.stage) {
      case 'position': {
        b.tuckArms();
        b.steerTo(this.pos, P.dashSpeed * 0.6, 2600);
        const arrived = dist(c.x, c.y, this.pos.x, this.pos.y) < 150;
        if (arrived || this.t > 2.0) {
          if (dist(c.x, c.y, p.x, p.y) < 480 && this.retries < 2) { this.retries++; this.t = 0; this.pickPos(); }
          else { this.stage = 'windup'; this.t = 0; this.locked = false; this.dashAng = Math.atan2(p.y - c.y, p.x - c.x); g.audio.warn(); }
        }
        break;
      }
      case 'windup': {
        const W = this.windupTime();
        b.tuckArms(); b.holdPosition();
        b.charge = Math.min(1, this.t / W);
        if (this.t < W - P.dashLock) this.dashAng = approachAngle(this.dashAng, Math.atan2(p.y - c.y, p.x - c.x), 4.5 * dt);
        else if (!this.locked) { this.locked = true; g.audio.warn(); }
        if (this.t >= W) {
          this.stage = 'dash'; this.t = 0; this.sx = c.x; this.sy = c.y;
          b.launch(this.dashAng, P.dashSpeed);
          g.audio.dash(); g.camera.addTrauma(0.4);
          g.effects.flash(0.12, b.pal.glow);
          g.effects.ring(c.x, c.y, 300, 0.5, b.pal.glow, 7);
          g.particles.burst(c.x, c.y, 40, 100, 600, 0.6, 9, b.pal.glow);
        }
        break;
      }
      case 'dash': {
        b.tuckArms(); b.charge = 0.6;
        if (Math.random() < 0.8) g.particles.emit(c.x + rand(-60, 60), c.y + rand(-60, 60), -Math.cos(this.dashAng) * 500, -Math.sin(this.dashAng) * 500, 0.35, 9, b.pal.light, { endSize: 0 });
        if (dist(c.x, c.y, this.sx, this.sy) >= 1800 || this.t > 2.6) { this.stage = 'recover'; this.t = 0; b.brake(3.2); }
        break;
      }
      case 'recover': {
        b.tuckArms();
        const wait = (this.rush && this.round < this.rounds - 1) ? 0.12 : 0.6;
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
    const b = this.boss, c = b.core, time = this.game.time;
    if (this.stage === 'windup') {
      const k = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(time * 18));
      drawCorridor(ctx, c.x, c.y, this.dashAng, 2600, this.width, CFG.WARN, k, this.locked, time);
    } else if (this.stage === 'dash' && this.t < 0.25) {
      drawCorridor(ctx, c.x, c.y, this.dashAng, 2600, this.width, CFG.WARN, 0.5 * (1 - this.t / 0.25), true, time);
    }
  }
}

/* ---------- 8. Arsenal Salvo: все четыре орудия по очереди ---------- */
class AresSalvo extends Attack {
  constructor(b, g) {
    super(b, g);
    this.name = 'ARSENAL SALVO';
    this.ang = rand(0, TAU); this.dir = randSign(); this.pt = { x: 0, y: 0 };
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    this.steps = [];
    for (let i = 0; i < this.P.salvoSteps; i++) this.steps.push({ arm: order[i % 4], at: 0.7 + i * this.P.salvoGap, fired: false });
    this.end = this.steps[this.steps.length - 1].at + 0.9;
  }
  update(dt) {
    this.t += dt;
    const b = this.boss, P = this.P, g = this.game;
    this.ang += dt * 0.5 * this.dir;
    b.orbit(this.pt, this.ang, P.hoverDist * 1.05, 0.6); b.steerTo(this.pt, P.moveSpeed * 1.05, P.accel);
    for (const s of this.steps) {
      if (s.fired) continue;
      const arm = b.arms[s.arm], pre = 0.45;
      if (this.t >= s.at - pre) {
        b.aimArm(s.arm, b.aimAngle(s.arm, 0.2), 8);
        arm.charge = clamp((this.t - (s.at - pre)) / pre, 0, 1);
        if (this.t >= s.at - pre && this.t < s.at - pre + dt * 1.5) g.audio.warn();
      }
      if (this.t >= s.at) {
        s.fired = true; arm.charge = 0;
        switch (arm.key) {
          case 'plasma': b.firePlasma(s.arm, 2, 0.3); break;
          case 'tesla': b.fireTesla(s.arm, 3, 0.7); break;
          case 'laser': for (let k = 0; k < 3; k++) b.fireBolt(s.arm, b.aimAngle(s.arm, 0.2) + (k - 1) * 0.1); break;
          default: b.fireNuke(s.arm, 0.85);
        }
        // рука отпускается после выстрела, если больше не нужна
        if (!this.steps.some(o => !o.fired && o.arm === s.arm)) b.armRest(s.arm);
      }
    }
    if (this.t > this.end) this.done = true;
    return this.done;
  }
  render(ctx) {
    const b = this.boss;
    for (const s of this.steps) {
      if (s.fired) continue;
      const k = clamp((this.t - (s.at - 0.45)) / 0.45, 0, 1);
      if (k <= 0) continue;
      drawAimLine(ctx, b.muzzle(s.arm), b.arms[s.arm].aim, 900, b.arms[s.arm].color, 0.1 + 0.5 * k, 2);
    }
  }
}

/* ---------- 9. Core Beam: ядро открыто, луч из реактора ---------- */
class AresCoreBeam extends Attack {
  constructor(b, g) {
    super(b, g);
    this.name = 'REACTOR BEAM'; this.stage = 'position'; this.pos = { x: 0, y: 0 };
    this.ang = 0; this.locked = false; this.k = 0; this.looping = false; this.len = 3400;
  }
  start() { this.boss.orbit(this.pos, rand(0, TAU), 820, 0.55); }
  update(dt) {
    this.t += dt;
    const b = this.boss, p = this.player, P = this.P, g = this.game, c = b.core;
    const want = Math.atan2(p.y - c.y, p.x - c.x);
    switch (this.stage) {
      case 'position':
        b.steerTo(this.pos, P.moveSpeed * 1.4, 2000);
        if (dist(c.x, c.y, this.pos.x, this.pos.y) < 160 || this.t > 2.0) {
          this.stage = 'aim'; this.t = 0; this.ang = want; this.locked = false;
          g.audio.beamCharge();
        }
        break;
      case 'aim': {
        b.holdPosition();
        b.expose(0.3);
        const T = P.cbAim, lockT = 0.4;
        b.charge = this.t / T;
        // орудия отводятся назад, освобождая линию огня
        for (const a of b.arms) { a.mode = 'custom'; a.cust.x = a.def.rest[0] * 0.75; a.cust.y = a.def.rest[1] * 0.6 + 40; a.aimTarget = want; a.turn = 5; }
        if (this.t < T - lockT) this.ang = approachAngle(this.ang, want, 3.2 * dt);
        else if (!this.locked) { this.locked = true; g.audio.warn(); }
        if (this.t >= T) { this.stage = 'fire'; this.t = 0; g.audio.beamLoop(true); this.looping = true; g.camera.addTrauma(0.5); g.effects.flash(0.2, b.pal.glow); }
        break;
      }
      case 'fire':
        b.holdPosition();
        b.expose(0.3);
        b.charge = 1;
        this.ang = approachAngle(this.ang, want, P.cbTurn * dt);
        this.k = clamp(Math.min(this.t / 0.12, (P.cbTime - this.t) / 0.2 + 0.001), 0, 1);
        g.camera.addTrauma(dt * 0.9);
        for (const a of b.arms) { a.aimTarget = this.ang; }
        if (this.t >= P.cbTime) { this.stage = 'recover'; this.t = 0; this.stopLoop(); }
        break;
      case 'recover':
        b.relaxArms();
        b.steerTo(this.pos, P.moveSpeed, P.accel);
        if (this.t > 0.9) this.done = true;
        break;
    }
    return this.done;
  }
  stopLoop() { if (this.looping) { this.game.audio.beamLoop(false); this.looping = false; } }
  cancel() { this.stopLoop(); }
  collide(p) {
    if (this.stage !== 'fire' || this.k < 0.5) return;
    const c = this.boss.core, P = this.P;
    for (const off of P.cbOffsets) {
      if (beamHitsPlayer(c.x, c.y, this.ang + off, this.len, P.cbWidth, p)) { p.hurt(P.cbDmg, c.x, c.y); return; }
    }
  }
  render(ctx) {
    const c = this.boss.core, P = this.P, time = this.game.time;
    if (this.stage === 'aim') {
      const k = this.t / P.cbAim;
      for (const off of P.cbOffsets) {
        ctx.save();
        ctx.translate(c.x, c.y); ctx.rotate(this.ang + off);
        ctx.strokeStyle = this.locked ? 'rgba(255,255,255,0.95)' : rgba(CFG.WARN, 0.35 + 0.4 * k);
        ctx.lineWidth = this.locked ? 4 + 4 * Math.sin(time * 40) : 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(this.len, 0); ctx.stroke();
        if (this.locked) { ctx.fillStyle = rgba(CFG.WARN, 0.16); ctx.fillRect(0, -P.cbWidth * 0.5, this.len, P.cbWidth); }
        ctx.restore();
      }
    } else if (this.stage === 'fire') {
      for (const off of P.cbOffsets) drawBeam(ctx, c.x, c.y, this.ang + off, this.len, P.cbWidth, this.boss.pal, time, this.k);
    }
  }
}

/* ---------- 10. Extinction Protocol ---------- */
class AresFinal extends Attack {
  constructor(b, g) {
    super(b, g);
    this.name = 'EXTINCTION PROTOCOL'; this.stage = 'gather';
    this.center = { x: CFG.ARENA.w / 2, y: CFG.ARENA.h / 2 };
    this.cx = this.center.x; this.cy = this.center.y;
    this.beamAng = rand(0, TAU); this.omega = 0; this.omegaDir = randSign(); this.flipped = false;
    this.fireT = 0; this.nukeIdx = 0; this.nukeT = 0; this.rings = []; this.ringIdx = 0; this.finalSpawned = false;
    this.looping = false; this.coreR = 0;
  }
  start() {
    const g = this.game;
    g.ui.banner('EXTINCTION PROTOCOL', 'ПРОТОКОЛ УНИЧТОЖЕНИЯ', CFG.WARN, 3.2);
    g.effects.darkenTarget = 0.62;
    g.projectilesToParticles();
    g.audio.beamCharge();
    g.camera.addTrauma(0.5);
  }
  beamsActive() { return this.stage === 'spiral' && this.t > 0.9; }
  spawnRing(delay, speed, th, gaps) { this.rings.push({ r: 80, delay, v: speed, th, gaps, t: 0 }); }

  update(dt) {
    this.t += dt;
    const b = this.boss, p = this.player, g = this.game, c = b.core, pal = b.pal;
    switch (this.stage) {
      case 'gather': {
        if (dist(c.x, c.y, this.center.x, this.center.y) > 120) b.steerTo(this.center, 900, 2200); else b.holdPosition();
        for (const a of b.arms) { a.mode = 'custom'; a.cust.x = a.def.rest[0] * 1.2; a.cust.y = a.def.rest[1] * 1.5; a.aimTarget = Math.atan2(a.cust.y, a.cust.x); a.turn = 5; a.charge = clamp(this.t / 3.2, 0, 1); }
        this.coreR = lerp(0, 120, clamp(this.t / 3.2, 0, 1));
        b.charge = clamp(this.t / 3.2, 0, 1);
        b.expose(0.3);
        g.camera.addTrauma(dt * 0.3);
        if (Math.random() < 0.9) {
          const a = rand(0, TAU), d = rand(250, 520);
          g.particles.emit(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, -Math.cos(a) * d * 1.6, -Math.sin(a) * d * 1.6, 0.3, 7, pal.glow, { endSize: 1 });
        }
        if (this.t > 3.2) {
          this.stage = 'spiral'; this.t = 0; this.cx = c.x; this.cy = c.y;
          g.audio.beamLoop(true); this.looping = true;
          g.effects.flash(0.4, pal.glow);
        }
        break;
      }
      case 'spiral': {
        b.holdPosition();
        b.charge = 1;
        this.cx = c.x; this.cy = c.y;
        if (!this.flipped && this.t > 3.2) { this.flipped = true; this.omegaDir *= -1; g.audio.warn(); }
        this.omega = approach(this.omega, this.omegaDir * 0.5, 1.2 * dt);
        this.beamAng += this.omega * dt;
        g.camera.addTrauma(dt * 0.6);
        for (let i = 0; i < 4; i++) {
          const arm = b.arms[i];
          arm.ext = 300;
          b.aimArm(i, this.beamAng + i * Math.PI / 2 + Math.PI / 4, 9);
          arm.charge = 0.6;
        }
        this.fireT -= dt;
        if (this.fireT <= 0 && this.t > 0.9) {
          this.fireT = 0.42;
          for (let i = 0; i < 4; i++) {
            const arm = b.arms[i], m = b.muzzle(i);
            g.spawnProjectile({ x: m.x, y: m.y, vx: Math.cos(arm.aim) * 360, vy: Math.sin(arm.aim) * 360, r: 14, dmg: this.P.plasmaDmg, life: 7, kind: 'orb', color: arm.color });
          }
          g.audio.projectile();
        }
        if (this.t > 6.6) { this.stage = 'nukes'; this.t = 0; this.stopLoop(); b.relaxArms(); g.audio.siren(); }
        break;
      }
      case 'nukes': {
        b.holdPosition();
        b.charge = 0.8;
        for (let i = 0; i < 4; i++) { b.aimArm(i, b.aimAngle(i, 0), 7); b.arms[i].charge = clamp((this.t - this.nukeIdx * 0.9) / 0.9, 0, 1); }
        if (this.nukeIdx < 4 && this.t >= (this.nukeIdx + 1) * 0.9) {
          b.fireNuke(this.nukeIdx, 1.1);
          b.arms[this.nukeIdx].charge = 0;
          this.nukeIdx++;
        }
        if (this.nukeIdx >= 4 && this.t > 4 * 0.9 + 2.2) { this.stage = 'collapse'; this.t = 0; this.ringIdx = 0; b.relaxArms(); this.cx = c.x; this.cy = c.y; }
        break;
      }
      case 'collapse': {
        b.holdPosition();
        b.charge = 0.9;
        this.cx = c.x; this.cy = c.y;
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
        b.holdPosition();
        b.charge = 1;
        g.camera.addTrauma(dt * 0.8);
        if (!this.finalSpawned && this.t > 1.2) {
          this.finalSpawned = true;
          const toP = Math.atan2(p.y - c.y, p.x - c.x);
          this.cx = c.x; this.cy = c.y;
          this.spawnRing(1.0, 900, 70, [{ a: toP + rand(-0.7, 0.7), w: 0.4 }]);
          g.audio.beamCharge();
        }
        if (this.finalSpawned && this.rings.length === 0) { this.stage = 'end'; this.t = 0; }
        break;
      }
      case 'end':
        g.effects.darkenTarget = 0;
        this.coreR = Math.max(0, this.coreR - 300 * dt);
        b.finalDone = true;
        b.relaxArms();
        b.expose(0.4);
        b.steerTo({ x: p.x, y: p.y - 500 }, this.P.moveSpeed, this.P.accel);
        if (this.t > 1.5) { b.expose(2.8); this.done = true; }
        break;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.delay > 0) {
        r.delay -= dt;
        if (r.delay <= 0) { g.camera.addTrauma(0.4); g.effects.flash(r.v > 800 ? 0.6 : 0.2, pal.light); g.audio.explosion(r.v > 800 ? 1 : 0.5); }
      } else {
        r.r += r.v * dt;
        if (r.r > 3100) this.rings.splice(i, 1);
      }
    }
    return this.done;
  }

  stopLoop() { if (this.looping) { this.game.audio.beamLoop(false); this.looping = false; } }
  cancel() { this.stopLoop(); this.game.effects.darkenTarget = 0; this.rings.length = 0; }

  collide(player) {
    const P = this.P;
    if (this.beamsActive()) {
      for (let i = 0; i < 4; i++) {
        if (beamHitsPlayer(this.cx, this.cy, this.beamAng + i * Math.PI / 2, 3400, 66, player)) { player.hurt(P.cbDmg, this.cx, this.cy); return; }
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
    const b = this.boss, c = b.core, pal = b.pal, time = this.game.time;
    if (this.coreR > 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, pal.glow, c.x, c.y, this.coreR * 3, 0.55);
      ctx.restore();
    }
    if (this.stage === 'spiral') {
      const k = clamp((this.t - 0.9) / 0.25, 0, 1);
      for (let i = 0; i < 4; i++) {
        const a = this.beamAng + i * Math.PI / 2;
        if (this.t < 0.9) {
          ctx.save();
          ctx.strokeStyle = rgba(CFG.WARN, 0.4 + 0.4 * Math.abs(Math.sin(time * 30)));
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(this.cx, this.cy); ctx.lineTo(this.cx + Math.cos(a) * 3400, this.cy + Math.sin(a) * 3400); ctx.stroke();
          ctx.restore();
        } else drawBeam(ctx, this.cx, this.cy, a, 3400, 66, pal, time, k);
      }
    }
    for (const r of this.rings) FinalAnnihilation.prototype.renderRing.call(this, ctx, r, pal, time);
  }
}

/* ---------- фабрика ---------- */
function createAresAttack(key, boss, game) {
  switch (key) {
    case 'plasma': return new AresPlasma(boss, game);
    case 'tesla': return new AresTesla(boss, game);
    case 'laser': return new AresLaser(boss, game);
    case 'gauss': return new AresGauss(boss, game);
    case 'strike': return new AresStrike(boss, game);
    case 'charge': return new AresCharge(boss, game, false);
    case 'rush': return new AresCharge(boss, game, true);
    case 'salvo': return new AresSalvo(boss, game);
    case 'sweep': return new AresCoreBeam(boss, game);
    case 'final': return new AresFinal(boss, game);
    default: return new AresPlasma(boss, game);
  }
}
