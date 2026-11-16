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

/* ---------- Devourer of Gods Mecha: векторные спрайты брони (кэшируются на offscreen canvas) ---------- */
const MechArt = {
  poly(g, pts) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); },
  mir(top) { return top.concat(top.slice().reverse().map(p => [p[0], -p[1]])); },
  canvas(w, h, ox, oy) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.translate(ox, oy); g.lineJoin = 'round';
    return { c, g };
  },
  /* броневая пластина: вертикальный градиент сталь→графит, тёмный контур */
  plate(g, pts, pal, edge, y0, y1, lw) {
    this.poly(g, pts);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, pal.light); gr.addColorStop(0.35, pal.mid); gr.addColorStop(1, pal.base);
    g.fillStyle = gr; g.fill();
    g.strokeStyle = edge; g.lineWidth = lw || 2; g.stroke();
  },
  neon(g, pts, color, w, a) {
    g.save(); g.globalAlpha = a == null ? 0.9 : a;
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    g.restore();
  },
  hex(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; i ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.closePath();
  },
  rivets(g, list, col) { g.fillStyle = col; for (const p of list) { g.beginPath(); g.arc(p[0], p[1], 1.4, 0, 6.283); g.fill(); } },

  /* сегмент тела 96x104, центр (48,52), «нос» смотрит в +x */
  body(pal, edge) {
    const { c, g } = this.canvas(96, 104, 48, 52);
    for (const sd of [-1, 1]) {
      g.save(); g.scale(1, sd);
      // откинутый назад клинок-шип
      this.plate(g, [[18, -27], [-22, -50], [-8, -26]], pal, edge, -50, -26, 1.8);
      this.neon(g, [[14, -30], [-17, -47]], pal.glow, 1.6, 0.8);
      // блок сопла
      g.fillStyle = edge; g.fillRect(-40, -27, 12, 11);
      g.fillStyle = pal.mid; g.fillRect(-39, -26, 4, 9);
      g.restore();
    }
    const top = [[-32, -17], [-20, -28], [24, -28], [36, -15], [36, 0]];
    this.plate(g, this.mir(top), pal, edge, -29, 29, 2.2);
    // внутренняя вставка
    const inner = [[-24, -12], [-15, -20], [18, -20], [27, -11], [27, 0]];
    this.poly(g, this.mir(inner)); g.fillStyle = rgbStr(mixRgb(pal.base, '#000000', 0.35)); g.fill();
    g.strokeStyle = edge; g.lineWidth = 1.4; g.stroke();
    // швы
    g.strokeStyle = edge; g.lineWidth = 1.2;
    for (const x of [-9, 14]) { g.beginPath(); g.moveTo(x, -20); g.lineTo(x, -9); g.moveTo(x, 20); g.lineTo(x, 9); g.stroke(); }
    // неоновые линии энергии
    this.neon(g, [[-28, -14], [20, -14], [30, -7]], pal.glow, 2, 0.85);
    this.neon(g, [[-28, 14], [20, 14], [30, 7]], pal.glow, 2, 0.85);
    // гнездо ядра
    this.hex(g, 3, 0, 12); g.fillStyle = '#04090d'; g.fill(); g.strokeStyle = pal.glow; g.lineWidth = 1.6; g.globalAlpha = 0.8; g.stroke(); g.globalAlpha = 1;
    this.hex(g, 3, 0, 7); g.fillStyle = rgbStr(mixRgb(pal.glow, '#000000', 0.55)); g.fill();
    this.rivets(g, [[-28, -23], [-28, 23], [30, -20], [30, 20], [-3, -24], [-3, 24]], edge);
    return c;
  },

  /* голова 150x130, центр (62,65), «нос» в +x */
  head(pal, edge) {
    const { c, g } = this.canvas(150, 130, 62, 65);
    // блок маршевых двигателей сзади
    g.fillStyle = edge; g.fillRect(-60, -24, 16, 48);
    g.fillStyle = pal.mid; g.fillRect(-58, -22, 5, 44);
    g.fillStyle = '#04090d';
    for (const y of [-12, 12]) { g.beginPath(); g.arc(-58, y, 6, 0, 6.283); g.fill(); }
    // рога-антенны (откинуты назад)
    for (const sd of [-1, 1]) {
      g.save(); g.scale(1, sd);
      this.plate(g, [[-2, -38], [-58, -60], [-42, -30]], pal, edge, -60, -30, 2);
      this.plate(g, [[26, -32], [-4, -54], [4, -34]], pal, edge, -54, -32, 2);
      this.neon(g, [[-6, -40], [-50, -56]], pal.glow, 1.8, 0.85);
      g.restore();
    }
    // череп-клин
    const top = [[-52, -24], [-38, -40], [0, -44], [34, -32], [62, -14], [76, -5], [76, 0]];
    this.plate(g, this.mir(top), pal, edge, -44, 44, 2.6);
    // центральный гребень
    this.poly(g, [[-34, -6], [10, -9], [42, -4], [42, 4], [10, 9], [-34, 6]]);
    g.fillStyle = rgbStr(mixRgb(pal.base, '#000000', 0.5)); g.fill(); g.strokeStyle = edge; g.lineWidth = 1.4; g.stroke();
    // боковые неоновые линии
    this.neon(g, [[-46, -15], [-10, -31], [22, -27], [44, -19]], pal.glow, 2.2, 0.9);
    this.neon(g, [[-46, 15], [-10, 31], [22, 27], [44, 19]], pal.glow, 2.2, 0.9);
    // визор с сенсорами
    this.poly(g, this.mir([[24, -13], [58, -8], [68, -3], [68, 0]]));
    g.fillStyle = '#02060a'; g.fill(); g.strokeStyle = pal.glow; g.lineWidth = 1.4; g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
    g.fillStyle = rgbStr(mixRgb(pal.eye, '#000000', 0.5));
    for (const p of [[40, -7, 4.6], [40, 7, 4.6], [58, 0, 3.6]]) { g.beginPath(); g.arc(p[0], p[1], p[2], 0, 6.283); g.fill(); }
    // гнездо главного ядра
    this.hex(g, -16, 0, 15); g.fillStyle = '#04090d'; g.fill(); g.strokeStyle = pal.glow; g.lineWidth = 1.8; g.stroke();
    this.hex(g, -16, 0, 9); g.fillStyle = rgbStr(mixRgb(pal.glow, '#000000', 0.55)); g.fill();
    this.rivets(g, [[-44, -30], [-44, 30], [4, -38], [4, 38], [30, -27], [30, 27]], edge);
    return c;
  },

  /* жвало-клешня 100x44, шарнир в (6,22), изгиб к оси в -y */
  jaw(pal, edge) {
    const { c, g } = this.canvas(100, 44, 6, 22);
    this.plate(g, [[0, -9], [30, -11], [64, -17], [92, -19], [70, -6], [46, 2], [24, 9], [0, 9]], pal, edge, -19, 9, 2);
    this.neon(g, [[6, -3], [40, -7], [80, -15]], pal.glow, 1.6, 0.8);
    g.fillStyle = edge; for (const x of [40, 54, 68]) { g.beginPath(); g.moveTo(x, -4); g.lineTo(x + 5, 3); g.lineTo(x - 4, 3); g.fill(); }
    g.beginPath(); g.arc(0, 0, 6, 0, 6.283); g.fillStyle = '#04090d'; g.fill(); g.strokeStyle = pal.glow; g.lineWidth = 1.2; g.stroke();
    return c;
  },

  /* хвост-клинок 112x60, центр сегмента (84,30), остриё в -x */
  tail(pal, edge) {
    const { c, g } = this.canvas(112, 60, 84, 30);
    for (const sd of [-1, 1]) {
      g.save(); g.scale(1, sd);
      this.plate(g, [[-2, -14], [-36, -29], [-30, -11]], pal, edge, -29, -11, 1.8);
      g.fillStyle = edge; g.fillRect(-12, -20, 12, 8);
      g.restore();
    }
    const top = [[24, -13], [0, -17], [-30, -12], [-60, -5], [-82, 0]];
    this.plate(g, this.mir(top), pal, edge, -17, 17, 2.2);
    this.neon(g, [[10, 0], [-70, 0]], pal.glow, 2.4, 0.95);
    this.neon(g, [[-4, -9], [-40, -6]], pal.glow, 1.4, 0.7);
    this.neon(g, [[-4, 9], [-40, 6]], pal.glow, 1.4, 0.7);
    return c;
  }
};

const BossSprites = {
  sets: null,
  get() {
    if (this.sets) return this.sets;
    this.sets = CFG.PALETTES.map(pal => this.build(pal));
    return this.sets;
  },
  build(pal) {
    const edge = rgbStr(mixRgb(pal.base, '#000000', 0.6));
    const body = MechArt.body(pal, edge), head = MechArt.head(pal, edge), jaw = MechArt.jaw(pal, edge), tail = MechArt.tail(pal, edge);
    return { body, head, jaw, tail, bodyF: makeFlash(body), headF: makeFlash(head), jawF: makeFlash(jaw), tailF: makeFlash(tail), edge };
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
    // меха-визуал
    this.debris = []; this.prevSpeed = 0; this.accelK = 0; this.heat = 0; this.spinePhase = 0; this.tint = null; this.tintKey = -1;
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
    this.updateMech(dt);
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
    this.game.particles.burst(seg.x + rand(-8, 8), seg.y + rand(-8, 8), 4, 120, 480, 0.35, 3.5, '#ffd58a');   // искры от брони

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
    g.onBossKilled();
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
    g.particles.burst(s.x, s.y, big ? 40 : 14, 200, 900, 0.7, 3.5, '#ffb060');   // искры металла
    this.spawnDebris(s, big ? 14 : 4);
    g.effects.ring(s.x, s.y, big ? 600 : 260, 0.7, pal.light, big ? 14 : 8);
    g.camera.addTrauma(big ? 0.7 : 0.2);
    g.audio.explosion(big ? 1 : 0.4);
  }

  /* ---------- меха-анимации: ускорение, нагрев, искры, обломки ---------- */
  updateMech(dt) {
    const g = this.game;
    const acc = (this.speed - this.prevSpeed) / Math.max(dt, 1e-3);
    this.prevSpeed = this.speed;
    this.accelK = damp(this.accelK, clamp(acc / 2500, -1, 1), 9, dt);
    this.heat = 1 - clamp(this.hpRatio, 0, 1);
    this.spinePhase += dt * (0.35 + clamp(this.speed / 1500, 0, 1) * 1.1 + this.charge * 0.8);
    const hq = Math.round(this.heat * 20) + this.palIdx * 100;
    if (hq !== this.tintKey) { this.tintKey = hq; this.tint = rgbStr(mixRgb(this.pal.glow, '#ff3d52', this.heat * 0.5)); }
    // повреждённая броня искрит
    if ((this.state === 'fight' || this.state === 'transition') && this.heat > 0.3 && this.alpha > 0.5) {
      if (Math.random() < (this.heat - 0.3) * 16 * dt) {
        const s = this.segments[(Math.random() * this.segments.length) | 0];
        if (!s.dead && s.a > 0.5) g.particles.burst(s.x + rand(-14, 14), s.y + rand(-14, 14), 3, 60, 260, 0.5, 4, '#ffb060');
      }
    }
    // обломки брони
    const D = this.debris;
    for (let i = D.length - 1; i >= 0; i--) {
      const d = D[i];
      d.life -= dt;
      if (d.life <= 0) { D[i] = D[D.length - 1]; D.pop(); continue; }
      d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 1 - 0.8 * dt; d.vy *= 1 - 0.8 * dt; d.rot += d.vr * dt;
      if (Math.random() < 6 * dt) g.particles.emit(d.x, d.y, rand(-30, 30), rand(-30, 30), 0.4, 6, '#ff9a3d', { endSize: 0 });
    }
  }

  spawnDebris(s, n) {
    for (let i = 0; i < n && this.debris.length < 140; i++) {
      const a = rand(0, TAU), v = rand(120, 620);
      this.debris.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, TAU), vr: rand(-9, 9),
        life: rand(0.9, 1.9), max: 1.9, size: rand(8, 20) * (s.kind === 'head' ? 1.5 : 1), pal: this.palIdx, tri: Math.random() < 0.6 });
    }
  }

  /* ---------- отрисовка меха ---------- */
  render(ctx) {
    const alive = this.state !== 'dead';
    if (!alive && !this.debris.length) return;
    const set = this.sprites[this.palIdx], pal = this.pal, time = this.time, tint = this.tint || pal.glow;
    const segs = this.segments, N = segs.length;
    const heat = this.heat, charge = this.charge;
    const over = this.state === 'dying' ? 1 : 0;
    // интенсивность свечения: растёт с уроном и зарядом атаки; при смерти мерцает
    let lit = 0.55 + 0.3 * heat + 0.4 * charge;
    if (over) lit = 0.9 + 0.6 * Math.sin(time * 40) * Math.sin(time * 23);
    else if (heat > 0.6 && Math.sin(time * 31 + Math.sin(time * 7) * 4) > 0.93) lit *= 0.35;   // нестабильное ядро
    const speedK = clamp(this.speed / 1800, 0, 1);

    if (alive) {
      // 1) мягкая подсветка вокруг сегментов
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = N - 1; i >= 0; i--) {
        const s = segs[i];
        if (s.dead || s.a < 0.02) continue;
        const pulse = 0.5 + 0.5 * Math.sin(time * 4 - i * 0.5);
        Glow.draw(ctx, tint, s.x, s.y, s.r * 2.4, (0.12 + 0.1 * pulse) * lit * s.a);
      }
      ctx.restore();

      // 2) шарниры и кабели между сегментами (под бронёй)
      ctx.save();
      ctx.lineCap = 'butt';
      for (let i = 0; i < N - 1; i++) {
        const a = segs[i], b = segs[i + 1];
        if (a.dead || b.dead || a.a < 0.05) continue;
        const ang = Math.atan2(a.y - b.y, a.x - b.x), nx = -Math.sin(ang), ny = Math.cos(ang);
        ctx.globalAlpha = a.a;
        ctx.strokeStyle = set.edge; ctx.lineWidth = 15 * b.scale;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.strokeStyle = pal.mid; ctx.lineWidth = 2.2;
        for (const o of [-6, 6]) { ctx.beginPath(); ctx.moveTo(a.x + nx * o, a.y + ny * o); ctx.lineTo(b.x + nx * o, b.y + ny * o); ctx.stroke(); }
      }
      ctx.restore();

      // 3) броня: хвост → голова
      ctx.save();
      for (let i = N - 1; i >= 0; i--) {
        const s = segs[i];
        if (s.dead || s.a < 0.02) continue;
        const prev = segs[Math.max(0, i - 1)];
        let bend = s.angle - prev.angle; bend = Math.atan2(Math.sin(bend), Math.cos(bend));   // изгиб относительно переднего сегмента
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle + (s.kind === 'body' ? bend * 0.25 : 0));
        ctx.globalAlpha = s.a;
        if (s.kind === 'body') {
          const k = s.scale, st = 1 + this.accelK * 0.05;
          ctx.scale(k * st, k);
          ctx.drawImage(set.body, -48, -52);
          if (s.flash > 0) { ctx.globalAlpha = s.flash * 0.85 * s.a; ctx.drawImage(set.bodyF, -48, -52); }
          // яркость неоновых линий
          ctx.globalAlpha = s.a * clamp(lit - 0.45, 0, 1) * 0.7;
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = tint; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-28, -14); ctx.lineTo(20, -14); ctx.moveTo(-28, 14); ctx.lineTo(20, 14); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        } else if (s.kind === 'tail') {
          ctx.drawImage(set.tail, -84, -30);
          if (s.flash > 0) { ctx.globalAlpha = s.flash * 0.85 * s.a; ctx.drawImage(set.tailF, -84, -30); }
        } else {
          this.renderHead(ctx, set, s);
        }
        ctx.restore();
      }
      ctx.restore();

      // 4) двигатели, энергетический хребет, ядра, сенсоры (аддитивно)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flameBase = 5 + speedK * 24 + Math.max(0, this.accelK) * 18 + charge * 10;
      for (let i = 0; i < N; i++) {
        const s = segs[i];
        if (s.dead || s.a < 0.2) continue;
        if (s.kind === 'body') {
          const prev = segs[i - 1];
          let bend = s.angle - prev.angle; bend = Math.atan2(Math.sin(bend), Math.cos(bend));
          const ca = Math.cos(s.angle), sa = Math.sin(s.angle), k = s.scale;
          const pulse = 0.5 + 0.5 * Math.sin(time * 5 - i * 0.55);
          // ядро
          const cx = s.x + ca * 3 * k, cy = s.y + sa * 3 * k;
          Glow.draw(ctx, pal.eye, cx, cy, (13 + pulse * 6 + charge * 8) * k, (0.4 + 0.35 * pulse) * lit * s.a);
          if (i % 2 === 0) {
            // сопла по бокам: наружная сторона поворота разгорается сильнее
            for (const side of [-1, 1]) {
              const f = flameBase * k * (1 + Math.max(0, bend * side * 3.2)) * (0.8 + 0.2 * Math.sin(time * 40 + i * 3 + side));
              const nx = s.x + ca * -36 * k - sa * side * 21 * k, ny = s.y + sa * -36 * k + ca * side * 21 * k;
              ctx.fillStyle = tint; ctx.globalAlpha = 0.35 * s.a;
              ctx.beginPath(); ctx.moveTo(nx + sa * side * 5 * k, ny - ca * side * 5 * k); ctx.lineTo(nx - sa * side * 5 * k, ny + ca * side * 5 * k);
              ctx.lineTo(nx - ca * f * 1.6, ny - sa * f * 1.6); ctx.closePath(); ctx.fill();
              ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5 * s.a;
              ctx.beginPath(); ctx.moveTo(nx + sa * side * 2 * k, ny - ca * side * 2 * k); ctx.lineTo(nx - sa * side * 2 * k, ny + ca * side * 2 * k);
              ctx.lineTo(nx - ca * f * 0.8, ny - sa * f * 0.8); ctx.closePath(); ctx.fill();
            }
          }
        } else if (s.kind === 'tail') {
          const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
          for (const side of [-1, 1]) {
            const f = (flameBase * 1.5 + 8) * (0.8 + 0.2 * Math.sin(time * 40 + side));
            const nx = s.x - ca * 12 - sa * side * 14, ny = s.y - sa * 12 + ca * side * 14;
            ctx.fillStyle = tint; ctx.globalAlpha = 0.4 * s.a;
            ctx.beginPath(); ctx.moveTo(nx + sa * 5, ny - ca * 5); ctx.lineTo(nx - sa * 5, ny + ca * 5); ctx.lineTo(nx - ca * f * 1.8, ny - sa * f * 1.8); ctx.closePath(); ctx.fill();
          }
          Glow.draw(ctx, tint, s.x - ca * 40, s.y - sa * 40, 26, 0.5 * lit * s.a);
        }
      }
      ctx.globalAlpha = 1;
      // энергетические импульсы, бегущие по хребту (хвост → голова)
      const pulses = 7;
      for (let k = 0; k < pulses; k++) {
        const u = (this.spinePhase * 0.9 + k / pulses) % 1;       // 0 = голова, 1 = хвост
        const f = (1 - u) * (N - 1), i0 = Math.min(N - 2, Math.floor(f)), t = f - i0;
        const a = segs[i0], b = segs[i0 + 1];
        if (a.dead || b.dead || a.a < 0.3) continue;
        Glow.draw(ctx, '#ffffff', lerp(a.x, b.x, t), lerp(a.y, b.y, t), 11 + charge * 8, 0.55 * lit * a.a);
      }
      // голова: сенсоры, ядро, двигатели, схождение энергии при подготовке атаки
      const hd = this.head;
      if (!hd.dead && hd.a > 0.1) {
        const ca = Math.cos(hd.angle), sa = Math.sin(hd.angle);
        const P = (lx, ly) => [hd.x + ca * lx - sa * ly, hd.y + sa * lx + ca * ly];
        const eyeR = 14 + charge * 12 + this.hitPulse * 6;
        for (const [lx, ly, r] of [[40, -7, 1], [40, 7, 1], [58, 0, 0.8]]) {
          const [ex, ey] = P(lx, ly);
          Glow.draw(ctx, pal.eye, ex, ey, eyeR * r, (0.7 + 0.3 * Math.sin(time * 9 + ly)) * hd.a);
        }
        const [cx, cy] = P(-16, 0);
        Glow.draw(ctx, tint, cx, cy, (34 + charge * 40) , (0.55 + 0.45 * Math.sin(time * 6)) * lit * hd.a);
        Glow.draw(ctx, '#ffffff', cx, cy, 12 + charge * 14, 0.5 * lit * hd.a);
        Glow.draw(ctx, tint, hd.x, hd.y, 90 + charge * 90, (0.14 + 0.34 * charge) * hd.a);
        const fh = (flameBase * 1.8 + 10) * (0.85 + 0.15 * Math.sin(time * 37));
        for (const ly of [-12, 12]) {
          const [nx, ny] = P(-58, ly);
          ctx.fillStyle = tint; ctx.globalAlpha = 0.4 * hd.a;
          ctx.beginPath(); ctx.moveTo(nx + sa * 6, ny - ca * 6); ctx.lineTo(nx - sa * 6, ny + ca * 6); ctx.lineTo(nx - ca * fh * 1.8, ny - sa * fh * 1.8); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5 * hd.a;
          ctx.beginPath(); ctx.moveTo(nx + sa * 2.5, ny - ca * 2.5); ctx.lineTo(nx - sa * 2.5, ny + ca * 2.5); ctx.lineTo(nx - ca * fh * 0.9, ny - sa * fh * 0.9); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // подготовка к мощной атаке: энергия стягивается к пасти
        if (charge > 0.25) {
          const [mx, my] = P(70, 0);
          for (let k = 0; k < 9; k++) {
            const u = (time * 1.6 + k / 9) % 1, a = k * 0.7 + time * 2.5, r = (1 - u) * (60 + 140 * charge);
            Glow.draw(ctx, k % 2 ? pal.eye : tint, mx + Math.cos(a) * r, my + Math.sin(a) * r, 7 + 5 * u, 0.7 * charge * u * hd.a);
          }
          Glow.draw(ctx, '#ffffff', mx, my, 12 + charge * 26, 0.35 * charge * hd.a);
        }
      }
      // электрические разряды между сегментами при уничтожении
      if (over) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
        for (let k = 0; k < 6; k++) {
          const i = (Math.random() * (N - 1)) | 0, a = segs[i], b = segs[i + 1];
          if (a.dead || b.dead) continue;
          ctx.beginPath(); ctx.moveTo(a.x + rand(-20, 20), a.y + rand(-20, 20)); ctx.lineTo((a.x + b.x) / 2 + rand(-30, 30), (a.y + b.y) / 2 + rand(-30, 30)); ctx.lineTo(b.x + rand(-20, 20), b.y + rand(-20, 20)); ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 5) обломки брони
    if (this.debris.length) {
      ctx.save();
      for (const d of this.debris) {
        const set2 = this.sprites[d.pal], k = clamp(d.life / 0.5, 0, 1);
        ctx.save();
        ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.globalAlpha = k;
        ctx.fillStyle = CFG.PALETTES[d.pal].mid; ctx.strokeStyle = CFG.PALETTES[d.pal].glow; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (d.tri) { ctx.moveTo(d.size, 0); ctx.lineTo(-d.size * 0.7, d.size * 0.6); ctx.lineTo(-d.size * 0.4, -d.size * 0.7); }
        else { ctx.rect(-d.size * 0.6, -d.size * 0.35, d.size * 1.2, d.size * 0.7); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  renderHead(ctx, set, s) {
    const jawAng = this.jaw * 0.55;
    // клешни-мандибулы (под черепом)
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.translate(40, side * 24);
      ctx.rotate(side * jawAng);
      if (side < 0) ctx.scale(1, -1);
      ctx.scale(0.82, 0.82);
      ctx.drawImage(set.jaw, -6, -22);
      if (s.flash > 0) { ctx.globalAlpha = s.flash * 0.85 * s.a; ctx.drawImage(set.jawF, -6, -22); ctx.globalAlpha = s.a; }
      ctx.restore();
    }
    ctx.drawImage(set.head, -62, -65);
    if (s.flash > 0) {
      ctx.globalAlpha = s.flash * 0.85 * s.a;
      ctx.drawImage(set.headF, -62, -65);
    }
  }
}
