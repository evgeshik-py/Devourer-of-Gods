'use strict';

/* ============================================================
   main.js — точка входа
   Порядок: SDK (если есть) → данные игрока → Game → меню → LoadingAPI.ready()
   ============================================================ */
window.addEventListener('DOMContentLoaded', async () => {
  try { await Platform.init(); } catch (e) { /* без SDK игра работает локально */ }

  const game = new Game(document.getElementById('game'));
  window.game = game;   // для отладки в консоли
  Platform.bind(game);
  game.menu = new Menu(game);
  game.inventoryUI = new InventoryUI(game);
  game.menu.refresh();
  game.menu.refreshControls();

  const on = (id, fn) => {
    const el = document.getElementById(id);
    el.addEventListener('click', () => { fn(); el.blur(); });
  };
  // межстраничная реклама — только перед НОВЫМ боем (из меню / экрана результатов), никогда во время боя
  const startAfterAd = () => Platform.interstitial(() => game.start());
  on('btn-start', startAfterAd);
  on('btn-retry', startAfterAd);
  on('btn-again', startAfterAd);
  on('btn-resume', () => game.resume());
  on('btn-restart', () => game.start());
  on('btn-menu-pause', () => game.toMenu());
  on('btn-menu-defeat', () => game.toMenu());
  on('btn-menu-victory', () => game.toMenu());
  on('btn-sound', () => game.toggleSound());
  on('btn-inventory', () => game.openInventory());
  on('btn-inv-close', () => game.closeInventory());
  on('btn-retire', () => game.retire());

  // награда за рекламу (по желанию игрока, вне боя)
  on('btn-bonus', () => Platform.rewarded(() => game.grantBonusKit()));
  on('btn-bonus-v', () => Platform.rewarded(() => game.grantBonusLoot()));
  on('btn-bonus-d', () => Platform.rewarded(() => game.grantBonusLoot()));
  game.onMenu = ((prev) => () => { if (prev) prev(); document.getElementById('bonus-msg').textContent = ''; document.getElementById('btn-bonus').classList.toggle('hidden', !Platform.hasSdk); })(game.onMenu);
  document.getElementById('btn-bonus').classList.toggle('hidden', !Platform.hasSdk);

  document.getElementById('boot').classList.add('hidden');
  Platform.ready();   // игрок может начинать играть: экранов загрузки нет
});
