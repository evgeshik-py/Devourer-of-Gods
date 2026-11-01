'use strict';

/* ============================================================
   game.js — состояние игры, цикл, коллизии, отрисовка
   ============================================================ */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.audio = new AudioFX();
    this.camera = new Camera();
    this.particles = new ParticleSystem(CFG.MAX_PARTICLES);
    this.effects = new Effects(this);
    this.background = new Background();
    this.player = new Player(this);
    this.ui = new UI(this);
    this.boss = null;
    this.sel = this.loadSelection();      // выбор в меню: { diff: id, weapon: id }
    this.diff = CFG.DIFFS[1];
    this.bullets = []; this.projectiles = []; this.portals = [];
    this.stats = this.freshStats();
    this.state = 'menu';            // menu | playing | paused | defeat | victory
    this.time = 0; this.timeScale = 1;
    this.pendingEnd = null; this.endTimer = 0;
    this.bgBlend = 0;
    this.lastT = 0; this.ft = 1 / 60;
    this.w = 1280; this.h = 720;
    this.els = {};
    for (const n of ['start', 'pause', 'defeat', 'victory']) this.els[n] = document.getElementById('screen-' + n);
    this.soundBtn = document.getElementById('btn-sound');
    this.refreshSoundBtn();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('blur', () => { if (this.state === 'playing') this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    this.showScreen('start');
    requestAnimationFrame((t) => this.tick(t));
  }

  freshStats() { return { damage: 0, taken: 0, shots: 0, hits: 0, time: 0 }; }

  /* ---------- выбор сложности и оружия ---------- */
  loadSelection() {
    let s = { boss: 'dog', diff: 'normal', weapon: 'pulse' };
    try {
      const raw = JSON.parse(localStorage.getItem('dog_sel') || 'null');
      if (raw && CFG.DIFFS.some(d => d.id === raw.diff) && CFG.WEAPONS.some(w => w.id === raw.weapon)) {
        s = { boss: CFG.BOSSES.some(b => b.id === raw.boss) ? raw.boss : 'dog', diff: raw.diff, weapon: raw.weapon };
      }
    } catch (e) { /* ignore */ }
    return s;
  }
  saveSelection() { try { localStorage.setItem('dog_sel', JSON.stringify(this.sel)); } catch (e) { /* ignore */ } }
  diffById(id) { return CFG.DIFFS.find(d => d.id === id) || CFG.DIFFS[1]; }
  weaponIndex(id) { const i = CFG.WEAPONS.findIndex(w => w.id === id); return i < 0 ? 0 : i; }

  /* ближайший видимый сегмент босса (для самонаведения) */
  nearestSegment(x, y) {
    const boss = this.boss;
    if (!boss || boss.invulnerable || boss.state === 'dying' || boss.state === 'dead') return null;
    let best = null, bd = Infinity;
    for (const s of boss.segments) {
      if (s.dead || s.a < 0.5) continue;
      const d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) - (isCritSeg(s) ? 40000 : 0);   // голова чуть приоритетнее
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  toMenu() {
    this.state = 'menu';
    this.audio.stopAmbient(); this.audio.beamLoop(false); this.audio.resume();
    this.input.releaseAll();
    this.pendingEnd = null; this.timeScale = 1;
    this.effects.reset(); this.effects.darkenTarget = 0;
    this.showScreen('start');
    if (this.onMenu) this.onMenu();
  }

  /* ---------- экраны ---------- */
  showScreen(name) {
    for (const k in this.els) this.els[k].classList.toggle('hidden', k !== name);
  }
  hideScreens() { for (const k in this.els) this.els[k].classList.add('hidden'); }

  refreshSoundBtn() { this.soundBtn.textContent = this.audio.muted ? '♪ ЗВУК: ВЫКЛ' : '♪ ЗВУК: ВКЛ'; }
  toggleSound() { this.audio.init(); this.audio.setMuted(!this.audio.muted); this.refreshSoundBtn(); }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(320, Math.floor(window.innerWidth * dpr)), h = Math.max(240, Math.floor(window.innerHeight * dpr));
    this.canvas.width = w; this.canvas.height = h;
    this.w = w; this.h = h;
    this.camera.resize(w, h);
    this.camera.clampToArena();
  }

  /* ---------- управление состоянием ---------- */
  start() {
    this.audio.init(); this.audio.resume();
    this.audio.stopAmbient(); this.audio.beamLoop(false);
    const A = CFG.ARENA;
    this.diff = this.diffById(this.sel.diff);
    this.player.maxHp = Math.round(CFG.PLAYER.hp * this.diff.playerHp);
    this.player.reset();
    this.player.setWeapon(this.weaponIndex(this.sel.weapon), true);
    this.bullets.length = 0; this.projectiles.length = 0; this.portals.length = 0;
    this.particles.clear(); this.effects.reset(); this.ui.reset();
    this.stats = this.freshStats();
    this.timeScale = 1; this.pendingEnd = null; this.endTimer = 0;
    this.input.releaseAll(); this.input.clearPressed();

    this.boss = this.sel.boss === 'ares' ? new Ares(this) : new Boss(this);
    this.boss.begin();
    this.bgBlend = 0;
    this.camera.snap(this.player.x, this.player.y - 250);
    this.state = 'playing';
    this.hideScreens();
    this.audio.startAmbient(); this.audio.setAmbientPhase(0);
    this.ui.banner(this.boss.name, this.boss.introSub + '  •  ' + this.diff.name, this.boss.pal.accent, 3.6);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.releaseAll();
    this.audio.suspend();
    this.showScreen('pause');
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.input.releaseAll(); this.input.clearPressed();
    this.audio.resume();
    this.hideScreens();
  }

  onPlayerDeath() {
    if (this.pendingEnd) return;
    this.pendingEnd = 'defeat'; this.endTimer = 2.2;
    this.audio.beamLoop(false); this.audio.stopAmbient(); this.audio.defeat();
  }
  onBossDead() {
    if (this.pendingEnd) return;
    this.pendingEnd = 'victory'; this.endTimer = 2.2;
    this.audio.stopAmbient(); this.audio.victory();
  }

  finishRun() {
    const s = this.stats, acc = s.shots ? Math.round(s.hits / s.shots * 100) : 0;
    this.input.releaseAll();
    this.audio.beamLoop(false);
    const row = (a, b) => '<div>' + a + ': <span>' + b + '</span></div>';
    const setup = row('Босс', this.boss.name) + row('Сложность', this.diff.name) + row('Оружие', this.player.weapon.name);
    document.getElementById('victory-sub').textContent = this.boss.victoryText;
    document.getElementById('defeat-sub').textContent = this.boss.defeatText;
    if (this.pendingEnd === 'victory') {
      document.getElementById('victory-stats').innerHTML = setup +
        row('Время', fmtTime(s.time)) + row('Нанесено урона', fmtNum(s.damage)) +
        row('Получено урона', fmtNum(s.taken)) + row('Точность', acc + '%');
      this.state = 'victory'; this.showScreen('victory');
    } else {
      const left = this.boss ? Math.ceil(this.boss.hpRatio * 100) : 100;
      document.getElementById('defeat-stats').innerHTML = setup +
        row('Фаза', this.boss ? this.boss.phase.roman + ' — ' + this.boss.phase.name : '-') +
        row('У босса осталось', left + '%') + row('Время', fmtTime(s.time)) + row('Нанесено урона', fmtNum(s.damage));
      this.state = 'defeat'; this.showScreen('defeat');
    }
    this.pendingEnd = null;
  }

  /* ---------- вспомогательное ---------- */
  spawnProjectile(o) {
    if (this.projectiles.length >= CFG.MAX_PROJECTILES) return null;
    const p = new Projectile(o);
    this.projectiles.push(p);
    return p;
  }
  projectilesToParticles() {
    for (const p of this.projectiles) if (p.alive) this.particles.burst(p.x, p.y, 3, 40, 220, 0.5, 6, p.color);
    this.projectiles.length = 0;
  }

  /* ---------- главный цикл ---------- */
  tick(t) {
    requestAnimationFrame((tt) => this.tick(tt));
    let rdt = (t - this.lastT) / 1000;
    this.lastT = t;
    if (!(rdt > 0)) rdt = 1 / 60;
    rdt = Math.min(rdt, CFG.MAX_DT);
    this.ft = lerp(this.ft, rdt, 0.05);
    // адаптивное качество частиц
    if (this.ft > 0.024) this.particles.density = Math.max(0.4, this.particles.density - 0.01);
    else if (this.ft < 0.019) this.particles.density = Math.min(1, this.particles.density + 0.004);

    const inp = this.input;
    if (inp.consume('KeyM')) this.toggleSound();
    if (inp.consume('Escape')) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }

    if (this.state === 'playing') this.update(rdt * this.timeScale);
    else if (this.state === 'menu' || this.state === 'defeat' || this.state === 'victory') {
      this.time += rdt;
      this.camera.x = CFG.ARENA.w / 2 + Math.sin(this.time * 0.12) * 500;
      this.camera.y = CFG.ARENA.h / 2 + Math.cos(this.time * 0.09) * 300;
      this.camera.clampToArena();
      this.camera.ox = 0; this.camera.oy = 0;
      this.particles.update(rdt);
      this.effects.update(rdt);
    }
    this.render();
  }

  update(dt) {
    const inp = this.input, p = this.player, boss = this.boss, cam = this.camera;
    this.time += dt;

    if (boss && (boss.state === 'fight' || boss.state === 'transition' || boss.state === 'dying')) this.stats.time += dt;

    p.update(dt, inp);
    boss.update(dt);

    this.updateBullets(dt);
    this.updateProjectiles(dt);

    for (let i = this.portals.length - 1; i >= 0; i--) {
      const pr = this.portals[i];
      pr.update(dt, this);
      if (pr.dead) this.portals.splice(i, 1);
    }

    // атаки с собственной геометрией (луч, кольца)
    if (!p.dead) boss.collide(p);
    this.contactDamage();

    this.particles.update(dt);
    this.effects.update(dt);

    // камера: игрок + небольшое смещение в сторону босса
    const hd = boss.head;
    const k = boss.state === 'intro' ? 0.45 : 0.16;
    cam.follow(p.x + (hd.x - p.x) * k, p.y + (hd.y - p.y) * k, dt);

    this.ui.update(dt);

    if (this.pendingEnd) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.finishRun();
    }
  }

  updateBullets(dt) {
    const boss = this.boss, bl = this.bullets, segs = boss.segments;
    const canHit = boss.state !== 'dead' && boss.state !== 'dying';
    for (let i = bl.length - 1; i >= 0; i--) {
      const b = bl[i];
      b.update(dt, this);
      if (b.alive && canHit) {
        const W = b.wp;
        for (let j = 0; j < segs.length; j++) {
          const s = segs[j];
          if (s.dead || s.a < 0.5) continue;
          if (b.hitSet && b.hitSet.has(s)) continue;
          if (Physics.segDist(s.x, s.y, b.px, b.py, b.x, b.y) <= s.r * 0.9 + b.r) {
            const d = boss.takeDamage(b.dmg, s);
            if (d > 0) {
              if (!b.counted) { b.counted = true; this.stats.hits++; }
              this.player.charge = Math.min(100, this.player.charge + W.gain);
              this.effects.text(s.x, s.y - s.r, String(d), isCritSeg(s) ? '#ffe27a' : '#e8f6ff', (isCritSeg(s) ? 22 : 17) + (d > 80 ? 6 : 0));
              this.particles.burst(b.x, b.y, d > 80 ? 10 : 4, 60, 320, 0.4, 5, W.id === 'pulse' ? boss.pal.light : W.color);
              this.audio.hit(isCritSeg(s) || d > 80);
              if (d > 80) this.camera.addTrauma(0.08);
            } else {
              this.particles.burst(b.x, b.y, 3, 40, 200, 0.3, 4, '#9ffcff');
            }
            // пробивание: урон падает с каждой целью; у неуязвимого босса пуля гасится
            if (d > 0 && b.pierce > 1) {
              b.hitSet.add(s);
              b.pierce--;
              b.dmg *= b.falloff;
            } else {
              b.alive = false;
              break;
            }
          }
        }
      }
      if (b.alive && boss.hazardHit) boss.hazardHit(b);
      if (!b.alive) bl.splice(i, 1);
    }
  }

  updateProjectiles(dt) {
    const pl = this.projectiles, p = this.player;
    for (let i = pl.length - 1; i >= 0; i--) {
      const pr = pl[i];
      pr.update(dt, this);
      if (pr.alive && !p.dead && Physics.circleHit(pr.x, pr.y, pr.r * 0.85, p.x, p.y, p.radius)) {
        if (p.canBeHurt()) {
          p.hurt(pr.dmg, pr.x, pr.y);
          pr.alive = false;
          this.particles.burst(pr.x, pr.y, 14, 80, 400, 0.5, 7, pr.color);
        }
      }
      if (!pr.alive) pl.splice(i, 1);
    }
  }

  contactDamage() {
    const boss = this.boss, p = this.player;
    if (p.dead || !p.canBeHurt()) return;
    if (boss.state === 'intro' || boss.state === 'dying' || boss.state === 'dead') return;
    const mult = boss.phase.contactMult;
    const segs = boss.segments;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (s.dead || s.a < 0.5) continue;
      if (Physics.circleHit(p.x, p.y, p.radius, s.x, s.y, s.r * 0.82)) {
        p.hurt(boss.contactDamage(s) * mult, s.x, s.y);
        return;
      }
    }
  }

  /* ---------- отрисовка ---------- */
  render() {
    const ctx = this.ctx, cam = this.camera, boss = this.boss;
    const playing = this.state !== 'menu';
    const target = boss && playing ? boss.palIdx : 0;
    this.bgBlend = damp(this.bgBlend, target, 0.9, 1 / 60);
    this.background.render(ctx, cam, this.time, this.bgBlend, this.effects.darken, boss && playing ? boss.palettes : CFG.PALETTES);

    if (playing && boss) {
      const view = cam.view();
      cam.apply(ctx);
      this.drawArena(ctx, view, boss);
      drawBarrier(ctx, cam, this.time, boss.pal.accent, this.player);
      for (const pr of this.portals) pr.render(ctx);
      if (boss.attack) boss.attack.render(ctx);
      boss.render(ctx);
      for (const pr of this.projectiles) pr.render(ctx);
      for (const b of this.bullets) b.render(ctx);
      this.player.render(ctx);
      this.particles.render(ctx, view);
      this.effects.renderWorld(ctx);
    } else {
      cam.apply(ctx);
      this.particles.render(ctx, cam.view());
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.effects.renderScreen(ctx, this.w, this.h);
    if (playing && boss && (this.state === 'playing' || this.state === 'paused')) this.ui.render(ctx, this.w, this.h);
  }

  drawArena(ctx, v, boss) {
    const A = CFG.ARENA;
    // пространство за границей затемнено
    ctx.fillStyle = 'rgba(0,0,10,0.5)';
    const l = v.l - 50, r = v.r + 50, t = v.t - 50, b = v.b + 50;
    if (l < 0) ctx.fillRect(l, t, -l, b - t);
    if (r > A.w) ctx.fillRect(A.w, t, r - A.w, b - t);
    if (t < 0) ctx.fillRect(Math.max(l, 0), t, Math.min(r, A.w) - Math.max(l, 0), -t);
    if (b > A.h) ctx.fillRect(Math.max(l, 0), A.h, Math.min(r, A.w) - Math.max(l, 0), b - A.h);
    // сетка ориентиров
    const step = 240, pal = boss.pal;
    ctx.fillStyle = rgba(pal.accent, 0.22);
    const x0 = Math.max(0, Math.floor(v.l / step) * step), y0 = Math.max(0, Math.floor(v.t / step) * step);
    for (let x = x0; x <= Math.min(A.w, v.r); x += step) {
      for (let y = y0; y <= Math.min(A.h, v.b); y += step) ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }
}

/* сегмент, попадание по которому считается точным (голова червя, ядро Ares) */
function isCritSeg(s) { return s.kind === 'head' || s.kind === 'core'; }
