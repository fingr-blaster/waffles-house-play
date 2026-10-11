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

  function readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.connected) return p;
    }
    return null;
  }

  I.update = function () {
    const pad = readPad();
    padConnected = !!pad;
    if (pad) {
      // any button press unlocks audio too
      if (pad.buttons.some((b) => b.pressed)) {
        WH.Audio.unlock();
        WH.Audio.resumePending();
        anyKeyRaw = true;
      }
    }

    for (const name in KEYMAP) {
      const kb = KEYMAP[name].some((code) => keys[code]);
      let gp = false;
      if (pad) {
        gp = (PADMAP[name] || []).some((idx) => pad.buttons[idx] && pad.buttons[idx].pressed);
      }
      prev[name] = held[name];
      held[name] = kb || gp;
    }

    // analog axes
    axX = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    axY = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    if (pad) {
      const dz = 0.28;
      const gx = pad.axes[0] || 0, gy = pad.axes[1] || 0;
      if (Math.abs(gx) > dz) axX = Math.abs(gx) > Math.abs(axX) ? gx : axX;
      if (Math.abs(gy) > dz) axY = Math.abs(gy) > Math.abs(axY) ? gy : axY;
    }
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

  // human-readable prompts that adapt to input device
  I.prompt = function (name) {
    if (padConnected) {
      return { interact: "A", attack: "X", heavy: "Y", dodge: "B", pause: "START" }[name] || name;
    }
    return { interact: "E", attack: "J", heavy: "K", dodge: "SPACE", pause: "ESC" }[name] || name;
  };

  return I;
})();
