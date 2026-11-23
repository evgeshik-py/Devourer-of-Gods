'use strict';

/* ============================================================
   touch.js — сенсорное управление для телефонов и планшетов (ландшафт)

   Левая половина экрана: плавающий стик движения.
   Правая половина: удержание = огонь. Лёгкое касание без сдвига — автонаведение
   на ближайшую часть босса; сдвиг стика — ручное наведение.
   Кнопки: Nova, Ускорение (переключатель), смена оружия, расходники Q/E/R/F, пауза, инвентарь.
   Бой/механики не упрощаются: всё то же, что и на клавиатуре.
   ============================================================ */
class Touch {
  constructor(game) {
    this.g = game;
    this.enabled = false;
    this.visible = false;
    this.mv = { id: -1, ox: 0, oy: 0 };
    this.am = { id: -1, ox: 0, oy: 0 };
    this.acc = 0;
    const mq = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
    this.build();
    if ((mq && mq.matches) || /[?&]touch=1/.test(location.search)) this.enable();
    // гибриды: включаем при первом реальном касании
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !this.enabled) this.enable(); }, { passive: true });
    // запрет масштабирования щипком (iOS) и прокрутки во время игры
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    // в игре страница не скроллится; прокрутка разрешена только внутри экранов меню
    document.addEventListener('touchmove', (e) => { if (!(e.target.closest && e.target.closest('.screen'))) e.preventDefault(); }, { passive: false });
  }

  enable() {
    this.enabled = true;
    this.g.input.touchMode = true;
    document.documentElement.classList.add('is-touch');
    if (this.g.dprCap) this.g.resize();
    this.g.menu && this.g.menu.refreshControls && this.g.menu.refreshControls();
  }

  el(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    (parent || this.root).appendChild(e);
    return e;
  }

  build() {
    const root = this.root = document.createElement('div');
    root.id = 'touch'; root.className = 'hidden';
    document.body.insertBefore(root, document.getElementById('overlay'));

    this.zl = this.el('div', 'tzone left'); this.zr = this.el('div', 'tzone right');
    this.sl = this.el('div', 'stick hidden', null, '<i></i>'); this.sr = this.el('div', 'stick aim hidden', null, '<i></i>');
    this.bind(this.zl, this.mv, false);
    this.bind(this.zr, this.am, true);

    const btn = (cls, html, fn, hold) => {
      const b = this.el('button', 'tb ' + cls, null, html);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(e, b); });
      return b;
    };
    const inp = this.g.input;
    this.bPause = btn('pause', 'II', () => this.g.pause());
    this.bInv = btn('inv', 'ИНВ', () => this.g.openInventory());
    this.bWpn = btn('wpn', '1', () => { const n = CFG.WEAPONS.length, cur = this.g.player.weaponIdx; inp.pressed['Digit' + (((cur + 1) % n) + 1)] = true; });
    this.bNova = btn('nova', 'NOVA', () => { inp.mouse.rightPressed = true; });
    this.bBoost = btn('boost', 'БУСТ', (e, b) => { inp.touchBoost = !inp.touchBoost; b.classList.toggle('on', inp.touchBoost); });
    this.cons = {};
    for (const it of ITEMS) {
      if (it.type !== 'consumable') continue;
      const b = btn('cons', '<u>' + it.glyph + '</u><em>0</em>', () => { inp.pressed[it.key] = true; });
      b.style.setProperty('--c', it.color);
      this.cons[it.id] = b;
    }
  }

  bind(zone, st, isAim) {
    const inp = this.g.input;
    const R = () => Math.max(38, Math.min(72, window.innerHeight * 0.15));
    const base = isAim ? this.sr : this.sl;
    zone.addEventListener('pointerdown', (e) => {
      if (st.id !== -1) return;
      e.preventDefault();
      st.id = e.pointerId; st.ox = e.clientX; st.oy = e.clientY;
      try { zone.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      base.classList.remove('hidden');
      base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px';
      base.firstChild.style.transform = 'translate(0px,0px)';
      if (isAim) { inp.touchFire = true; inp.touchAimStick = false; } else { inp.touchMove.x = 0; inp.touchMove.y = 0; inp.touchMove.on = true; }
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== st.id) return;
      e.preventDefault();
      const r = R();
      let dx = e.clientX - st.ox, dy = e.clientY - st.oy;
      const d = Math.hypot(dx, dy);
      const k = d > r ? r / d : 1;
      const kx = dx * k, ky = dy * k;
      base.firstChild.style.transform = 'translate(' + kx.toFixed(1) + 'px,' + ky.toFixed(1) + 'px)';
      if (isAim) {
        if (d > r * 0.3) { inp.touchAimStick = true; inp.touchAim = Math.atan2(dy, dx); }
        else inp.touchAimStick = false;
      } else {
        inp.touchMove.x = kx / r; inp.touchMove.y = ky / r;
      }
    });
    const end = (e) => {
      if (e.pointerId !== st.id) return;
      st.id = -1;
      base.classList.add('hidden');
      if (isAim) { inp.touchFire = false; inp.touchAimStick = false; }
      else { inp.touchMove.x = 0; inp.touchMove.y = 0; inp.touchMove.on = false; }
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  }

  reset() {
    const inp = this.g.input;
    this.mv.id = -1; this.am.id = -1;
    inp.touchMove.x = 0; inp.touchMove.y = 0; inp.touchMove.on = false;
    inp.touchFire = false; inp.touchAimStick = false; inp.touchBoost = false;
    this.bBoost.classList.remove('on');
    this.sl.classList.add('hidden'); this.sr.classList.add('hidden');
  }

  /* вызывается из игрового цикла каждый кадр (дёшево): видимость и редкое обновление подписей */
  sync(dt) {
    if (!this.enabled) return;
    const show = this.g.state === 'playing';
    if (show !== this.visible) {
      this.visible = show;
      this.root.classList.toggle('hidden', !show);
      if (!show) this.reset();
    }
    if (!show) return;
    this.acc += dt;
    if (this.acc < 0.12) return;
    this.acc = 0;
    const g = this.g, p = g.player;
    const w = CFG.WEAPONS[p.weaponIdx];
    const wl = (p.weaponIdx + 1) + ' ' + w.short;
    if (this.bWpn.textContent !== wl) { this.bWpn.textContent = wl; this.bWpn.style.setProperty('--c', w.color); }
    const ready = p.charge >= 100;
    this.bNova.style.setProperty('--ch', Math.floor(p.charge) + '%');
    this.bNova.classList.toggle('ready', ready);
    for (const it of ITEMS) {
      const b = this.cons[it.id]; if (!b) continue;
      const n = g.inventory.count(it.id), em = b.lastChild;
      const t = String(n);
      if (em.textContent !== t) { em.textContent = t; b.classList.toggle('empty', n <= 0); }
    }
  }
}
