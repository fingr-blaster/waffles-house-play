/* WAFFLE'S HOUSE — input.js
   Unified keyboard + gamepad input with virtual buttons.
   Keyboard: WASD/Arrows move · E/Enter interact · J/Z punch · K/X heavy
             Space/Shift dodge · Esc/P pause
   Gamepad:  stick/dpad move · A interact · X punch · Y heavy · B dodge
             Start pause */
"use strict";
window.WH = window.WH || {};

WH.Input = (function () {
  const I = {};
  const keys = {}; // raw key state by code

  const KEYMAP = {
    left: ["ArrowLeft", "KeyA"],
    right: ["ArrowRight", "KeyD"],
    up: ["ArrowUp", "KeyW"],
    down: ["ArrowDown", "KeyS"],
    interact: ["KeyE", "Enter"],
    attack: ["KeyJ", "KeyZ"],
    heavy: ["KeyK", "KeyX"],
    dodge: ["Space", "ShiftLeft", "ShiftRight"],
    pause: ["Escape", "KeyP"],
  };
  // gamepad button indices (standard mapping)
  const PADMAP = {
    interact: [0],        // A
    dodge: [1],           // B
    attack: [2],          // X
    heavy: [3, 5],        // Y, RB
    pause: [9],           // Start
    left: [14],
    right: [15],
    up: [12],
    down: [13],
  };

  const held = {};
  const prev = {};
  let axX = 0, axY = 0;
  let padConnected = false;
  I.anyKeyThisFrame = false;
  let anyKeyRaw = false;

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) {
      e.preventDefault(); // don't scroll the page
    }
    if (!e.repeat) anyKeyRaw = true;
    keys[e.code] = true;
    WH.Audio.unlock();
    WH.Audio.resumePending();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });
  window.addEventListener("mousedown", () => {
    WH.Audio.unlock();
    WH.Audio.resumePending();
  });
  window.addEventListener("blur", () => {
    for (const k in keys) keys[k] = false;
  });

  // Every connected pad counts. Reading only the first slot broke play
  // whenever Steam or a virtual device sat in slot 1 ahead of the real pad.
  function readPads() {
    const out = [];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) out.push(p);
    return out;
  }

  // Sticks double as a d-pad for menus. Latched with hysteresis: engage
  // past 0.35 (a light flick counts), release under 0.2 (edge jitter can't
  // double-fire one push).
  const NAV_ON = 0.35, NAV_OFF = 0.2;
  const navLatch = { left: false, right: false, up: false, down: false };
  const digital = {}; // keys + pad buttons only, no stick (feeds movement)

  function strongest(pads, ix, iy, standardOnly) {
    let bx = 0, by = 0;
    for (const p of pads) {
      // on non-standard pads, axes 2/3 can be triggers resting at -1
      if (standardOnly && p.mapping !== "standard") continue;
      const x = p.axes[ix] || 0, y = p.axes[iy] || 0;
      if (Math.hypot(x, y) > Math.hypot(bx, by)) { bx = x; by = y; }
    }
    return [bx, by];
  }

  I.update = function () {
    const pads = readPads();
    padConnected = pads.length > 0;
    // any button press unlocks audio too
    if (pads.some((p) => p.buttons.some((b) => b.pressed))) {
      WH.Audio.unlock();
      WH.Audio.resumePending();
      anyKeyRaw = true;
    }

    const [lx, ly] = strongest(pads, 0, 1, false);
    const [rx, ry] = strongest(pads, 2, 3, true);
    const nx = Math.abs(rx) > Math.abs(lx) ? rx : lx;
    const ny = Math.abs(ry) > Math.abs(ly) ? ry : ly;
    const latch = (v, on) => (on ? v > NAV_OFF : v > NAV_ON);
    navLatch.right = latch(nx, navLatch.right);
    navLatch.left = latch(-nx, navLatch.left);
    navLatch.down = latch(ny, navLatch.down);
    navLatch.up = latch(-ny, navLatch.up);

    for (const name in KEYMAP) {
      const kb = KEYMAP[name].some((code) => keys[code]);
      const btn = pads.some((p) =>
        (PADMAP[name] || []).some((idx) => p.buttons[idx] && p.buttons[idx].pressed));
      digital[name] = kb || btn;
      prev[name] = held[name];
      held[name] = digital[name] || !!navLatch[name];
    }

    // movement: keys/d-pad give full speed, the left stick stays truly analog
    axX = (digital.right ? 1 : 0) - (digital.left ? 1 : 0);
    axY = (digital.down ? 1 : 0) - (digital.up ? 1 : 0);
    const dz = 0.28;
    if (Math.abs(lx) > dz && Math.abs(lx) > Math.abs(axX)) axX = lx;
    if (Math.abs(ly) > dz && Math.abs(ly) > Math.abs(axY)) axY = ly;
    axX = WH.U.clamp(axX, -1, 1);
    axY = WH.U.clamp(axY, -1, 1);

    I.anyKeyThisFrame = anyKeyRaw;
    anyKeyRaw = false;
  };

  I.held = (name) => !!held[name];
  I.pressed = (name) => !!held[name] && !prev[name];
  I.axisX = () => axX;
  I.axisY = () => axY;
  I.hasPad = () => padConnected;

  // controller rumble (no-op without a pad or on pads without an actuator)
  I.rumble = function (strong, weak, ms) {
    for (const pad of readPads()) {
      const act = pad.vibrationActuator;
      if (!act || typeof act.playEffect !== "function") continue;
      try {
        act.playEffect("dual-rumble", {
          duration: ms || 120,
          strongMagnitude: WH.U.clamp(strong || 0, 0, 1),
          weakMagnitude: WH.U.clamp(weak === undefined ? strong || 0 : weak, 0, 1),
          startDelay: 0,
        });
      } catch (e) { /* older pads/browsers: silently skip */ }
    }
  };

  // human-readable prompts that adapt to input device
  I.prompt = function (name) {
    if (padConnected) {
      return { interact: "A", attack: "X", heavy: "Y", dodge: "B", pause: "START" }[name] || name;
    }
    return { interact: "E", attack: "J", heavy: "K", dodge: "SPACE", pause: "ESC" }[name] || name;
  };

  return I;
})();
