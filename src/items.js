'use strict';

/* ============================================================
   items.js — предметы, инвентарь, аксессуары, трофеи (TerraBattle)
   Данные предметов — только здесь. Логика экипировки не зависит от отрисовки.
   ============================================================ */

const RARITY = {
  common: { name: 'ОБЫЧНЫЙ', color: '#9fb4c8', weight: 60 },
  rare:   { name: 'РЕДКИЙ', color: '#35e0ff', weight: 30 },
  epic:   { name: 'ЭПИЧЕСКИЙ', color: '#c06bff', weight: 10 }
};

/* mods — вклад аксессуара. Суммируются по всем надетым.
   dmg/rate/hp/speed/novaRate/dr/loot/magnet — доли; leech — доля нанесённого урона, возвращаемая в корпус;
   pierce — доп. цели, которые пробивает снаряд; aegis — перезарядка щита в секундах (0 = нет). */
const ITEMS = [
  /* ---- расходники (горячие клавиши в бою) ---- */
  { id: 'repair', type: 'consumable', name: 'РЕМОНТНЫЙ НАБОР', glyph: '✚', color: '#4dff8a', key: 'KeyQ', keyLabel: 'Q', stack: 9,
    desc: 'Мгновенно восстанавливает 35% корпуса.' },
  { id: 'energy', type: 'consumable', name: 'ЭНЕРГОЯЧЕЙКА', glyph: '⚡', color: '#35e0ff', key: 'KeyE', keyLabel: 'E', stack: 9,
    desc: 'Добавляет 60% заряда Stellar Nova.' },
  { id: 'shield', type: 'consumable', name: 'ЯЧЕЙКА ЩИТА', glyph: '⬡', color: '#bfe9ff', key: 'KeyR', keyLabel: 'R', stack: 9,
    desc: '4 секунды полной неуязвимости.' },
  { id: 'overdrive', type: 'consumable', name: 'ОВЕРДРАЙВ', glyph: '≫', color: '#ffb040', key: 'KeyF', keyLabel: 'F', stack: 9,
    desc: '8 секунд: +35% скорострельность и +25% урон.' },

  /* ---- аксессуары (3 слота, надеваются в ангаре) ---- */
  { id: 'plasma_core', type: 'accessory', rarity: 'common', name: 'ПЛАЗМЕННОЕ ЯДРО', glyph: '◉', mods: { dmg: 0.12 },
    desc: '+12% к урону оружия.' },
  { id: 'overclock', type: 'accessory', rarity: 'common', name: 'РАЗГОННЫЙ ЧИП', glyph: '⟫', mods: { rate: 0.12 },
    desc: '+12% к скорострельности.' },
  { id: 'ablative', type: 'accessory', rarity: 'common', name: 'АБЛЯЦИОННАЯ БРОНЯ', glyph: '▣', mods: { hp: 0.2 },
    desc: '+20% к максимальному корпусу.' },
  { id: 'thrusters', type: 'accessory', rarity: 'common', name: 'ФОРСАЖНЫЕ ДЮЗЫ', glyph: '▲', mods: { speed: 0.12 },
    desc: '+12% к скорости полёта.' },
  { id: 'capacitor', type: 'accessory', rarity: 'rare', name: 'КОНДЕНСАТОР NOVA', glyph: '☄', mods: { novaRate: 0.5 },
    desc: 'Stellar Nova заряжается на 50% быстрее.' },
  { id: 'siphon', type: 'accessory', rarity: 'rare', name: 'ВАМПИРСКИЙ УЗЕЛ', glyph: '❖', mods: { leech: 0.01 },
    desc: '1% нанесённого урона возвращается в корпус.' },
  { id: 'aegis', type: 'accessory', rarity: 'rare', name: 'ЭГИДА', glyph: '⛨', mods: { aegis: 15 },
    desc: 'Поглощает один удар. Перезарядка 15 секунд.' },
  { id: 'piercer', type: 'accessory', rarity: 'rare', name: 'БРОНЕБОЙНЫЕ ЯДРА', glyph: '➤', mods: { pierce: 1 },
    desc: 'Снаряды пробивают на 1 цель больше (урон падает с каждой).' },
  { id: 'scavenger', type: 'accessory', rarity: 'rare', name: 'МАРОДЁРСКИЙ МОДУЛЬ', glyph: '⌖', mods: { loot: 0.5, magnet: 0.8 },
    desc: '+50% к шансу выпадения трофеев, магнит подбора сильнее.' },
  { id: 'reinforced', type: 'accessory', rarity: 'epic', name: 'УСИЛЕННЫЙ КАРКАС', glyph: '⬢', mods: { dr: 0.15 },
    desc: 'Входящий урон снижен на 15%.' },
  { id: 'reactor', type: 'accessory', rarity: 'epic', name: 'НЕСТАБИЛЬНЫЙ РЕАКТОР', glyph: '☢', mods: { dmg: 0.25, rate: 0.15, hp: -0.15 },
    desc: '+25% урона и +15% скорострельности, но −15% корпуса.' }
];
const ITEM = {};
for (const it of ITEMS) ITEM[it.id] = it;
const EQUIP_SLOTS = 3;

function itemColor(it) { return it.type === 'accessory' ? RARITY[it.rarity].color : it.color; }

/* строки с описанием суммарных бонусов (для панели ангара) */
function describeMods(m) {
  const out = [], pct = (v) => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
  if (m.dmg) out.push('Урон ' + pct(m.dmg));
  if (m.rate) out.push('Скорострельность ' + pct(m.rate));
  if (m.hp) out.push('Корпус ' + pct(m.hp));
  if (m.speed) out.push('Скорость ' + pct(m.speed));
  if (m.novaRate) out.push('Заряд Nova ' + pct(m.novaRate));
  if (m.leech) out.push('Вампиризм ' + (m.leech * 100).toFixed(1).replace(/\.0$/, '') + '%');
  if (m.pierce) out.push('Пробитие +' + m.pierce);
  if (m.dr) out.push('Входящий урон −' + Math.round(m.dr * 100) + '%');
  if (m.aegis) out.push('Эгида: щит раз в ' + m.aegis + ' с');
  if (m.loot) out.push('Трофеи ' + pct(m.loot));
  if (m.magnet) out.push('Магнит ' + pct(m.magnet));
  return out;
}

function emptyMods() { return { dmg: 0, rate: 0, hp: 0, speed: 0, novaRate: 0, leech: 0, pierce: 0, dr: 0, aegis: 0, loot: 0, magnet: 0 }; }
function sumMods(ids) {
  const m = emptyMods();
  for (const id of ids) {
    const it = ITEM[id];
    if (!it || it.type !== 'accessory') continue;
    for (const k in it.mods) m[k] += it.mods[k];
  }
  return m;
}

/* ============================================================
   Инвентарь: рюкзак (SIZE ячеек, расходники стакаются) + 3 слота аксессуаров.
   Хранится в localStorage; изменения сохраняются сразу.
   ============================================================ */
class Inventory {
  constructor() {
    this.size = 20;
    this.slots = new Array(this.size).fill(null);     // null | { id, n }
    this.equip = new Array(EQUIP_SLOTS).fill(null);   // null | id аксессуара
    this.best = { endlessWave: 0, endlessScore: 0 };
    this.onChange = null;
    if (!this.load()) { this.giveStarterKit(); this.save(); }
  }

  giveStarterKit() {
    this.slots.fill(null); this.equip.fill(null);
    this.add('repair', 3); this.add('energy', 2); this.add('shield', 1); this.add('overdrive', 1);
    this.add('overclock', 1); this.add('ablative', 1);
  }

  /* ---------- запросы ---------- */
  count(id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.n; return n; }
  owns(id) { return this.count(id) > 0 || this.equip.indexOf(id) >= 0; }
  freeSlots() { let n = 0; for (const s of this.slots) if (!s) n++; return n; }
  mods() { return sumMods(this.equip.filter(Boolean)); }

  /* ---------- изменения ---------- */
  /* добавить предмет; возвращает, сколько НЕ поместилось */
  add(id, n) {
    const it = ITEM[id]; if (!it) return n;
    n = n || 1;
    if (it.type === 'consumable') {
      for (const s of this.slots) {
        if (n <= 0) break;
        if (s && s.id === id && s.n < it.stack) { const k = Math.min(n, it.stack - s.n); s.n += k; n -= k; }
      }
      for (let i = 0; i < this.size && n > 0; i++) {
        if (!this.slots[i]) { const k = Math.min(n, it.stack); this.slots[i] = { id, n: k }; n -= k; }
      }
    } else {
      for (let i = 0; i < this.size && n > 0; i++) if (!this.slots[i]) { this.slots[i] = { id, n: 1 }; n--; }
    }
    this.changed();
    return n;
  }

  /* потратить один расходник; false, если нет */
  take(id) {
    for (let i = this.size - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) { s.n--; if (s.n <= 0) this.slots[i] = null; this.changed(); return true; }
    }
    return false;
  }

  /* надеть аксессуар из ячейки рюкзака в слот экипировки (с обменом); возвращает true/строку причины */
  equipFrom(slotIdx, eqIdx) {
    const s = this.slots[slotIdx];
    if (!s || ITEM[s.id].type !== 'accessory') return 'Это не аксессуар';
    if (eqIdx < 0 || eqIdx >= EQUIP_SLOTS) return 'Нет такого слота';
    if (this.equip.indexOf(s.id) >= 0 && this.equip[eqIdx] !== s.id) return 'Такой аксессуар уже надет';
    const old = this.equip[eqIdx];
    this.equip[eqIdx] = s.id;
    this.slots[slotIdx] = old ? { id: old, n: 1 } : null;
    this.changed();
    return true;
  }
  unequip(eqIdx) {
    const id = this.equip[eqIdx];
    if (!id) return 'Слот пуст';
    const free = this.slots.indexOf(null);
    if (free < 0) return 'Рюкзак полон';
    this.slots[free] = { id, n: 1 }; this.equip[eqIdx] = null;
    this.changed();
    return true;
  }
  discard(slotIdx) {
    if (!this.slots[slotIdx]) return false;
    this.slots[slotIdx] = null; this.changed();
    return true;
  }

  changed() { this.save(); if (this.onChange) this.onChange(); }

  /* ---------- сохранение ---------- */
  save() {
    try {
      localStorage.setItem('terrabattle_save', JSON.stringify({ v: 1, slots: this.slots, equip: this.equip, best: this.best }));
    } catch (e) { /* хранилище недоступно — играем без сохранения */ }
  }
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem('terrabattle_save') || 'null');
      if (!raw || raw.v !== 1 || !Array.isArray(raw.slots) || !Array.isArray(raw.equip)) return false;
      for (let i = 0; i < this.size; i++) {
        const s = raw.slots[i];
        this.slots[i] = s && ITEM[s.id] ? { id: s.id, n: clamp(s.n | 0, 1, ITEM[s.id].stack || 1) } : null;
      }
      for (let i = 0; i < EQUIP_SLOTS; i++) {
        const id = raw.equip[i];
        this.equip[i] = id && ITEM[id] && ITEM[id].type === 'accessory' && this.equip.indexOf(id) < 0 ? id : null;
      }
      if (raw.best) this.best = { endlessWave: raw.best.endlessWave | 0, endlessScore: raw.best.endlessScore | 0 };
      return true;
    } catch (e) { return false; }
  }
}

/* ============================================================
   Таблицы трофеев
   ============================================================ */
const Loot = {
  weighted(list) {
    let sum = 0; for (const e of list) sum += e[1];
    let r = Math.random() * sum;
    for (const e of list) { r -= e[1]; if (r <= 0) return e[0]; }
    return list[list.length - 1][0];
  },
  consumable() { return this.weighted([['repair', 40], ['energy', 28], ['shield', 17], ['overdrive', 15]]); },
  /* аксессуар нужной редкости; пытается дать то, чего ещё нет */
  accessory(inv, weights) {
    const w = weights || { common: 60, rare: 30, epic: 10 };
    let id = null;
    for (let t = 0; t < 4; t++) {
      const rar = this.weighted([['common', w.common], ['rare', w.rare], ['epic', w.epic]]);
      const pool = ITEMS.filter(i => i.type === 'accessory' && i.rarity === rar);
      id = pool[(Math.random() * pool.length) | 0].id;
      if (!inv || !inv.owns(id)) break;
    }
    return id;
  },
  /* награда за победу над боссом: 1 аксессуар + расходники */
  boss(inv) {
    const out = [{ id: this.accessory(inv, { common: 25, rare: 55, epic: 20 }), n: 1 }];
    for (let i = 0; i < 2; i++) out.push({ id: this.consumable(), n: 1 + ((Math.random() * 2) | 0) });
    return out;
  },
  /* выпадение с рядового врага (null — ничего) */
  drop(chance, lootMul) {
    if (Math.random() > chance * (1 + lootMul)) return null;
    return { id: this.consumable(), n: 1 };
  },
  /* выпадение с элитного врага */
  elite(inv) {
    if (Math.random() < 0.6) return [{ id: this.accessory(inv, { common: 30, rare: 50, epic: 20 }), n: 1 }, { id: this.consumable(), n: 1 }];
    return [{ id: this.consumable(), n: 2 }, { id: this.consumable(), n: 1 }];
  }
};

/* ============================================================
   Подбираемый предмет в мире: притягивается к игроку
   ============================================================ */
class Pickup {
  constructor(x, y, id, n) {
    this.x = x; this.y = y; this.id = id; this.n = n || 1;
    const a = rand(0, TAU), v = rand(60, 220);
    this.vx = Math.cos(a) * v; this.vy = Math.sin(a) * v;
    this.age = 0; this.life = 30; this.dead = false; this.stuck = 0;
  }
  update(dt, g) {
    this.age += dt; this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const p = g.player, d = dist(this.x, this.y, p.x, p.y);
    const range = 170 * (1 + (p.mods ? p.mods.magnet : 0));
    if (!p.dead && this.age > 0.35 && d < range) {
      const k = 1 - d / range, sp = 300 + 1100 * k * k;
      this.vx = damp(this.vx, (p.x - this.x) / (d || 1) * sp, 9, dt);
      this.vy = damp(this.vy, (p.y - this.y) / (d || 1) * sp, 9, dt);
    } else { this.vx *= 1 - 2.4 * dt; this.vy *= 1 - 2.4 * dt; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    const A = CFG.ARENA;
    this.x = clamp(this.x, 30, A.w - 30); this.y = clamp(this.y, 30, A.h - 30);
    if (!p.dead && d < p.radius + 22 && this.age > 0.25) this.collect(g);
  }
  collect(g) {
    const it = ITEM[this.id], left = g.inventory.add(this.id, this.n);
    const got = this.n - left;
    if (got > 0) {
      g.effects.text(this.x, this.y - 24, '+' + got + ' ' + it.name, itemColor(it), 17);
      g.particles.burst(this.x, this.y, 12, 40, 220, 0.5, 5, itemColor(it));
      g.audio.ready();
      g.stats.loot = (g.stats.loot || []); g.stats.loot.push({ id: this.id, n: got });
    }
    if (left <= 0) this.dead = true;
    else if (got === 0 && g.time - (this.warnT || -9) > 2) { this.warnT = g.time; g.effects.text(this.x, this.y - 24, 'РЮКЗАК ПОЛОН', '#ff6f8f', 16); }
  }
  render(ctx, t) {
    const it = ITEM[this.id], c = itemColor(it);
    const blink = this.life < 5 && Math.sin(t * 20) > 0 ? 0.35 : 1;
    const bob = Math.sin(t * 4 + this.x) * 3;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, c, this.x, this.y + bob, 34, 0.55);
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(this.x, this.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(4,10,16,0.92)'; ctx.strokeStyle = c; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(-11, -11, 22, 22); ctx.fill(); ctx.stroke();
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = c; ctx.font = '700 15px ' + CFG.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(it.glyph, 0, 1);
    ctx.restore();
  }
}
