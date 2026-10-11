/* WAFFLE'S HOUSE — scenery.js
   Life outside the diner windows: random easter-egg passersby. Both windows
   look onto one continuous street — the wall between them hides the middle,
   so a car can vanish behind the menu board and reappear on the other side.
   Coordinates are screen pixels; GROUND is where feet and tires meet the lot. */
"use strict";
window.WH = window.WH || {};

WH.Scenery = (function () {
  const SC = {};
  const U = WH.U;
  const WIN = [{ x: 40, w: 240 }, { x: 620, w: 240 }];
  const TOP = 30, BOT = 170, MULLION_Y = 100;
  const GROUND = 166;
  const SKINS = ["#f0c8a0", "#e8b48c", "#c98f5e", "#8f5f3c", "#6e4428"];

  // relative odds; the UFO is meant to be a rare treat
  const WEIGHTS = { driveby: 24, heist: 18, party: 18, grandma: 16, raccoon: 17, ufo: 7 };
  SC.TYPES = Object.keys(WEIGHTS);
  SC.LABELS = {
    driveby: "DRIVE-BY", heist: "THIEF + COP CHASE", party: "PARTY GOERS",
    grandma: "GRANDMAS", raccoon: "RACCOON", ufo: "UFO",
  };

  let ev = null;     // the event currently playing out
  let timer = 7;     // seconds until the next one
  let queued = null; // developer-mode request

  function px(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), w, h);
  }
  function say(g, str, x, y, color) {
    WH.T.text(g, str, x, y, 10, color || "#f0e6c8", "center");
  }
  const onStreet = (x) => x > -40 && x < 1000;

  function pickType() {
    let total = 0;
    for (const k in WEIGHTS) total += WEIGHTS[k];
    let r = Math.random() * total;
    for (const k in WEIGHTS) { r -= WEIGHTS[k]; if (r <= 0) return k; }
    return "raccoon";
  }

  // ---------------------------------------------------------------- sprites
  function person(g, x, o) {
    const gy = GROUND - (o.bob || 0), d = o.dir || 1;
    const s = Math.sin(o.stride || 0) * 3;
    px(g, x - 3 + s, gy - 8, 3, 8, o.pants);
    px(g, x + 1 - s, gy - 8, 3, 8, o.pants);
    px(g, x - 5, gy - 18, 10, 11, o.shirt);
    px(g, x - 4, gy - 25, 8, 7, o.skin);
    px(g, x + (d > 0 ? 1 : -3), gy - 23, 2, 2, "#1c1c22");
  }

  function headlight(g, front, gy, d) {
    g.fillStyle = "rgba(255,236,160,0.16)";
    g.beginPath();
    g.moveTo(front, gy - 9);
    g.lineTo(front + d * 50, gy - 15);
    g.lineTo(front + d * 50, gy + 3);
    g.closePath();
    g.fill();
  }

  function drawCar(g, c) {
    const d = c.dir, gy = GROUND - (c.bounce || 0);
    headlight(g, c.x + d * 22, gy, d);
    px(g, c.x - 22, gy - 12, 44, 8, c.body);
    px(g, c.x - 22, gy - 5, 44, 2, "rgba(0,0,0,0.35)");
    if (!c.open) {
      px(g, c.x - 11 - d * 2, gy - 19, 22, 7, c.roof || c.body);
      px(g, c.x - 8 - d * 2, gy - 17, 7, 4, "#8fb4c8");
      px(g, c.x + 1 - d * 2, gy - 17, 7, 4, "#8fb4c8");
    }
    px(g, d > 0 ? c.x + 19 : c.x - 22, gy - 11, 3, 3, "#fff2b0");
    px(g, d > 0 ? c.x - 22 : c.x + 19, gy - 11, 3, 3, "#ff3b30");
    const wy = GROUND - 6; // wheels stay planted while the body bounces
    px(g, c.x - 16, wy, 8, 8, "#141418");
    px(g, c.x + 8, wy, 8, 8, "#141418");
    px(g, c.x - 14, wy + 2, 4, 4, c.rim || "#8a8a8a");
    px(g, c.x + 10, wy + 2, 4, 4, c.rim || "#8a8a8a");
  }

  function drawCop(g, c, t) {
    drawCar(g, c);
    px(g, c.x - 22, GROUND - 9, 44, 2, "#2c5fd1");
    const flip = Math.floor(t * 7) % 2 === 0;
    const lx = c.x - 7 - c.dir * 2;
    px(g, lx, GROUND - 22, 7, 3, flip ? "#ff3b30" : "#3b6bff");
    px(g, lx + 7, GROUND - 22, 7, 3, flip ? "#3b6bff" : "#ff3b30");
    // a tight flash on whichever side is lit, not a halo over the whole car
    g.fillStyle = flip ? "rgba(255,59,48,0.32)" : "rgba(59,107,255,0.32)";
    g.beginPath();
    g.arc(flip ? lx + 3 : lx + 10, GROUND - 21, 8, 0, Math.PI * 2);
    g.fill();
  }

  function drawLimo(g, L, t) {
    const d = L.dir, gy = GROUND, x = L.x;
    headlight(g, x + d * 46, gy, d);
    // party people popping out of the sunroof (drawn first; the roof hides their waists)
    for (let i = 0; i < 3; i++) {
      const hx = x - 16 + i * 14, pop = Math.abs(Math.sin(t * 7 + i * 1.7)) * 5;
      px(g, hx - 3, gy - 26 - pop, 7, 7, SKINS[i]);
      g.fillStyle = ["#ff5f4e", "#3b6bff", "#ffd23e"][i];
      g.beginPath();
      g.moveTo(hx - 3, gy - 26 - pop);
      g.lineTo(hx + 4, gy - 26 - pop);
      g.lineTo(hx, gy - 34 - pop);
      g.fill();
      if (Math.sin(t * 7 + i) > 0) px(g, hx + 4, gy - 31 - pop, 2, 6, SKINS[i]);
    }
    px(g, x - 46, gy - 12, 92, 8, "#e85aa8");
    px(g, x - 34, gy - 19, 68, 7, "#c94a90");
    for (let i = 0; i < 4; i++) px(g, x - 30 + i * 16, gy - 17, 11, 4, "#3a2a4a");
    px(g, x - 46, gy - 5, 92, 2, "rgba(0,0,0,0.35)");
    px(g, d > 0 ? x + 43 : x - 46, gy - 11, 3, 3, "#fff2b0");
    px(g, d > 0 ? x - 46 : x + 43, gy - 11, 3, 3, "#ff3b30");
    for (const wx of [x - 36, x - 4, x + 28]) {
      px(g, wx, gy - 6, 8, 8, "#141418");
      px(g, wx + 2, gy - 4, 4, 4, "#d0d4dc");
    }
  }

  function drawThief(g, th, t) {
    const run = th.mode === "run";
    const step = th.paused ? 0 : t * (run ? 22 : 9);
    const bob = th.paused ? 0 : Math.abs(Math.sin(step)) * (run ? 2 : 4); // tiptoeing = big bounce
    const s = Math.sin(step) * (run ? 4 : 3);
    const x = th.x, y = GROUND - bob;
    px(g, x - 3 + s, y - 8, 3, 8, "#1c1c22");
    px(g, x + 1 - s, y - 8, 3, 8, "#1c1c22");
    px(g, x - 5, y - 18, 10, 11, "#e8e4da");    // classic striped shirt
    px(g, x - 5, y - 16, 10, 2, "#1c1c22");
    px(g, x - 5, y - 12, 10, 2, "#1c1c22");
    px(g, x - 4, y - 25, 8, 7, "#e8b48c");
    px(g, x - 4, y - 23, 8, 3, "#1c1c22");      // the mask
    px(g, x + 1, y - 22, 2, 1, "#f0f0f0");
    px(g, x - 4, y - 28, 8, 3, "#1c1c22");      // beanie
    px(g, x - 14, y - 27, 10, 10, "#8a6a3a");   // loot sack over the shoulder
    px(g, x - 10, y - 29, 3, 3, "#8a6a3a");
    WH.T.text(g, "$", x - 9, y - 19, 8, "#ffd23e", "center", true, false);
    if (th.paused) say(g, "shh!", x, y - 33);
    if (th.alarm > 0) say(g, "!!", x, y - 33, "#ff5f4e");
  }

  function drawDancer(g, d, dir, t) {
    const ph = t * 9 + d.i * 1.3;
    const bob = Math.abs(Math.sin(ph)) * 3;
    person(g, d.x, { dir, shirt: d.shirt, pants: "#2c2c34", skin: d.skin, stride: ph, bob });
    const y = GROUND - bob;
    if (d.lamp) {
      px(g, d.x - 5, y - 31, 10, 6, "#f5e6c8"); // a lampshade, naturally
      px(g, d.x - 6, y - 26, 12, 1, "#d8c8a8");
    } else {
      g.fillStyle = d.hat;
      g.beginPath();
      g.moveTo(d.x - 4, y - 25);
      g.lineTo(d.x + 4, y - 25);
      g.lineTo(d.x + dir, y - 34);
      g.fill();
    }
    if (Math.sin(ph) > 0) { // hands up on the beat
      px(g, d.x - 7, y - 27, 2, 8, d.skin);
      px(g, d.x + 5, y - 27, 2, 8, d.skin);
    }
    if (d.balloons) {
      const bx = d.x + dir * 6;
      g.strokeStyle = "rgba(240,240,235,0.7)";
      g.lineWidth = 1;
      for (const [c, ox, oy] of [["#ff5f4e", -5, -48], ["#48d0c8", 2, -53], ["#ffd23e", 7, -46]]) {
        g.beginPath();
        g.moveTo(bx, y - 18);
        g.lineTo(bx + ox, y + oy + 4);
        g.stroke();
        g.fillStyle = c;
        g.beginPath();
        g.arc(bx + ox, y + oy, 4, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  function drawGranny(g, w, d, t) {
    const x = w.x, gy = GROUND;
    const shuffle = Math.sin(t * 6) * 1.5;
    const fx = x + d * 9; // the walker, out in front
    const fl = Math.min(fx, fx + d * 7);
    px(g, fx - 1, gy - 14, 2, 14, "#b8bfc9");
    px(g, fx + d * 7 - 1, gy - 14, 2, 14, "#b8bfc9");
    px(g, fl - 1, gy - 15, 10, 2, "#b8bfc9");
    px(g, fx - 2, gy - 2, 3, 2, "#c8e04a"); // tennis-ball feet
    px(g, fx + d * 7 - 2, gy - 2, 3, 2, "#c8e04a");
    px(g, x - 3 + shuffle, gy - 5, 2, 5, "#e8d0b8");
    px(g, x + 1 - shuffle, gy - 5, 2, 5, "#e8d0b8");
    px(g, x - 5, gy - 11, 10, 6, "#4a5a8a");          // skirt
    px(g, x - 5 + d, gy - 19, 10, 9, "#8a5c8f");      // cardigan, hunched forward
    px(g, Math.min(x + d * 3, x + d * 10), gy - 16, 7, 2, "#8a5c8f"); // arm to the walker
    const hx = x + d * 3;
    px(g, hx - 3, gy - 25, 7, 7, "#f0c8a0");
    px(g, hx + (d > 0 ? 1 : -3), gy - 23, 3, 2, "#d0e4f0"); // glasses
    px(g, hx - 4, gy - 27, 8, 3, "#c8c8cc");
    px(g, hx - d * 4 - 2, gy - 30, 5, 4, "#c8c8cc");        // bun
  }

  function drawScooter(g, s, d, t) {
    const x = s.x, gy = GROUND;
    for (let i = 0; i < 3; i++) { // speed lines
      px(g, x - d * (24 + i * 7) - (d > 0 ? 9 : 0), gy - 19 + i * 5, 9, 1, "rgba(240,240,235,0.55)");
    }
    px(g, x - 13, gy - 8, 26, 5, "#c93a2e");          // deck
    px(g, x + d * 9 - 1, gy - 21, 3, 14, "#8a919c");  // steering column
    px(g, x + d * 9 - 4, gy - 23, 8, 2, "#2c2c34");   // handlebar
    px(g, x + d * 12 - 3, gy - 18, 7, 5, "#8a6a3a");  // basket
    px(g, x - 11, gy - 4, 6, 6, "#141418");
    px(g, x + 5, gy - 4, 6, 6, "#141418");
    const pole = x - d * 11; // safety flag, snapping in the wind
    px(g, pole, gy - 32, 1, 24, "#d0d4dc");
    g.fillStyle = "#ff8f3a";
    g.beginPath();
    g.moveTo(pole, gy - 32);
    g.lineTo(pole - d * 9, gy - 29 + Math.sin(t * 25));
    g.lineTo(pole, gy - 26);
    g.fill();
    px(g, x - 5, gy - 18, 9, 10, "#4a8a6a");          // sporty teal cardigan
    px(g, x - 3 + d * 2, gy - 25, 7, 7, "#f0c8a0");
    px(g, x - 4 + d * 2, gy - 27, 8, 3, "#c8c8cc");
    px(g, x - d * 6 - 2, gy - 29, 4, 4, "#c8c8cc");   // bun
    px(g, x + d * 4 - 1, gy - 23, 3, 2, "#d0e4f0");   // goggles
    if (s.beep > 0) say(g, "beep beep!", x, gy - 36, "#ffd23e");
  }

  function drawRaccoon(g, r, d, t) {
    const x = r.x, gy = GROUND;
    const still = r.stop > 0;
    const s = still ? 0 : Math.sin(t * 30) * 2;
    for (let i = 0; i < 4; i++) { // ringed tail
      px(g, x - d * (9 + i * 3) - 1, gy - 9 - i, 3, 3, i % 2 ? "#2c2c34" : "#8a8a92");
    }
    px(g, x - 8, gy - 9, 15, 6, "#7a7a82");
    px(g, x - 6 + s, gy - 3, 2, 3, "#2c2c34");
    px(g, x + 3 - s, gy - 3, 2, 3, "#2c2c34");
    const hx = x + d * 8;
    px(g, hx - 3, gy - 12, 7, 6, "#8a8a92");
    px(g, hx - 3, gy - 10, 7, 2, "#1c1c22");                  // the mask
    px(g, hx - 2, gy - 10, 1, 1, still ? "#ffffff" : "#c8c8c8"); // eyeshine
    px(g, hx + 2, gy - 10, 1, 1, still ? "#ffffff" : "#c8c8c8");
    px(g, hx - 3, gy - 14, 2, 2, "#7a7a82");
    px(g, hx + 2, gy - 14, 2, 2, "#7a7a82");
    g.fillStyle = "#ffd23e"; // contraband: one (1) slice of pizza
    g.beginPath();
    g.moveTo(hx + d * 4, gy - 9);
    g.lineTo(hx + d * 12, gy - 11);
    g.lineTo(hx + d * 12, gy - 5);
    g.fill();
    px(g, hx + d * 9 - 1, gy - 9, 2, 2, "#c93a2e");
  }

  function drawUfo(g, s, t) {
    const y = s.y + Math.sin(t * 3) * 2;
    g.fillStyle = "rgba(72,208,200,0.6)";
    g.beginPath();
    g.arc(s.x, y - 3, 9, Math.PI, 0);
    g.fill();
    g.fillStyle = "#b8bfc9";
    g.beginPath();
    g.ellipse(s.x, y, 24, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#8a919c";
    g.beginPath();
    g.ellipse(s.x, y + 2, 24, 3, 0, 0, Math.PI);
    g.fill();
    const cols = ["#ff5f4e", "#ffd23e", "#5fd668"];
    for (let i = 0; i < 5; i++) {
      px(g, s.x - 17 + i * 8, y - 1, 3, 2, cols[(Math.floor(t * 8) + i) % 3]);
    }
  }

  function drawBeam(g, s, t) {
    const y = s.y + Math.sin(t * 3) * 2 + 4;
    g.fillStyle = `rgba(150,255,170,${0.18 + Math.sin(t * 20) * 0.04})`;
    g.beginPath();
    g.moveTo(s.x - 9, y);
    g.lineTo(s.x + 9, y);
    g.lineTo(s.x + 30, GROUND + 2);
    g.lineTo(s.x - 30, GROUND + 2);
    g.closePath();
    g.fill();
  }

  function drawCow(g, c, grazing, t) {
    g.save();
    g.translate(Math.round(c.x), Math.round(c.y));
    if (c.rot) g.rotate(c.rot);
    px(g, -11, -15, 22, 10, "#f0ece0");
    px(g, -6, -14, 5, 4, "#1c1c22");
    px(g, 3, -11, 6, 4, "#1c1c22");
    for (const lx of [-9, -4, 3, 7]) px(g, lx, -5, 3, 5, "#1c1c22");
    const hy = grazing ? -9 : -17;
    px(g, -18, hy, 8, 8, "#f0ece0");
    px(g, -19, hy + 4, 5, 4, "#f2a8b8");
    px(g, -16, hy - 2, 2, 2, "#d8d4c8");
    px(g, -12, hy - 2, 2, 2, "#d8d4c8");
    px(g, 11, -14 + Math.sin(t * 4), 2, 7, "#1c1c22");
    g.restore();
  }

  // ---------------------------------------------------------------- events
  // Each event: start(ev) sets up actors, tick(ev, dt) returns true when
  // everyone has left the street, draw(g, ev) paints them.
  const DEF = {};

  DEF.driveby = {
    start(ev) {
      const dir = U.chance(0.5) ? 1 : -1;
      const bass = U.chance(0.6); // lowrider on hydraulics, or a convertible
      ev.car = {
        x: dir > 0 ? -70 : 1030, dir, speed: bass ? 118 : 175, bass, open: !bass,
        body: bass ? "#7a3f8f" : "#c93a2e", rim: bass ? "#ffd23e" : "#d0d4dc",
      };
      ev.thump = 0;
    },
    tick(ev, dt) {
      const c = ev.car;
      c.x += c.dir * c.speed * dt;
      c.bounce = c.bass ? Math.max(0, Math.sin(ev.t * 13)) * 3 : 0;
      if (c.bass && onStreet(c.x)) {
        ev.thump -= dt;
        if (ev.thump <= 0) {
          ev.thump = 0.45;
          WH.Audio.sfx("bass");
          ev.bits.push({
            kind: "note", x: c.x + U.rand(-10, 10), y: GROUND - 22, vx: U.rand(-8, 8), vy: -26,
            life: 1.6, t: 0, ch: U.pick(["♪", "♫"]), color: U.pick(["#ff8fd0", "#48d0c8", "#ffd23e"]),
          });
        }
      }
      return c.dir > 0 ? c.x > 1060 : c.x < -100;
    },
    draw(g, ev) {
      const c = ev.car;
      drawCar(g, c);
      if (c.open) { // driver with a scarf streaming behind
        const hx = c.x - c.dir * 3, gy = GROUND - 12;
        px(g, hx - 3, gy - 9, 7, 7, "#e8b48c");
        px(g, c.dir > 0 ? hx - 17 : hx + 3, gy - 6 + Math.sin(ev.t * 20) * 2, 14, 2, "#ffd23e");
      }
    },
  };

  DEF.heist = {
    start(ev) {
      ev.thief = { x: -20, speed: 40, mode: "sneak", paused: false, pauseT: 0, alarm: 0 };
      ev.cop = null;
      ev.siren = 0;
    },
    tick(ev, dt) {
      const th = ev.thief;
      // halfway across the first window he freezes, looks around... "shh!"
      if (th.mode === "sneak" && !th.paused && th.pauseT === 0 && th.x > 150) {
        th.paused = true;
        th.pauseT = 1.6;
      }
      if (th.paused) {
        th.pauseT -= dt;
        if (th.pauseT <= 0) { th.paused = false; th.pauseT = -1; }
      } else {
        th.x += th.speed * dt;
      }
      if (!ev.cop && th.x > 640) { // he's made it to the second window. Then: sirens.
        ev.cop = { x: -70, dir: 1, speed: 300, body: "#e8e4da", roof: "#e8e4da", rim: "#d0d4dc" };
        th.mode = "run";
        th.speed = 155;
        th.alarm = 1.0;
      }
      th.alarm = Math.max(0, th.alarm - dt);
      if (ev.cop) {
        ev.cop.x += ev.cop.speed * dt;
        ev.siren -= dt;
        if (ev.siren <= 0 && ev.cop.x < 1000) { ev.siren = 1.3; WH.Audio.sfx("siren"); }
      }
      return th.x > 1010 && !!ev.cop && ev.cop.x > 1070;
    },
    draw(g, ev) {
      drawThief(g, ev.thief, ev.t);
      if (ev.cop) drawCop(g, ev.cop, ev.t);
    },
  };

  DEF.party = {
    start(ev) {
      ev.dir = U.chance(0.5) ? 1 : -1;
      ev.bus = U.chance(0.4); // party limo, or a conga line on foot
      ev.woo = 1.2;
      ev.wooT = 0;
      ev.wooWho = 0;
      ev.conf = 0;
      if (ev.bus) {
        ev.limo = { x: ev.dir > 0 ? -100 : 1060, dir: ev.dir, speed: 72 };
      } else {
        const sx = ev.dir > 0 ? -24 : 984;
        ev.dancers = ["#ff8fd0", "#48d0c8", "#ffd23e", "#8fe07c"].map((shirt, i) => ({
          x: sx - ev.dir * i * 17, shirt, i, skin: U.pick(SKINS),
          hat: U.pick(["#ff5f4e", "#3b6bff", "#ffd23e", "#c9a2e8"]),
        }));
        ev.dancers[0].balloons = true;
        ev.dancers[3].lamp = true;
      }
    },
    tick(ev, dt) {
      if (ev.bus) ev.limo.x += ev.dir * ev.limo.speed * dt;
      else for (const d of ev.dancers) d.x += ev.dir * 48 * dt;
      ev.conf -= dt;
      if (ev.conf <= 0) {
        ev.conf = 0.12;
        const src = ev.bus ? ev.limo.x + U.rand(-16, 16) : U.pick(ev.dancers).x;
        if (onStreet(src)) {
          ev.bits.push({
            kind: "confetti", x: src + U.rand(-8, 8), y: GROUND - 32, vx: U.rand(-20, 20), vy: U.rand(-40, -10),
            life: 1.3, t: 0, color: U.pick(["#ff8fd0", "#48d0c8", "#ffd23e", "#8fe07c", "#ff5f4e"]),
          });
        }
      }
      ev.woo -= dt;
      if (ev.woo <= 0) {
        ev.woo = U.rand(1.6, 2.8);
        ev.wooT = 0.9;
        ev.wooWho = ev.bus ? 0 : U.randInt(0, ev.dancers.length - 1);
      }
      ev.wooT = Math.max(0, ev.wooT - dt);
      const tail = ev.bus ? ev.limo.x - ev.dir * 50 : ev.dancers[ev.dancers.length - 1].x;
      return ev.dir > 0 ? tail > 1040 : tail < -80;
    },
    draw(g, ev) {
      if (ev.bus) drawLimo(g, ev.limo, ev.t);
      else for (const d of ev.dancers) drawDancer(g, d, ev.dir, ev.t);
      if (ev.wooT > 0) {
        const x = ev.bus ? ev.limo.x : ev.dancers[ev.wooWho].x;
        say(g, "WOOO!", x, GROUND - (ev.bus ? 52 : 44), "#ffd23e");
      }
    },
  };

  DEF.grandma = {
    start(ev) {
      ev.dir = U.chance(0.5) ? 1 : -1;
      const sx = ev.dir > 0 ? -16 : 876;
      ev.walker = { x: sx, start: sx };
      ev.scooter = null;
      ev.passed = false;
      ev.hmph = 0;
    },
    tick(ev, dt) {
      const w = ev.walker, d = ev.dir;
      w.x += d * 24 * dt;
      // she's barely gotten going when the OTHER grandma blows past on a scooter
      if (!ev.scooter && Math.abs(w.x - w.start) > 120) {
        ev.scooter = { x: d > 0 ? -50 : 1010, beep: 1.0 };
        WH.Audio.sfx("beep");
      }
      if (ev.scooter) {
        const s = ev.scooter;
        s.x += d * 205 * dt;
        s.beep = Math.max(0, s.beep - dt);
        if (!ev.passed && (d > 0 ? s.x > w.x + 16 : s.x < w.x - 16)) { ev.passed = true; ev.hmph = 1.4; }
      }
      ev.hmph = Math.max(0, ev.hmph - dt);
      const walkerGone = d > 0 ? w.x > 300 : w.x < 600; // shuffled behind the wall
      const scootGone = !!ev.scooter && (d > 0 ? ev.scooter.x > 1050 : ev.scooter.x < -90);
      return walkerGone && scootGone;
    },
    draw(g, ev) {
      drawGranny(g, ev.walker, ev.dir, ev.t);
      if (ev.hmph > 0) say(g, "HMPH!", ev.walker.x, GROUND - 35, "#ff8f7f");
      if (ev.scooter) drawScooter(g, ev.scooter, ev.dir, ev.t);
    },
  };

  DEF.raccoon = {
    start(ev) {
      ev.dir = U.chance(0.5) ? 1 : -1;
      ev.r = { x: ev.dir > 0 ? -20 : 980, stop: 0, stopped: false };
    },
    tick(ev, dt) {
      const r = ev.r, d = ev.dir;
      const mid = d > 0 ? 160 : 740;
      if (!r.stopped && (d > 0 ? r.x > mid : r.x < mid)) { r.stopped = true; r.stop = 1.1; } // stares at you
      if (r.stop > 0) r.stop -= dt;
      else r.x += d * 140 * dt;
      return d > 0 ? r.x > 1010 : r.x < -50;
    },
    draw(g, ev) {
      drawRaccoon(g, ev.r, ev.dir, ev.t);
    },
  };

  DEF.ufo = {
    start(ev) {
      ev.phase = "cowIn";
      ev.pt = 0;
      ev.cow = { x: 885, y: GROUND, rot: 0, gone: false };
      ev.ship = null;
    },
    tick(ev, dt) {
      ev.pt += dt;
      const cow = ev.cow;
      const next = (p) => { ev.phase = p; ev.pt = 0; };
      if (ev.phase === "cowIn") { // a cow. in a diner parking lot. at 3 AM.
        cow.x -= 30 * dt;
        if (cow.x <= 770) next("graze");
      } else if (ev.phase === "graze") {
        if (ev.pt > 1.6) { next("ufoIn"); ev.ship = { x: 600, y: 18 }; WH.Audio.sfx("ufo"); }
      } else if (ev.phase === "ufoIn") {
        const k = Math.min(1, ev.pt / 2);
        const e = 1 - Math.pow(1 - k, 3);
        ev.ship.x = 600 + 170 * e;
        ev.ship.y = 18 + 40 * e;
        if (k >= 1) next("beam");
      } else if (ev.phase === "beam") {
        const k = Math.min(1, ev.pt / 3.2);
        cow.y = GROUND - (GROUND - 72) * k * k;
        cow.rot = Math.sin(ev.pt * 2) * 0.35 * k;
        if (k >= 1) { cow.gone = true; next("hold"); }
      } else if (ev.phase === "hold") {
        if (ev.pt > 0.6) { next("zip"); WH.Audio.sfx("ufo"); }
      } else if (ev.phase === "zip") {
        ev.ship.x += (180 + ev.pt * 700) * dt;
        ev.ship.y -= (60 + ev.pt * 200) * dt;
        if (ev.ship.x > 1000 || ev.ship.y < -40) {
          const sc = WH.Game.getScene();
          if (sc && sc.kind === "cook") {
            WH.FX.float(480, 228, '"...did anybody else see that?"', "#b8f0a8", 13, 2.6);
          }
          return true;
        }
      }
      return false;
    },
    draw(g, ev) {
      if (ev.phase === "beam" || ev.phase === "hold") drawBeam(g, ev.ship, ev.t);
      if (!ev.cow.gone) drawCow(g, ev.cow, ev.phase === "graze" || ev.phase === "ufoIn", ev.t);
      if (ev.ship) drawUfo(g, ev.ship, ev.t);
      if (ev.phase === "beam" && ev.pt > 0.4 && ev.pt < 2.4) say(g, "MOO?", ev.cow.x, ev.cow.y - 22);
    },
  };

  // ---------------------------------------------------------------- particles
  function tickBits(e, dt) {
    for (const b of e.bits) {
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.kind === "confetti") b.vy += 70 * dt;
    }
    e.bits = e.bits.filter((b) => b.t < b.life);
  }

  function drawBits(g, e) {
    for (const b of e.bits) {
      g.globalAlpha = Math.max(0, 1 - b.t / b.life);
      if (b.kind === "note") WH.T.text(g, b.ch, b.x, b.y, 11, b.color, "center", true, false);
      else px(g, b.x, b.y, 2, 2, b.color);
    }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- public
  function begin(type) {
    ev = { type, t: 0, bits: [], done: false };
    DEF[type].start(ev);
  }

  SC.update = function (dt) {
    if (ev) {
      ev.t += dt;
      if (!ev.done && DEF[ev.type].tick(ev, dt)) ev.done = true;
      tickBits(ev, dt);
      if (ev.done && ev.bits.length === 0) {
        ev = null;
        timer = queued ? 1.2 : U.rand(12, 26);
      }
    } else {
      timer -= dt;
      if (timer <= 0) {
        begin(queued || pickType());
        queued = null;
      }
    }
  };

  // Call right after drawing the diner background. Paints the street action
  // clipped to the glass, then re-lays the window frames on top so it all
  // reads as happening OUTSIDE.
  SC.draw = function (g) {
    if (!ev) return;
    g.save();
    g.beginPath();
    for (const w of WIN) g.rect(w.x, TOP, w.w, BOT - TOP);
    g.clip();
    if (!ev.done) DEF[ev.type].draw(g, ev);
    drawBits(g, ev);
    g.restore();
    g.strokeStyle = "#2c2117";
    g.lineWidth = 6;
    for (const w of WIN) {
      g.strokeRect(w.x, TOP, w.w, BOT - TOP);
      g.beginPath();
      g.moveTo(w.x + w.w / 2, TOP);
      g.lineTo(w.x + w.w / 2, BOT);
      g.moveTo(w.x, MULLION_Y);
      g.lineTo(w.x + w.w, MULLION_Y);
      g.stroke();
    }
  };

  // developer mode: line up a specific event next
  SC.queue = function (type) {
    queued = type;
    ev = null;
    timer = 1.2;
  };
  SC.spawn = function (type) { begin(type); };
  SC.active = () => (ev ? ev.type : null);

  return SC;
})();
