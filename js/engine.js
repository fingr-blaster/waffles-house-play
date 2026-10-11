/* WAFFLE'S HOUSE — engine.js
   Game loop, scene manager, particles, floating text, screen shake,
   hitstop, save data, and the shared night-run state. */
"use strict";
window.WH = window.WH || {};

// ------------------------------------------------------------------ Save
WH.Save = (function () {
  const KEY = "waffles-house-save-v1";
  const S = {
    data: {
      high: { score: 0, grade: "-", title: "NOBODY (YET)" },
      settings: { master: 0.8, music: 0.6, sfx: 0.8, shake: true, reduceFlash: false },
      totals: { nights: 0, wins: 0, customersFed: 0, enemiesKOd: 0, chairsCaught: 0, cashLifetime: 0 },
      seenHowTo: false,
    },
  };
  S.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // shallow-merge known sections so new fields keep defaults
        for (const k of ["high", "settings", "totals"]) {
          if (parsed[k]) Object.assign(S.data[k], parsed[k]);
        }
        if (parsed.seenHowTo) S.data.seenHowTo = true;
      }
    } catch (e) { /* corrupted or blocked storage — play with defaults */ }
    WH.Audio.settings.master = S.data.settings.master;
    WH.Audio.settings.music = S.data.settings.music;
    WH.Audio.settings.sfx = S.data.settings.sfx;
  };
  S.save = function () {
    try {
      localStorage.setItem(KEY, JSON.stringify(S.data));
    } catch (e) { /* storage unavailable; ignore */ }
  };
  return S;
})();

// ------------------------------------------------------------------ Text
WH.T = (function () {
  const T = {};
  T.font = (size, bold) => `${bold ? "bold " : ""}${size}px "Courier New", monospace`;
  T.text = function (g, str, x, y, size, color, align, bold, shadow) {
    g.font = T.font(size, bold !== false);
    g.textAlign = align || "left";
    g.textBaseline = "alphabetic";
    if (shadow !== false) {
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.fillText(str, x + 2, y + 2);
    }
    g.fillStyle = color || "#f0e6c8";
    g.fillText(str, x, y);
    g.textAlign = "left";
  };
  T.bar = function (g, x, y, w, h, ratio, fg, bg) {
    g.fillStyle = bg || "rgba(0,0,0,0.55)";
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = fg || "#5fd668";
    g.fillRect(x, y, Math.max(0, Math.round(w * WH.U.clamp(ratio, 0, 1))), h);
  };
  return T;
})();

// ------------------------------------------------------------------ FX
WH.FX = (function () {
  const FX = {};
  let parts = [];
  let floats = [];

  FX.clear = function () { parts = []; floats = []; };

  FX.burst = function (x, y, color, n, speed, life) {
    for (let i = 0; i < (n || 8); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (speed || 120) * (0.4 + Math.random() * 0.8);
      parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
        life: (life || 0.5) * (0.6 + Math.random() * 0.6),
        t: 0, color, size: 2 + Math.random() * 3, grav: 300,
      });
    }
  };

  FX.steam = function (x, y) {
    parts.push({
      x: x + WH.U.rand(-6, 6), y, vx: WH.U.rand(-8, 8), vy: -40 - Math.random() * 30,
      life: 0.9, t: 0, color: "rgba(240,240,235,0.5)", size: 3 + Math.random() * 3, grav: -20,
    });
  };

  FX.float = function (x, y, str, color, size, life) {
    // keep long lines on screen
    const halfW = String(str).length * (size || 16) * 0.31;
    floats.push({ x: WH.U.clamp(x, 20 + halfW, 940 - halfW), y, str, color: color || "#ffe066", size: size || 16, t: 0, life: life || 1.0 });
  };

  FX.update = function (dt) {
    for (const p of parts) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.grav || 0) * dt;
    }
    parts = parts.filter((p) => p.t < p.life);
    for (const f of floats) {
      f.t += dt;
      f.y -= 36 * dt;
    }
    floats = floats.filter((f) => f.t < f.life);
  };

  FX.draw = function (g) {
    for (const p of parts) {
      const a = 1 - p.t / p.life;
      g.globalAlpha = Math.max(0, a);
      g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.globalAlpha = 1;
    for (const f of floats) {
      const a = 1 - f.t / f.life;
      g.globalAlpha = Math.max(0, a);
      WH.T.text(g, f.str, f.x, f.y, f.size, f.color, "center");
      g.globalAlpha = 1;
    }
  };

  return FX;
})();

// ------------------------------------------------------------------ Night run state
WH.Night = (function () {
  const N = {};
  N.reset = function () {
    N.hour = 0;                 // 0..7 => 10 PM..5 AM
    N.cash = 0;                 // cash == score
    N.hp = 100;
    N.maxHp = 100;
    N.perks = new Set();
    N.grudges = [];             // enemy type ids queued from failed orders
    N.leftovers = [];           // cooked-but-unserved food -> brawl snacks
    N.heat = 0;                 // WAFL INDEX heat
    N.combo = 0;                // consecutive perfect serves
    N.usedSecondWind = false;
    N.linecookStation = null;
    N.lastPerk = null;
    N.stats = { served: 0, failed: 0, kos: 0, chairsCaught: 0, tips: 0, burned: 0 };
  };
  N.has = (perkId) => N.perks.has(perkId);
  N.indexLevel = function () {
    if (N.heat >= 6) return 2;
    if (N.heat >= 3) return 1;
    return 0;
  };
  N.addCash = function (amt) { N.cash += amt; };
  N.reset();
  return N;
})();

// ------------------------------------------------------------------ Game core
WH.Game = (function () {
  const G = {};
  const W = 960, H = 540;
  G.W = W; G.H = H;

  let canvas, ctx;
  let scene = null;
  let overlay = null;      // pause layer
  let shakeT = 0, shakeMag = 0;
  let hitstopT = 0;
  let fade = { t: 0, dur: 0, dir: 0, cb: null }; // dir 1 = to black, -1 = from black
  let last = 0;
  let accum = 0;
  const STEP = 1 / 60;

  G.debug = /[?&]debug=1/.test(location.search);
  G.debugInvuln = false;

  G.init = function () {
    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    window.addEventListener("resize", fit);
    fit();
    WH.Save.load();
    WH.Sprites.init();
    requestAnimationFrame(loop);
  };

  function fit() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = Math.floor(W * scale) + "px";
    canvas.style.height = Math.floor(H * scale) + "px";
  }

  G.setScene = function (s) {
    if (scene && scene.exit) scene.exit();
    overlay = null;
    WH.FX.clear(); // no floating text ghosts across scenes
    scene = s;
    if (s && s.enter) s.enter();
  };
  G.getScene = () => scene;

  G.pushOverlay = function (s) {
    overlay = s;
    if (s && s.enter) s.enter();
  };
  G.popOverlay = function () {
    if (overlay && overlay.exit) overlay.exit();
    overlay = null;
  };
  G.hasOverlay = () => !!overlay;

  G.shake = function (mag, dur) {
    if (!WH.Save.data.settings.shake) return;
    shakeMag = Math.max(shakeMag, mag);
    shakeT = Math.max(shakeT, dur);
  };

  G.hitstop = function (frames) {
    hitstopT = Math.max(hitstopT, frames * STEP);
  };

  // fade to black, run cb, fade back in
  G.transition = function (cb, dur) {
    fade.dur = dur || 0.35;
    fade.t = 0;
    fade.dir = 1;
    fade.cb = cb;
  };

  function simStep(dt) {
    // fade bookkeeping
    if (fade.dir !== 0) {
      fade.t += dt;
      if (fade.dir === 1 && fade.t >= fade.dur) {
        if (fade.cb) fade.cb();
        fade.cb = null;
        fade.dir = -1;
        fade.t = 0;
      } else if (fade.dir === -1 && fade.t >= fade.dur) {
        fade.dir = 0;
      }
    }
    if (hitstopT > 0) {
      hitstopT -= dt;
      return;
    }
    if (overlay) {
      if (overlay.update) overlay.update(dt);
    } else if (scene && scene.update && fade.dir !== 1) {
      scene.update(dt);
    }
    WH.FX.update(dt);
    if (shakeT > 0) shakeT -= dt;
  }

  function render() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (shakeT > 0) {
      ctx.translate(
        Math.round(WH.U.rand(-shakeMag, shakeMag)),
        Math.round(WH.U.rand(-shakeMag, shakeMag))
      );
    }
    if (scene && scene.draw) scene.draw(ctx);
    WH.FX.draw(ctx);
    if (overlay && overlay.draw) overlay.draw(ctx);
    ctx.restore();

    // fade curtain
    if (fade.dir !== 0) {
      const a = fade.dir === 1 ? fade.t / fade.dur : 1 - fade.t / fade.dur;
      ctx.fillStyle = `rgba(8,6,10,${WH.U.clamp(a, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (G.debug) {
      ctx.fillStyle = "#5fd668";
      ctx.font = '10px "Courier New", monospace';
      ctx.fillText(
        `DEBUG hour:${WH.Night.hour} hp:${Math.round(WH.Night.hp)} heat:${WH.Night.heat.toFixed(1)} $${WH.Night.cash}` +
        (G.debugInvuln ? " [INVULN]" : ""),
        6, H - 6
      );
    }
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    const now = ts / 1000;
    let dt = Math.min(now - last, 0.1);
    last = now;

    accum += dt;
    let steps = 0;
    while (accum >= STEP && steps < 5) {
      WH.Input.update(); // per-step so button edges fire exactly once
      simStep(STEP);
      accum -= STEP;
      steps++;
    }
    if (steps === 5) accum = 0; // dropped frames; don't spiral

    render();
  }

  // Debug/testing hook: advance N fixed frames synchronously and render once.
  // Lets automated tests drive the game when rAF is throttled (hidden tab).
  G.step = function (frames) {
    if (!G.debug) return;
    for (let i = 0; i < (frames || 1); i++) {
      WH.Input.update();
      simStep(STEP);
    }
    render();
  };

  // debug hotkeys
  window.addEventListener("keydown", (e) => {
    if (!G.debug) return;
    if (e.code === "F1") { e.preventDefault(); if (scene && scene.debugSkip) scene.debugSkip(); }
    if (e.code === "F2") { e.preventDefault(); WH.Night.addCash(200); }
    if (e.code === "F3") { e.preventDefault(); WH.Night.hp = WH.Night.maxHp; }
    if (e.code === "F4") { e.preventDefault(); G.debugInvuln = !G.debugInvuln; }
  });

  return G;
})();
