'use strict';

/* ============================================================
   DEVOURER OF GODS — глобальная конфигурация
   ============================================================ */
const CFG = {
  VIEW_H: 980,                         // высота видимой области в мировых единицах
  ARENA: { w: 4600, h: 2900 },         // игровая зона игрока
  BOSS_MARGIN: 800,                    // насколько далеко босс может выходить за арену
  MAX_DT: 1 / 30,
  MAX_PARTICLES: 2400,
  MAX_PROJECTILES: 380,
  MAX_BULLETS: 140,
  WARN: '#ff3d71',                     // цвет предупреждений об опасности
  SAFE: '#6dffd8',                     // цвет безопасных зон
  FONT: '"Segoe UI", "Trebuchet MS", Arial, sans-serif',

  PLAYER: {
    hp: 500, radius: 12,
    accel: 2100, boostAccel: 1.35, drag: 2.3,
    maxSpeed: 540, boostSpeed: 860,
    iframes: 1.0,
    fireDelay: 0.085, bulletSpeed: 1900, bulletDamage: 22, bulletLife: 1.15, spread: 0.022,
    specialCooldown: 18, specialRadius: 1050, specialDamage: 110, specialGainPerHit: 0.55,
    phaseHeal: 100
  },

  BOSS: {
    name: 'DEVOURER OF GODS',
    hp: 24000,
    bodyCount: 44,
    spacing: 46,
    headRadius: 46, bodyRadius: 33, tailRadius: 22,
    headMult: 1.6, bodyMult: 0.8, tailMult: 0.55,
    contact: { head: 100, body: 62, tail: 40 },
    transitionTime: 3.4
  },

  /* ---------------- СЛОЖНОСТЬ ----------------
     bossHp — множитель здоровья босса; dmg — урон по игроку; speed — скорость и поворот босса;
     time — длительность предупреждений и пауз (меньше = быстрее и злее);
     playerHp — множитель здоровья игрока; iframes — неуязвимость после удара;
     heal — лечение при смене фазы; count — добавка к числу снарядов в залпе */
  DIFFS: [
    { id: 'easy', name: 'КАДЕТ', color: '#6dffb0', desc: 'Для знакомства с боссом. Предупреждения долгие, урон мал, босс медленнее.',
      bossHp: 0.7, dmg: 0.6, speed: 0.85, time: 1.3, playerHp: 1.2, iframes: 1.3, heal: 1.5, count: -2 },
    { id: 'normal', name: 'ПИЛОТ', color: '#6df0ff', desc: 'Задуманный баланс. Честная и напряжённая битва.',
      bossHp: 1, dmg: 1, speed: 1, time: 1, playerHp: 1, iframes: 1, heal: 1, count: 0 },
    { id: 'hard', name: 'ВЕТЕРАН', color: '#ffb040', desc: 'Босс быстрее и прочнее, удары болезненнее, времени на реакцию меньше.',
      bossHp: 1.3, dmg: 1.45, speed: 1.12, time: 0.85, playerHp: 1, iframes: 0.85, heal: 0.7, count: 1 },
    { id: 'nightmare', name: 'ГОДСЛЕЕР', color: '#ff3d71', desc: 'Кошмар. Почти нет права на ошибку: два удара — и тебя нет.',
      bossHp: 1.6, dmg: 2.1, speed: 1.25, time: 0.72, playerHp: 0.9, iframes: 0.7, heal: 0.3, count: 2 }
  ],

  /* ---------------- ОРУЖИЕ ----------------
     delay — пауза между выстрелами; pellets/cone — число снарядов и угол веера;
     pierce — сколько целей пробивает; falloff — потеря урона на каждой пробитой цели;
     homing — скорость самонаведения (рад/с); alt — чередующийся разворот ствола;
     gain — заряд Nova за попадание; ratings — оценки для меню (1..5) */
  WEAPONS: [
    { id: 'pulse', name: 'PULSE BLASTER', short: 'PULSE', tag: 'Скорострельный', color: '#58e6ff', core: '#d8fdff',
      desc: 'Плотный поток плазмы. Надёжен на любой дистанции.',
      delay: 0.085, dmg: 22, speed: 1900, life: 1.15, spread: 0.022, pellets: 1, cone: 0, pierce: 1, falloff: 1,
      homing: 0, alt: 0, recoil: 0, gain: 0.55, len: 22, w: 4, r: 5, ratings: [3, 5, 3] },
    { id: 'scatter', name: 'NEBULA SCATTER', short: 'SCATTER', tag: 'Дробовик', color: '#ff9bf2', core: '#fff0fc',
      desc: 'Веер из семи зарядов. Страшен вблизи, особенно по телу червя.',
      delay: 0.42, dmg: 13, speed: 1550, life: 0.62, spread: 0.05, pellets: 7, cone: 0.6, pierce: 1, falloff: 1,
      homing: 0, alt: 0, recoil: 190, gain: 0.3, len: 14, w: 5, r: 5, ratings: [4, 2, 4] },
    { id: 'lance', name: 'VOID LANCE', short: 'LANCE', tag: 'Рейлган', color: '#ffd86b', core: '#ffffff',
      desc: 'Редкий, но сокрушительный выстрел. Пробивает до трёх сегментов подряд.',
      delay: 0.62, dmg: 105, speed: 3400, life: 0.9, spread: 0, pellets: 1, cone: 0, pierce: 3, falloff: 0.65,
      homing: 0, alt: 0, recoil: 260, gain: 2.2, len: 90, w: 7, r: 8, ratings: [5, 1, 1] },
    { id: 'seeker', name: 'STAR SEEKER', short: 'SEEKER', tag: 'Самонаведение', color: '#9aff8f', core: '#f0ffe8',
      desc: 'Ракеты сами ищут цель. Слабее по урону, зато почти не промахиваются.',
      delay: 0.11, dmg: 20, speed: 1100, life: 1.9, spread: 0.05, pellets: 1, cone: 0, pierce: 1, falloff: 1,
      homing: 6.5, alt: 0.55, recoil: 0, gain: 0.35, len: 16, w: 5, r: 6, ratings: [2, 4, 5] }
  ],

  /* ---------------- ФАЗЫ ---------------- */
  PHASES: [
    {
      name: 'AWAKENING', roman: 'I', to: 0.75,
      idleSpeed: 360, idleTurn: 1.3, idleRadius: 460, idleTime: 1.5, contactMult: 1.0,
      dashSpeed: 1000, dashWindup: 1.15, dashLock: 0.42, rush: 3,
      projSpeed: 440, projCount: 5, volleys: 3, projDmg: 34,
      sweepSpeed: 800, sweepSpan: 3.3, sweepCount: 1,
      rainWaves: 3, rainWarn: 0.95, rainSpeed: 820, rainDmg: 40, rainTilt: 0,
      portalOpen: 1.6,
      beamTime: 1.3, beamAim: 1.4, beamWidth: 70, beamTurn: 0.42, beamDmg: 50, beamOffsets: [0],
      comboChance: 0, combos: [],
      pool: { dash: 3, projectiles: 3, sweep: 2 }
    },
    {
      name: 'HUNT', roman: 'II', to: 0.5,
      idleSpeed: 540, idleTurn: 1.9, idleRadius: 330, idleTime: 1.0, contactMult: 1.1,
      dashSpeed: 1250, dashWindup: 0.9, dashLock: 0.38, rush: 3,
      projSpeed: 520, projCount: 7, volleys: 3, projDmg: 38,
      sweepSpeed: 950, sweepSpan: 3.4, sweepCount: 1,
      rainWaves: 3, rainWarn: 0.85, rainSpeed: 880, rainDmg: 44, rainTilt: 0,
      portalOpen: 1.35,
      beamTime: 1.4, beamAim: 1.25, beamWidth: 76, beamTurn: 0.5, beamDmg: 55, beamOffsets: [0],
      comboChance: 0.2, combos: [['projectiles', 'dash'], ['rain', 'dash']],
      pool: { dash: 3, projectiles: 3, sweep: 2, rain: 3, portal: 2 }
    },
    {
      name: 'DEVOURING', roman: 'III', to: 0.25,
      idleSpeed: 700, idleTurn: 2.3, idleRadius: 260, idleTime: 0.7, contactMult: 1.25,
      dashSpeed: 1450, dashWindup: 0.7, dashLock: 0.34, rush: 4,
      projSpeed: 600, projCount: 9, volleys: 4, projDmg: 42,
      sweepSpeed: 1100, sweepSpan: 3.5, sweepCount: 2,
      rainWaves: 4, rainWarn: 0.75, rainSpeed: 960, rainDmg: 48, rainTilt: 0,
      portalOpen: 1.15,
      beamTime: 1.5, beamAim: 1.1, beamWidth: 82, beamTurn: 0.6, beamDmg: 60, beamOffsets: [0],
      comboChance: 0.45,
      combos: [['projectiles', 'dash'], ['rain', 'rush'], ['portal', 'beam'], ['sweep', 'projectiles', 'dash'], ['beam', 'rush']],
      pool: { dash: 2, projectiles: 2, sweep: 2, rain: 2, portal: 2, beam: 3, rush: 3 }
    },
    {
      name: 'GODSLAYER', roman: 'IV', to: 0,
      idleSpeed: 840, idleTurn: 2.7, idleRadius: 230, idleTime: 0.45, contactMult: 1.4,
      dashSpeed: 1700, dashWindup: 0.55, dashLock: 0.3, rush: 5,
      projSpeed: 700, projCount: 11, volleys: 5, projDmg: 48,
      sweepSpeed: 1300, sweepSpan: 3.6, sweepCount: 2,
      rainWaves: 5, rainWarn: 0.65, rainSpeed: 1050, rainDmg: 54, rainTilt: 0.26,
      portalOpen: 0.95,
      beamTime: 1.8, beamAim: 0.95, beamWidth: 90, beamTurn: 0.75, beamDmg: 70, beamOffsets: [-0.42, 0, 0.42],
      comboChance: 0.6,
      combos: [['projectiles', 'dash'], ['rain', 'rush'], ['portal', 'beam'], ['sweep', 'projectiles', 'dash'],
               ['beam', 'rush'], ['rain', 'portal', 'rush'], ['beam', 'sweep', 'rush'], ['portal', 'projectiles', 'beam']],
      pool: { dash: 2, projectiles: 2, sweep: 2, rain: 2, portal: 2, beam: 2, rush: 3, final: 0.6 }
    }
  ],

  /* ---------------- ПАЛИТРЫ (по фазам) ---------------- */
  PALETTES: [
    { base: '#241459', mid: '#5a3bc8', light: '#a98aff', glow: '#9a6bff', eye: '#7ffbff', accent: '#3be3ff',
      bgTop: '#03010c', bgBot: '#0b0626',
      stars: ['#cfd8ff', '#aee4ff', '#e0c8ff'], nebula: ['#4b2fd6', '#1f7fe0', '#8a2fd0'] },
    { base: '#0a2850', mid: '#1f70d8', light: '#6fd2ff', glow: '#4fe6ff', eye: '#c4ffe9', accent: '#6dffd8',
      bgTop: '#010712', bgBot: '#04193a',
      stars: ['#c0f0ff', '#9ad8ff', '#d8fff4'], nebula: ['#1f9fe0', '#12c8b8', '#2f56d6'] },
    { base: '#3a0f50', mid: '#a02ad6', light: '#ee7cff', glow: '#ff59e6', eye: '#fff29e', accent: '#ff9bf2',
      bgTop: '#0b0212', bgBot: '#2a0630',
      stars: ['#ffd0f4', '#e6c0ff', '#ffe8f8'], nebula: ['#c02fd0', '#6a2fe0', '#ff4fa0'] },
    { base: '#3b0610', mid: '#c4162f', light: '#ff7a52', glow: '#ffb040', eye: '#ffffff', accent: '#ffd86b',
      bgTop: '#120103', bgBot: '#3a0610',
      stars: ['#ffe2c0', '#ffc9a0', '#fff4e0'], nebula: ['#d4202f', '#ff7a20', '#a0102f'] }
  ]
};

/* ============================================================
   БОСС 2 — ARES-07 (парящий экзоскелет с четырьмя орудиями)
   ============================================================ */
CFG.BOSSES = [
  { id: 'dog', name: 'DEVOURER OF GODS', tag: 'Космический червь', color: '#9a6bff',
    desc: 'Огромный сегментированный червь: рывки, дуги, метеоры и лучи. Быстрый, напористый, бьёт со всех сторон.' },
  { id: 'ares', name: 'ARES-07', tag: 'Экзоскелет', color: '#35e0ff',
    desc: 'Парящий боевой механизм с четырьмя орудиями. Прочная броня: открывает ядро для удара только после своих атак.' }
];

CFG.ARES = {
  name: 'ARES-07',
  hp: 20000,
  coreR: 78, cannonR: 42,
  contact: { core: 90, cannon: 55 },
  transitionTime: 3.4,
  muzzle: 72,
  // порядок = слот руки. shoulder/rest — смещения от центра ядра
  armDefs: [
    { key: 'plasma', name: 'PLASMA CANNON', color: '#6dff7a', shoulder: [-62, -34], rest: [-250, -118] },
    { key: 'tesla', name: 'TESLA CANNON', color: '#5aa8ff', shoulder: [62, -34], rest: [250, -118] },
    { key: 'laser', name: 'LASER CANNON', color: '#ff4d6d', shoulder: [-56, 40], rest: [-215, 132] },
    { key: 'gauss', name: 'GAUSS NUKE', color: '#ffb040', shoulder: [56, 40], rest: [215, 132] }
  ],

  PALETTES: [
    { base: '#141b2e', mid: '#34507a', light: '#9cc4f0', glow: '#35e0ff', eye: '#9ffcff', accent: '#5ad8ff',
      bgTop: '#02060f', bgBot: '#071a2e', stars: ['#cfe8ff', '#aee0ff', '#e0f0ff'], nebula: ['#1f6fe0', '#12b8c8', '#2f4fd6'] },
    { base: '#10241f', mid: '#2f6f5f', light: '#8ff0c8', glow: '#4dffb0', eye: '#e8fff2', accent: '#6dffb0',
      bgTop: '#010a08', bgBot: '#06261c', stars: ['#c8ffe8', '#a0ffd0', '#e0fff4'], nebula: ['#12c88a', '#1fa0e0', '#2fd66a'] },
    { base: '#2a1c0c', mid: '#8a5a1f', light: '#ffcf7a', glow: '#ffa030', eye: '#fff2c8', accent: '#ffd070',
      bgTop: '#0c0602', bgBot: '#2c1604', stars: ['#ffe8c0', '#ffd8a0', '#fff4e0'], nebula: ['#e08a1f', '#d6402f', '#e0c01f'] },
    { base: '#2a0a12', mid: '#9a1f3a', light: '#ff8aa0', glow: '#ff3d5e', eye: '#ffffff', accent: '#ff9fb0',
      bgTop: '#0f0105', bgBot: '#35050f', stars: ['#ffd0d8', '#ffb8c4', '#fff0f2'], nebula: ['#d4202f', '#ff3d71', '#a0102f'] }
  ],

  /* ---- параметры фаз ----
     moveSpeed/accel/hoverDist — парение; *Warn — предупреждения; *Dmg — урон (до множителя сложности) */
  PHASES: [
    {
      name: 'BOOT SEQUENCE', roman: 'I', to: 0.75,
      moveSpeed: 400, accel: 950, hoverDist: 620, idleTime: 1.4, contactMult: 1.0,
      plasmaSpeed: 430, plasmaHoming: 1.5, plasmaDmg: 36, plasmaCount: 3, plasmaSalvos: 2, plasmaShards: 6, shardDmg: 22, plasmaWarn: 0.8,
      teslaSpeed: 300, teslaLife: 4.6, teslaCount: 4, teslaDmg: 34, arcRange: 540, teslaWarn: 0.9, teslaVolleys: 1,
      laserBolts: 5, laserSpeed: 1050, laserDmg: 26, laserWarn: 0.85, laserBeam: false, beamTime: 0, beamWarn: 1.2, beamWidth: 56, beamTurn: 0.5, beamDmg: 55,
      nukeCount: 1, nukeSpeed: 340, nukeTurn: 1.1, nukeFly: 3.0, nukeFuse: 0.9, nukeRadius: 300, nukeDmg: 80, gaussWarn: 1.0,
      strikeCount: 5, strikeWarn: 1.1, strikeRadius: 125, strikeDmg: 55, strikeGap: 0.45,
      dashSpeed: 1150, dashWindup: 1.25, dashLock: 0.42, rushCount: 3,
      cbWidth: 96, cbTime: 1.6, cbAim: 1.4, cbTurn: 0.35, cbDmg: 62, cbOffsets: [0],
      salvoSteps: 4, salvoGap: 0.75,
      comboChance: 0, combos: [],
      pool: { plasma: 3, tesla: 3, laser: 3, strike: 2 }
    },
    {
      name: 'WEAPONS FREE', roman: 'II', to: 0.5,
      moveSpeed: 520, accel: 1150, hoverDist: 560, idleTime: 1.0, contactMult: 1.1,
      plasmaSpeed: 500, plasmaHoming: 1.9, plasmaDmg: 40, plasmaCount: 3, plasmaSalvos: 3, plasmaShards: 7, shardDmg: 24, plasmaWarn: 0.7,
      teslaSpeed: 340, teslaLife: 5.0, teslaCount: 5, teslaDmg: 38, arcRange: 580, teslaWarn: 0.8, teslaVolleys: 2,
      laserBolts: 6, laserSpeed: 1200, laserDmg: 30, laserWarn: 0.75, laserBeam: true, beamTime: 1.3, beamWarn: 1.05, beamWidth: 62, beamTurn: 0.6, beamDmg: 60,
      nukeCount: 1, nukeSpeed: 380, nukeTurn: 1.3, nukeFly: 3.0, nukeFuse: 0.85, nukeRadius: 330, nukeDmg: 90, gaussWarn: 0.9,
      strikeCount: 7, strikeWarn: 1.0, strikeRadius: 130, strikeDmg: 58, strikeGap: 0.38,
      dashSpeed: 1350, dashWindup: 1.0, dashLock: 0.38, rushCount: 3,
      cbWidth: 104, cbTime: 1.8, cbAim: 1.25, cbTurn: 0.42, cbDmg: 66, cbOffsets: [0],
      salvoSteps: 6, salvoGap: 0.62,
      comboChance: 0.2, combos: [['plasma', 'charge'], ['strike', 'laser']],
      pool: { plasma: 2, tesla: 3, laser: 3, strike: 2, gauss: 3, charge: 2, salvo: 2 }
    },
    {
      name: 'OVERCLOCK', roman: 'III', to: 0.25,
      moveSpeed: 640, accel: 1350, hoverDist: 520, idleTime: 0.7, contactMult: 1.25,
      plasmaSpeed: 570, plasmaHoming: 2.2, plasmaDmg: 44, plasmaCount: 4, plasmaSalvos: 3, plasmaShards: 8, shardDmg: 26, plasmaWarn: 0.6,
      teslaSpeed: 380, teslaLife: 5.2, teslaCount: 6, teslaDmg: 42, arcRange: 620, teslaWarn: 0.7, teslaVolleys: 2,
      laserBolts: 8, laserSpeed: 1350, laserDmg: 32, laserWarn: 0.65, laserBeam: true, beamTime: 1.5, beamWarn: 0.9, beamWidth: 68, beamTurn: 0.72, beamDmg: 66,
      nukeCount: 2, nukeSpeed: 420, nukeTurn: 1.5, nukeFly: 3.0, nukeFuse: 0.8, nukeRadius: 350, nukeDmg: 100, gaussWarn: 0.8,
      strikeCount: 9, strikeWarn: 0.9, strikeRadius: 135, strikeDmg: 62, strikeGap: 0.32,
      dashSpeed: 1550, dashWindup: 0.85, dashLock: 0.34, rushCount: 4,
      cbWidth: 112, cbTime: 2.0, cbAim: 1.1, cbTurn: 0.5, cbDmg: 72, cbOffsets: [0],
      salvoSteps: 8, salvoGap: 0.52,
      comboChance: 0.45,
      combos: [['plasma', 'charge'], ['strike', 'laser'], ['gauss', 'rush'], ['salvo', 'sweep'], ['tesla', 'laser', 'charge']],
      pool: { plasma: 2, tesla: 2, laser: 2, strike: 2, gauss: 2, charge: 2, rush: 2, salvo: 2, sweep: 3 }
    },
    {
      name: 'EXTINCTION PROTOCOL', roman: 'IV', to: 0,
      moveSpeed: 760, accel: 1550, hoverDist: 480, idleTime: 0.45, contactMult: 1.4,
      plasmaSpeed: 640, plasmaHoming: 2.5, plasmaDmg: 48, plasmaCount: 5, plasmaSalvos: 4, plasmaShards: 9, shardDmg: 28, plasmaWarn: 0.5,
      teslaSpeed: 420, teslaLife: 5.4, teslaCount: 7, teslaDmg: 46, arcRange: 660, teslaWarn: 0.6, teslaVolleys: 3,
      laserBolts: 10, laserSpeed: 1500, laserDmg: 34, laserWarn: 0.55, laserBeam: true, beamTime: 1.7, beamWarn: 0.8, beamWidth: 74, beamTurn: 0.85, beamDmg: 72,
      nukeCount: 3, nukeSpeed: 460, nukeTurn: 1.7, nukeFly: 3.0, nukeFuse: 0.75, nukeRadius: 370, nukeDmg: 110, gaussWarn: 0.7,
      strikeCount: 11, strikeWarn: 0.8, strikeRadius: 140, strikeDmg: 66, strikeGap: 0.27,
      dashSpeed: 1800, dashWindup: 0.7, dashLock: 0.3, rushCount: 5,
      cbWidth: 120, cbTime: 2.3, cbAim: 0.95, cbTurn: 0.6, cbDmg: 78, cbOffsets: [-0.45, 0, 0.45],
      salvoSteps: 10, salvoGap: 0.44,
      comboChance: 0.6,
      combos: [['plasma', 'charge'], ['strike', 'laser'], ['gauss', 'rush'], ['salvo', 'sweep'], ['tesla', 'laser', 'charge'],
               ['sweep', 'gauss', 'rush'], ['strike', 'salvo', 'sweep']],
      pool: { plasma: 2, tesla: 2, laser: 2, strike: 2, gauss: 2, charge: 1, rush: 2, salvo: 2, sweep: 3, final: 0.6 }
    }
  ]
};
