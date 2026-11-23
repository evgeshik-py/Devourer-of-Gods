'use strict';

/* ============================================================
   platform.js — обёртка над Yandex Games SDK + локальный режим

   Используются ТОЛЬКО методы из официальной документации:
     YaGames.init()                                  -> ysdk
     ysdk.features.LoadingAPI?.ready()
     ysdk.features.GameplayAPI?.start() / .stop()
     ysdk.on / ysdk.off('game_api_pause' | 'game_api_resume')
     ysdk.adv.showFullscreenAdv({ callbacks })       (межстраничная реклама)
     ysdk.adv.showRewardedVideo({ callbacks })       (награда за просмотр)
     ysdk.getPlayer(), player.getData(), player.setData(data, flush)
     ysdk.environment.i18n.lang
   Если SDK нет (локальный запуск) — игра работает полностью, без рекламы,
   сохранения идут в localStorage.
   ============================================================ */

/* ---------- хранилище: localStorage + облако игрока ---------- */
const Store = {
  SYNC: ['terrabattle_sel', 'terrabattle_save'],   // ключи, которые зеркалятся в данные игрока
  cloud: {},
  player: null,
  dirty: false, timer: 0, lastFlush: 0, flushes: [],

  getItem(k) {
    if (this.player && Object.prototype.hasOwnProperty.call(this.cloud, k)) return this.cloud[k];
    try { return localStorage.getItem(k); } catch (e) { return null; }
  },
  setItem(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* приватный режим и т.п. */ }
    if (this.player && this.SYNC.indexOf(k) >= 0) {
      this.cloud[k] = v;
      this.dirty = true;
      this.schedule();
    }
  },
  schedule() {
    if (this.timer) return;
    // не чаще одного запроса в ~4 с (лимит платформы: 100 запросов за 5 минут)
    const wait = Math.max(1500, 4000 - (Date.now() - this.lastFlush));
    this.timer = setTimeout(() => { this.timer = 0; this.flush(false); }, wait);
  },
  flush(now) {
    if (!this.player || !this.dirty) return;
    const t = Date.now();
    this.flushes = this.flushes.filter(x => t - x < 300000);
    if (this.flushes.length >= 90) { this.schedule(); return; }   // запас до лимита 100/5 мин
    this.dirty = false; this.lastFlush = t; this.flushes.push(t);
    try {
      const r = this.player.setData(this.cloud, !!now);
      if (r && r.catch) r.catch(() => { this.dirty = true; });
    } catch (e) { this.dirty = true; }
  },
  /* первичная загрузка: облако главнее, локальные данные переносятся, если в облаке пусто */
  async attach(player) {
    this.player = player;
    let data = null;
    try { data = await player.getData(this.SYNC); } catch (e) { data = null; }
    this.cloud = {};
    if (data && typeof data === 'object') for (const k of this.SYNC) if (typeof data[k] === 'string') this.cloud[k] = data[k];
    for (const k of this.SYNC) {
      if (this.cloud[k] === undefined) {
        let loc = null; try { loc = localStorage.getItem(k); } catch (e) { /* ignore */ }
        if (loc) { this.cloud[k] = loc; this.dirty = true; }
      }
    }
    if (this.dirty) this.schedule();
  }
};

/* ---------- платформа ---------- */
const Platform = {
  ysdk: null,
  lang: 'ru',
  adActive: false,
  lastAdAt: 0,
  sessionsSinceAd: 0,     // завершённых боёв с момента последней рекламы
  gameplayOn: false,
  sdkPaused: false,
  game: null,
  MIN_AD_GAP: 60000,      // собственный минимум между показами; частоту дополнительно ограничивает платформа

  get hasSdk() { return !!this.ysdk; },

  /* sdk.js подключается только на хостинге платформы; локально (localhost, file://, LAN)
     скрипта нет, и мы не создаём ошибку 404 в консоли. Принудительно: ?sdk=1, отключить: ?sdk=0 */
  shouldLoadSdk() {
    const q = location.search;
    if (/[?&]sdk=0/.test(q)) return false;
    if (/[?&]sdk=1/.test(q)) return true;
    const h = location.hostname, p = location.protocol;
    if (p === 'file:' || !h) return false;
    if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h)) return false;
    return true;
  },

  loadSdkScript() {
    return new Promise((resolve) => {
      if (typeof YaGames !== 'undefined') return resolve(true);
      const s = document.createElement('script');
      let done = false;
      const fin = (ok) => { if (!done) { done = true; resolve(ok); } };
      s.src = '/sdk.js';
      s.async = true;
      s.onload = () => fin(typeof YaGames !== 'undefined');
      s.onerror = () => fin(false);
      setTimeout(() => fin(false), 6000);
      document.head.appendChild(s);
    });
  },

  async init() {
    try {
      if (this.shouldLoadSdk() && await this.loadSdkScript()) {
        this.ysdk = await YaGames.init();
      }
    } catch (e) { this.ysdk = null; }
    if (!this.ysdk) return;

    try {
      const l = this.ysdk.environment && this.ysdk.environment.i18n && this.ysdk.environment.i18n.lang;
      if (l) this.lang = String(l);
    } catch (e) { /* ignore */ }

    try {
      const player = await this.ysdk.getPlayer();     // без signed — игрок может остаться гостем
      await Store.attach(player);
    } catch (e) { /* гость/ошибка: работаем с localStorage */ }

    try {
      this.ysdk.on('game_api_pause', () => this.onSdkPause());
      this.ysdk.on('game_api_resume', () => this.onSdkResume());
    } catch (e) { /* ignore */ }
  },

  bind(game) { this.game = game; },

  /* сигнал «игра загружена, можно играть» — после построения меню, без экранов загрузки */
  ready() {
    try { if (this.ysdk && this.ysdk.features && this.ysdk.features.LoadingAPI) this.ysdk.features.LoadingAPI.ready(); } catch (e) { /* ignore */ }
  },

  /* разметка геймплея: вызывается при смене факта «идёт бой» */
  setGameplay(on) {
    on = !!on && !this.adActive;
    if (on === this.gameplayOn) return;
    this.gameplayOn = on;
    try {
      const f = this.ysdk && this.ysdk.features && this.ysdk.features.GameplayAPI;
      if (f) { if (on) f.start(); else f.stop(); }
    } catch (e) { /* ignore */ }
  },

  /* платформа просит паузу (сворачивание, чужая реклама и т.п.) */
  onSdkPause() {
    this.sdkPaused = true;
    const g = this.game; if (!g) return;
    g.pause();
    g.audio.suspend();
  },
  onSdkResume() {
    this.sdkPaused = false;
    const g = this.game; if (!g) return;
    // бой остаётся на паузе до нажатия «Продолжить»; звук возвращаем только вне паузы
    if (g.state !== 'paused') g.audio.resume();
  },

  /* ---------- реклама ---------- */
  adVeil(on) {
    const v = document.getElementById('ad-veil');
    if (v) v.classList.toggle('hidden', !on);
  },

  /* межстраничная реклама: ТОЛЬКО вне боя, между сессиями. done() вызывается ровно один раз. */
  interstitial(done) {
    if (this.adActive) return;     // реклама уже идёт — повторный клик игнорируем
    const g = this.game, now = Date.now();
    if (!this.ysdk || !g || g.state === 'playing' || this.sessionsSinceAd < 1 || now - this.lastAdAt < this.MIN_AD_GAP) { done(); return; }
    this.adActive = true;
    let fin = false, guard = 0;
    const end = () => {
      if (fin) return; fin = true; clearTimeout(guard);
      this.adActive = false; this.lastAdAt = Date.now(); this.sessionsSinceAd = 0;
      this.adVeil(false);
      if (g.state !== 'paused') g.audio.resume();
      done();
    };
    this.setGameplay(false);
    this.adVeil(true);
    g.audio.suspend(); g.input.releaseAll();
    guard = setTimeout(end, 120000);   // страховка от потерянного колбэка
    try {
      this.ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => { /* звук и игра уже остановлены */ },
          onClose: () => end(),          // wasShown не важен: после закрытия/ошибки/частого вызова идём дальше
          onError: () => end()
        }
      });
    } catch (e) { end(); }
  },

  /* реклама с наградой: вызывается только по кнопке игрока и только вне боя */
  rewarded(onReward, onFinish) {
    const g = this.game;
    if (!this.ysdk || this.adActive || !g || g.state === 'playing') { if (onFinish) onFinish(false); return false; }
    this.adActive = true;
    let fin = false, got = false, guard = 0;
    const end = () => {
      if (fin) return; fin = true; clearTimeout(guard);
      this.adActive = false; this.lastAdAt = Date.now(); this.sessionsSinceAd = 0;
      this.adVeil(false);
      if (g.state !== 'paused') g.audio.resume();
      if (got) onReward();
      if (onFinish) onFinish(got);
    };
    this.setGameplay(false);
    this.adVeil(true);
    g.audio.suspend(); g.input.releaseAll();
    guard = setTimeout(end, 120000);
    try {
      this.ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => { /* ничего */ },
          onRewarded: () => { got = true; },   // награда выдаётся при закрытии, когда вернулись в игру
          onClose: () => end(),
          onError: () => { got = false; end(); }
        }
      });
    } catch (e) { got = false; end(); }
    return true;
  },

  /* сохранить сразу (уход со страницы / скрытие вкладки) */
  flush() { Store.flush(true); }
};
