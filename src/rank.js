'use strict';

/* ============================================================
   rank.js — измерение времени боя и определение ранга.
   Не зависит от отрисовки. Единый источник времени — performance.now()
   (в тестах можно подменить через BattleTimer.clock).
   ============================================================ */
class BattleTimer {
  constructor(clock) {
    this.clock = clock || (() => performance.now());
    this.reset();
  }
  reset() {
    this.status = 'idle';     // idle | running | paused | stopped
    this.startAt = 0; this.pausedAt = 0; this.pausedTotal = 0; this.finalMs = 0;
  }
  start() {
    if (this.status !== 'idle') return;
    this.startAt = this.clock(); this.pausedTotal = 0; this.status = 'running';
  }
  pause() {
    if (this.status !== 'running') return;
    this.pausedAt = this.clock(); this.status = 'paused';
  }
  resume() {
    if (this.status !== 'paused') return;
    this.pausedTotal += this.clock() - this.pausedAt; this.status = 'running';
  }
  /* подтверждённая победа: фиксирует и возвращает время в мс */
  stop() {
    if (this.status === 'running' || this.status === 'paused') {
      this.finalMs = this.elapsedMs();
      this.status = 'stopped';
    }
    return this.finalMs;
  }
  elapsedMs() {
    switch (this.status) {
      case 'running': return this.clock() - this.startAt - this.pausedTotal;
      case 'paused': return this.pausedAt - this.startAt - this.pausedTotal;
      case 'stopped': return this.finalMs;
      default: return 0;
    }
  }
  get seconds() { return this.elapsedMs() / 1000; }
}

const Rank = {
  thresholds(bossId) { return CFG.RANKS.times[bossId] || CFG.RANKS.defaultTimes; },
  /* границы включительные: ровно 60.000 с — ранг S */
  evaluate(bossId, ms) {
    const t = this.thresholds(bossId), order = CFG.RANKS.order, sec = ms / 1000;
    for (let i = 0; i < t.length; i++) if (sec <= t[i] + 1e-9) return order[i];
    return order[order.length - 1];
  },
  info(r) { return CFG.RANKS.info[r]; }
};

/* MM:SS.mmm */
function fmtTimeMs(ms) {
  ms = Math.max(0, Math.floor(ms));
  const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, r = ms % 1000;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (r < 100 ? (r < 10 ? '00' : '0') : '') + r;
}
