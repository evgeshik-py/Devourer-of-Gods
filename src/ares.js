'use strict';

/* ============================================================
   ares.js — босс ARES-07: парящий экзоскелет с четырьмя орудиями
   Хитбоксы: ядро (kind 'core') и четыре орудия (kind 'cannon').
   Интерфейс совпадает с Boss (червём), поэтому Game работает с обоими.
   ============================================================ */

/* ---------- процедурные пиксельные спрайты ---------- */
const AresSprites = {
  sets: null,
  get() {
    if (!this.sets) this.sets = CFG.ARES.PALETTES.map(p => this.build(p));
    return this.sets;
  },
  build(pal) {
    const edge = rgbStr(mixRgb(pal.base, '#000000', 0.6));
    const set = { core: this.core(pal, edge), cannon: {}, cannonF: {} };
    set.coreF = makeFlash(set.core);
    for (const def of CFG.ARES.armDefs) {
      set.cannon[def.key] = this.cannon(def, pal, edge);
      set.cannonF[def.key] = makeFlash(set.cannon[def.key]);
    }
    return set;
  },
  core(pal, edge) {
    return makeSprite(48, 48, (x, y, u, v) => {
      const au = Math.abs(u), av = Math.abs(v);
      const oct = Math.max(au, av, (au + av) * 0.74);
      if (oct > 0.97) return null;
      if (oct > 0.9) return edge;
      const rr = Math.hypot(u, v);
      if (rr < 0.36) return rr < 0.3 ? '#04050b' : edge;
      const bolts = [[-0.62, -0.34], [0.62, -0.34], [-0.58, 0.4], [0.58, 0.4]];
      for (let i = 0; i < 4; i++) {
        const d = Math.hypot(u - bolts[i][0], v - bolts[i][1]);
        if (d < 0.16) return d < 0.09 ? pal.glow : edge;
      }
      if (av > 0.62 && av < 0.74 && au < 0.46 && (x % 3 !== 0)) return '#05060c';
      if (x % 12 === 0 || y % 12 === 0) return edge;
      const shade = -v * 0.6 - u * 0.2 + (hash2(x, y) - 0.5) * 0.22;
      if (shade > 0.4) return pal.light;
      if (shade > 0.0) return pal.mid;
      return pal.base;
    });
  },
  cannon(def, pal, edge) {
    const wc = def.color, key = def.key;
    return makeSprite(36, 22, (x, y) => {
      const dy = y + 0.5 - 11, ady = Math.abs(dy);
      const shade = (-dy / 8) * 0.7 + (hash2(x, y) - 0.5) * 0.2;
      const steel = shade > 0.35 ? pal.light : (shade > -0.1 ? pal.mid : pal.base);
      if (x >= 2 && x <= 15 && ady <= 7.5) {                       // общий корпус
        if (x === 2 || x === 15 || ady > 6.6) return edge;
        if (ady < 1.2 && x > 5 && x < 13) return wc;
        return steel;
      }
      if (key === 'plasma') {
        if (x > 15 && x <= 23 && ady <= 5) return (ady > 4 || x === 16 || x === 23) ? edge : steel;
        const d = Math.hypot(x + 0.5 - 28, dy);
        if (d <= 7) return d > 6 ? edge : (d < 3 ? '#ffffff' : wc);
        return null;
      }
      if (key === 'tesla') {
        if (x > 15 && x <= 28 && ady <= 3.6) return (x % 3 === 0) ? wc : (ady > 3 ? edge : steel);
        if (x > 15 && x <= 33 && ady >= 5.4 && ady <= 7.2) return x > 30 ? '#ffffff' : (ady > 6.6 ? edge : wc);
        return null;
      }
      if (key === 'laser') {
        if (x > 15 && x <= 34 && ady <= 2.3) return ady > 1.6 ? edge : steel;
        if (x > 15 && x <= 24 && ady > 2.3 && ady <= 7.5 - (x - 15) * 0.7) return ady > 6.9 - (x - 15) * 0.7 ? edge : steel;
        if (x >= 34 && ady <= 2) return '#ffffff';
        return null;
      }
      // gauss
      if (x > 13 && x <= 33 && ady <= 7.5) {
        if (x === 33 || x === 14 || ady > 6.6) return edge;
        if (x < 22 && ((x + y) % 6 < 3)) return wc;
        if (x > 30) return '#05060c';
        return steel;
      }
      return null;
    });
  }
};

/* ============================================================
   Босс
   ============================================================ */
class Ares {
  constructor(game) {
    const A = CFG.ARES, D = game.diff;
    this.game = game;
    this.name = A.name;
    this.introSub = 'ЭКЗОСКЕЛЕТ ПРОБУЖДЁН';
    this.victoryText = 'Экзоскелет ARES-07 уничтожен.';
    this.defeatText = 'ARES-07 стёр тебя из эфира.';
    this.maxHp = Math.round(A.hp * D.bossHp); this.hp = this.maxHp;
    this.phases = Ares.scalePhases(D);
    this.palettes = A.PALETTES;
    this.novaScale = 3.2;               // у Ares мало хитбоксов — Nova бьёт сильнее
    this.phaseIdx = 0; this.palIdx = 0; this.palSwapped = true;
    this.state = 'intro'; this.invulnerable = true;
    this.alpha = 0;

    this.core = { x: 0, y: 0, angle: 0, r: A.coreR, scale: 1, kind: 'core', i: 0, flash: 0, a: 0, dead: false };
    this.segments = [this.core];
    this.arms = [];
    A.armDefs.forEach((def, i) => {
      const seg = { x: 0, y: 0, angle: 0, r: A.cannonR, scale: 1, kind: 'cannon', i: i + 1, flash: 0, a: 0, dead: false };
      this.arms.push({
        i, def, key: def.key, color: def.color, seg,
        hx: 0, hy: 0, ex: 0, ey: 0, sx: 0, sy: 0,
        aim: 0, aimTarget: 0, turn: 3, mode: 'rest', cust: { x: 0, y: 0 }, ext: 250,
        charge: 0, recoil: 0
      });
      this.segments.push(seg);
    });
    this.head = this.core;

    // движение
    this.vx = 0; this.vy = 0; this.speed = 0; this.tilt = 0;
    this.mode = 'steer'; this.tx = 0; this.ty = 0; this.maxSpeed = 400; this.accel = 900; this.drag = 2.2;

    this.charge = 0; this.hitPulse = 0; this.time = 0; this.exposed = 0; this.openK = 0;
    this.attackNameT = 0; this.attackName = '';
    this.hazards = []; this.arcs = []; this._tl = [];

    this.attack = null; this.queue = []; this.lastKey = '';
    this.idleTimer = 1; this.idleAng = rand(0, TAU); this.idlePt = { x: 0, y: 0 };
    this.finalPending = false; this.finalDone = false;
    this.transT = 0; this.dyingT = 0; this.introT = 0; this.dieIdx = 0; this.ventT = 0;
    this.sprites = AresSprites.get();
  }

  get x() { return this.core.x; } set x(v) { this.core.x = v; }
  get y() { return this.core.y; } set y(v) { this.core.y = v; }
  get phase() { return this.phases[this.phaseIdx]; }
  get pal() { return CFG.ARES.PALETTES[this.palIdx]; }
  get hpRatio() { return this.hp / this.maxHp; }

  /* копии фаз с учётом сложности */
  static scalePhases(D) {
    const speed = ['moveSpeed', 'plasmaSpeed', 'teslaSpeed', 'laserSpeed', 'nukeSpeed', 'dashSpeed'];
    const turn = ['nukeTurn', 'beamTurn', 'cbTurn', 'plasmaHoming'];
    const time = ['plasmaWarn', 'teslaWarn', 'laserWarn', 'gaussWarn', 'strikeWarn', 'dashWindup', 'dashLock', 'beamWarn', 'cbAim', 'idleTime'];
    return CFG.ARES.PHASES.map((src) => {
      const P = Object.assign({}, src);
      for (const k of speed) P[k] = src[k] * D.speed;
      for (const k of turn) P[k] = src[k] * (1 + (D.speed - 1) * 0.7);
      for (const k of time) P[k] = src[k] * D.time;
      P.accel = src.accel * D.speed;
      P.plasmaCount = Math.max(2, src.plasmaCount + D.count);
      P.teslaCount = Math.max(3, src.teslaCount + D.count);
      P.laserBolts = Math.max(3, src.laserBolts + D.count);
      P.strikeCount = Math.max(3, src.strikeCount + D.count * 2);
      P.nukeCount = Math.max(1, src.nukeCount + (D.count > 1 ? 1 : 0));
      return P;
    });
  }

  /* ---------- общие помощники для атак ---------- */
  steerTo(pt, speed, accel) { this.mode = 'steer'; this.tx = pt.x; this.ty = pt.y; this.maxSpeed = speed; this.accel = accel || this.phase.accel; }
  holdPosition() { this.mode = 'steer'; this.tx = this.core.x; this.ty = this.core.y; this.maxSpeed = 300; this.accel = 1600; }
  launch(ang, speed) { this.mode = 'free'; this.vx = Math.cos(ang) * speed; this.vy = Math.sin(ang) * speed; this.drag = 0; }
  brake(drag) { this.mode = 'free'; this.drag = drag || 2.6; }

  /* точка на эллиптической орбите вокруг игрока */
  orbit(out, ang, dist, ky) {
    const p = this.game.player, A = CFG.ARENA;
    out.x = clamp(p.x + Math.cos(ang) * dist * 1.25, -200, A.w + 200);
    out.y = clamp(p.y + Math.sin(ang) * dist * (ky || 0.62), -150, A.h + 150);
    return out;
  }

  muzzle(i) {
    const a = this.arms[i], m = CFG.ARES.muzzle - a.recoil * 14;
    return { x: a.hx + Math.cos(a.aim) * m, y: a.hy + Math.sin(a.aim) * m };
  }
  /* угол от дула руки i до игрока с упреждением */
  aimAngle(i, lead) {
    const p = this.game.player, m = this.muzzle(i), k = lead || 0;
    return Math.atan2(p.y + p.vy * k - m.y, p.x + p.vx * k - m.x);
  }
  aimArm(i, ang, turn) { const a = this.arms[i]; a.mode = 'aim'; a.aimTarget = ang; a.turn = turn || 7; }
  armRest(i) { const a = this.arms[i]; a.mode = 'rest'; a.charge = 0; }
  relaxArms() { for (const a of this.arms) { a.mode = 'rest'; a.charge = 0; a.ext = 250; } }
  tuckArms() { for (const a of this.arms) { a.mode = 'tuck'; a.charge = 0; } }

  /* ---------- стрельба ---------- */
  muzzleFlash(i, n) {
    const a = this.arms[i], m = this.muzzle(i), g = this.game;
    a.recoil = 1;
    g.particles.cone(m.x, m.y, a.aim, 0.7, n || 12, 120, 520, 0.35, 8, a.color, { endSize: 0 });
    g.particles.burst(m.x, m.y, 4, 30, 150, 0.2, 9, '#ffffff');
  }
  firePlasma(i, n, spread) {
    const g = this.game, P = this.phase, arm = this.arms[i], a0 = this.aimAngle(i, 0.15), m = this.muzzle(i);
    for (let k = 0; k < n; k++) {
      const a = a0 + (n === 1 ? 0 : (k / (n - 1) - 0.5) * spread);
      if (g.projectiles.length >= CFG.MAX_PROJECTILES) break;
      g.projectiles.push(new PlasmaOrb({ x: m.x, y: m.y, vx: Math.cos(a) * P.plasmaSpeed, vy: Math.sin(a) * P.plasmaSpeed,
        r: 17, dmg: P.plasmaDmg, life: 3.4, color: arm.color, homing: P.plasmaHoming, shards: P.plasmaShards, shardDmg: P.shardDmg }));
    }
    this.muzzleFlash(i, 14);
    g.audio.plasma();
  }
  fireTesla(i, n, spread) {
    const g = this.game, P = this.phase, a0 = this.aimAngle(i, 0.3), m = this.muzzle(i);
    for (let k = 0; k < n; k++) {
      const a = a0 + (n === 1 ? 0 : (k / (n - 1) - 0.5) * spread);
      this.hazards.push(new TeslaSphere(m.x, m.y, Math.cos(a) * P.teslaSpeed, Math.sin(a) * P.teslaSpeed, P.teslaLife, P.teslaDmg, this.arms[i].color));
    }
    this.muzzleFlash(i, 14);
    g.audio.zap();
  }
  fireBolt(i, ang) {
    const g = this.game, P = this.phase, m = this.muzzle(i), arm = this.arms[i];
    g.spawnProjectile({ x: m.x, y: m.y, vx: Math.cos(ang) * P.laserSpeed, vy: Math.sin(ang) * P.laserSpeed, r: 9, dmg: P.laserDmg, life: 2.2, kind: 'shard', color: arm.color });
    this.muzzleFlash(i, 5);
    g.audio.laserShot();
  }
  fireNuke(i, radiusMult) {
    const g = this.game, P = this.phase, m = this.muzzle(i), arm = this.arms[i];
    const a = this.aimAngle(i, 0);
    this.hazards.push(new GaussNuke(m.x, m.y, a, P, radiusMult || 1));
    this.muzzleFlash(i, 18);
    g.audio.nukeLaunch();
    g.camera.addTrauma(0.15);
  }
  addStrike(x, y) {
    const P = this.phase;
    this.hazards.push(new StrikeMarker(x, y, P.strikeRadius, P.strikeWarn, P.strikeDmg));
  }

  /* ---------- уязвимость ---------- */
  expose(t) { this.exposed = Math.max(this.exposed, t); }

  /* ---------- жизненный цикл ---------- */
  begin() {
    const g = this.game, p = g.player;
    this.core.x = p.x; this.core.y = p.y - 640;
    this.tx = this.core.x; this.ty = this.core.y;
    for (const a of this.arms) a.mode = 'tuck';
    this.updateArms(1, true);
    this.state = 'intro'; this.introT = 0; this.alpha = 0; this.invulnerable = true;
    g.audio.bossSpawn();
    g.effects.ring(this.core.x, this.core.y, 520, 1.2, this.pal.accent, 10);
  }

  updateIntro(dt) {
    const g = this.game;
    this.introT += dt;
    const k = clamp((this.introT - 0.4) / 2.0, 0, 1);
    this.alpha = k < 1 ? k * (0.75 + 0.25 * Math.random()) : 1;
    this.charge = Math.min(1, this.introT / 2.6);
    g.camera.addTrauma(dt * 0.25);
    if (Math.random() < 0.9 && this.introT < 2.6) {
      const a = rand(0, TAU), d = rand(220, 480);
      g.particles.emit(this.core.x + Math.cos(a) * d, this.core.y + Math.sin(a) * d, -Math.cos(a) * d * 1.5, -Math.sin(a) * d * 1.5, 0.32, 7, this.pal.glow, { endSize: 1 });
    }
    if (this.introT > 2.6 && this.introT - dt <= 2.6) {
      g.effects.flash(0.35, this.pal.accent);
      g.effects.ring(this.core.x, this.core.y, 600, 0.9, this.pal.accent, 10);
      g.camera.addTrauma(0.6);
      g.particles.burst(this.core.x, this.core.y, 70, 100, 700, 0.9, 9, this.pal.glow);
      for (const a of this.arms) a.mode = 'rest';
    }
    this.holdPosition();
    if (this.introT > 3.5) { this.state = 'fight'; this.invulnerable = false; this.idleTimer = 0.8; this.alpha = 1; }
  }

  update(dt) {
    this.time += dt;
    this.charge = Math.max(0, this.charge - dt * 2.5);
    this.hitPulse = Math.max(0, this.hitPulse - dt * 4);
    this.attackNameT = Math.max(0, this.attackNameT - dt);
    this.exposed = Math.max(0, this.exposed - dt);
    this.openK = damp(this.openK, this.exposed > 0 || this.state === 'dying' ? 1 : 0, 9, dt);
    for (const s of this.segments) if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 5);
    for (const a of this.arms) { a.recoil = Math.max(0, a.recoil - dt * 6); }

    switch (this.state) {
      case 'intro': this.updateIntro(dt); break;
      case 'fight': this.updateFight(dt); break;
      case 'transition': this.updateTransition(dt); break;
      case 'dying': this.updateDying(dt); break;
      default: break;
    }
    this.moveCore(dt);
    this.updateArms(dt, false);
    this.updateHazards(dt);
    for (const s of this.segments) s.a = this.alpha;
    this.emitEffects(dt);
  }

  moveCore(dt) {
    const c = this.core, A = CFG.ARENA, M = 700;
    if (this.mode === 'free') {
      const f = Math.exp(-this.drag * dt);
      this.vx *= f; this.vy *= f;
    } else {
      const dx = this.tx - c.x, dy = this.ty - c.y, d = Math.hypot(dx, dy);
      const sp = Math.min(this.maxSpeed, d * 2.4);
      const wx = d > 1 ? dx / d * sp : 0, wy = d > 1 ? dy / d * sp : 0;
      let ax = wx - this.vx, ay = wy - this.vy;
      const al = Math.hypot(ax, ay), lim = this.accel * dt;
      if (al > lim) { ax *= lim / al; ay *= lim / al; }
      this.vx += ax; this.vy += ay;
    }
    c.x = clamp(c.x + this.vx * dt, -M, A.w + M);
    c.y = clamp(c.y + this.vy * dt, -M, A.h + M);
    this.speed = Math.hypot(this.vx, this.vy);
    this.tilt = damp(this.tilt, clamp(this.vx / 1500, -0.3, 0.3), 6, dt);
  }

  /* руки: кинематика по двум костям (плечо-локоть-кисть) */
  updateArms(dt, snap) {
    const c = this.core, L = 145, p = this.game.player, t = this.time;
    for (const a of this.arms) {
      const d = a.def;
      a.sx = c.x + d.shoulder[0]; a.sy = c.y + d.shoulder[1];
      let tx, ty, rate = 5;
      if (a.mode === 'aim') {
        tx = a.sx + Math.cos(a.aimTarget) * a.ext; ty = a.sy + Math.sin(a.aimTarget) * a.ext; rate = 10;
      } else if (a.mode === 'tuck') {
        tx = c.x + d.rest[0] * 0.42; ty = c.y + d.rest[1] * 0.42; rate = 8;
        a.aimTarget = Math.atan2(d.rest[1], d.rest[0]); a.turn = 6;
      } else if (a.mode === 'custom') {
        tx = c.x + a.cust.x; ty = c.y + a.cust.y; rate = 8;
      } else {
        tx = c.x + d.rest[0] + Math.sin(t * 1.3 + a.i * 1.7) * 14;
        ty = c.y + d.rest[1] + Math.cos(t * 1.7 + a.i * 1.1) * 10; rate = 5;
        a.aimTarget = Math.atan2(p.y - a.hy, p.x - a.hx); a.turn = 2.4;
      }
      // не дальше длины руки
      let dx = tx - a.sx, dy = ty - a.sy, dd = Math.hypot(dx, dy);
      const maxR = 2 * L - 4;
      if (dd > maxR) { tx = a.sx + dx / dd * maxR; ty = a.sy + dy / dd * maxR; dd = maxR; }
      if (snap) { a.hx = tx; a.hy = ty; a.aim = a.aimTarget; }
      else {
        const k = 1 - Math.exp(-rate * dt);
        a.hx += (tx - a.hx) * k; a.hy += (ty - a.hy) * k;
        a.aim = approachAngle(a.aim, a.aimTarget, a.turn * dt);
      }
      // локоть
      dx = a.hx - a.sx; dy = a.hy - a.sy; dd = Math.max(1, Math.hypot(dx, dy));
      const h = Math.sqrt(Math.max(0, L * L - (dd / 2) * (dd / 2)));
      const mx = a.sx + dx / 2, my = a.sy + dy / 2, nx = -dy / dd, ny = dx / dd;
      const e1x = mx + nx * h, e1y = my + ny * h, e2x = mx - nx * h, e2y = my - ny * h;
      const away1 = Math.hypot(e1x - c.x, e1y - c.y), away2 = Math.hypot(e2x - c.x, e2y - c.y);
      if (away1 >= away2) { a.ex = e1x; a.ey = e1y; } else { a.ex = e2x; a.ey = e2y; }
      // хитбокс орудия
      a.seg.x = a.hx + Math.cos(a.aim) * 22; a.seg.y = a.hy + Math.sin(a.aim) * 22; a.seg.angle = a.aim;
    }
  }

  updateHazards(dt) {
    const g = this.game, hz = this.hazards;
    this._tl.length = 0;
    for (let i = hz.length - 1; i >= 0; i--) {
      const h = hz[i];
      h.update(dt, g, this);
      if (h.dead) hz.splice(i, 1);
    }
    for (let i = 0; i < hz.length; i++) if (hz[i].tesla) this._tl.push(hz[i]);
    // дуги между сферами Теслы
    this.arcs.length = 0;
    const tl = this._tl, R = this.phase.arcRange;
    for (let i = 0; i < tl.length; i++) {
      for (let j = i + 1; j < tl.length; j++) {
        const d = Math.hypot(tl[i].x - tl[j].x, tl[i].y - tl[j].y);
        if (d < R) this.arcs.push({ a: tl[i], b: tl[j], k: 1 - d / R });
      }
    }
  }

  clearHazards() {
    for (const h of this.hazards) this.game.particles.burst(h.x, h.y, 6, 50, 260, 0.5, 7, h.color || this.pal.glow);
    this.hazards.length = 0; this.arcs.length = 0;
  }

  emitEffects(dt) {
    const g = this.game, c = this.core;
    if (this.alpha < 0.5 || this.state === 'dead') return;
    // выхлоп двигателей
    if (this.speed > 250 && Math.random() < 0.8) {
      g.particles.emit(c.x + rand(-60, 60), c.y + 80, -this.vx * 0.05 + rand(-30, 30), 120 + rand(0, 100), 0.5, 11, this.pal.glow, { endSize: 0 });
    }
    // пар из вентиляции в окне уязвимости
    if (this.exposed > 0 && this.state === 'fight') {
      this.ventT -= dt;
      if (this.ventT <= 0) {
        this.ventT = 0.05;
        const s = randSign();
        g.particles.emit(c.x + s * rand(10, 60), c.y - 50, s * rand(20, 90), -rand(90, 200), 0.6, 10, '#d8e8ff', { endSize: 2, add: false, drag: 1.2 });
      }
    }
  }

  /* ---------- ИИ ---------- */
  updateFight(dt) {
    if (!this.finalDone && this.phaseIdx === 3 && this.hpRatio <= 0.12) this.finalPending = true;
    if (this.attack) {
      if (this.attack.update(dt)) this.endAttack();
    } else {
      this.idleTimer -= dt;
      this.idleBehavior(dt);
      if (this.idleTimer <= 0) this.pickAttack();
    }
  }

  idleBehavior(dt) {
    const P = this.phase;
    this.idleAng += dt * (0.55 + this.phaseIdx * 0.12);
    this.orbit(this.idlePt, this.idleAng, P.hoverDist, 0.6);
    this.steerTo(this.idlePt, P.moveSpeed, P.accel);
  }

  pickAttack() {
    const P = this.phase;
    let key;
    if (this.finalPending && !this.finalDone) { key = 'final'; this.finalPending = false; this.queue.length = 0; }
    else if (this.queue.length) key = this.queue.shift();
    else if (P.combos.length && Math.random() < P.comboChance) { const c = pick(P.combos); this.queue = c.slice(1); key = c[0]; }
    else key = weightedPick(P.pool, this.lastKey, (k) => k !== 'final' || this.finalDone);
    this.lastKey = key;
    this.attack = createAresAttack(key, this, this.game);
    this.attackName = this.attack.name;
    this.attackNameT = 2.0;
    this.attack.start();
  }

  endAttack() {
    if (this.attack) this.attack.cancel();
    this.attack = null;
    this.relaxArms();
    if (this.finalPending) this.queue.length = 0;
    this.expose(this.queue.length ? 0.6 : 1.5);          // окно уязвимости после атаки
    this.idleTimer = this.queue.length ? 0.15 : this.phase.idleTime * rand(0.85, 1.15);
    if (this.mode === 'free') this.mode = 'steer';
  }

  cancelAttack() {
    if (this.attack) { this.attack.cancel(); this.attack = null; }
    this.queue.length = 0;
    this.relaxArms();
    if (this.mode === 'free') this.mode = 'steer';
  }

  collide(player) {
    if (this.attack) this.attack.collide(player);
    for (const h of this.hazards) if (h.collide) h.collide(player, this.game, this);
    // дуги Теслы
    for (const a of this.arcs) {
      if (Physics.segDist(player.x, player.y, a.a.x, a.a.y, a.b.x, a.b.y) < 13 + player.radius) {
        player.hurt(this.phase.teslaDmg * 0.8, (a.a.x + a.b.x) / 2, (a.a.y + a.b.y) / 2);
        return;
      }
    }
  }
  contactDamage(seg) { return CFG.ARES.contact[seg.kind]; }

  /* пули игрока по опасным объектам (ядерные заряды можно сбивать) */
  hazardHit(b) {
    for (const h of this.hazards) {
      if (!h.shootable || h.dead) continue;
      if (Physics.segDist(h.x, h.y, b.px, b.py, b.x, b.y) <= h.hitR + b.r) {
        h.hit(b.dmg, this.game, this);
        b.alive = false;
        return;
      }
    }
  }
  /* Nova: убирает сферы и сбивает ядерные заряды */
  novaClear(x, y, r) {
    for (const h of this.hazards) {
      if (h.dead || !h.clearable) continue;
      if (dist(x, y, h.x, h.y) <= r) h.destroy(this.game, this);
    }
  }

  /* ---------- урон ---------- */
  takeDamage(amount, seg) {
    if (this.state === 'dying' || this.state === 'dead') return 0;
    if (this.invulnerable) return -1;
    const mult = seg.kind === 'core' ? (this.exposed > 0 ? 1.8 : 0.65) : 0.85;
    const dmg = Math.max(1, Math.round(amount * mult * rand(0.92, 1.08)));
    this.hp = Math.max(0, this.hp - dmg);
    seg.flash = 1; this.hitPulse = 1;
    this.game.stats.damage += dmg;

    if (this.hp <= 0 && this.phaseIdx < 3) {
      this.hp = Math.max(1, Math.floor(this.maxHp * this.phase.to));
      this.startTransition();
    } else if (this.hp <= 0) {
      this.die();
    } else if (this.phaseIdx < 3 && this.hpRatio <= this.phase.to) {
      this.startTransition();
    }
    return dmg;
  }

  startTransition() {
    const g = this.game;
    this.cancelAttack();
    this.clearHazards();
    this.state = 'transition'; this.transT = 0;
    this.invulnerable = true;
    this.phaseIdx++;
    this.palSwapped = false;
    this.exposed = 0;
    g.projectilesToParticles();
    g.audio.phase();
    g.audio.setAmbientPhase(this.phaseIdx);
    g.effects.flash(0.5, '#ffffff');
    g.camera.addTrauma(0.9);
    g.effects.ring(this.core.x, this.core.y, 900, 1.2, this.pal.glow, 14);
    g.player.heal(Math.round(CFG.PLAYER.phaseHeal * g.diff.heal));
    const ph = this.phase;
    g.ui.banner('PHASE ' + ph.roman, ph.name, CFG.ARES.PALETTES[this.phaseIdx].accent, 3.2);
  }

  updateTransition(dt) {
    const g = this.game, p = g.player;
    this.transT += dt;
    this.idleAng += dt * 0.7;
    this.orbit(this.idlePt, this.idleAng, 820, 0.55);
    this.steerTo(this.idlePt, 480, 900);
    this.charge = 1;
    // руки раскинуты в стороны, пока идёт перезагрузка
    for (const a of this.arms) { a.mode = 'custom'; a.cust.x = a.def.rest[0] * 1.15; a.cust.y = a.def.rest[1] * 1.0 - 40; a.aimTarget = Math.atan2(a.cust.y, a.cust.x); a.turn = 4; }
    if (!this.palSwapped && this.transT >= 1.0) {
      this.palSwapped = true;
      this.palIdx = this.phaseIdx;
      g.effects.flash(1.0, '#ffffff');
      g.camera.addTrauma(1);
      g.audio.explosion(1);
      g.particles.burst(this.core.x, this.core.y, 90, 100, 800, 1.0, 10, this.pal.glow);
      for (const a of this.arms) g.particles.burst(a.hx, a.hy, 30, 80, 500, 0.8, 9, this.pal.light);
      g.effects.ring(this.core.x, this.core.y, 1400, 1.4, this.pal.light, 18);
    }
    if (this.transT >= CFG.ARES.transitionTime) {
      this.relaxArms();
      this.state = 'fight'; this.invulnerable = false; this.idleTimer = 1.0;
      this.expose(1.8);
    }
  }

  die() {
    const g = this.game;
    this.cancelAttack();
    this.clearHazards();
    this.state = 'dying'; this.dyingT = 0; this.dieIdx = 0;
    this.invulnerable = true;
    this.holdPosition();
    g.projectilesToParticles();
    g.effects.darkenTarget = 0;
    g.effects.flash(0.7, '#ffffff');
    g.camera.addTrauma(1);
    g.timeScale = 0.45;
    g.audio.beamLoop(false);
  }

  updateDying(dt) {
    const g = this.game;
    this.dyingT += dt;
    this.charge = 1;
    this.holdPosition();
    this.mode = 'free'; this.drag = 2.5;
    // руки обвисают
    for (const a of this.arms) { a.mode = 'custom'; a.cust.x = a.def.rest[0] * 0.5; a.cust.y = 190; a.aimTarget = 1.2 * Math.sign(a.def.rest[0]) + 0.3; a.turn = 2; }
    const order = [this.arms[0].seg, this.arms[3].seg, this.arms[1].seg, this.arms[2].seg, this.core];
    while (this.dieIdx < order.length && this.dyingT >= this.dieIdx * 0.6) { this.explodeSeg(order[this.dieIdx]); this.dieIdx++; }
    if (this.dieIdx >= 3) g.timeScale = damp(g.timeScale, 1, 2, dt);
    // мелкие взрывы по корпусу
    if (this.dieIdx < order.length && Math.random() < 0.35) {
      g.particles.burst(this.core.x + rand(-70, 70), this.core.y + rand(-70, 70), 10, 60, 380, 0.6, 8, Math.random() < 0.5 ? this.pal.glow : '#ffffff');
      g.camera.addTrauma(0.05);
    }
    if (this.dieIdx >= order.length && this.dyingT > order.length * 0.6 + 0.9) {
      this.state = 'dead';
      g.effects.flash(1.0, '#ffffff');
      g.camera.addTrauma(1);
      g.timeScale = 1;
      g.onBossDead();
    }
  }

  explodeSeg(s) {
    if (s.dead) return;
    s.dead = true;
    const g = this.game, pal = this.pal, big = s.kind === 'core';
    g.particles.burst(s.x, s.y, big ? 200 : 70, 100, big ? 1000 : 650, 1.2, big ? 13 : 10, pal.glow);
    g.particles.burst(s.x, s.y, big ? 100 : 30, 60, 450, 0.9, 8, '#ffffff');
    g.particles.burst(s.x, s.y, big ? 60 : 20, 40, 300, 1.4, 12, pal.base, { add: false, drag: 1.5 });
    g.effects.ring(s.x, s.y, big ? 800 : 320, 0.8, pal.light, big ? 16 : 9);
    g.camera.addTrauma(big ? 0.9 : 0.3);
    g.audio.explosion(big ? 1 : 0.5);
  }

  /* ---------- отрисовка ---------- */
  render(ctx) {
    if (this.state === 'dead') return;
    const set = this.sprites[this.palIdx], pal = this.pal, c = this.core, time = this.time;

    // нижний слой опасностей (метки ударов)
    for (const h of this.hazards) if (h.layer === 0) h.render(ctx, time, this);

    const coreAlive = !c.dead && this.alpha > 0.02;
    if (coreAlive) {
      // аура и двигатели
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, pal.glow, c.x, c.y, 230 + this.charge * 130, (0.2 + 0.35 * this.charge) * this.alpha);
      const fl = 34 + Math.min(70, this.speed / 14) + Math.sin(time * 40) * 6;
      for (const sx of [-52, 52]) {
        ctx.globalAlpha = 0.7 * this.alpha;
        const gr = ctx.createLinearGradient(0, c.y + 70, 0, c.y + 70 + fl);
        gr.addColorStop(0, rgba(pal.eye, 0.95)); gr.addColorStop(1, rgba(pal.glow, 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(c.x + sx - 13, c.y + 70); ctx.lineTo(c.x + sx, c.y + 70 + fl); ctx.lineTo(c.x + sx + 13, c.y + 70);
        ctx.fill();
      }
      ctx.restore();
    }

    // руки (звенья и суставы)
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const a of this.arms) {
      if (a.seg.dead || this.alpha < 0.02) continue;
      ctx.globalAlpha = this.alpha;
      this.drawLimb(ctx, a.sx, a.sy, a.ex, a.ey, 26, pal);
      this.drawLimb(ctx, a.ex, a.ey, a.hx, a.hy, 22, pal);
      for (const [jx, jy, jr] of [[a.sx, a.sy, 19], [a.ex, a.ey, 15], [a.hx, a.hy, 13]]) {
        ctx.fillStyle = rgbStr(mixRgb(pal.base, '#000000', 0.5)); ctx.beginPath(); ctx.arc(jx, jy, jr + 3, 0, TAU); ctx.fill();
        ctx.fillStyle = pal.mid; ctx.beginPath(); ctx.arc(jx, jy, jr, 0, TAU); ctx.fill();
        ctx.fillStyle = a.color; ctx.beginPath(); ctx.arc(jx, jy, jr * 0.38, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();

    // ядро
    if (coreAlive) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(this.tilt);
      ctx.globalAlpha = this.alpha;
      ctx.imageSmoothingEnabled = false;
      const S = 3.5, W = 48 * S;
      ctx.drawImage(set.core, -W / 2, -W / 2, W, W);
      if (c.flash > 0) { ctx.globalAlpha = c.flash * 0.85 * this.alpha; ctx.drawImage(set.coreF, -W / 2, -W / 2, W, W); ctx.globalAlpha = this.alpha; }
      this.drawReactor(ctx, pal);
      ctx.restore();
    }

    // орудия
    for (const a of this.arms) {
      if (a.seg.dead || this.alpha < 0.02) continue;
      ctx.save();
      ctx.translate(a.hx, a.hy);
      ctx.rotate(a.aim);
      ctx.globalAlpha = this.alpha;
      if (Math.cos(a.aim) < 0) ctx.scale(1, -1);
      ctx.translate(-a.recoil * 14, 0);
      ctx.imageSmoothingEnabled = false;
      const cs = 3.2;
      ctx.drawImage(set.cannon[a.key], -10 * cs, -10.5 * cs, 36 * cs, 22 * cs);
      if (a.seg.flash > 0) { ctx.globalAlpha = a.seg.flash * 0.85 * this.alpha; ctx.drawImage(set.cannonF[a.key], -10 * cs, -10.5 * cs, 36 * cs, 22 * cs); }
      ctx.restore();
      // заряд на дуле
      const m = this.muzzle(a.i);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = 0.18 + a.charge * 0.82;
      Glow.draw(ctx, a.color, m.x, m.y, 22 + a.charge * 56 + a.recoil * 30, g * this.alpha * (0.4 + a.charge * 0.6));
      if (a.charge > 0.05) Glow.draw(ctx, '#ffffff', m.x, m.y, 8 + a.charge * 18, a.charge * this.alpha);
      ctx.restore();
    }

    // верхний слой опасностей
    for (const h of this.hazards) if (h.layer !== 0) h.render(ctx, time, this);
    this.renderArcs(ctx);

    // метка уязвимости
    if (this.exposed > 0 && this.state === 'fight' && !c.dead) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.exposed * 2) * (0.7 + 0.3 * Math.sin(time * 12));
      ctx.textAlign = 'center';
      ctx.font = '900 20px ' + CFG.FONT;
      ctx.fillStyle = '#ffe27a';
      ctx.shadowColor = '#ffb040'; ctx.shadowBlur = 12;
      ctx.fillText('▼ ЯДРО ОТКРЫТО ▼', c.x, c.y - 120);
      ctx.restore();
    }
  }

  drawLimb(ctx, x1, y1, x2, y2, w, pal) {
    ctx.strokeStyle = rgbStr(mixRgb(pal.base, '#000000', 0.55)); ctx.lineWidth = w + 6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = pal.base; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = pal.mid; ctx.lineWidth = w * 0.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // блик и гидравлика
    const dx = x2 - x1, dy = y2 - y1, d = Math.max(1, Math.hypot(dx, dy)), nx = -dy / d * w * 0.22, ny = dx / d * w * 0.22;
    ctx.strokeStyle = pal.light; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x2 + nx, y2 + ny); ctx.stroke();
  }

  drawReactor(ctx, pal) {
    const p = this.game.player, o = this.openK, c = this.core;
    const look = Math.atan2(p.y - c.y, p.x - c.x), px = Math.cos(look) * 6, py = Math.sin(look) * 6;
    const hot = this.exposed > 0 || this.state === 'dying';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = 24 + this.charge * 8 + this.hitPulse * 4;
    Glow.draw(ctx, hot ? '#ffcf70' : pal.glow, px, py, r * 2.6, 0.5 + o * 0.5);
    Glow.draw(ctx, pal.eye, px, py, r * 1.2, 0.4 + o * 0.6);
    ctx.restore();
    // створки над реактором
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, 29, 0, TAU); ctx.clip();
    ctx.fillStyle = pal.mid;
    ctx.fillRect(-32 - o * 30, -32, 32, 64);
    ctx.fillRect(o * 30, -32, 32, 64);
    ctx.fillStyle = pal.base;
    ctx.fillRect(-32 - o * 30, -32, 6, 64); ctx.fillRect(26 + o * 30, -32, 6, 64);
    ctx.restore();
    // щель между створками
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(pal.eye, (1 - o) * 0.8 + 0.1);
    ctx.fillRect(-1.5 - o * 4, -26, 3 + o * 8, 52);
    ctx.restore();
  }

  renderArcs(ctx) {
    if (!this.arcs.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    const col = this.arms[1].color;
    for (const a of this.arcs) {
      const x1 = a.a.x, y1 = a.a.y, x2 = a.b.x, y2 = a.b.y;
      const dx = x2 - x1, dy = y2 - y1, d = Math.max(1, Math.hypot(dx, dy)), nx = -dy / d, ny = dx / d;
      const n = Math.max(4, Math.floor(d / 38));
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath(); ctx.moveTo(x1, y1);
        for (let i = 1; i < n; i++) {
          const t = i / n, j = (Math.random() - 0.5) * 28 * (0.5 + a.k);
          ctx.lineTo(x1 + dx * t + nx * j, y1 + dy * t + ny * j);
        }
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = pass === 0 ? rgba(col, 0.45 + 0.4 * a.k) : 'rgba(255,255,255,0.9)';
        ctx.lineWidth = pass === 0 ? 8 : 2.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
