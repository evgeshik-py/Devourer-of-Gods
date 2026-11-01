'use strict';

/* ============================================================
   player.js — ввод и управляемый персонаж
   ============================================================ */

class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = Object.create(null);
    this.pressed = Object.create(null);
    this.mouse = { x: 0, y: 0, left: false, right: false, rightPressed: false };
    const block = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

    window.addEventListener('keydown', (e) => {
      if (block.indexOf(e.code) >= 0) e.preventDefault();
      if (!e.repeat) this.pressed[e.code] = true;
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => this.releaseAll());
    canvas.addEventListener('mousemove', (e) => this.setMouse(e));
    canvas.addEventListener('mousedown', (e) => {
      this.setMouse(e);
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setMouse(e) {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.mouse.x = (e.clientX - r.left) * (this.canvas.width / r.width);
    this.mouse.y = (e.clientY - r.top) * (this.canvas.height / r.height);
  }

  releaseAll() {
    for (const k in this.keys) this.keys[k] = false;
    this.mouse.left = false; this.mouse.right = false;
  }

  down(...codes) { for (const c of codes) if (this.keys[c]) return true; return false; }
  consume(code) { const v = !!this.pressed[code]; this.pressed[code] = false; return v; }
  consumeRight() { const v = this.mouse.rightPressed; this.mouse.rightPressed = false; return v; }
  clearPressed() { for (const k in this.pressed) this.pressed[k] = false; this.mouse.rightPressed = false; }
}

/* ---------- пиксельный спрайт пилота ---------- */
const PlayerSprite = {
  canvas: null,
  rows: [
    '.....dddddd.....',
    '....dHHHHHHd....',
    '...dHHHHHHHHd...',
    '...dHvvvvvvHd...',
    '...dHvggggvHd...',
    '...dHvvvvvvHd...',
    '....dHHHHHHd....',
    '.....dddddd.....',
    '....aAAAAAAa....',
    '...aAAggggAAa...',
    '..saAAAggAAAas..',
    '..saAAAAAAAAas..',
    '..ssAAAAAAAAss..',
    '....aaddddaa....',
    '....aAA..AAa....',
    '....aAA..AAa....',
    '....aaa..aaa....',
    '...dddd..dddd...',
    '...dddd..dddd...'
  ],
  pal: { d: '#1a1f45', H: '#4a5fd6', v: '#12234f', g: '#8ffcff', a: '#2f3f8f', A: '#5a78e6', s: '#e8b890' },
  get() {
    if (this.canvas) return this.canvas;
    const c = document.createElement('canvas');
    c.width = 16; c.height = this.rows.length;
    const g = c.getContext('2d');
    for (let y = 0; y < this.rows.length; y++) {
      const row = this.rows[y];
      for (let x = 0; x < row.length; x++) {
        const col = this.pal[row[x]];
        if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
      }
    }
    this.canvas = c;
    return c;
  }
};

class Bullet {
  constructor(x, y, vx, vy, wp) {
    this.x = x; this.y = y; this.px = x; this.py = y;
    this.vx = vx; this.vy = vy;
    this.wp = wp;
    this.dmg = wp.dmg; this.life = wp.life; this.r = wp.r;
    this.pierce = wp.pierce; this.falloff = wp.falloff;
    this.homing = wp.homing; this.age = 0; this.retarget = 0; this.target = null;
    this.hitSet = wp.pierce > 1 ? new Set() : null;
    this.alive = true;
  }
  update(dt, game) {
    this.px = this.x; this.py = this.y;
    this.age += dt;
    if (this.homing > 0 && this.age > 0.12) this.steer(dt, game);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    const A = CFG.ARENA, m = 900;
    if (this.life <= 0 || this.x < -m || this.x > A.w + m || this.y < -m || this.y > A.h + m) this.alive = false;
  }
  /* самонаведение: ближайший видимый сегмент босса */
  steer(dt, game) {
    this.retarget -= dt;
    if (this.retarget <= 0 || !this.target || this.target.dead) {
      this.retarget = 0.08;
      this.target = game.nearestSegment(this.x, this.y);
    }
    const t = this.target;
    if (!t) return;
    const sp = Math.hypot(this.vx, this.vy);
    const cur = Math.atan2(this.vy, this.vx);
    const a = approachAngle(cur, Math.atan2(t.y - this.y, t.x - this.x), this.homing * dt);
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
  }
  render(ctx) {
    const W = this.wp, a = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    Glow.draw(ctx, W.color, 0, 0, 16 + W.len * 0.45, 0.8);
    ctx.fillStyle = W.color;
    ctx.fillRect(-W.len * 0.65, -W.w * 0.5, W.len, W.w);
    ctx.fillStyle = W.core;
    ctx.fillRect(-W.len * 0.2, -W.w * 0.25, W.len * 0.55, W.w * 0.5);
    ctx.restore();
  }
}

class Player {
  constructor(game) {
    this.game = game;
    this.radius = CFG.PLAYER.radius;
    this.maxHp = CFG.PLAYER.hp;
    this.weaponIdx = 0; this.weapon = CFG.WEAPONS[0]; this.altSide = 1;
    this.reset();
  }

  setWeapon(idx, silent) {
    idx = clamp(idx | 0, 0, CFG.WEAPONS.length - 1);
    if (idx === this.weaponIdx && this.weapon === CFG.WEAPONS[idx] && !silent) return;
    this.weaponIdx = idx; this.weapon = CFG.WEAPONS[idx];
    this.fireTimer = Math.max(this.fireTimer || 0, 0.12);
    if (!silent) {
      this.game.audio.swap();
      this.game.effects.text(this.x, this.y - 44, this.weapon.name, this.weapon.color, 18);
      this.game.particles.burst(this.x, this.y, 10, 40, 180, 0.4, 5, this.weapon.color);
    }
  }

  reset() {
    const A = CFG.ARENA;
    this.x = A.w / 2; this.y = A.h * 0.72;
    this.vx = 0; this.vy = 0;
    this.hp = this.maxHp;
    this.iframes = 0;
    this.fireTimer = 0;
    this.charge = 50;           // 0..100 — готовность Nova
    this.readyNotified = false;
    this.face = 1;
    this.aim = -Math.PI / 2;
    this.dead = false;
    this.hurtFlash = 0;
    this.nova = null;
    this.boosting = false;
    this.trailT = 0;
  }

  canBeHurt() { return !this.dead && this.iframes <= 0; }

  heal(n) {
    if (this.dead) return;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    if (this.hp > before) {
      this.game.effects.text(this.x, this.y - 40, '+' + Math.round(this.hp - before), '#6dffb0', 22);
      this.game.particles.burst(this.x, this.y, 18, 60, 220, 0.8, 5, '#6dffb0');
    }
  }

  hurt(dmg, sx, sy) {
    if (!this.canBeHurt()) return false;
    const g = this.game;
    const D = g.diff;
    dmg = Math.max(1, Math.round(dmg * D.dmg));
    this.hp -= dmg;
    this.iframes = CFG.PLAYER.iframes * D.iframes;
    this.hurtFlash = 1;
    g.stats.taken += dmg;
    // отбрасывание от источника
    const a = Math.atan2(this.y - sy, this.x - sx);
    this.vx += Math.cos(a) * 520; this.vy += Math.sin(a) * 520;
    g.camera.addTrauma(0.45);
    g.effects.flash(0.22, '#ff3d71');
    g.effects.text(this.x, this.y - 34, '-' + dmg, '#ff6f8f', 26);
    g.particles.burst(this.x, this.y, 26, 80, 380, 0.7, 6, '#ff4d6d');
    g.audio.playerHurt();
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      g.particles.burst(this.x, this.y, 110, 100, 700, 1.2, 8, '#58e6ff');
      g.particles.burst(this.x, this.y, 60, 60, 400, 1.0, 6, '#ffffff');
      g.effects.ring(this.x, this.y, 400, 0.8, '#58e6ff', 10);
      g.camera.addTrauma(0.8);
      g.audio.explosion(0.8);
      g.onPlayerDeath();
    }
    return true;
  }

  update(dt, input) {
    const P = CFG.PLAYER, g = this.game;
    this.iframes = Math.max(0, this.iframes - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 4);
    this.fireTimer -= dt;

    if (this.dead) { this.updateNova(dt); return; }

    // направление ввода (e.code — не зависит от раскладки)
    let ix = 0, iy = 0;
    if (input.down('KeyA', 'ArrowLeft')) ix -= 1;
    if (input.down('KeyD', 'ArrowRight')) ix += 1;
    if (input.down('KeyW', 'Space', 'ArrowUp')) iy -= 1;
    if (input.down('KeyS', 'ArrowDown')) iy += 1;
    const len = Math.hypot(ix, iy);
    if (len > 0) { ix /= len; iy /= len; }

    const boost = input.down('ShiftLeft', 'ShiftRight') && len > 0;
    this.boosting = boost;
    const accel = P.accel * (boost ? P.boostAccel : 1);
    this.vx += ix * accel * dt;
    this.vy += iy * accel * dt;
    const f = Math.exp(-P.drag * dt);
    this.vx *= f; this.vy *= f;

    // ограничение скорости (плавное при отпускании Shift)
    const maxS = boost ? P.boostSpeed : P.maxSpeed;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > maxS) {
      const ns = damp(sp, maxS, boost ? 20 : 6, dt);
      this.vx *= ns / sp; this.vy *= ns / sp;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // границы арены: игрок не покидает зону
    const A = CFG.ARENA, m = 30;
    if (this.x < m) { this.x = m; if (this.vx < 0) this.vx *= -0.2; }
    if (this.x > A.w - m) { this.x = A.w - m; if (this.vx > 0) this.vx *= -0.2; }
    if (this.y < m) { this.y = m; if (this.vy < 0) this.vy *= -0.2; }
    if (this.y > A.h - m) { this.y = A.h - m; if (this.vy > 0) this.vy *= -0.2; }

    // прицел
    const mw = g.camera.screenToWorld(input.mouse.x, input.mouse.y);
    this.aim = Math.atan2(mw.y - this.y, mw.x - this.x);
    this.face = Math.cos(this.aim) >= 0 ? 1 : -1;

    // смена оружия: 1-4
    for (let i = 0; i < CFG.WEAPONS.length; i++) {
      if (input.consume('Digit' + (i + 1)) || input.consume('Numpad' + (i + 1))) this.setWeapon(i);
    }

    // стрельба
    if (input.mouse.left && this.fireTimer <= 0) this.fire();

    // спец. способность
    if (input.consumeRight()) this.useSpecial();

    // заряд Nova
    if (this.charge < 100) {
      this.charge = Math.min(100, this.charge + (100 / P.specialCooldown) * dt);
    }
    if (this.charge >= 100 && !this.readyNotified) { this.readyNotified = true; g.audio.ready(); }

    this.updateNova(dt);

    // шлейф и двигатели
    this.trailT -= dt;
    if (this.trailT <= 0 && (len > 0 || sp > 120)) {
      this.trailT = boost ? 0.012 : 0.04;
      g.particles.emit(this.x + rand(-5, 5), this.y + 20, -this.vx * 0.05 + rand(-20, 20), 60 + rand(0, 60),
        boost ? 0.45 : 0.3, boost ? 8 : 5, boost ? '#9ffcff' : '#58b8ff', { endSize: 0 });
    }
  }

  fire() {
    const W = this.weapon, g = this.game;
    if (g.bullets.length + W.pellets > CFG.MAX_BULLETS) return;
    this.fireTimer = W.delay;
    const mx = this.x + Math.cos(this.aim) * 32, my = this.y + 4 + Math.sin(this.aim) * 32;
    if (W.alt) this.altSide = -this.altSide;
    for (let i = 0; i < W.pellets; i++) {
      let a = this.aim + rand(-W.spread, W.spread);
      if (W.pellets > 1) a += (i / (W.pellets - 1) - 0.5) * W.cone;
      if (W.alt) a += this.altSide * W.alt;
      const sp = W.speed * (W.pellets > 1 ? rand(0.9, 1.08) : 1);
      // скорость корабля подмешивается слабо, чтобы пули летели куда целишься
      const k = W.homing || W.pierce > 1 ? 0 : 0.3;
      g.bullets.push(new Bullet(mx, my, Math.cos(a) * sp + this.vx * k, Math.sin(a) * sp + this.vy * k, W));
    }
    g.stats.shots += W.pellets;
    g.audio.shoot(W.id);
    if (W.recoil) { this.vx -= Math.cos(this.aim) * W.recoil; this.vy -= Math.sin(this.aim) * W.recoil; }
    // дульная вспышка
    g.particles.cone(mx, my, this.aim, W.pellets > 1 ? W.cone : 0.4, W.pellets > 1 ? 10 : 3, 120, W.id === 'lance' ? 700 : 320, 0.16, W.id === 'lance' ? 10 : 7, W.core, { endSize: 0 });
    if (W.id === 'lance') { g.camera.addTrauma(0.12); g.effects.ring(mx, my, 70, 0.22, W.color, 5); }
    else if (W.id === 'scatter') g.camera.addTrauma(0.06);
  }

  useSpecial() {
    const g = this.game;
    if (this.charge < 100 || this.dead || this.nova) return;
    this.charge = 0;
    this.readyNotified = false;
    this.nova = { x: this.x, y: this.y, r: 20, hit: new Set() };
    this.iframes = Math.max(this.iframes, 0.8);
    g.audio.nova();
    g.camera.addTrauma(0.5);
    g.effects.flash(0.35, '#bff8ff');
    g.effects.ring(this.x, this.y, CFG.PLAYER.specialRadius, 0.7, '#bff8ff', 14);
    g.effects.ring(this.x, this.y, CFG.PLAYER.specialRadius * 0.7, 0.55, '#58e6ff', 8);
    g.particles.burst(this.x, this.y, 80, 200, 900, 0.9, 7, '#9ffcff');
  }

  updateNova(dt) {
    const n = this.nova;
    if (!n) return;
    const P = CFG.PLAYER, g = this.game, boss = g.boss;
    n.r += 2300 * dt;
    if (boss && boss.state !== 'dying' && boss.state !== 'dead') {
      for (const s of boss.segments) {
        if (s.dead || s.a < 0.5 || n.hit.has(s)) continue;
        if (dist(n.x, n.y, s.x, s.y) <= n.r + s.r) {
          n.hit.add(s);
          const d = boss.takeDamage(P.specialDamage * (boss.novaScale || 1), s);
          if (d > 0) {
            g.effects.text(s.x, s.y - 20, String(d), '#bff8ff', 22);
            g.particles.burst(s.x, s.y, 8, 100, 400, 0.5, 6, '#9ffcff');
          }
        }
      }
    }
    if (boss && boss.novaClear) boss.novaClear(n.x, n.y, n.r);
    // сжигает вражеские снаряды
    for (const p of g.projectiles) {
      if (p.alive && dist(n.x, n.y, p.x, p.y) <= n.r) {
        p.alive = false;
        g.particles.burst(p.x, p.y, 6, 60, 260, 0.5, 5, p.color);
      }
    }
    if (n.r > P.specialRadius) this.nova = null;
  }

  render(ctx) {
    const g = this.game, t = g.time;
    // кольцо Nova (в мировых координатах)
    if (this.nova) {
      const n = this.nova;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const k = 1 - n.r / CFG.PLAYER.specialRadius;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.max(1, n.r - i * 22), 0, TAU);
        ctx.strokeStyle = rgba(i === 0 ? '#ffffff' : '#58e6ff', k * (1 - i * 0.3));
        ctx.lineWidth = 16 - i * 4;
        ctx.stroke();
      }
      ctx.restore();
    }
    if (this.dead) return;

    const spd = Math.hypot(this.vx, this.vy);
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(t * 3) * 1.5);
    let alpha = 1;
    if (this.iframes > 0) alpha = 0.35 + 0.5 * (Math.sin(t * 50) > 0 ? 1 : 0);
    ctx.globalAlpha = alpha;

    // свечение и крылья из энергии
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, '#58e6ff', 0, 0, 90, 0.28 * alpha);
    const flap = Math.sin(t * (9 + spd / 120)) * 0.3;
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.scale(side, 1);
      for (let i = 0; i < 4; i++) {
        const ang = -1.0 + i * 0.32 + flap, len = 42 - i * 6;
        ctx.beginPath();
        ctx.moveTo(6, -4);
        ctx.lineTo(6 + Math.cos(ang) * len, -4 + Math.sin(ang) * len);
        ctx.lineTo(6 + Math.cos(ang + 0.2) * len * 0.55, -4 + Math.sin(ang + 0.2) * len * 0.55);
        ctx.closePath();
        ctx.fillStyle = 'rgba(88,230,255,0.45)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,250,255,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';

    // тело
    ctx.imageSmoothingEnabled = false;
    const S = 2.5, spr = PlayerSprite.get();
    ctx.save();
    ctx.scale(this.face, 1);
    ctx.drawImage(spr, -8 * S, -9.5 * S, 16 * S, spr.height * S);
    ctx.restore();
    if (this.hurtFlash > 0) {
      ctx.globalAlpha = this.hurtFlash * 0.6;
      ctx.fillStyle = '#ff3d71';
      ctx.fillRect(-20, -24, 40, 48);
      ctx.globalAlpha = alpha;
    }
    ctx.imageSmoothingEnabled = true;

    // оружие
    ctx.save();
    ctx.translate(0, 4);
    ctx.rotate(this.aim);
    if (Math.cos(this.aim) < 0) ctx.scale(1, -1);
    ctx.fillStyle = '#2b3269'; ctx.fillRect(2, -3, 20, 6);
    ctx.fillStyle = '#6a86ff'; ctx.fillRect(2, -3, 20, 2);
    ctx.fillStyle = '#9ffcff'; ctx.fillRect(22, -2, 5, 4);
    ctx.restore();

    ctx.restore();
  }
}
