/* WAFFLE'S HOUSE — sprites.js
   Procedural pixel art. Everything is drawn in code: characters, food,
   furniture, and the diner itself. No external assets. */
"use strict";
window.WH = window.WH || {};

WH.Sprites = (function () {
  const S = {};
  const U = WH.U;

  // ------------------------------------------------------------ icon maker
  // rows: array of strings; palette: {char: cssColor}; px: pixel size
  function makeIcon(rows, palette, px) {
    px = px || 3;
    const w = rows[0].length, h = rows.length;
    const c = document.createElement("canvas");
    c.width = w * px;
    c.height = h * px;
    const g = c.getContext("2d");
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === ".") continue;
        g.fillStyle = palette[ch] || "#f0f";
        g.fillRect(x * px, y * px, px, px);
      }
    }
    return c;
  }

  const P = {
    w: "#e8b64c", W: "#c98f2e", d: "#8a5a1a", // waffle golds
    e: "#f5f0e6", y: "#ffc93e",               // egg white / yolk
    b: "#b5533c", B: "#7e3428", f: "#e8a08a", // bacon
    h: "#d9a44c", H: "#a8742a", A: "#f2cd78", // hash golds + crispy highlight
    o: "#c9a2e8",                             // onion
    c: "#ffd23e",                             // cheese
    m: "#e8e4da", M: "#b8b4aa", k: "#4a3428", // mug / coffee
    r: "#ff5f4e", R: "#c93a2e",               // heart red
    s: "#ffe066",                             // star
    x: "#3a3a44", X: "#22222a",               // dark outline
    n: "#c98f5a", N: "#8a5c34",               // wood
    t: "#d0d4dc",                             // steel
  };

  S.icons = {};

  function buildIcons() {
    S.icons.waffle = makeIcon([
      "..wwwwww..",
      ".wWwWwWww.",
      "wWdWdWdWww",
      "wWwWwWwWww",
      "wWdWdWdWww",
      "wWwWwWwWww",
      "wWdWdWdWww",
      ".wwwwwwww.",
      "..wwwwww..",
    ], P);
    S.icons.eggs = makeIcon([
      "..eeeeee..",
      ".eeeeeeee.",
      "eeeyyeeeee",
      "eeyyyyeeee",
      "eeyyyyeeee",
      "eeeyyeeeee",
      ".eeeeeeee.",
      "..eeeeee..",
    ], P);
    S.icons.bacon = makeIcon([
      "..........",
      "bBbbfbbBb.",
      ".bBbbfbbBb",
      "bBbbfbbBb.",
      ".bBbbfbbBb",
      "bBbbfbbBb.",
      "..........",
    ], P);
    // shredded golden pile: light strands + crispy dark edges
    S.icons.hash = makeIcon([
      "..........",
      "...AhhA...",
      "..hAhhhh..",
      ".hhHAhHhh.",
      "hAhhhAhhHh",
      "hhHAhhHhAh",
      "hHhhAhhhhh",
      ".HHhhhHHh.",
      "..........",
    ], P);
    S.icons.coffee = makeIcon([
      "..........",
      ".mmmmmm...",
      ".mkkkkm.M.",
      ".mkkkkmMM.",
      ".mkkkkm.M.",
      ".mkkkkm...",
      ".mmmmmm...",
      "..........",
    ], P);
    S.icons.heart = makeIcon([
      ".rr..rr.",
      "rrrrrrrr",
      "rrrrrrrr",
      ".rrrrrr.",
      "..rrrr..",
      "...rr...",
    ], P);
    S.icons.star = makeIcon([
      "...s...",
      "..sss..",
      "sssssss",
      ".sssss.",
      "..s.s..",
    ], P);
    S.icons.chair = makeIcon([
      ".nn.....",
      ".nn.....",
      ".nnnnnn.",
      ".nnnnnn.",
      ".nN..Nn.",
      ".nN..Nn.",
    ], P);
    S.icons.burnt = makeIcon([
      "..xxxxxx..",
      ".xXxxxxXx.",
      "xxxXxxxxxx",
      "xXxxxXxxXx",
      "xxxxxxxXxx",
      ".xxXxxxxx.",
    ], P);
  }

  // Hash with dressing overlays, cached by mod key
  const hashCache = {};
  S.hashIcon = function (mods) {
    const key = (mods || []).slice().sort().join(",");
    if (hashCache[key]) return hashCache[key];
    const base = S.icons.hash;
    const c = document.createElement("canvas");
    c.width = base.width; c.height = base.height;
    const g = c.getContext("2d");
    g.drawImage(base, 0, 0);
    const px = 3;
    if (mods && mods.includes("covered")) {
      g.fillStyle = P.c;
      g.fillRect(2 * px, 2 * px, 6 * px, 2 * px);
      g.fillRect(3 * px, 4 * px, 2 * px, 1 * px);
      g.fillRect(6 * px, 4 * px, 1 * px, 1 * px);
    }
    if (mods && mods.includes("smothered")) {
      g.fillStyle = P.o;
      g.fillRect(3 * px, 3 * px, px, px);
      g.fillRect(6 * px, 2 * px, px, px);
      g.fillRect(5 * px, 5 * px, px, px);
      g.fillRect(2 * px, 5 * px, px, px);
    }
    hashCache[key] = c;
    return c;
  };

  S.foodIcon = function (foodId, mods) {
    if (foodId === "hash" && mods && mods.length) return S.hashIcon(mods);
    return S.icons[foodId] || S.icons.waffle;
  };

  // ------------------------------------------------------------ characters
  // Chunky rect people. Origin = feet center. facing: 1 right / -1 left.
  // opts: {shirt, skin, apron, hat, hair, scale, mood}
  // pose: idle | walk | punch | punch2 | heavy | throw | block | dodge |
  //       hurt | ko | sit | carry
  const u = 3; // pixel unit

  function rect(g, x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(Math.round(x * u), Math.round(y * u), Math.round(w * u), Math.round(h * u));
  }

  S.drawDude = function (g, x, y, opts, pose, t, facing) {
    const scale = (opts.scale || 1);
    const skin = opts.skin || "#e8b48c";
    const shirt = opts.shirt || "#6a7fd1";
    const pants = opts.pants || "#3a3a4c";
    const mood = opts.mood || "normal";
    g.save();
    g.translate(Math.round(x), Math.round(y));
    g.scale((facing || 1) * scale, scale);

    // shadow
    g.fillStyle = "rgba(0,0,0,0.30)";
    g.beginPath();
    g.ellipse(0, 2, 8 * u, 2.4 * u, 0, 0, Math.PI * 2);
    g.fill();

    if (pose === "ko") {
      // lying flat
      rect(g, -11, -4, 14, 4, shirt);
      rect(g, -13, -4, 3, 4, pants);
      g.fillStyle = skin;
      g.fillRect(3 * u, -5 * u, 6 * u, 5 * u); // head sideways
      rect(g, 4, -6, 4, 1, opts.hatColor || "#f5f0e6");
      // X eyes
      g.fillStyle = "#22222a";
      g.fillRect(5 * u, -3.5 * u, u, u);
      g.fillRect(7 * u, -3.5 * u, u, u);
      g.restore();
      return;
    }

    const walking = pose === "walk";
    const swing = walking ? Math.sin(t * 11) * 2 : 0;
    const bob = walking ? Math.abs(Math.sin(t * 11)) * 1 : 0;
    const lean = (pose === "punch" || pose === "punch2" || pose === "heavy") ? 1.5 :
                 (pose === "hurt" ? -2 : 0);

    if (pose === "sit") {
      // upper body only (behind counter)
      rect(g, -5, -13, 10, 8, shirt);
      // arms resting forward
      rect(g, -6, -8, 3, 3, skin);
      rect(g, 3, -8, 3, 3, skin);
    } else {
      // legs
      rect(g, -4 + lean * 0.3, -6 + Math.max(0, -swing), 3, 6 - Math.max(0, -swing), pants);
      rect(g, 1 + lean * 0.3, -6 + Math.max(0, swing), 3, 6 - Math.max(0, swing), pants);
      // torso
      rect(g, -5 + lean, -15 - bob, 10, 9, shirt);
      if (opts.apron) {
        rect(g, -4 + lean, -13 - bob, 8, 7, "#f0ece0");
        rect(g, -4 + lean, -13 - bob, 8, 1, "#d8d4c8");
      }
      // arms by pose
      g.fillStyle = skin;
      if (pose === "punch") {
        rect(g, 5 + lean, -14 - bob, 8, 3, skin);          // extended jab
        rect(g, -7 + lean, -13 - bob, 2, 5, skin);
      } else if (pose === "punch2") {
        rect(g, 5 + lean, -12 - bob, 9, 3, skin);          // cross
        rect(g, -7 + lean, -14 - bob, 2, 4, skin);
      } else if (pose === "heavy") {
        rect(g, 4 + lean, -20 - bob, 4, 8, skin);          // uppercut
        rect(g, -7 + lean, -12 - bob, 2, 5, skin);
      } else if (pose === "throw") {
        rect(g, 3 + lean, -19 - bob, 7, 3, skin);          // overhead
        rect(g, -7 + lean, -13 - bob, 2, 5, skin);
      } else if (pose === "block") {
        rect(g, 4 + lean, -16 - bob, 3, 7, skin);
        rect(g, 6 + lean, -15 - bob, 2, 5, "#d0d4dc");     // spatula!
      } else if (pose === "carry") {
        rect(g, 4 + lean, -16 - bob, 6, 2, skin);          // arms out front
        rect(g, -7 + lean, -16 - bob, 3, 2, skin);
      } else if (pose === "hurt") {
        rect(g, 4 + lean, -11 - bob, 5, 3, skin);
        rect(g, -8 + lean, -15 - bob, 3, 3, skin);
      } else {
        rect(g, 5 + lean, -14 - bob, 2, 6 + swing * 0.5, skin);
        rect(g, -7 + lean, -14 - bob, 2, 6 - swing * 0.5, skin);
      }
    }

    const headY = (pose === "sit" ? -20 : -22) - bob;
    // head
    rect(g, -4 + lean, headY, 8, 7, skin);
    // face
    g.fillStyle = "#22222a";
    if (mood === "angry") {
      g.fillRect((1 + lean) * u, (headY + 2) * u, u, u);
      g.fillRect((3 + lean) * u, (headY + 2) * u, u, u);
      // brows
      g.fillRect((0.5 + lean) * u, (headY + 1) * u, u * 1.5, u * 0.7);
      g.fillRect((2.8 + lean) * u, (headY + 1) * u, u * 1.5, u * 0.7);
    } else if (mood === "happy") {
      g.fillRect((1 + lean) * u, (headY + 2.4) * u, u, u * 0.6);
      g.fillRect((3 + lean) * u, (headY + 2.4) * u, u, u * 0.6);
      g.fillRect((1.5 + lean) * u, (headY + 4.4) * u, u * 2, u * 0.6);
    } else {
      g.fillRect((1 + lean) * u, (headY + 2.4) * u, u, u);
      g.fillRect((3 + lean) * u, (headY + 2.4) * u, u, u);
    }

    // hats & hair
    const hat = opts.hat || "none";
    if (hat === "paper") { // classic cook's paper hat
      rect(g, -4 + lean, headY - 4, 8, 4, "#f5f0e6");
      rect(g, -4 + lean, headY - 0.8, 8, 0.8, "#c8c4b8");
    } else if (hat === "cap") {
      rect(g, -4 + lean, headY - 2, 8, 2.4, opts.hatColor || "#b5533c");
      rect(g, 2 + lean, headY - 0.6, 5, 1.2, opts.hatColor || "#b5533c");
    } else if (hat === "beanie") {
      rect(g, -4 + lean, headY - 2, 8, 3, opts.hatColor || "#4a7c59");
    } else if (hat === "bob") {
      rect(g, -5 + lean, headY - 2, 10, 3, opts.hairColor || "#c9973e");
      rect(g, -5 + lean, headY, 1.6, 6, opts.hairColor || "#c9973e");
      rect(g, 3.4 + lean, headY, 1.6, 6, opts.hairColor || "#c9973e");
    } else if (hat === "megabob") { // The Final Karen. The bob has ascended.
      rect(g, -6 + lean, headY - 4, 12, 5, opts.hairColor || "#e8d44c");
      rect(g, -6 + lean, headY - 1, 2, 8, opts.hairColor || "#e8d44c");
      rect(g, 4 + lean, headY - 1, 2, 8, opts.hairColor || "#e8d44c");
    } else if (hat === "fedora") {
      rect(g, -6 + lean, headY - 1, 12, 1.4, "#3a3a44");
      rect(g, -3 + lean, headY - 3.6, 6, 2.8, "#3a3a44");
    } else if (hat === "hair") {
      rect(g, -4 + lean, headY - 1.4, 8, 1.6, opts.hairColor || "#4a3428");
    }

    g.restore();
  };

  // ------------------------------------------------------------ furniture
  S.drawChair = function (g, x, y, angle) {
    g.save();
    g.translate(x, y);
    if (angle) g.rotate(angle);
    g.fillStyle = "#a06a3a";
    g.fillRect(-9, -22, 4, 22);      // back
    g.fillRect(-9, -4, 20, 4);       // seat
    g.fillStyle = "#7c4e28";
    g.fillRect(-7, 0, 3, 8);
    g.fillRect(7, 0, 3, 8);
    g.restore();
  };

  S.drawStool = function (g, x, y) {
    g.fillStyle = "#c93a2e";
    g.fillRect(x - 11, y - 6, 22, 6);
    g.fillStyle = "#8f2a20";
    g.fillRect(x - 11, y - 2, 22, 2);
    g.fillStyle = "#b8b4aa";
    g.fillRect(x - 2, y, 4, 12);
  };

  S.drawPlate = function (g, x, y, r) {
    g.fillStyle = "#f0ece0";
    g.beginPath();
    g.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#d8d4c8";
    g.beginPath();
    g.ellipse(x, y, r * 0.65, r * 0.26, 0, 0, Math.PI * 2);
    g.fill();
  };

  // Neon sign: amber block letters with glow. Original trade dress: rounded
  // tiles, apostrophe, two-line stack — deliberately NOT a yellow square grid.
  S.drawNeonSign = function (g, cx, cy, scale, t, text) {
    text = text || "WAFFLE'S";
    const letterW = 26 * scale, letterH = 34 * scale, gap = 6 * scale;
    const totalW = text.length * (letterW + gap) - gap;
    let x = cx - totalW / 2;
    const flickerIdx = Math.floor(t / 2.7) % text.length; // one tile flickers
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const lit = !(i === flickerIdx && (t % 2.7) > 2.35 && (Math.sin(t * 43) > -0.3));
      if (ch !== " " && ch !== "'") {
        g.fillStyle = lit ? "#ffb63e" : "#5a4116";
        if (lit) {
          g.shadowColor = "#ffb63e";
          g.shadowBlur = 18 * scale;
        }
        const r = 6 * scale;
        g.beginPath();
        g.moveTo(x + r, cy);
        g.arcTo(x + letterW, cy, x + letterW, cy + letterH, r);
        g.arcTo(x + letterW, cy + letterH, x, cy + letterH, r);
        g.arcTo(x, cy + letterH, x, cy, r);
        g.arcTo(x, cy, x + letterW, cy, r);
        g.fill();
        g.shadowBlur = 0;
        g.fillStyle = lit ? "#4a2c08" : "#2e2210";
        g.font = `bold ${Math.round(24 * scale)}px "Courier New", monospace`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(ch, x + letterW / 2, cy + letterH / 2 + 2 * scale);
      } else if (ch === "'") {
        g.fillStyle = "#ffb63e";
        g.shadowColor = "#ffb63e";
        g.shadowBlur = 12 * scale;
        g.fillRect(x + 4 * scale, cy - 2 * scale, 7 * scale, 14 * scale);
        g.shadowBlur = 0;
        x -= (letterW - 14 * scale); // apostrophe is narrow
      }
      x += letterW + gap;
    }
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
  };

  // ------------------------------------------------------------ backgrounds
  function starField(g, w, yMax, n, seedShift) {
    for (let i = 0; i < n; i++) {
      const sx = ((i * 137 + seedShift * 61) % w);
      const sy = ((i * 89 + seedShift * 31) % yMax);
      g.fillStyle = i % 3 === 0 ? "#cdd7ef" : "#7f89a8";
      g.fillRect(sx, sy, 2, 2);
    }
  }

  function drawRoomBase(g, opts) {
    const W = 960, H = 540;
    // wall
    g.fillStyle = "#4a3527";
    g.fillRect(0, 0, W, 260);
    // wood paneling lines
    g.fillStyle = "#3d2c20";
    for (let x = 0; x < W; x += 48) g.fillRect(x, 0, 3, 260);
    // windows (night)
    for (const wx of [40, 620]) {
      g.fillStyle = "#241f14";
      g.fillRect(wx - 8, 22, 256, 156);
      g.fillStyle = "#0e1224";
      g.fillRect(wx, 30, 240, 140);
      const prev = g.getTransform ? null : null;
      g.save();
      g.beginPath();
      g.rect(wx, 30, 240, 140);
      g.clip();
      starField(g, 960, 120, 40, wx);
      if (wx === 40) {
        // one moon, as astronomy intended (left window only)
        g.fillStyle = "#e8e4d0";
        g.beginPath();
        g.arc(wx + 190, 60, 16, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#0e1224";
        g.beginPath();
        g.arc(wx + 196, 55, 13, 0, Math.PI * 2);
        g.fill();
      } else {
        // right window: the town water tower and a lucky shooting star
        g.fillStyle = "#1a2036";
        g.fillRect(wx + 168, 78, 44, 26);            // tank
        g.beginPath();                                // tank roof
        g.moveTo(wx + 164, 78); g.lineTo(wx + 190, 64); g.lineTo(wx + 216, 78);
        g.fill();
        g.fillRect(wx + 174, 104, 4, 36);            // legs
        g.fillRect(wx + 202, 104, 4, 36);
        g.fillRect(wx + 186, 104, 3, 28);
        g.fillStyle = "#2c3654";
        g.fillRect(wx + 172, 116, 36, 3);            // cross-brace
        g.fillStyle = "#c93a2e";                     // blinking beacon (caught mid-blink)
        g.fillRect(wx + 188, 60, 4, 4);
        // shooting star streak
        g.strokeStyle = "rgba(205,215,239,0.7)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(wx + 40, 42); g.lineTo(wx + 78, 54);
        g.stroke();
        g.fillStyle = "#cdd7ef";
        g.fillRect(wx + 78, 53, 3, 3);
      }
      // parking lot glow + a sad distant car
      g.fillStyle = "#1c2138";
      g.fillRect(wx, 140, 240, 30);
      g.fillStyle = "#3a3f55";
      g.fillRect(wx + 30, 150, 44, 14);
      g.fillStyle = "#ffd97f";
      g.fillRect(wx + 70, 154, 5, 5);
      g.restore();
      // frame
      g.strokeStyle = "#2c2117";
      g.lineWidth = 6;
      g.strokeRect(wx, 30, 240, 140);
      g.beginPath();
      g.moveTo(wx + 120, 30); g.lineTo(wx + 120, 170);
      g.moveTo(wx, 100); g.lineTo(wx + 240, 100);
      g.stroke();
    }
    // menu board
    g.fillStyle = "#241c12";
    g.fillRect(340, 30, 240, 118);
    g.strokeStyle = "#8a6a3a";
    g.lineWidth = 4;
    g.strokeRect(340, 30, 240, 118);
    g.fillStyle = "#f0e6c8";
    g.font = 'bold 15px "Courier New", monospace';
    g.fillText("== MENU ==", 400, 52);
    g.font = '13px "Courier New", monospace';
    const menu = ["WAFFLE........$6", "EGGS..........$4", "BACON.........$5", "HASHBROWNS....$5", "COFFEE........$2", "FIGHT.......FREE"];
    menu.forEach((m, i) => g.fillText(m, 356, 70 + i * 13));

    // clock
    g.fillStyle = "#d8d4c8";
    g.beginPath(); g.arc(925, 60, 22, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#4a3527"; g.lineWidth = 3;
    g.beginPath(); g.arc(925, 60, 22, 0, Math.PI * 2); g.stroke();

    // jukebox (right wall)
    g.fillStyle = "#8a2e5a";
    g.fillRect(880, 150, 64, 110);
    g.fillStyle = "#ffb63e";
    g.beginPath(); g.arc(912, 172, 20, Math.PI, 0); g.fill();
    g.fillStyle = "#48d0c8";
    g.fillRect(890, 182, 44, 8);
    g.fillStyle = "#2c1020";
    g.fillRect(890, 196, 44, 40);
    g.fillStyle = "#ffd97f";
    g.font = '9px "Courier New", monospace';
    g.fillText("WAFL-O-", 896, 210);
    g.fillText("MATIC", 900, 221);

    // floor: checkered
    const tile = 40;
    for (let row = 0; 260 + row * tile < H; row++) {
      for (let col = 0; col * tile < W; col++) {
        const odd = (row + col) % 2 === 1;
        g.fillStyle = odd ? "#8a8069" : "#3a322b";
        g.fillRect(col * tile, 260 + row * tile, tile, tile);
      }
    }
    // floor darkening toward bottom (night mood)
    const grad = g.createLinearGradient(0, 260, 0, H);
    grad.addColorStop(0, "rgba(20,14,8,0.10)");
    grad.addColorStop(1, "rgba(20,14,8,0.45)");
    g.fillStyle = grad;
    g.fillRect(0, 260, W, H - 260);
  }

  S.makeKitchenBG = function () {
    const c = document.createElement("canvas");
    c.width = 960; c.height = 540;
    const g = c.getContext("2d");
    drawRoomBase(g, {});

    // customer counter (they sit behind it, facing us)
    g.fillStyle = "#6e4a2a";
    g.fillRect(0, 236, 960, 10);
    g.fillStyle = "#a06a3a";
    g.fillRect(0, 246, 960, 26);
    g.fillStyle = "#7c4e28";
    g.fillRect(0, 272, 960, 8);
    // red vinyl trim — classic diner
    g.fillStyle = "#c93a2e";
    g.fillRect(0, 280, 960, 10);

    // back-of-kitchen steel counter (bottom, stations sit on it)
    // pulled upward so the walk from grill to counter is short
    g.fillStyle = "#5a5e66";
    g.fillRect(0, 434, 960, 106);
    g.fillStyle = "#767c86";
    g.fillRect(0, 434, 960, 8);
    g.fillStyle = "#43464e";
    g.fillRect(0, 528, 960, 12);
    return c;
  };

  S.makeArenaBG = function () {
    const c = document.createElement("canvas");
    c.width = 960; c.height = 540;
    const g = c.getContext("2d");
    drawRoomBase(g, {});
    // counter pushed to top, dining floor open
    g.fillStyle = "#6e4a2a";
    g.fillRect(0, 236, 960, 10);
    g.fillStyle = "#a06a3a";
    g.fillRect(0, 246, 960, 22);
    g.fillStyle = "#c93a2e";
    g.fillRect(0, 268, 960, 8);
    // knocked-over stools, scattered fries of war
    S.drawStool(g, 80, 300);
    g.save();
    g.translate(320, 500); g.rotate(1.4);
    S.drawStool(g, 0, 0);
    g.restore();
    g.save();
    g.translate(860, 460); g.rotate(-1.9);
    S.drawStool(g, 0, 0);
    g.restore();
    // spilled coffee
    g.fillStyle = "rgba(58,36,20,0.55)";
    g.beginPath(); g.ellipse(500, 430, 38, 12, 0, 0, Math.PI * 2); g.fill();
    return c;
  };

  // Station block drawing (used by cooking scene; state drawn per-frame)
  S.drawStationBase = function (g, x, y, w, label, color) {
    g.fillStyle = "#3a3d44";
    g.fillRect(x - w / 2, y - 34, w, 40);
    g.fillStyle = color || "#565a63";
    g.fillRect(x - w / 2 + 3, y - 31, w - 6, 24);
    g.fillStyle = "#f0e6c8";
    g.font = 'bold 11px "Courier New", monospace';
    g.textAlign = "center";
    g.fillText(label, x, y + 18);
    g.textAlign = "left";
  };

  S.init = function () {
    buildIcons();
    S.bgKitchen = S.makeKitchenBG();
    S.bgArena = S.makeArenaBG();
  };

  return S;
})();
