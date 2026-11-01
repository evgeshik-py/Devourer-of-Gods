'use strict';

/* ============================================================
   menu.js — выбор сложности и оружия на стартовом экране
   ============================================================ */
class Menu {
  constructor(game) {
    this.game = game;
    this.bossList = document.getElementById('boss-list');
    this.bossDesc = document.getElementById('boss-desc');
    this.title = document.getElementById('title');
    this.diffList = document.getElementById('diff-list');
    this.diffDesc = document.getElementById('diff-desc');
    this.weaponList = document.getElementById('weapon-list');
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

  selectBoss(id) { this.game.sel.boss = id; this.game.saveSelection(); this.refresh(); }
  selectDiff(id) { this.game.sel.diff = id; this.game.saveSelection(); this.refresh(); }
  selectWeapon(id) { this.game.sel.weapon = id; this.game.saveSelection(); this.refresh(); }

  refresh() {
    const sel = this.game.sel;
    const bs = CFG.BOSSES.find(x => x.id === sel.boss) || CFG.BOSSES[0];
    for (const el of this.bossList.children) el.classList.toggle('active', el.dataset.id === sel.boss);
    this.title.textContent = bs.name;
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
}
