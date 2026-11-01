'use strict';

/* ============================================================
   ui.js — HUD в тёмной космической стилистике (рисуется на canvas)
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

  panel(ctx, x, y, w, h, c) {
    const k = Math.min(10 * this.s, h * 0.4);
    ctx.beginPath();
    ctx.moveTo(x + k, y); ctx.lineTo(x + w - k, y); ctx.lineTo(x + w, y + k);
    ctx.lineTo(x + w, y + h - k); ctx.lineTo(x + w - k, y + h); ctx.lineTo(x + k, y + h);
    ctx.lineTo(x, y + h - k); ctx.lineTo(x, y + k); ctx.closePath();
    ctx.fillStyle = 'rgba(6,4,22,0.72)';
    ctx.fill();
    ctx.strokeStyle = c || 'rgba(120,225,255,0.55)';
    ctx.lineWidth = Math.max(1, 1.5 * this.s);
    ctx.stroke();
  }

  /* ---------- главный рендер ---------- */
  render(ctx, w, h) {
    const g = this.game, s = this.s = clamp(Math.min(w / 1280, h / 720), 0.7, 2.2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'middle';
    if (g.boss) this.bossBar(ctx, w, h, s);
    this.bossArrow(ctx, w, h, s);
    this.playerHud(ctx, w, h, s);
    this.lowHp(ctx, w, h);
    this.bannerDraw(ctx, w, h, s);
    this.hint(ctx, w, h, s);
  }

  bossBar(ctx, w, h, s) {
    const g = this.game, b = g.boss, pal = b.pal;
    const bw = Math.min(w * 0.62, 980 * s), bh = 20 * s, x = (w - bw) / 2, y = 52 * s;
    this.text(ctx, b.name, w / 2, 26 * s, 24 * s, '#eaf6ff', 'center', '900', pal.glow);
    this.panel(ctx, x - 6 * s, y - 6 * s, bw + 12 * s, bh + 12 * s, rgba(pal.accent, 0.7));
    // трейл урона
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, bw * clamp(this.hpTrail, 0, 1), bh);
    const gr = ctx.createLinearGradient(x, 0, x + bw, 0);
    gr.addColorStop(0, pal.mid); gr.addColorStop(1, pal.light);
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, bw * clamp(this.hpShown, 0, 1), bh);
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y, bw * clamp(this.hpShown, 0, 1), bh * 0.35);
    if (b.hitPulse > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (b.hitPulse * 0.25).toFixed(3) + ')';
      ctx.fillRect(x, y, bw, bh);
    }
    // отметки фаз
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const f of [0.75, 0.5, 0.25]) ctx.fillRect(x + bw * f - 1, y - 3 * s, 2, bh + 6 * s);
    const pct = Math.max(b.hp > 0 ? 1 : 0, Math.ceil(b.hpRatio * 100));
    this.text(ctx, 'ФАЗА ' + b.phase.roman + ' — ' + b.phase.name, x, y + bh + 20 * s, 15 * s, pal.accent, 'left', '800', pal.glow);
    this.text(ctx, (b.state === 'dead' ? 0 : pct) + '%', x + bw, y + bh + 20 * s, 17 * s, '#ffffff', 'right', '800');
    if (b.attackNameT > 0 && b.state === 'fight') {
      ctx.globalAlpha = clamp(b.attackNameT / 0.6, 0, 1);
      this.text(ctx, '⚠ ' + b.attackName, w / 2, y + bh + 20 * s, 14 * s, CFG.WARN, 'center', '800', CFG.WARN);
      ctx.globalAlpha = 1;
    }
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
    this.text(ctx, 'ЗДОРОВЬЕ', x, y - 14 * s, 13 * s, '#9fb4ff', 'left', '800');
    this.panel(ctx, x - 5 * s, y - 5 * s, bw + 10 * s, bh + 10 * s, 'rgba(130,200,255,0.5)');
    const r = clamp(this.playerShown, 0, 1);
    const gr = ctx.createLinearGradient(x, 0, x + bw, 0);
    gr.addColorStop(0, r < 0.3 ? '#ff2d55' : '#2aa8ff'); gr.addColorStop(1, r < 0.3 ? '#ff7a8f' : '#6dffd8');
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
    this.text(ctx, ready ? 'STELLAR NOVA — ПКМ' : 'STELLAR NOVA', sx, y - 14 * s, 13 * s, ready ? '#bff8ff' : '#9fb4ff', 'left', '800', ready ? '#58e6ff' : null);
    this.panel(ctx, sx - 5 * s, y - 5 * s, sw + 10 * s, bh + 10 * s, ready ? rgba('#9ffcff', 0.6 + 0.4 * pulse) : 'rgba(130,200,255,0.5)');
    ctx.fillStyle = ready ? rgba('#9ffcff', 0.75 + 0.25 * pulse) : '#4a6ae0';
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

    // метка сложности (под кнопкой звука)
    this.text(ctx, 'СЛОЖНОСТЬ: ' + g.diff.name, 22 * s, 66 * s, 12 * s, g.diff.color, 'left', '800');

    // урон и таймер
    const rx = w - pad;
    this.text(ctx, 'НАНЕСЕНО УРОНА', rx, h - pad - 42 * s, 12 * s, '#9fb4ff', 'right', '800');
    this.text(ctx, fmtNum(g.stats.damage), rx, h - pad - 20 * s, 26 * s, '#ffffff', 'right', '900', pal.glow);
    this.text(ctx, fmtTime(g.stats.time), rx, 26 * s, 20 * s, '#cfe6ff', 'right', '800');
    this.text(ctx, 'ВРЕМЯ БИТВЫ', rx, 46 * s, 11 * s, '#7f90cc', 'right', '700');
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
    this.text(ctx, 'WASD / Пробел — полёт   •   Shift — ускорение   •   ЛКМ — огонь   •   ПКМ — Stellar Nova   •   1–4 — смена оружия', w / 2, h - 150 * s, 14 * s, '#b8c8ff', 'center', '700');
    ctx.globalAlpha = 1;
  }
}
