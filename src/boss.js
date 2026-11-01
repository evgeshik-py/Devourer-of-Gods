'use strict';

/* ============================================================
   boss.js — Devourer of Gods: сегментированный червь
   Движение: голова ведёт, каждый сегмент подтягивается к предыдущему
   на фиксированной дистанции (follow-the-leader) — цепь не рвётся.
   ============================================================ */

/* ---------- процедурные пиксельные спрайты ---------- */
function makeSprite(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = fn(x, y, (x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2));
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  }
  return c;
}
function hash2(x, y) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
function makeFlash(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
function inTri(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

const BossSprites = {
  sets: null,
  get() {
    if (this.sets) return this.sets;
    this.sets = CFG.PALETTES.map(pal => this.build(pal));
    return this.sets;
  },
  build(pal) {
    const edge = rgbStr(mixRgb(pal.base, '#000000', 0.55));
    const body = this.body(pal, edge), head = this.head(pal, edge), jaw = this.jaw(pal, edge), tail = this.tail(pal, edge);
    return {
      body, head, jaw, tail,
      bodyF: makeFlash(body), headF: makeFlash(head), jawF: makeFlash(jaw), tailF: makeFlash(tail)
    };
  },
  body(pal, edge) {
    return makeSprite(30, 26, (x, y, u, v) => {
      const au = Math.abs(u), av = Math.abs(v);
      const e = (u * u) / (0.9 * 0.9) + (v * v) / (0.78 * 0.78);
      const spike = av > 0.74 && av <= 1.0 && au < (1.0 - av) * 1.15 + 0.02 && au < 0.34;
      if (e > 1 && !spike) return null;
      if (spike) return av > 0.9 ? pal.light : pal.mid;
      if (e > 0.8) return edge;
      if (av < 0.11 && au < 0.72) return av < 0.05 ? '#ffffff' : pal.glow;
      if (x % 8 === 3) return edge;
      const shade = -v * 0.7 - u * 0.15 + (hash2(x, y) - 0.5) * 0.25;
      if (shade > 0.38) return pal.light;
      if (shade > -0.05) return pal.mid;
      return pal.base;
    });
  },
  head(pal, edge) {
    return makeSprite(48, 38, (x, y) => {
      const dx = x - 19.5, dy = y - 18.5, ady = Math.abs(dy);
      const skull = (dx * dx) / (19 * 19) + (dy * dy) / (17 * 17);
      const snoutHalf = 11 - (dx - 8) * 0.30;
      const inSnout = dx > 8 && dx < 28 && ady <= snoutHalf;
      const horn = inTri(x, y, 8, 6, 18, 4, 1, 0) || inTri(x, y, 8, 31, 18, 33, 1, 37);
      if (skull > 1 && !inSnout && !horn) return null;
      if (horn && skull > 1) return ady > 15 ? pal.light : pal.mid;
      // глаза
      const eyeUp = Math.abs(x - 28) <= 1.6 && Math.abs(y - 12.5) <= 1.2;
      const eyeDn = Math.abs(x - 28) <= 1.6 && Math.abs(y - 25.5) <= 1.2;
      if (eyeUp || eyeDn) return (Math.abs(x - 28) < 0.8) ? '#ffffff' : pal.eye;
      // надбровье
      if ((Math.abs(y - 10) < 1 || Math.abs(y - 28) < 1) && x > 22 && x < 34) return edge;
      // светящаяся вена
      if (ady < 1.2 && x > 4 && x < 36) return pal.glow;
      if (skull > 0.82 && !inSnout) return edge;
      if (inSnout && (ady > snoutHalf - 1.1 || dx > 26.5)) return edge;
      if (x % 9 === 5 && ady > 2) return edge;
      const shade = -dy / 17 * 0.7 + (hash2(x, y) - 0.5) * 0.25;
      if (shade > 0.35) return pal.light;
      if (shade > -0.1) return pal.mid;
      return pal.base;
    });
  },
  jaw(pal, edge) {
    return makeSprite(20, 10, (x, y) => {
      const t = x / 19, cy = 5 - 4 * t * t, th = 3.6 * (1 - t) + 0.4;
      const d = y + 0.5 - cy;
      if (Math.abs(d) > th) return null;
      if (x > 16) return pal.glow;
      if (Math.abs(d) > th - 0.9) return edge;
      return d < -th * 0.3 ? pal.light : (d > th * 0.4 ? pal.base : pal.mid);
    });
  },
  tail(pal, edge) {
    return makeSprite(28, 20, (x, y) => {
      const t = x / 27, half = 1 + 8.5 * Math.pow(t, 0.85);
      const dy = y + 0.5 - 10;
      let h = half;
      if (x >= 18 && x <= 24 && Math.abs(dy) < half + 2.2 && Math.abs(dy) > half - 1) h = half + 2.2;
      if (Math.abs(dy) > h) return null;
      if (Math.abs(dy) < 0.9 && t > 0.3) return pal.glow;
      if (Math.abs(dy) > h - 1) return edge;
      const shade = -dy / 9 * 0.7 + (hash2(x, y) - 0.5) * 0.25;
      return shade > 0.35 ? pal.light : (shade > -0.1 ? pal.mid : pal.base);
    });
  }
};

/* ============================================================
   Босс
   ============================================================ */
class Boss {
  constructor(game) {
    this.game = game;
    const B = CFG.BOSS;
    const D = game.diff;
    this.maxHp = Math.round(B.hp * D.bossHp); this.hp = this.maxHp;
    this.phases = Boss.scalePhases(D);
    this.name = B.name;
    this.introSub = 'ПРОБУЖДЕНИЕ';
    this.victoryText = 'Пожиратель богов повержен.';
    this.defeatText = 'Бездна поглотила тебя.';
    this.palettes = CFG.PALETTES;
    this.phaseIdx = 0; this.palIdx = 0; this.palSwapped = true;
    this.state = 'intro';           // intro | fight | transition | dying | dead
    this.invulnerable = true;

    this.segments = [];
    const total = B.bodyCount + 2;
    for (let i = 0; i < total; i++) {
      const kind = i === 0 ? 'head' : (i === total - 1 ? 'tail' : 'body');
      const k = i / (total - 1);
      const scale = kind === 'body' ? (1.08 - 0.34 * Math.pow(k, 1.4)) : 1;
      const r = kind === 'head' ? B.headRadius : (kind === 'tail' ? B.tailRadius : B.bodyRadius * scale);
      this.segments.push({ x: 0, y: 0, angle: 0, r, scale, kind, i, flash: 0, a: 1, dead: false });
    }
    this.head = this.segments[0];
    this.tail = this.segments[total - 1];

    // состояние головы
    this.angle = Math.PI / 2; this.speed = 0; this.targetSpeed = 0; this.accel = 800; this.turnRate = 1.5;
    this.steerTarget = null; this.pathFn = null; this.pathT = 0;
    this.alpha = 1; this.emergePortal = null; this.portal = null;

    // визуальное
    this.charge = 0; this.jaw = 0.2; this.time = 0; this.hitPulse = 0;
    this.attackNameT = 0; this.attackName = '';

    // ИИ
    this.attack = null; this.queue = []; this.lastKey = '';
    this.idleTimer = 1; this.idleAng = rand(0, TAU); this.idlePt = { x: 0, y: 0 };
    this.finalPending = false; this.finalDone = false;
    this.transT = 0; this.dyingT = 0; this.explodeIdx = 0; this.introT = 0; this.emerging = false;
    this.sprites = BossSprites.get();
  }

  /* копии фаз с учётом сложности: скорость, время предупреждений, размер залпов */
  static scalePhases(D) {
    const speedKeys = ['idleSpeed', 'dashSpeed', 'projSpeed', 'sweepSpeed', 'rainSpeed'];
    const turnKeys = ['idleTurn', 'beamTurn'];
    const timeKeys = ['dashWindup', 'dashLock', 'rainWarn', 'portalOpen', 'beamAim', 'idleTime'];
    return CFG.PHASES.map((src) => {
      const P = Object.assign({}, src);
      for (const k of speedKeys) P[k] = src[k] * D.speed;
      for (const k of turnKeys) P[k] = src[k] * (1 + (D.speed - 1) * 0.7);
      for (const k of timeKeys) P[k] = src[k] * D.time;
      P.projCount = Math.max(3, src.projCount + D.count);
      P.volleys = Math.max(2, src.volleys + (D.count > 1 ? 1 : (D.count < 0 ? -1 : 0)));
      P.rainWaves = Math.max(2, src.rainWaves + (D.count > 1 ? 1 : 0));
      return P;
    });
  }

  get phase() { return this.phases[this.phaseIdx]; }
  get pal() { return CFG.PALETTES[this.palIdx]; }
  get hpRatio() { return this.hp / this.maxHp; }
  targetable() { return this.state === 'fight' || this.state === 'transition' || this.state === 'intro'; }

  /* ---------- управление головой ---------- */
  steer(target, speed, turn, accel) {
    this.steerTarget = target; this.targetSpeed = speed; this.turnRate = turn; this.accel = accel || 900; this.pathFn = null;
  }
  lockHeading(speed, accel) {
    this.steerTarget = null; this.targetSpeed = speed; this.accel = accel || 900; this.pathFn = null;
  }
  followPath(fn) { this.pathFn = fn; this.pathT = 0; this.steerTarget = null; }
  teleport(x, y, ang) {
    for (const s of this.segments) { s.x = x; s.y = y; s.angle = ang; }
    this.angle = ang; this.pathFn = null;
  }

  /* ---------- общий интерфейс босса (используется Game) ---------- */
  begin() {
    const g = this.game, p = g.player;
    const portal = new Portal(p.x, p.y - 720, 210, this.pal.accent, this.pal.glow);
    g.portals.push(portal);
    this.startIntro(portal);
  }
  collide(player) { if (this.attack) this.attack.collide(player); }
  contactDamage(seg) { return CFG.BOSS.contact[seg.kind]; }

  /* ---------- интро: выход из портала ---------- */
  startIntro(portal) {
    this.portal = portal;
    this.teleport(portal.x, portal.y, Math.PI / 2);
    this.emergePortal = portal;
    this.state = 'intro'; this.introT = 0; this.emerging = false;
    this.invulnerable = true;
    this.lockHeading(0, 800);
    this.game.audio.bossSpawn();
    this.updateAlpha();
  }

  updateIntro(dt) {
    const g = this.game, p = g.player;
    this.introT += dt;
    this.charge = Math.min(1, this.introT / 2);
    g.camera.addTrauma(dt * 0.3 * (this.emerging ? 0.5 : 1));
    if (!this.emerging) {
      if (this.introT > 2.0) {
        this.emerging = true;
        this.speed = 300;
        this.steer(p, 700, 1.0, 600);
        g.effects.flash(0.4, this.pal.accent);
        g.effects.ring(this.portal.x, this.portal.y, 500, 0.9, this.pal.accent, 10);
        g.camera.addTrauma(0.6);
        g.particles.burst(this.portal.x, this.portal.y, 80, 100, 800, 0.9, 9, this.pal.glow);
      }
    } else {
      this.steer(p, 700, 1.0, 600);
      const out = dist(this.tail.x, this.tail.y, this.portal.x, this.portal.y) > this.portal.r * 0.9 + 60;
      if ((out && this.introT > 4) || this.introT > 9) {
        this.portal.close();
        this.emergePortal = null;
        this.state = 'fight'; this.invulnerable = false; this.idleTimer = 1.0;
      }
    }
  }

  /* ---------- главный update ---------- */
  update(dt) {
    this.time += dt;
    this.charge = Math.max(0, this.charge - dt * 2.5);
    this.hitPulse = Math.max(0, this.hitPulse - dt * 4);
    this.attackNameT = Math.max(0, this.attackNameT - dt);
    for (const s of this.segments) if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 5);

    switch (this.state) {
      case 'intro': this.updateIntro(dt); break;
      case 'fight': this.updateFight(dt); break;
      case 'transition': this.updateTransition(dt); break;
      case 'dying': this.updateDying(dt); break;
      default: break;
    }

    // движение (подшаги, чтобы цепь не растягивалась на больших скоростях)
    const n = Math.max(1, Math.ceil(dt * 60 * 0.99)), h = dt / n;
    for (let i = 0; i < n; i++) { this.stepHead(h); this.stepBody(h); }

    this.updateAlpha();
    this.emitTrail();
    const jt = 0.18 + this.charge * 0.55 + clamp(this.speed / 1800, 0, 1) * 0.3;
    this.jaw = damp(this.jaw, jt, 8, dt);
  }

  stepHead(h) {
    const hd = this.head, A = CFG.ARENA, M = CFG.BOSS_MARGIN;
    if (this.state === 'dying') {
      this.speed = approach(this.speed, 0, 600 * h);
    }
    if (this.pathFn) {
      this.pathT += h;
      const p = this.pathFn(this.pathT);
      const blend = this.pathT < 0.45;
      const k = blend ? 1 - Math.exp(-9 * h) : 1;
      const ox = hd.x, oy = hd.y;
      hd.x = lerp(hd.x, p.x, k); hd.y = lerp(hd.y, p.y, k);
      this.angle = blend ? approachAngle(this.angle, p.ang, 8 * h) : p.ang;
      this.speed = Math.hypot(hd.x - ox, hd.y - oy) / h;
      return;
    }
    if (this.steerTarget) {
      const t = this.steerTarget;
      this.angle = approachAngle(this.angle, Math.atan2(t.y - hd.y, t.x - hd.x), this.turnRate * h);
    }
    if (hd.x < -M || hd.x > A.w + M || hd.y < -M || hd.y > A.h + M) {
      this.angle = approachAngle(this.angle, Math.atan2(A.h / 2 - hd.y, A.w / 2 - hd.x), 3.2 * h);
    }
    this.speed = approach(this.speed, this.targetSpeed, this.accel * h);
    hd.x += Math.cos(this.angle) * this.speed * h;
    hd.y += Math.sin(this.angle) * this.speed * h;
    hd.x = clamp(hd.x, -M - 600, A.w + M + 600);
    hd.y = clamp(hd.y, -M - 600, A.h + M + 600);
  }

  stepBody(h) {
    const S = CFG.BOSS.spacing, segs = this.segments;
    segs[0].angle = this.angle;
    for (let i = 1; i < segs.length; i++) {
      const s = segs[i], p = segs[i - 1];
      const gap = i === 1 ? S + 8 : S;
      let dx = p.x - s.x, dy = p.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d > gap) {
        const k = (d - gap) / d;
        s.x += dx * k; s.y += dy * k;
        dx = p.x - s.x; dy = p.y - s.y;
      }
      if (d > 0.01) s.angle = approachAngle(s.angle, Math.atan2(dy, dx), 14 * h);
    }
  }

  updateAlpha() {
    const pr = this.emergePortal;
    for (const s of this.segments) {
      let a = this.alpha;
      if (pr) {
        const d = Math.hypot(s.x - pr.x, s.y - pr.y);
        a *= pr.r > 1 ? clamp((d - pr.r * 0.12) / (pr.r * 0.5), 0, 1) : (d < 160 ? 0 : 1);
      }
      s.a = a;
    }
  }

  emitTrail() {
    if (this.alpha < 0.5 || this.speed < 450 || this.state === 'dying') return;
    const g = this.game, pal = this.pal, hd = this.head;
    const sp = this.speed;
    g.particles.emit(hd.x - Math.cos(this.angle) * 40 + rand(-12, 12), hd.y - Math.sin(this.angle) * 40 + rand(-12, 12),
      -Math.cos(this.angle) * sp * 0.05, -Math.sin(this.angle) * sp * 0.05, 0.6, 14, pal.glow, { endSize: 0 });
    const s = this.segments[1 + ((Math.random() * (this.segments.length - 2)) | 0)];
    if (s.a > 0.5) g.particles.emit(s.x + rand(-10, 10), s.y + rand(-10, 10), rand(-30, 30), rand(-30, 30), 0.5, 10, pal.accent, { endSize: 0 });
  }

  /* ---------- ИИ боя ---------- */
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
    const P = this.phase, p = this.game.player;
    this.idleAng += dt * (0.8 + this.phaseIdx * 0.15);
    this.idlePt.x = p.x + Math.cos(this.idleAng) * P.idleRadius;
    this.idlePt.y = p.y + Math.sin(this.idleAng) * P.idleRadius;
    this.steer(this.idlePt, P.idleSpeed, P.idleTurn, 700);
  }

  pickAttack() {
    const P = this.phase;
    let key;
    if (this.finalPending && !this.finalDone) {
      key = 'final'; this.finalPending = false; this.queue.length = 0;
    } else if (this.queue.length) {
      key = this.queue.shift();
    } else if (P.combos.length && Math.random() < P.comboChance) {
      const c = pick(P.combos);
      this.queue = c.slice(1); key = c[0];
    } else {
      key = weightedPick(P.pool, this.lastKey, (k) => k !== 'final' || this.finalDone);
    }
    this.lastKey = key;
    this.attack = createAttack(key, this, this.game);
    this.attackName = this.attack.name;
    this.attackNameT = 2.0;
    this.attack.start();
  }

  endAttack() {
    if (this.attack) this.attack.cancel();
    this.attack = null;
    if (this.finalPending) this.queue.length = 0;
    this.idleTimer = this.queue.length ? 0.12 : this.phase.idleTime * rand(0.85, 1.15);
    this.alpha = 1;
  }

  cancelAttack() {
    if (this.attack) { this.attack.cancel(); this.attack = null; }
    this.queue.length = 0;
    this.pathFn = null;
    this.alpha = 1;
    this.emergePortal = null;
  }

  /* ---------- урон ---------- */
  /* возвращает: >0 — нанесённый урон, 0 — игнор, -1 — заблокировано (неуязвим) */
  takeDamage(amount, seg) {
    if (this.state === 'dying' || this.state === 'dead') return 0;
    if (this.invulnerable) return -1;
    const B = CFG.BOSS;
    const mult = seg.kind === 'head' ? B.headMult : (seg.kind === 'tail' ? B.tailMult : B.bodyMult);
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

  /* ---------- смена фазы ---------- */
  startTransition() {
    const g = this.game;
    this.cancelAttack();
    this.state = 'transition'; this.transT = 0;
    this.invulnerable = true;
    this.phaseIdx++;
    this.palSwapped = false;
    g.projectilesToParticles();
    g.audio.phase();
    g.audio.setAmbientPhase(this.phaseIdx);
    g.effects.flash(0.5, '#ffffff');
    g.camera.addTrauma(0.9);
    g.effects.ring(this.head.x, this.head.y, 900, 1.2, this.pal.glow, 14);
    g.player.heal(Math.round(CFG.PLAYER.phaseHeal * g.diff.heal));
    const ph = this.phase;
    g.ui.banner('PHASE ' + ph.roman, ph.name, CFG.PALETTES[this.phaseIdx].accent, 3.2);
  }

  updateTransition(dt) {
    const g = this.game, p = g.player;
    this.transT += dt;
    this.idleAng += dt * 0.9;
    this.idlePt.x = p.x + Math.cos(this.idleAng) * 900;
    this.idlePt.y = p.y + Math.sin(this.idleAng) * 900;
    this.steer(this.idlePt, 520, 2.2, 800);
    this.charge = 1;
    if (!this.palSwapped && this.transT >= 1.0) {
      this.palSwapped = true;
      this.palIdx = this.phaseIdx;
      g.effects.flash(1.0, '#ffffff');
      g.camera.addTrauma(1);
      g.audio.explosion(1);
      for (let i = 0; i < this.segments.length; i += 2) {
        const s = this.segments[i];
        g.particles.burst(s.x, s.y, 10, 100, 500, 0.9, 9, this.pal.glow);
      }
      g.effects.ring(this.head.x, this.head.y, 1400, 1.4, this.pal.light, 18);
    }
    if (this.transT >= CFG.BOSS.transitionTime) {
      this.state = 'fight'; this.invulnerable = false; this.idleTimer = 1.0;
    }
  }

  /* ---------- смерть ---------- */
  die() {
    const g = this.game;
    this.cancelAttack();
    this.state = 'dying'; this.dyingT = 0; this.explodeIdx = 0;
    this.invulnerable = true;
    this.lockHeading(0, 500);
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
    const N = this.segments.length;
    while (this.explodeIdx < N && this.dyingT >= this.explodeIdx * 0.075) {
      this.explodeSeg(this.segments[this.explodeIdx]);
      this.explodeIdx++;
    }
    if (this.explodeIdx >= 20) g.timeScale = damp(g.timeScale, 1, 2, dt);
    for (const s of this.segments) if (!s.dead) { s.x += rand(-2, 2); s.y += rand(-2, 2); }
    if (this.explodeIdx >= N && this.dyingT > N * 0.075 + 1.0) {
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
    const g = this.game, pal = this.pal, big = s.kind === 'head';
    g.particles.burst(s.x, s.y, big ? 140 : 50, 100, big ? 900 : 600, 1.1, big ? 12 : 9, pal.glow);
    g.particles.burst(s.x, s.y, big ? 70 : 24, 60, 400, 0.8, 7, '#ffffff');
    g.effects.ring(s.x, s.y, big ? 600 : 260, 0.7, pal.light, big ? 14 : 8);
    g.camera.addTrauma(big ? 0.7 : 0.2);
    g.audio.explosion(big ? 1 : 0.4);
  }

  /* ---------- отрисовка ---------- */
  render(ctx) {
    if (this.state === 'dead') return;
    const set = this.sprites[this.palIdx], pal = this.pal, time = this.time;
    const segs = this.segments, N = segs.length;
    const S = 3;

    // свечение сегментов (динамическое освещение)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = N - 1; i >= 0; i--) {
      const s = segs[i];
      if (s.dead || s.a < 0.02) continue;
      const pulse = 0.5 + 0.5 * Math.sin(time * 4 - i * 0.5);
      Glow.draw(ctx, pal.glow, s.x, s.y, s.r * 2.6, 0.2 * s.a * (0.6 + 0.4 * pulse) + 0.1 * this.charge * s.a);
    }
    ctx.restore();

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let i = N - 1; i >= 0; i--) {
      const s = segs[i];
      if (s.dead || s.a < 0.02) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = s.a;
      if (s.kind === 'body') {
        const w = 30 * S * s.scale, h = 26 * S * s.scale;
        ctx.drawImage(set.body, -w / 2, -h / 2, w, h);
        if (s.flash > 0) { ctx.globalAlpha = s.flash * 0.85 * s.a; ctx.drawImage(set.bodyF, -w / 2, -h / 2, w, h); }
      } else if (s.kind === 'tail') {
        const w = 28 * S, h = 20 * S;
        ctx.drawImage(set.tail, -w + 14, -h / 2, w, h);
        if (s.flash > 0) { ctx.globalAlpha = s.flash * 0.85 * s.a; ctx.drawImage(set.tailF, -w + 14, -h / 2, w, h); }
      } else {
        this.renderHead(ctx, set, S, s);
      }
      ctx.restore();
    }
    ctx.restore();

    // яркие ядра и глаза (аддитивно)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < N - 1; i += 2) {
      const s = segs[i];
      if (s.dead || s.a < 0.3) continue;
      const pulse = 0.5 + 0.5 * Math.sin(time * 5 - i * 0.55);
      Glow.draw(ctx, pal.eye, s.x, s.y, 14 + pulse * 6, 0.35 * s.a * pulse);
    }
    const hd = this.head;
    if (!hd.dead && hd.a > 0.1) {
      const ca = Math.cos(hd.angle), sa = Math.sin(hd.angle);
      const eyeR = 20 + this.charge * 14 + this.hitPulse * 6;
      for (let side = -1; side <= 1; side += 2) {
        const lx = (28 - 19.5) * S, ly = (side * 7) * S;
        const ex = hd.x + ca * lx - sa * ly, ey = hd.y + sa * lx + ca * ly;
        Glow.draw(ctx, pal.eye, ex, ey, eyeR, 0.95 * hd.a);
      }
      Glow.draw(ctx, pal.glow, hd.x, hd.y, 110 + this.charge * 90, (0.25 + 0.4 * this.charge) * hd.a);
    }
    ctx.restore();
  }

  renderHead(ctx, set, S, s) {
    const jawAng = this.jaw * 0.55;
    const cxp = 19.5, cyp = 18.5;
    // жвалы (под черепом)
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.translate((34 - cxp) * S, side * 7 * S);
      ctx.rotate(side * jawAng);
      if (side < 0) ctx.scale(1, -1);
      ctx.drawImage(set.jaw, 0, -5 * S, 20 * S * 0.9, 10 * S * 0.9);
      if (s.flash > 0) { ctx.globalAlpha = s.flash * 0.85 * s.a; ctx.drawImage(set.jawF, 0, -5 * S, 20 * S * 0.9, 10 * S * 0.9); ctx.globalAlpha = s.a; }
      ctx.restore();
    }
    ctx.drawImage(set.head, -cxp * S, -cyp * S, 48 * S, 38 * S);
    if (s.flash > 0) {
      ctx.globalAlpha = s.flash * 0.85 * s.a;
      ctx.drawImage(set.headF, -cxp * S, -cyp * S, 48 * S, 38 * S);
    }
  }
}
