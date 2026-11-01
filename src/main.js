'use strict';

/* ============================================================
   main.js — точка входа
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game(document.getElementById('game'));
  window.game = game;   // для отладки в консоли
  new Menu(game);

  const on = (id, fn) => {
    const el = document.getElementById(id);
    el.addEventListener('click', () => { fn(); el.blur(); });
  };
  on('btn-start', () => game.start());
  on('btn-resume', () => game.resume());
  on('btn-restart', () => game.start());
  on('btn-retry', () => game.start());
  on('btn-again', () => game.start());
  on('btn-menu-pause', () => game.toMenu());
  on('btn-menu-defeat', () => game.toMenu());
  on('btn-menu-victory', () => game.toMenu());
  on('btn-sound', () => game.toggleSound());
});
