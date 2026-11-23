'use strict';

/* ============================================================
   menu.js — выбор сложности и оружия на стартовом экране
   ============================================================ */
class Menu {
  constructor(game) {
    this.game = game;
    this.modeList = document.getElementById('mode-list');
    this.modeDesc = document.getElementById('mode-desc');
    this.bossSection = document.getElementById('boss-section');
    this.loadout = document.getElementById('loadout-line');
    this.startBtn = document.getElementById('btn-start');
    this.bossList = document.getElementById('boss-list');
    this.bossDesc = document.getElementById('boss-desc');
    this.title = document.getElementById('title');
    this.diffList = document.getElementById('diff-list');
    this.diffDesc = document.getElementById('diff-desc');
    this.weaponList = document.getElementById('weapon-list');
    this.buildModes();
    this.buildBosses();
    this.buildDifficulties();
    this.buildWeapons();
    this.refresh();
    game.onMenu = () => this.refresh();

    // цифры 1-4 выбирают оружие, пока открыто меню
    window.addEventListener('keydown', (e) => {
      if (game.state !== 'menu' || e.repeat) return;
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (m && CFG.WEAPONS[+m[1] - 1]) this.selectWeapon(CFG.WEAPONS[+m[1] - 1].id);
    });
  }

  buildModes() {
    for (const m of CFG.MODES) {
      const b = document.createElement('button');
      b.className = 'choice boss';
      b.dataset.id = m.id;
      b.style.setProperty('--c', m.color);
      b.innerHTML = '<strong>' + m.name + '</strong><span>' + m.tag + '</span>';
      b.addEventListener('click', () => { this.selectMode(m.id); b.blur(); });
      this.modeList.appendChild(b);
    }
  }

  buildBosses() {
    for (const bs of CFG.BOSSES) {
      const b = document.createElement('button');
      b.className = 'choice boss';
      b.dataset.id = bs.id;
      b.style.setProperty('--c', bs.color);
      b.innerHTML = '<strong>' + bs.name + '</strong><span>' + bs.tag + '</span>';
      b.addEventListener('click', () => { this.selectBoss(bs.id); b.blur(); });
      this.bossList.appendChild(b);
    }
  }

  buildDifficulties() {
    for (const d of CFG.DIFFS) {
      const b = document.createElement('button');
      b.className = 'choice';
      b.dataset.id = d.id;
      b.style.setProperty('--c', d.color);
      b.textContent = d.name;
      b.addEventListener('click', () => { this.selectDiff(d.id); b.blur(); });
      this.diffList.appendChild(b);
    }
  }

  buildWeapons() {
    const labels = ['УРОН', 'ТЕМП', 'ПРОЩЕНИЕ'];
    CFG.WEAPONS.forEach((w, i) => {
      const c = document.createElement('button');
      c.className = 'card';
      c.dataset.id = w.id;
      c.style.setProperty('--c', w.color);
      let bars = '';
      for (let k = 0; k < 3; k++) {
        let seg = '';
        for (let n = 1; n <= 5; n++) seg += '<i' + (n <= w.ratings[k] ? ' class="on"' : '') + '></i>';
        bars += '<div class="bar"><em>' + labels[k] + '</em><div>' + seg + '</div></div>';
      }
      c.innerHTML = '<span class="key">' + (i + 1) + '</span><strong>' + w.name + '</strong><u>' + w.tag + '</u><p>' + w.desc + '</p>' + bars;
      c.addEventListener('click', () => { this.selectWeapon(w.id); c.blur(); });
      this.weaponList.appendChild(c);
    });
  }

  selectMode(id) { this.game.sel.mode = id; this.game.saveSelection(); this.refresh(); }
  selectBoss(id) { this.game.sel.boss = id; this.game.saveSelection(); this.refresh(); }
  selectDiff(id) { this.game.sel.diff = id; this.game.saveSelection(); this.refresh(); }
  selectWeapon(id) { this.game.sel.weapon = id; this.game.saveSelection(); this.refresh(); }

  refresh() {
    const sel = this.game.sel;
    const bs = CFG.BOSSES.find(x => x.id === sel.boss) || CFG.BOSSES[0];
    for (const el of this.bossList.children) el.classList.toggle('active', el.dataset.id === sel.boss);
    const mode = CFG.MODES.find(x => x.id === sel.mode) || CFG.MODES[0], endless = mode.id === 'endless';
    for (const el of this.modeList.children) el.classList.toggle('active', el.dataset.id === mode.id);
    this.bossSection.classList.toggle('hidden', endless);
    const best = this.game.inventory.best;
    this.modeDesc.innerHTML = mode.desc + (endless ? '<br><span>Рекорд: волна ' + best.endlessWave + ' • ' + fmtNum(best.endlessScore) + ' очков</span>' : '');
    this.modeDesc.style.setProperty('--c', mode.color);
    this.startBtn.textContent = endless ? 'НАЧАТЬ ЗАБЕГ' : 'НАЧАТЬ БИТВУ';
    this.refreshLoadout();
    this.bossDesc.textContent = bs.desc;
    this.bossDesc.style.setProperty('--c', bs.color);
    for (const el of this.diffList.children) el.classList.toggle('active', el.dataset.id === sel.diff);
    for (const el of this.weaponList.children) el.classList.toggle('active', el.dataset.id === sel.weapon);
    const d = this.game.diffById(sel.diff);
    const pct = (v) => (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + '%';
    this.diffDesc.innerHTML = d.desc +
      '<br><span>HP босса ' + pct(d.bossHp) + ' • урон по тебе ' + pct(d.dmg) + ' • скорость босса ' + pct(d.speed) +
      ' • твоё HP ' + Math.round(CFG.PLAYER.hp * d.playerHp) + '</span>';
    this.diffDesc.style.setProperty('--c', d.color);
  }

  /* подсказки по управлению: клавиатура или сенсор */
  refreshControls() {
    const touch = this.game.touch && this.game.touch.enabled;
    document.getElementById('controls').innerHTML = touch
      ? '<span><b>Левая половина</b> стик полёта</span><span><b>Правая</b> огонь / прицел</span><span><b>NOVA</b> спецспособность</span><span><b>БУСТ</b> ускорение</span><span><b>Кнопки</b> расходники и оружие</span>'
      : '<span><b>A/D W/S</b> полёт</span><span><b>Shift</b> ускорение</span><span><b>ЛКМ</b> огонь</span><span><b>ПКМ</b> Stellar Nova</span><span><b>Q E R F</b> расходники</span><span><b>I</b> инвентарь</span><span><b>Esc</b> пауза</span><span><b>M</b> звук</span>';
    document.getElementById('wpn-hint').textContent = touch ? '(в бою — кнопка на экране)' : '(в бою можно менять клавишами 1–4)';
  }

  /* строка «Экипировка» над кнопкой старта */
  refreshLoadout() {
    const inv = this.game.inventory, ids = inv.equip.filter(Boolean);
    this.loadout.innerHTML = 'Экипировка: ' + (ids.length ? ids.map(id => { const it = ITEM[id]; return '<span class="loot" style="--c:' + itemColor(it) + '">' + it.glyph + ' ' + it.name + '</span>'; }).join(' ') : '<span class="none">аксессуары не надеты — открой ангар</span>');
  }
}
