'use strict';

/* ============================================================
   audio.js — процедурные звуки (Web Audio API)
   ============================================================ */
class AudioFX {
  constructor() {
    this.ctx = null; this.master = null; this.noiseBuf = null;
    this.muted = false;
    this.last = {};
    this.beam = null;
    this.amb = null;
    try { this.muted = localStorage.getItem('dog_muted') === '1'; } catch (e) { /* ignore */ }
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      this.ctx = c;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      const comp = c.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(c.destination);
      const len = c.sampleRate * 2;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    } catch (e) { this.ctx = null; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('dog_muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
  }

  gate(name, gap) {
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < gap * 1000) return false;
    this.last[name] = now;
    return true;
  }

  /* ---------- базовые генераторы ---------- */
  tone(o) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
    const vol = o.vol === undefined ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + o.dur + 0.05);
  }

  noise(o) {
    if (!this.ctx || !this.noiseBuf) return;
    const c = this.ctx, t0 = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.f0, t0);
    if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
    const g = c.createGain();
    const vol = o.vol === undefined ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0, Math.random());
    src.stop(t0 + o.dur + 0.05);
  }

  /* ---------- эффекты ---------- */
  shoot(kind) {
    if (!this.gate('shoot' + kind, 0.05)) return;
    switch (kind) {
      case 'scatter':
        this.noise({ f0: 2600, f1: 300, dur: 0.18, vol: 0.2 });
        this.tone({ type: 'sawtooth', f0: 220, f1: 60, dur: 0.18, vol: 0.12 });
        break;
      case 'lance':
        this.tone({ type: 'sawtooth', f0: 1500, f1: 90, dur: 0.38, vol: 0.14 });
        this.tone({ type: 'sine', f0: 120, f1: 40, dur: 0.4, vol: 0.28 });
        this.noise({ type: 'bandpass', q: 2, f0: 4000, f1: 400, dur: 0.3, vol: 0.14 });
        break;
      case 'seeker':
        this.tone({ type: 'triangle', f0: 400, f1: 900, dur: 0.12, vol: 0.06 });
        this.noise({ type: 'bandpass', q: 3, f0: 1500, f1: 3500, dur: 0.1, vol: 0.05 });
        break;
      default:
        this.tone({ type: 'square', f0: 900, f1: 320, dur: 0.07, vol: 0.04 });
    }
  }
  plasma() {
    if (!this.gate('plasma', 0.06)) return;
    this.tone({ type: 'sine', f0: 300, f1: 700, dur: 0.22, vol: 0.12 });
    this.tone({ type: 'triangle', f0: 150, f1: 420, dur: 0.26, vol: 0.1 });
    this.noise({ type: 'bandpass', q: 2, f0: 600, f1: 1800, dur: 0.18, vol: 0.08 });
  }
  zap() {
    if (!this.gate('zap', 0.08)) return;
    this.noise({ type: 'highpass', f0: 2500, dur: 0.25, vol: 0.16 });
    this.tone({ type: 'sawtooth', f0: 1800, f1: 200, dur: 0.22, vol: 0.09 });
    this.tone({ type: 'square', f0: 120, f1: 60, dur: 0.3, vol: 0.1 });
  }
  laserShot() {
    if (!this.gate('lshot', 0.05)) return;
    this.tone({ type: 'sawtooth', f0: 2200, f1: 500, dur: 0.12, vol: 0.07 });
  }
  nukeLaunch() {
    this.noise({ f0: 1800, f1: 200, dur: 0.7, vol: 0.28 });
    this.tone({ type: 'sawtooth', f0: 80, f1: 220, dur: 0.6, vol: 0.18 });
  }
  siren() {
    if (!this.gate('siren', 0.4)) return;
    this.tone({ type: 'square', f0: 500, f1: 900, dur: 0.35, vol: 0.06 });
    this.tone({ type: 'square', f0: 900, f1: 500, dur: 0.35, vol: 0.06, delay: 0.35 });
  }
  swap() {
    this.tone({ type: 'square', f0: 500, f1: 800, dur: 0.06, vol: 0.05 });
    this.tone({ type: 'square', f0: 800, f1: 1200, dur: 0.06, vol: 0.05, delay: 0.06 });
  }
  hit(heavy) {
    if (!this.gate('hit', 0.04)) return;
    this.noise({ type: 'highpass', f0: 3000, dur: 0.04, vol: heavy ? 0.1 : 0.06 });
    this.tone({ type: 'sine', f0: heavy ? 180 : 240, f1: 100, dur: 0.06, vol: heavy ? 0.12 : 0.06 });
  }
  playerHurt() {
    this.tone({ type: 'sawtooth', f0: 260, f1: 60, dur: 0.35, vol: 0.22 });
    this.noise({ f0: 900, f1: 200, dur: 0.3, vol: 0.25 });
  }
  dash() {
    if (!this.gate('dash', 0.15)) return;
    this.noise({ type: 'bandpass', q: 3, f0: 300, f1: 2400, dur: 0.7, vol: 0.28 });
    this.tone({ type: 'sawtooth', f0: 90, f1: 40, dur: 0.6, vol: 0.18 });
  }
  projectile() {
    if (!this.gate('proj', 0.08)) return;
    this.tone({ type: 'sine', f0: 700, f1: 200, dur: 0.25, vol: 0.1 });
    this.tone({ type: 'triangle', f0: 350, f1: 120, dur: 0.3, vol: 0.08 });
  }
  warn() {
    if (!this.gate('warn', 0.2)) return;
    this.tone({ type: 'square', f0: 660, dur: 0.09, vol: 0.06 });
    this.tone({ type: 'square', f0: 660, dur: 0.09, vol: 0.06, delay: 0.13 });
  }
  bossSpawn() {
    this.tone({ type: 'sawtooth', f0: 40, f1: 95, dur: 2.5, vol: 0.28, attack: 0.5 });
    this.tone({ type: 'sine', f0: 80, f1: 30, dur: 2.4, vol: 0.3 });
    this.noise({ f0: 200, f1: 1100, dur: 2.2, vol: 0.22, attack: 0.6 });
  }
  portal() {
    if (!this.gate('portal', 0.5)) return;
    this.tone({ type: 'sine', f0: 300, f1: 80, dur: 1.4, vol: 0.22 });
    this.noise({ type: 'bandpass', q: 2, f0: 800, f1: 200, dur: 1.3, vol: 0.18 });
  }
  phase() {
    this.tone({ type: 'sine', f0: 120, f1: 30, dur: 1.4, vol: 0.5 });
    this.noise({ f0: 1200, f1: 60, dur: 1.6, vol: 0.42 });
    this.tone({ type: 'sawtooth', f0: 110, f1: 220, dur: 2.0, vol: 0.1, attack: 0.4 });
    this.tone({ type: 'sawtooth', f0: 165, f1: 330, dur: 2.0, vol: 0.08, attack: 0.4 });
  }
  beamCharge() {
    this.tone({ type: 'sawtooth', f0: 120, f1: 900, dur: 1.2, vol: 0.1, attack: 0.3 });
  }
  beamLoop(on) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (on && !this.beam) {
      const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o1.type = 'sawtooth'; o1.frequency.value = 70;
      o2.type = 'square'; o2.frequency.value = 141;
      f.type = 'lowpass'; f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.linearRampToValueAtTime(0.14, c.currentTime + 0.1);
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
      o1.start(); o2.start();
      this.beam = { o1, o2, g };
    } else if (!on && this.beam) {
      const b = this.beam;
      this.beam = null;
      b.g.gain.cancelScheduledValues(c.currentTime);
      b.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.08);
      b.o1.stop(c.currentTime + 0.5); b.o2.stop(c.currentTime + 0.5);
    }
  }
  nova() {
    this.tone({ type: 'sine', f0: 150, f1: 900, dur: 0.5, vol: 0.3 });
    this.noise({ type: 'bandpass', q: 1.5, f0: 400, f1: 3000, dur: 0.6, vol: 0.28 });
  }
  ready() { this.tone({ type: 'sine', f0: 880, f1: 1320, dur: 0.2, vol: 0.1 }); }
  explosion(size) {
    const s = size === undefined ? 1 : size;
    if (!this.gate('boom', 0.06)) return;
    this.noise({ f0: 2000, f1: 80, dur: 0.5 + 0.8 * s, vol: 0.35 * Math.min(1.2, s + 0.2) });
    this.tone({ type: 'sine', f0: 90, f1: 25, dur: 0.5 + 0.6 * s, vol: 0.3 * Math.min(1.2, s + 0.2) });
  }
  victory() {
    const n = [262, 330, 392, 523, 659, 784, 1047];
    n.forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.7, vol: 0.14, delay: i * 0.13 }));
    this.tone({ type: 'sine', f0: 131, dur: 2.2, vol: 0.2, delay: 0.1 });
  }
  defeat() {
    [392, 330, 262, 196, 131].forEach((f, i) =>
      this.tone({ type: 'sawtooth', f0: f, f1: f * 0.8, dur: 0.6, vol: 0.12, delay: i * 0.22 }));
    this.noise({ f0: 600, f1: 60, dur: 1.6, vol: 0.2 });
  }

  /* ---------- фоновая атмосфера ---------- */
  startAmbient() {
    if (!this.ctx || this.amb) return;
    const c = this.ctx;
    const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    const lfo = c.createOscillator(), lg = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'sawtooth';
    o1.frequency.value = 55; o2.frequency.value = 55.6;
    f.type = 'lowpass'; f.frequency.value = 220;
    g.gain.value = 0.05;
    lfo.frequency.value = 0.15; lg.gain.value = 0.02;
    lfo.connect(lg); lg.connect(g.gain);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
    o1.start(); o2.start(); lfo.start();
    this.amb = { o1, o2, f, g, lfo };
  }
  setAmbientPhase(i) {
    if (!this.ctx || !this.amb) return;
    const t = this.ctx.currentTime, base = [55, 62, 69, 78][i] || 55;
    this.amb.o1.frequency.setTargetAtTime(base, t, 1.2);
    this.amb.o2.frequency.setTargetAtTime(base * 1.011, t, 1.2);
    this.amb.f.frequency.setTargetAtTime(220 + i * 120, t, 1.2);
    this.amb.g.gain.setTargetAtTime(0.05 + i * 0.012, t, 1.2);
  }
  stopAmbient() {
    if (!this.ctx || !this.amb) return;
    const a = this.amb;
    this.amb = null;
    a.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
    try { a.o1.stop(this.ctx.currentTime + 1.5); a.o2.stop(this.ctx.currentTime + 1.5); a.lfo.stop(this.ctx.currentTime + 1.5); } catch (e) { /* ignore */ }
  }
}
