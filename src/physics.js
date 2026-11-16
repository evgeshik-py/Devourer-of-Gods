'use strict';

/* ============================================================
   physics.js — математика, цвета и коллизии
   ============================================================ */
const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function normAngle(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
function angleDiff(from, to) { return normAngle(to - from); }
function approachAngle(cur, target, maxStep) {
  const d = angleDiff(cur, target);
  if (Math.abs(d) <= maxStep) return target;
  return normAngle(cur + (d > 0 ? maxStep : -maxStep));
}
function approach(cur, target, step) {
  if (cur < target) return Math.min(cur + step, target);
  return Math.max(cur - step, target);
}
function damp(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function randSign() { return Math.random() < 0.5 ? -1 : 1; }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function wrap(v, p) { return ((v % p) + p) % p; }

/* Взвешенный выбор: weights = {ключ: вес}; exclude — ключ, который нельзя повторять; filter(key) -> bool */
function weightedPick(weights, exclude, filter) {
  let total = 0;
  const keys = Object.keys(weights);
  for (const k of keys) {
    if (k === exclude || (filter && !filter(k))) continue;
    total += weights[k];
  }
  if (total <= 0) return keys[0];
  let r = Math.random() * total;
  for (const k of keys) {
    if (k === exclude || (filter && !filter(k))) continue;
    r -= weights[k];
    if (r <= 0) return k;
  }
  return keys[0];
}

/* ---------- цвета ---------- */
const _rgbCache = Object.create(null);
function hexToRgb(hex) {
  let c = _rgbCache[hex];
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    _rgbCache[hex] = c;
  }
  return c;
}
function rgbStr(c, a) {
  return a === undefined ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'
    : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
}
function rgba(hex, a) {
  const c = hexToRgb(hex);
  a = a < 0 ? 0 : (a > 1 ? 1 : a);
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (Math.round(a * 1000) / 1000) + ')';
}
function mixRgb(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
}
function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), r = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
}
function fmtNum(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/* ---------- коллизии ---------- */
const Physics = {
  circleHit(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by, r = ar + br;
    return dx * dx + dy * dy <= r * r;
  },
  /* расстояние от точки до отрезка */
  segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  },
  /* расстояние от точки до луча (конечного) */
  rayDist(px, py, x, y, ang, len) {
    return Physics.segDist(px, py, x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
  }
};
