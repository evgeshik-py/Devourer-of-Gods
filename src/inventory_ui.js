'use strict';

/* ============================================================
   inventory_ui.js — экран инвентаря (DOM). Две обстановки:
   'hangar' — из меню: можно надевать/снимать аксессуары;
   'battle' — из боя (игра на паузе): можно применять расходники.
   Вся логика предметов — в items.js (Inventory), здесь только отображение и клики.
   ============================================================ */
class InventoryUI {
  constructor(game) {
    this.game = game; this.inv = game.inventory;
    this.mode = 'hangar'; this.sel = null; this.msg = '';
    this.el = {
      ctx: document.getElementById('inv-context'), equip: document.getElementById('equip-slots'), mods: document.getElementById('mods-sum'),
      grid: document.getElementById('inv-grid'), count: document.getElementById('inv-count'), detail: document.getElementById('inv-detail'),
      msg: document.getElementById('inv-msg')
    };
    this.inv.onChange = () => { if (game.inventoryOpen()) this.render(); };   // не перерисовываем скрытый экран
    document.getElementById('inv-panel').addEventListener('click', (e) => this.onClick(e));
  }

  open(mode) {
    this.mode = mode; this.sel = null; this.msg = '';
    this.render();
  }

  itemOf(sel) {
    if (!sel) return null;
    if (sel.t === 'slot') { const s = this.inv.slots[sel.i]; return s ? { it: ITEM[s.id], n: s.n } : null; }
    const id = this.inv.equip[sel.i]; return id ? { it: ITEM[id], n: 1 } : null;
  }

  tile(it, n, selected, attrs) {
    const c = itemColor(it);
    return '<button class="tile' + (selected ? ' sel' : '') + '" style="--c:' + c + '" ' + attrs + ' title="' + it.name + '">' +
      '<span class="g">' + it.glyph + '</span>' + (n > 1 ? '<span class="n">' + n + '</span>' : '') +
      (it.type === 'consumable' ? '<span class="k">' + it.keyLabel + '</span>' : '') + '</button>';
  }

  render() {
    const inv = this.inv, E = this.el, battle = this.mode === 'battle';
    E.ctx.textContent = battle ? '// ПОЛЕВОЙ ИНВЕНТАРЬ — БОЙ НА ПАУЗЕ, ВРЕМЯ НЕ ИДЁТ' : '// АНГАР — ПОДГОТОВКА СНАРЯЖЕНИЯ';

    // слоты экипировки
    let h = '';
    for (let i = 0; i < EQUIP_SLOTS; i++) {
      const id = inv.equip[i];
      const selected = this.sel && this.sel.t === 'eq' && this.sel.i === i;
      h += id ? this.tile(ITEM[id], 1, selected, 'data-eq="' + i + '"')
              : '<button class="tile empty' + (selected ? ' sel' : '') + '" data-eq="' + i + '"><span class="g">+</span></button>';
    }
    E.equip.innerHTML = h;

    // суммарные бонусы
    const m = inv.mods(), lines = describeMods(m), diff = this.game.diffById(this.game.sel.diff);
    const hp = Math.max(50, Math.round(CFG.PLAYER.hp * diff.playerHp * (1 + m.hp)));
    E.mods.innerHTML = '<div>Макс. корпус: <span>' + hp + '</span></div>' + (lines.length ? lines.map(l => '<div>' + l + '</div>').join('') : '<div class="none">Аксессуары не надеты</div>');

    // рюкзак
    h = '';
    for (let i = 0; i < inv.size; i++) {
      const s = inv.slots[i], selected = this.sel && this.sel.t === 'slot' && this.sel.i === i;
      h += s ? this.tile(ITEM[s.id], s.n, selected, 'data-slot="' + i + '"') : '<button class="tile empty' + (selected ? ' sel' : '') + '" data-slot="' + i + '"></button>';
    }
    E.grid.innerHTML = h;
    E.count.textContent = '(' + (inv.size - inv.freeSlots()) + '/' + inv.size + ')';

    // описание выбранного
    const cur = this.itemOf(this.sel);
    if (!cur) {
      E.detail.innerHTML = '<p class="none">Выбери предмет в рюкзаке или в слоте экипировки.</p>' +
        '<p class="hint">Расходники (Q E R F) применяются в бою. Аксессуары надеваются в ангаре — до 3 одновременно.</p>';
    } else {
      const it = cur.it, c = itemColor(it), acc = it.type === 'accessory';
      let d = '<div class="dn" style="--c:' + c + '"><span class="g">' + it.glyph + '</span>' + it.name + '</div>' +
        '<div class="dr" style="--c:' + c + '">' + (acc ? RARITY[it.rarity].name + ' АКСЕССУАР' : 'РАСХОДНИК • клавиша ' + it.keyLabel) + '</div>' +
        '<p>' + it.desc + '</p>';
      if (acc) d += '<div class="dm">' + describeMods(it.mods).map(l => '<div>' + l + '</div>').join('') + '</div>';
      d += '<div class="acts">';
      if (this.sel.t === 'eq') {
        d += battle ? '<p class="hint">Смена экипировки доступна только в ангаре.</p>' : '<button data-act="unequip">СНЯТЬ</button>';
      } else if (acc) {
        if (battle) d += '<p class="hint">Смена экипировки доступна только в ангаре.</p>';
        else for (let i = 0; i < EQUIP_SLOTS; i++) d += '<button data-act="equip" data-to="' + i + '">НАДЕТЬ В СЛОТ ' + (i + 1) + '</button>';
      } else {
        d += battle ? '<button data-act="use" class="go">ИСПОЛЬЗОВАТЬ</button>' : '<p class="hint">Расходники применяются в бою.</p>';
      }
      if (this.sel.t === 'slot') d += '<button data-act="drop" class="ghost">ВЫБРОСИТЬ' + (cur.n > 1 ? ' СТАК' : '') + '</button>';
      d += '</div>';
      E.detail.innerHTML = d;
    }
    E.msg.textContent = this.msg;
    if (this.game.menu) this.game.menu.refreshLoadout();
  }

  say(s) { this.msg = s; this.el.msg.textContent = s; }

  onClick(e) {
    const t = e.target.closest('[data-slot],[data-eq],[data-act]');
    if (!t) return;
    const inv = this.inv;
    if (t.dataset.act) {
      const act = t.dataset.act, sel = this.sel;
      if (!sel) return;
      let r = true;
      if (act === 'equip') r = inv.equipFrom(sel.i, +t.dataset.to);
      else if (act === 'unequip') r = inv.unequip(sel.i);
      else if (act === 'drop') { inv.discard(sel.i); r = true; }
      else if (act === 'use') {
        const s = inv.slots[sel.i], p = this.game.player;
        if (s) { p.useCd = 0; r = p.useItem(s.id) ? true : 'Сейчас не требуется'; }
      }
      if (act === 'equip' || act === 'unequip' || act === 'drop') this.sel = null;
      this.msg = r === true ? '' : r;
      this.render();
      return;
    }
    this.sel = t.dataset.slot !== undefined ? { t: 'slot', i: +t.dataset.slot } : { t: 'eq', i: +t.dataset.eq };
    if (!this.itemOf(this.sel)) this.sel = null;
    this.msg = '';
    this.render();
  }
}
