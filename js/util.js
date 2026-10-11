/* WAFFLE'S HOUSE — util.js
   Math helpers, RNG, timers, geometry. Global namespace: WH */
"use strict";
window.WH = window.WH || {};

WH.U = (function () {
  const U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  U.sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1)); // inclusive
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;

  // Pick n distinct random elements
  U.pickN = function (arr, n) {
    const copy = arr.slice();
    const out = [];
    while (out.length < n && copy.length > 0) {
      out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
  };

  U.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Move current toward target by maxDelta
  U.approach = function (cur, target, maxDelta) {
    if (cur < target) return Math.min(cur + maxDelta, target);
    return Math.max(cur - maxDelta, target);
  };

  // Rect overlap {x,y,w,h}
  U.rectsOverlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // Simple cooldown timer
  U.Timer = class {
    constructor(duration) {
      this.duration = duration;
      this.t = 0;
      this.running = false;
    }
    start(d) {
      if (d !== undefined) this.duration = d;
      this.t = this.duration;
      this.running = true;
    }
    update(dt) {
      if (!this.running) return false;
      this.t -= dt;
      if (this.t <= 0) {
        this.t = 0;
        this.running = false;
        return true; // fired this frame
      }
      return false;
    }
    get ratio() {
      return this.duration > 0 ? U.clamp(this.t / this.duration, 0, 1) : 0;
    }
    get done() {
      return !this.running;
    }
  };

  // Formats 0..7 hour index into clock label, 10 PM -> 5 AM
  U.hourLabel = function (idx) {
    const labels = ["10 PM", "11 PM", "12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM"];
    return labels[U.clamp(idx, 0, 7)];
  };

  // Formats minutes within the hour for HUD clock (progress 0..1)
  U.clockText = function (hourIdx, progress) {
    const startHours = [22, 23, 0, 1, 2, 3, 4, 5];
    const h24 = startHours[U.clamp(hourIdx, 0, 7)];
    const mins = Math.floor(U.clamp(progress, 0, 0.999) * 60);
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    const ampm = h24 >= 12 ? "PM" : "AM";
    return `${h12}:${mins < 10 ? "0" : ""}${mins} ${ampm}`;
  };

  U.money = (n) => "$" + Math.round(n).toLocaleString("en-US");

  // Word-wraps text into lines that fit maxWidth for given ctx font
  U.wrapText = function (ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  return U;
})();
