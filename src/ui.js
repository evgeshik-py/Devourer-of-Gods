'use strict';

/* ============================================================
   ui.js — HUD в стилистике интерфейса боевого меха (рисуется на canvas)
   ============================================================ */
class UI {
  constructor(game) {
    this.game = game;
    this.s = 1;
    this.reset();
  }

  reset() {
    this.cur = null;
    this.hpShown = 1; this.hpTrail = 1;
    this.hintT = 9;
    this.playerShown = 1;
  }

  banner(title, sub, color, dur) {
    this.cur = { title, sub: sub || '', color: color || '#9ffcff', t: 0, dur: dur || 3 };
  }

  update(dt) {
    const b = this.game.boss;
    if (this.cur) { this.cur.t += dt; if (this.cur.t >= this.cur.dur) this.cur = null; }
    this.hintT = Math.max(0, this.hintT - dt);
    if (b) {
      const r = b.hpRatio;
      this.hpShown = damp(this.hpShown, r, 14, dt);
      if (this.hpTrail > r) this.hpTrail = Math.max(r, this.hpTrail - dt * 0.12); else this.hpTrail = r;
    }
    this.playerShown = damp(this.playerShown, this.game.player.hp / this.game.player.maxHp, 12, dt);
  }

  /* ---------- примитивы ---------- */
  text(ctx, str, x, y, size, color, align, weight, glow) {
    ctx.font = (weight || '700') + ' ' + Math.round(size) + 'px ' + CFG.FONT;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = size * 0.6; }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  /* угловая техническая панель: срезанные углы, тонкая рамка, уголки-маркеры */
  panel(ctx, x, y, w, h, c) {
    const k = Math.min(9 * this.s, h * 0.35);
    ctx.beginPath();
    ctx.moveTo(x + k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - k);
    ctx.lineTo(x + w - k, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + k); ctx.closePath();
    ctx.fillStyle = 'rgba(3,8,13,0.78)';
    ctx.fill();
    ctx.strokeStyle = c || 'rgba(53,224,255,0.5)';
    ctx.lineWidth = Math.max(1, 1.2 * this.s);
    ctx.stroke();
    // акцентные скобки по углам
    const m = 7 * this.s;
    ctx.beginPath();
    ctx.moveTo(x + w - m, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + m);
    ctx.moveTo(x, y + h - m); ctx.lineTo(x, y + h); ctx.lineTo(x + m, y + h);
    ctx.lineWidth = Math.max(1.5, 2 * this.s);
    ctx.stroke();
  }

  /* статус боя для HUD */
  status() {
    const b = this.game.boss, g = this.game;
    if (g.killed || b.state === 'dying' || b.state === 'dead') return { t: 'ЦЕЛЬ УНИЧТОЖЕНА', c: '#ffe27a' };
    if (b.state === 'intro') return { t: 'ОБНАРУЖЕНА ЦЕЛЬ', c: '#35e0ff' };
    if (b.state === 'transition') return { t: 'СМЕНА РЕЖИМА', c: '#ff9a3d' };
    if (b.attackNameT > 0) return { t: '⚠ ' + b.attackName, c: CFG.WARN };
    return { t: 'В БОЮ', c: '#4dff8a' };
  }

  /* ---------- главный рендер ---------- */
  render(ctx, w, h) {
    const g = this.game, s = this.s = clamp(Math.min(w / 1280, h / 720), 0.7, 2.2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'middle';
    if (g.boss) this.bossBar(ctx, w, h, s);
    if (g.boss) this.timerHud(ctx, w, h, s);
    this.bossArrow(ctx, w, h, s);
    this.playerHud(ctx, w, h, s);
    this.lowHp(ctx, w, h);
    this.bannerDraw(ctx, w, h, s);
    this.hint(ctx, w, h, s);
  }

  /* бесконечный режим: волна, оставшиеся враги, счёт */
  waveBar(ctx, w, h, s) {
    const g = this.game, b = g.boss, pal = b.pal;
    const pw = Math.min(w * 0.5, 720 * s), ph = 66 * s, px = (w - pw) / 2, py = 12 * s;
    const elite = b.eliteWave && b.waveState === 'active', col = elite ? '#ff3d71' : pal.accent;
    this.panel(ctx, px, py, pw, ph, rgba(col, 0.6));
    const ix = px + 14 * s, iw = pw - 28 * s;
    this.text(ctx, 'ENDLESS //', ix, py + 14 * s, 11 * s, '#6f8fa0', 'left', '700');
    this.text(ctx, (elite ? '★ ЭЛИТНАЯ ВОЛНА ' : 'ВОЛНА ') + (b.wave || '—'), ix + 70 * s, py + 14 * s, 15 * s, '#eaf6ff', 'left', '800', col);
    const st = b.waveState === 'countdown' ? { t: (b.wave ? 'СЛЕДУЮЩАЯ ВОЛНА ' : 'СТАРТ ') + Math.max(0, Math.ceil(b.countdown)) + ' с', c: '#35e0ff' }
      : elite ? { t: '⚠ ЭЛИТА НА ПОЛЕ', c: CFG.WARN } : { t: 'ВОЛНА АКТИВНА', c: '#4dff8a' };
    this.text(ctx, st.t, px + pw - 14 * s, py + 14 * s, 12 * s, st.c, 'right', '800', st.c);
    const bx = ix, by = py + 26 * s, bh = 14 * s;
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(bx, by, iw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx, by, iw * clamp(this.hpTrail, 0, 1), bh);
    const gr = ctx.createLinearGradient(bx, 0, bx + iw, 0);
    gr.addColorStop(0, pal.mid); gr.addColorStop(1, col);
    ctx.fillStyle = gr; ctx.fillRect(bx, by, iw * clamp(this.hpShown, 0, 1), bh);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(bx, by, iw * clamp(this.hpShown, 0, 1), bh * 0.35);
    if (b.hitPulse > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (b.hitPulse * 0.18).toFixed(3) + ')'; ctx.fillRect(bx, by, iw, bh); }
    ctx.fillStyle = 'rgba(3,8,13,0.7)';
    for (let i = 1; i < 20; i++) ctx.fillRect(bx + iw * i / 20 - 0.5, by, 1, bh);
    this.text(ctx, 'ВРАГОВ: ' + b.remaining, bx, py + 54 * s, 12 * s, col, 'left', '800');
    this.text(ctx, 'СЧЁТ ' + fmtNum(b.score), bx + iw, py + 54 * s, 12 * s, '#ffffff', 'right', '800');
  }

  bossBar(ctx, w, h, s) {
    if (this.game.boss.endless) return this.waveBar(ctx, w, h, s);
    const g = this.game, b = g.boss, pal = b.pal, st = this.status();
    const pw = Math.min(w * 0.5, 720 * s), ph = 66 * s, px = (w - pw) / 2, py = 12 * s;
    this.panel(ctx, px, py, pw, ph, rgba(pal.accent, 0.6));
    const ix = px + 14 * s, iw = pw - 28 * s;
    this.text(ctx, 'TARGET //', ix, py + 14 * s, 11 * s, '#6f8fa0', 'left', '700');
    this.text(ctx, b.name, ix + 66 * s, py + 14 * s, 15 * s, '#eaf6ff', 'left', '800', pal.glow);
    this.text(ctx, st.t, px + pw - 14 * s, py + 14 * s, 12 * s, st.c, 'right', '800', st.c);
    // полоса HP
    const bx = ix, by = py + 26 * s, bh = 14 * s;
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(bx, by, iw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(bx, by, iw * clamp(this.hpTrail, 0, 1), bh);
    const gr = ctx.createLinearGradient(bx, 0, bx + iw, 0);
    gr.addColorStop(0, pal.mid); gr.addColorStop(1, pal.accent);
    ctx.fillStyle = gr;
    ctx.fillRect(bx, by, iw * clamp(this.hpShown, 0, 1), bh);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(bx, by, iw * clamp(this.hpShown, 0, 1), bh * 0.35);
    if (b.hitPulse > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (b.hitPulse * 0.25).toFixed(3) + ')'; ctx.fillRect(bx, by, iw, bh); }
    // деления: каждые 5% тонкие, фазы — яркие
    ctx.fillStyle = 'rgba(3,8,13,0.7)';
    for (let i = 1; i < 20; i++) ctx.fillRect(bx + iw * i / 20 - 0.5, by, 1, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const f of [0.75, 0.5, 0.25]) ctx.fillRect(bx + iw * f - 1, by - 3 * s, 2, bh + 6 * s);
    const pct = Math.max(b.hp > 0 ? 1 : 0, Math.ceil(b.hpRatio * 100));
    this.text(ctx, 'ФАЗА ' + b.phase.roman + ' · ' + b.phase.name, bx, py + 54 * s, 12 * s, pal.accent, 'left', '800');
    this.text(ctx, 'ЦЕЛОСТНОСТЬ ' + (b.state === 'dead' ? 0 : pct) + '%', bx + iw, py + 54 * s, 12 * s, '#ffffff', 'right', '800');
  }

  /* таймер боя (справа вверху) */
  timerHud(ctx, w, h, s) {
    const g = this.game, t = g.timer;
    const pw = 176 * s, ph = 52 * s, px = w - 18 * s - pw, py = 12 * s;
    const live = t.status === 'running', done = t.status === 'stopped' && g.killed;
    const col = done ? '#ffe27a' : (live ? '#4dff8a' : '#6f8fa0');
    this.panel(ctx, px, py, pw, ph, rgba(col, 0.55));
    this.text(ctx, g.boss && g.boss.endless ? 'SURVIVAL' : 'FIGHT TIMER', px + 12 * s, py + 14 * s, 10 * s, '#6f8fa0', 'left', '700');
    ctx.fillStyle = col;
    ctx.globalAlpha = live ? 0.6 + 0.4 * Math.sin(g.time * 5) : 1;
    ctx.fillRect(px + pw - 18 * s, py + 10 * s, 6 * s, 6 * s);
    ctx.globalAlpha = 1;
    this.text(ctx, fmtTimeMs(t.elapsedMs()), px + pw / 2, py + 34 * s, 22 * s, '#eaf6ff', 'center', '800', live ? col : null);
  }

  bossArrow(ctx, w, h, s) {
    const g = this.game, b = g.boss;
    if (!b || b.state === 'dead' || b.state === 'intro' && b.alpha <= 0) return;
    const hd = b.head;
    if (hd.a < 0.3) return;
    const sp = g.camera.worldToScreen(hd.x, hd.y), m = 46 * s;
    if (sp.x > m && sp.x < w - m && sp.y > 110 * s && sp.y < h - m) return;
    const cx = w / 2, cy = h / 2;
    const ang = Math.atan2(sp.y - cy, sp.x - cx);
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const tx = dx !== 0 ? (dx > 0 ? (w - m - cx) : (m - cx)) / dx : Infinity;
    const ty = dy !== 0 ? (dy > 0 ? (h - m - cy) : (110 * s - cy)) / dy : Infinity;
    const t = Math.min(tx, ty);
    const px = cx + dx * t, py = cy + dy * t;
    const pulse = 0.65 + 0.35 * Math.sin(g.time * 8);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = b.pal.accent;
    ctx.shadowColor = b.pal.glow; ctx.shadowBlur = 14 * s;
    ctx.beginPath();
    ctx.moveTo(20 * s, 0); ctx.lineTo(-12 * s, -14 * s); ctx.lineTo(-5 * s, 0); ctx.lineTo(-12 * s, 14 * s);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  playerHud(ctx, w, h, s) {
    const g = this.game, p = g.player, pal = g.boss ? g.boss.pal : CFG.PALETTES[0];
    const pad = 22 * s, bw = Math.min(360 * s, w * 0.34), bh = 22 * s;
    const x = pad, y = h - pad - bh;
    // здоровье
    this.text(ctx, 'HULL INTEGRITY', x, y - 14 * s, 13 * s, '#9fb4ff', 'left', '800');
    this.panel(ctx, x - 5 * s, y - 5 * s, bw + 10 * s, bh + 10 * s, 'rgba(53,224,255,0.5)');
    const r = clamp(this.playerShown, 0, 1);
    const gr = ctx.createLinearGradient(x, 0, x + bw, 0);
    gr.addColorStop(0, r < 0.3 ? '#ff2d55' : '#14b87a'); gr.addColorStop(1, r < 0.3 ? '#ff7a8f' : '#4dff8a');
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, bw * r, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x, y, bw * r, bh * 0.35);
    if (p.iframes > 0) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, bw, bh); }
    this.text(ctx, Math.ceil(p.hp) + ' / ' + p.maxHp, x + bw / 2, y + bh / 2 + 1, 14 * s, '#ffffff', 'center', '800');

    // способность
    const sx = x + bw + 34 * s, sw = Math.min(250 * s, w * 0.22);
    const ready = p.charge >= 100;
    const pulse = ready ? 0.6 + 0.4 * Math.sin(g.time * 7) : 0;
    this.text(ctx, ready ? 'SPECIAL // NOVA — ПКМ' : 'SPECIAL // NOVA', sx, y - 14 * s, 13 * s, ready ? '#bff8ff' : '#9fb4ff', 'left', '800', ready ? '#58e6ff' : null);
    this.panel(ctx, sx - 5 * s, y - 5 * s, sw + 10 * s, bh + 10 * s, ready ? rgba('#9ffcff', 0.6 + 0.4 * pulse) : 'rgba(53,224,255,0.5)');
    ctx.fillStyle = ready ? rgba('#9ffcff', 0.75 + 0.25 * pulse) : '#1a8fb0';
    ctx.fillRect(sx, y, sw * clamp(p.charge / 100, 0, 1), bh);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(sx, y, sw * clamp(p.charge / 100, 0, 1), bh * 0.35);
    this.text(ctx, ready ? 'ГОТОВО' : Math.floor(p.charge) + '%', sx + sw / 2, y + bh / 2 + 1, 13 * s, '#ffffff', 'center', '800');

    // оружие: 4 слота, активный подсвечен
    const slotW = 112 * s, slotH = 24 * s, wy = y - 50 * s;
    for (let i = 0; i < CFG.WEAPONS.length; i++) {
      const W = CFG.WEAPONS[i], on = i === p.weaponIdx, sx0 = x + i * (slotW + 6 * s);
      this.panel(ctx, sx0, wy, slotW, slotH, on ? rgba(W.color, 0.95) : 'rgba(130,150,200,0.35)');
      if (on) { ctx.fillStyle = rgba(W.color, 0.22); ctx.fillRect(sx0 + 2, wy + 2, slotW - 4, slotH - 4); }
      this.text(ctx, (i + 1) + '  ' + W.short, sx0 + slotW / 2, wy + slotH / 2 + 1, 12 * s, on ? '#ffffff' : '#7f8fc0', 'center', '800', on ? W.color : null);
    }

    // быстрые слоты расходников (Q E R F) — справа от шкалы Nova
    const qw = 64 * s, qh = bh + 10 * s, qy = y - 5 * s;
    let qx = sx + sw + 30 * s;
    ctx.save();
    for (const it of ITEMS) {
      if (it.type !== 'consumable') continue;
      const n = g.inventory.count(it.id), has = n > 0;
      const act = it.id === 'overdrive' ? p.buffs.overdrive / 8 : it.id === 'shield' ? p.shieldT / 4 : 0;
      this.panel(ctx, qx, qy, qw, qh, has ? rgba(it.color, act > 0 ? 0.95 : 0.55) : 'rgba(130,150,200,0.25)');
      if (act > 0) { ctx.fillStyle = rgba(it.color, 0.3); ctx.fillRect(qx + 2, qy + qh - 2 - (qh - 4) * act, qw - 4, (qh - 4) * act); }
      ctx.globalAlpha = has ? 1 : 0.35;
      this.text(ctx, it.keyLabel, qx + 9 * s, qy + 9 * s, 10 * s, '#9fb4c8', 'left', '800');
      this.text(ctx, it.glyph, qx + qw * 0.42, qy + qh / 2 + 1, 17 * s, it.color, 'center', '800', has ? it.color : null);
      this.text(ctx, '×' + n, qx + qw - 8 * s, qy + qh - 9 * s, 12 * s, '#ffffff', 'right', '800');
      ctx.globalAlpha = 1;
      qx += qw + 4 * s;
    }
    ctx.restore();

    // надетые аксессуары (справа от слотов оружия)
    const asz = slotH;
    let ax = x + CFG.WEAPONS.length * (slotW + 6 * s) + 6 * s;
    for (let i = 0; i < EQUIP_SLOTS; i++) {
      const id = g.inventory.equip[i], it = id ? ITEM[id] : null, c = it ? itemColor(it) : 'rgba(130,150,200,0.3)';
      this.panel(ctx, ax, wy, asz, asz, it ? rgba(c, 0.8) : c);
      if (it) {
        this.text(ctx, it.glyph, ax + asz / 2, wy + asz / 2 + 1, 14 * s, c, 'center', '800', c);
        if (id === 'aegis' && p.aegisT > 0) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(ax + 2, wy + 2, asz - 4, (asz - 4) * (p.aegisT / it.mods.aegis)); }
      }
      ax += asz + 4 * s;
    }

    // метка сложности (под кнопкой звука)
    this.text(ctx, 'СЛОЖНОСТЬ: ' + g.diff.name, 22 * s, 66 * s, 12 * s, g.diff.color, 'left', '800');

    // урон и таймер
    const rx = w - pad;
    const en = g.boss && g.boss.endless;
    this.text(ctx, en ? 'ENEMIES DOWN' : 'DAMAGE DEALT', rx, h - pad - 42 * s, 12 * s, '#9fb4ff', 'right', '800');
    this.text(ctx, fmtNum(en ? g.boss.kills : g.stats.damage), rx, h - pad - 20 * s, 26 * s, '#ffffff', 'right', '900', pal.glow);
  }

  lowHp(ctx, w, h) {
    const p = this.game.player;
    const r = p.hp / p.maxHp;
    if (r >= 0.3 || p.dead) return;
    const a = (0.3 - r) / 0.3 * (0.25 + 0.15 * Math.sin(this.game.time * 6));
    const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
    gr.addColorStop(0, 'rgba(255,0,60,0)');
    gr.addColorStop(1, 'rgba(255,0,60,' + a.toFixed(3) + ')');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  }

  bannerDraw(ctx, w, h, s) {
    const b = this.cur;
    if (!b) return;
    const k = b.t / b.dur;
    const a = Math.min(smoothstep(0, 0.12, k), 1 - smoothstep(0.78, 1, k));
    const sc = 1 + (1 - smoothstep(0, 0.15, k)) * 0.25;
    const y = h * 0.3;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,12,0.55)';
    ctx.fillRect(0, y - 56 * s, w, 112 * s);
    ctx.fillStyle = rgba(b.color, 0.8);
    ctx.fillRect(0, y - 56 * s, w, 2 * s);
    ctx.fillRect(0, y + 54 * s, w, 2 * s);
    ctx.translate(w / 2, y - 8 * s);
    ctx.scale(sc, sc);
    this.text(ctx, b.title, 0, 0, 54 * s, '#ffffff', 'center', '900', b.color);
    if (b.sub) this.text(ctx, b.sub, 0, 44 * s, 20 * s, b.color, 'center', '800');
    ctx.restore();
  }

  hint(ctx, w, h, s) {
    if (this.hintT <= 0) return;
    ctx.globalAlpha = Math.min(1, this.hintT / 1.5) * 0.9;
    this.text(ctx, 'WASD — полёт  •  Shift — ускорение  •  ЛКМ — огонь  •  ПКМ — Nova  •  1–4 — оружие  •  Q E R F — расходники  •  I — инвентарь', w / 2, h - 150 * s, 14 * s, '#b8c8ff', 'center', '700');
    ctx.globalAlpha = 1;
  }
}
