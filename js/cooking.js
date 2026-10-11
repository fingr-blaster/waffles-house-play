/* WAFFLE'S HOUSE — cooking.js
   The order-rush half of the game. Work the line: waffle iron, eggs,
   bacon, hashbrowns, coffee. Serve the counter before patience dies.
   Failed orders become grudges. Grudges become fists. */
"use strict";
window.WH = window.WH || {};

WH.CookScene = function (hourIdx, onDone) {
  const U = WH.U, D = WH.Data, S = WH.Sprites, T = WH.T, N = WH.Night, I = WH.Input;
  const G = WH.Game;

  const HOUR_LEN = 80; // seconds of cooking per hour
  const SEATS = [150, 290, 430, 570, 710, 850];
  const LANE = { x0: 42, x1: 918, y0: 308, y1: 404 }; // short hop, counter to grill

  const self = { kind: "cook" };
  let t = 0;               // elapsed
  let over = false;
  let ambientT = 8;
  let earlyT = 0;          // counts up once the counter is cleared
  let hourFails = 0;
  let closing = false;     // graceful wind-down when the hour bell rings
  let closingT = 0;

  // ---------------------------------------------------------------- player
  const player = {
    x: 480, y: 370, facing: 1, animT: 0, moving: false,
    carry: [], // {food, mods}
    dashT: 0, dashCd: 0, dashVX: 0, dashVY: 0, // [SPACE] dash, same as fights
  };
  const carryMax = () => (N.has("thirdarm") ? 3 : 2);

  // ---------------------------------------------------------------- stations
  function makeStation(id, x, label, slots) {
    return {
      id, x, y: 448, label, w: slots > 1 ? 120 : 76,
      slots: Array.from({ length: slots }, () => ({ state: "empty", t: 0, t2: 0, jrT: 0 })),
    };
  }
  const stations = [
    makeStation("iron", 116, "WAFFLE", 2),
    makeStation("eggs", 276, "EGGS", 2),
    makeStation("bacon", 436, "BACON", 2),
    makeStation("hash", 596, "HASH", 2),
    makeStation("coffee", 736, "COFFEE", 1),
  ];
  const trash = { x: 858, y: 448 };
  const jukebox = { x: 906, y: 330 };
  let jukeIdx = 0;

  function foodForStation(stId) {
    for (const f of Object.values(D.FOODS)) if (f.station === stId) return f;
    return D.FOODS.waffle;
  }
  function cookTimeFor(food) {
    let ct = food.cookTime;
    if (food.id === "waffle" && N.has("quickiron")) ct *= 0.6;
    return ct;
  }

  // ---------------------------------------------------------------- customers
  const customers = []; // active, indexed by seat when seated
  let toSpawn = [];
  let namesLeft = U.shuffle(D.CUSTOMER_NAMES);

  function makeOrder() {
    const h = hourIdx;
    let count = 1;
    if (h >= 1) count = U.chance(0.6) ? 2 : 1;
    if (h >= 3) count = U.chance(0.5) ? 2 : U.chance(0.5) ? 3 : 1;
    if (h >= 5) count = U.pick([2, 2, 3]);
    const pool = ["waffle", "waffle", "eggs", "bacon", "hash", "hash", "coffee"];
    const lines = [];
    const used = new Set();
    while (lines.length < count) {
      const id = U.pick(pool);
      if (used.has(id)) continue;
      used.add(id);
      // Hash is binary now: plain, or the works (smothered & covered).
      let mods = [];
      if (id === "hash" && h >= 1 && U.chance(0.45)) mods = ["smothered", "covered"];
      lines.push({ food: id, mods, done: false });
    }
    return lines;
  }

  function orderCallout(order) {
    const bits = order.map((l) => {
      if (l.food === "hash") return D.isDressed(l.mods) ? "hash all the way" : "hash";
      return D.FOODS[l.food].name.toLowerCase();
    });
    return U.pick(D.CALLOUTS).replace("{items}", bits.join(", "));
  }

  function scheduleCustomers() {
    const total = D.HOURS[hourIdx].customers;
    const times = [1.5, 6];
    for (let i = 2; i < total; i++) times.push(U.rand(8, HOUR_LEN * 0.62));
    times.sort((a, b) => a - b);
    toSpawn = times.map((at) => ({ at }));
  }

  function freeSeat() {
    const taken = new Set(customers.filter((c) => c.state !== "gone").map((c) => c.seat));
    const free = SEATS.map((_, i) => i).filter((i) => !taken.has(i));
    return free.length ? U.pick(free) : -1;
  }

  function spawnCustomer() {
    const seat = freeSeat();
    if (seat < 0) return false; // full counter; try again shortly
    if (namesLeft.length === 0) namesLeft = U.shuffle(D.CUSTOMER_NAMES);
    const patienceMax = (48 - hourIdx * 1.6) * (N.has("charm") ? 1.3 : 1);
    const cust = {
      seat, name: namesLeft.pop(),
      opts: {
        shirt: U.pick(["#6a7fd1", "#b5533c", "#4a7c59", "#c9973e", "#8a5c8f", "#5f8fa8"]),
        skin: U.pick(["#e8b48c", "#c98f5e", "#8f5f3c", "#f0c8a0", "#6e4428"]),
        hat: U.pick(["cap", "beanie", "hair", "bob", "none", "fedora"]),
        hatColor: U.pick(["#b5533c", "#4a7c59", "#3a3a6e"]),
        hairColor: U.pick(["#4a3428", "#c9973e", "#8a8a8a", "#2c2c34"]),
        mood: "normal",
      },
      order: makeOrder(),
      patience: patienceMax, patienceMax,
      state: "seated", stateT: 0,
    };
    customers.push(cust);
    WH.Audio.sfx("chime");
    const cx = SEATS[seat];
    WH.FX.float(cx, 180, U.pick(D.ARRIVE_LINES), "#d8d4c8", 12, 1.8);
    if (U.chance(0.6)) {
      WH.FX.float(480, 300, orderCallout(cust.order), "#ffd97f", 13, 2.0);
    }
    return true;
  }

  // ---------------------------------------------------------------- serving
  function tryServe(cust) {
    // One press hands over EVERYTHING that matches — no E-mashing a
    // three-item order you're already holding.
    let servedCount = 0;
    let progress = true;
    while (progress) {
      progress = false;
      for (let ci = 0; ci < player.carry.length; ci++) {
        const item = player.carry[ci];
        const line = cust.order.find(
          (l) =>
            !l.done &&
            l.food === item.food &&
            (l.food !== "hash" || D.dressMatch(l.mods, item.mods))
        );
        if (line) {
          player.carry.splice(ci, 1);
          line.done = true;
          servedCount++;
          progress = true;
          break;
        }
      }
    }
    if (servedCount > 0) {
      WH.Audio.sfx("ding");
      WH.FX.float(SEATS[cust.seat], 205,
        servedCount > 1 ? "THE WHOLE SPREAD!" : U.pick(D.SERVE_LINES), "#8fe07c", 13);
      WH.FX.burst(SEATS[cust.seat], 240, "#ffe066", 6 + servedCount * 3, 80, 0.4);
      if (cust.order.every((l) => l.done)) completeOrder(cust);
      return true;
    }
    // Nothing servable — if a wrong-dressed hash is the reason, say so.
    const heldHash = player.carry.find((c) => c.food === "hash");
    const wrong = heldHash && cust.order.find((l) => !l.done && l.food === "hash");
    if (heldHash && wrong) {
      WH.Audio.sfx("buzz");
      WH.FX.float(SEATS[cust.seat], 205,
        `WANTED ${D.dressTag(wrong.mods)} — GOT ${D.dressTag(heldHash.mods)}`, "#ffab6a", 12, 1.8);
      return false;
    }
    WH.Audio.sfx("buzz");
    WH.FX.float(SEATS[cust.seat], 205, "\"Ain't mine, sugar.\"", "#d8a0a0", 12);
    return false;
  }

  function completeOrder(cust) {
    const base = cust.order.reduce((s, l) => s + D.FOODS[l.food].price, 0);
    let tip = Math.ceil((cust.patience / cust.patienceMax) * 5) + Math.min(N.combo, 6);
    if (N.has("bigtips")) tip = Math.ceil(tip * 1.5);
    N.addCash(base + tip);
    N.stats.served++;
    N.stats.tips += tip;
    N.combo++;
    N.heat = Math.max(0, N.heat - 0.5);
    cust.state = "happy";
    cust.stateT = 0;
    cust.opts.mood = "happy";
    WH.Audio.sfx("cash");
    WH.FX.float(SEATS[cust.seat], 190, `+$${base + tip}${tip > 3 ? " NICE TIP!" : ""}`, "#8fe07c", 15);
    if (U.chance(0.5)) WH.FX.float(SEATS[cust.seat], 168, U.pick(D.HAPPY_LINES), "#d8d4c8", 11);
    if (N.combo > 1) WH.FX.float(480, 60, `COMBO x${N.combo}`, "#ffd97f", 14);
  }

  function failCustomer(cust) {
    cust.state = "grudge";
    cust.stateT = 0;
    cust.opts.mood = "angry";
    N.combo = 0;
    N.stats.failed++;
    hourFails++;
    N.heat += 1;
    const pool = D.ENEMY_UNLOCK[hourIdx];
    N.grudges.push(U.pick(pool));
    WH.Audio.sfx("grudge");
    G.shake(4, 0.25);
    WH.FX.float(SEATS[cust.seat], 190, U.pick(D.ANGRY_LINES), "#ff8f7f", 13, 2.0);
    WH.FX.float(SEATS[cust.seat], 165, "GRUDGE +1", "#ff5f4e", 15, 1.6);
  }

  // ---------------------------------------------------------------- interactables
  function nearestInteractable() {
    const list = [];
    for (const st of stations) {
      st.slots.forEach((slot, si) => {
        const sx = st.x + (st.slots.length > 1 ? (si === 0 ? -30 : 30) : 0);
        let label = null;
        if (slot.state === "empty") label = `START ${st.label}`;
        else if (slot.state === "ready") label = `TAKE ${st.label}`;
        else if (slot.state === "burnt") label = "SCRAPE OFF";
        if (label) list.push({ x: sx, y: st.y - 20, label, kind: "station", st, slot, si });
      });
    }
    if (player.carry.length > 0) list.push({ x: trash.x, y: trash.y - 20, label: "TRASH IT", kind: "trash" });
    list.push({ x: jukebox.x, y: jukebox.y, label: "JUKEBOX", kind: "juke" });
    for (const c of customers) {
      if (c.state !== "seated") continue;
      list.push({ x: SEATS[c.seat], y: 290, label: "SERVE", kind: "serve", cust: c });
    }
    // forgiving reach: you don't have to be pixel-perfect in front of a
    // station or seat — close-ish and facing-ish is good enough
    let best = null, bestD = 84;
    for (const it of list) {
      const d = U.dist(player.x, player.y - 20, it.x, it.y);
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  function doInteract(it) {
    if (!it) return;
    if (it.kind === "station") {
      const food = foodForStation(it.st.id);
      const slot = it.slot;
      if (slot.state === "empty") {
        slot.state = "cooking";
        slot.t = cookTimeFor(food);
        slot.t2 = 0;
        WH.Audio.sfx("sizzle");
      } else if (slot.state === "ready") {
        if (player.carry.length >= carryMax()) {
          WH.Audio.sfx("buzz");
          WH.FX.float(player.x, player.y - 70, "HANDS FULL!", "#ff8f7f", 13);
        } else {
          player.carry.push({ food: food.id, mods: [] });
          slot.state = "empty";
          WH.Audio.sfx("pickup");
        }
      } else if (slot.state === "burnt") {
        slot.state = "empty";
        N.stats.burned++;
        WH.Audio.sfx("trash");
        WH.FX.float(it.x, it.y - 20, "R.I.P.", "#9a9a9a", 12);
      }
    } else if (it.kind === "trash") {
      if (player.carry.length) {
        player.carry.pop();
        WH.Audio.sfx("trash");
      }
    } else if (it.kind === "serve") {
      tryServe(it.cust);
    } else if (it.kind === "juke") {
      jukeIdx = (jukeIdx + 1) % D.JUKEBOX.length;
      const song = D.JUKEBOX[jukeIdx];
      WH.Audio.playMusic(song.track);
      WH.Audio.sfx("uiSelect");
      WH.FX.float(720, 300, `♪ ${song.title} — ${song.artist}`, "#48d0c8", 12);
    }
  }

  // hash dressing with the HEAVY button — binary: press once to dress it
  // "all the way" (onions & cheese). Pressing again does nothing.
  function dressHash() {
    const item = player.carry.find((c) => c.food === "hash");
    if (!item) return;
    if (item.mods.length > 0) return; // already dressed; extra presses are harmless
    item.mods = ["smothered", "covered"];
    WH.Audio.sfx("uiMove");
    WH.FX.float(player.x, player.y - 72, "DRESSED — ALL THE WAY!", "#ffd23e", 13, 1.4);
  }

  // ---------------------------------------------------------------- lifecycle
  self.enter = function () {
    scheduleCustomers();
    const song = D.JUKEBOX[jukeIdx];
    WH.Audio.playMusic(song.track);
  };

  self.debugSkip = function () { t = HOUR_LEN; };

  // debug-only: stage an arbitrary carry + first-customer order
  self.debugStage = function (carryArr, orderArr) {
    if (!WH.Game.debug) return;
    player.carry = carryArr.map((c) => ({ food: c.food, mods: (c.mods || []).slice() }));
    player.x = 430; player.y = 340;
    if (customers.length === 0) spawnCustomer();
    const c = customers.find((x) => x.state === "seated") || customers[0];
    if (c) {
      c.order = orderArr.map((l) => ({ food: l.food, mods: (l.mods || []).slice(), done: false }));
      c.patience = c.patienceMax;
    }
  };

  // debug-only: stage a dressing scenario for deterministic screenshots
  self.debugDemo = function (carryMods, wantMods) {
    if (!WH.Game.debug) return;
    player.carry = [{ food: "hash", mods: (carryMods || []).slice() }];
    player.x = 430; player.y = 340;
    if (customers.length === 0) spawnCustomer();
    const c = customers.find((x) => x.state === "seated") || customers[0];
    if (c) { c.order = [{ food: "hash", mods: (wantMods || []).slice(), done: false }]; c.patience = c.patienceMax; }
  };

  // debug-only state probe for automated playtesting
  self.debugInfo = function () {
    if (!WH.Game.debug) return null;
    return {
      t: Math.round(t),
      player: { x: Math.round(player.x), y: Math.round(player.y) },
      carry: player.carry,
      customers: customers.filter((c) => c.state === "seated").map((c) => ({
        seat: c.seat, x: SEATS[c.seat],
        order: c.order.map((l) => ({ food: l.food, mods: l.mods, done: l.done })),
        patience: Math.round(c.patience),
      })),
      stations: stations.map((st) => ({ id: st.id, x: st.x, slots: st.slots.map((s) => s.state) })),
    };
  };

  function endHour() {
    if (over) return;
    over = true;
    // leftovers -> brawl snacks, but ONLY with the Doggy Bag perk.
    // (Without it, unserved food stays in the kitchen — the perk is the bag.)
    const cap = N.has("doggybag") ? 6 : 0;
    N.leftovers = [];
    if (cap > 0) {
      for (const item of player.carry) {
        if (N.leftovers.length < cap && item.food !== "coffee") N.leftovers.push(item);
      }
      for (const st of stations) {
        for (const slot of st.slots) {
          if (slot.state === "ready" && N.leftovers.length < cap) {
            const f = foodForStation(st.id);
            if (f.id !== "coffee") N.leftovers.push({ food: f.id, mods: [] });
          }
        }
      }
    }
    player.carry = [];
    // index decay between hours
    N.heat = Math.max(0, N.heat - (N.has("decaf") ? 2 : 1));
    onDone();
  }

  self.update = function (dt) {
    t += dt;
    const idxLevel = N.indexLevel();
    const drainMult = [1, 1.22, 1.5][idxLevel];

    // pause
    if (I.pressed("pause")) {
      WH.Menus.openPause(self);
      return;
    }

    // spawns
    while (toSpawn.length && toSpawn[0].at <= t) {
      const ok = spawnCustomer();
      if (ok) toSpawn.shift();
      else { toSpawn[0].at = t + 4; break; }
    }

    // player movement (+ [SPACE] dash, same feel as the fight dodge)
    player.dashCd = Math.max(0, player.dashCd - dt);
    const ax = I.axisX(), ay = I.axisY();
    if (player.dashT > 0) {
      player.dashT -= dt;
      player.x = U.clamp(player.x + player.dashVX * dt, LANE.x0, LANE.x1);
      player.y = U.clamp(player.y + player.dashVY * dt, LANE.y0, LANE.y1);
      player.moving = true;
    } else {
      const speed = 305;
      player.x = U.clamp(player.x + ax * speed * dt, LANE.x0, LANE.x1);
      player.y = U.clamp(player.y + ay * speed * dt, LANE.y0, LANE.y1);
      player.moving = Math.abs(ax) > 0.1 || Math.abs(ay) > 0.1;
      if (I.pressed("dodge") && player.dashCd <= 0) {
        let dx = ax, dy = ay;
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) { dx = player.facing; dy = 0; }
        const d = Math.hypot(dx, dy) || 1;
        player.dashVX = (dx / d) * 430;
        player.dashVY = (dy / d) * 430;
        player.dashT = 0.22;
        player.dashCd = 0.5;
        WH.Audio.sfx("dodge");
      }
    }
    if (Math.abs(ax) > 0.1) player.facing = ax > 0 ? 1 : -1;
    player.animT += dt;

    // interact
    const it = nearestInteractable();
    self.hoverIt = it;
    if (I.pressed("interact")) doInteract(it);
    if (I.pressed("heavy")) dressHash();

    // stations cook
    for (const st of stations) {
      for (const slot of st.slots) {
        if (slot.state === "cooking") {
          slot.t -= dt;
          if (U.chance(dt * 1.5)) {
            const sx = st.x + (st.slots.length > 1 ? (st.slots.indexOf(slot) === 0 ? -30 : 30) : 0);
            WH.FX.steam(sx, st.y - 36);
            if (U.chance(0.4)) WH.Audio.sfx("sizzle");
          }
          if (slot.t <= 0) {
            slot.state = "ready";
            slot.t2 = 0;
            WH.Audio.sfx("ding");
          }
        } else if (slot.state === "ready") {
          const food = foodForStation(st.id);
          if (food.burnTime > 0) {
            slot.t2 += dt;
            if (slot.t2 >= food.burnTime) {
              slot.state = "burnt";
              WH.Audio.sfx("burn");
              const sx = st.x + (st.slots.length > 1 ? (st.slots.indexOf(slot) === 0 ? -30 : 30) : 0);
              WH.FX.burst(sx, st.y - 36, "#3a3a44", 10, 60, 0.8);
            }
          }
        }
      }
    }

    // customers — patience drains slower when the counter is slammed
    const seatedCount = customers.filter((c) => c.state === "seated").length;
    const busyFactor = Math.max(0.7, 1 - 0.08 * Math.max(0, seatedCount - 2));
    for (const c of customers) {
      c.stateT += dt;
      if (c.state === "seated") {
        c.patience -= dt * drainMult * busyFactor;
        const ratio = c.patience / c.patienceMax;
        // escalating heckling as the fuse burns down
        if (ratio < 0.35 && !c.warned) {
          c.warned = true;
          c.opts.mood = "angry";
          WH.Audio.sfx("buzz");
          WH.FX.float(SEATS[c.seat], 185, `"${U.pick(D.WARN_LINES)}"`, "#ffab8f", 13, 2.2);
        }
        if (ratio < 0.15 && !c.warned2) {
          c.warned2 = true;
          WH.Audio.sfx("grudge");
          G.shake(2, 0.12);
          WH.FX.float(SEATS[c.seat], 175, U.pick(D.WARN_LINES_FINAL), "#ff5f4e", 15, 2.2);
        }
        if (c.patience <= 0) failCustomer(c);
      } else if (c.state === "happy" && c.stateT > 1.6) {
        c.state = "gone";
      } else if (c.state === "grudge" && c.stateT > 1.4) {
        c.state = "gone";
      } else if (c.state === "leaving" && c.stateT > 1.3) {
        c.state = "gone";
      }
    }

    // Junior the line cook tends his one station, flawlessly
    if (N.has("linecook") && N.linecookStation) {
      const st = stations.find((s) => s.id === N.linecookStation);
      if (st) {
        for (const slot of st.slots) {
          if (slot.state === "empty") {
            slot.jrT += dt;
            if (slot.jrT > 1.4) {
              slot.jrT = 0;
              slot.state = "cooking";
              slot.t = cookTimeFor(foodForStation(st.id));
              slot.t2 = 0;
              WH.Audio.sfx("sizzle");
            }
          } else if (slot.state === "ready") {
            slot.t2 = 0; // he never lets it burn
          } else {
            slot.jrT = 0;
          }
        }
      }
    }

    // counter cleared early? call the hour
    if (!over && !closing && toSpawn.length === 0 && customers.length > 0 &&
        customers.every((c) => c.state === "gone")) {
      if (earlyT === 0) {
        const bonus = hourFails === 0 ? 15 + hourIdx * 3 : 0;
        if (bonus > 0) {
          N.addCash(bonus);
          WH.FX.float(480, 250, `COUNTER CLEARED! EARLY BONUS +$${bonus}`, "#8fe07c", 20);
        } else {
          WH.FX.float(480, 250, "COUNTER CLEARED — CALLING THE HOUR", "#8fe07c", 18);
        }
        WH.Audio.sfx("victory");
      }
      earlyT += dt;
      if (earlyT > 1.8) {
        endHour();
        return;
      }
    }

    // ambient flavor
    ambientT -= dt;
    if (ambientT <= 0) {
      ambientT = U.rand(14, 24);
      WH.FX.float(U.rand(200, 760), U.rand(120, 165), U.pick(D.AMBIENT_TOASTS), "#8f8878", 11);
    }

    // the hour bell: no hard cut — stragglers finish their coffee and drift
    // out while the room takes a breath, THEN the night moves on
    if (t >= HOUR_LEN && !closing && !over) {
      closing = true;
      closingT = 0;
      WH.Audio.sfx("chime");
      toSpawn = [];
      for (const c of customers) {
        if (c.state === "seated") {
          c.state = "leaving";
          c.stateT = 0;
        }
      }
    }
    if (closing && !over) {
      closingT += dt;
      if (closingT > 2.4) endHour();
    }
  };

  // ---------------------------------------------------------------- draw
  function slotPos(st, si) {
    return st.x + (st.slots.length > 1 ? (si === 0 ? -30 : 30) : 0);
  }

  // Each station gets its own silhouette so the line reads at a glance.
  function drawStationBody(g, st) {
    const x = st.x, y = st.y, w = st.w;
    if (st.id === "iron") {
      // cast-iron double waffle press: round plates, wood handles, heat lamp
      g.fillStyle = "#37322c";
      g.fillRect(x - w / 2, y - 34, w, 44);
      g.fillStyle = "#4e463c";
      g.fillRect(x - w / 2 + 3, y - 34, w - 6, 5);
      st.slots.forEach((slot, si) => {
        const sx = slotPos(st, si);
        g.fillStyle = "#211d18";
        g.beginPath(); g.arc(sx, y - 16, 18, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#5c5348"; g.lineWidth = 2;
        g.beginPath(); g.arc(sx, y - 16, 14, 0, Math.PI * 2); g.stroke();
        g.fillStyle = "#8a5c34"; // handle
        g.fillRect(sx + 12, y - 34, 5, 12);
      });
      g.fillStyle = "#c93a2e";
      g.fillRect(x + w / 2 - 10, y + 2, 6, 4);
    } else if (st.id === "eggs") {
      // bright flat-top griddle with grease sheen and a splash guard
      g.fillStyle = "#6a707a";
      g.fillRect(x - w / 2, y - 34, w, 44);
      g.fillStyle = "#9aa1ac";
      g.fillRect(x - w / 2 + 4, y - 31, w - 8, 22);
      g.fillStyle = "#b8bfc9";
      g.fillRect(x - w / 2 + 4, y - 31, w - 8, 4);
      g.fillStyle = "#7d848f"; // grease stains
      g.fillRect(x - 26, y - 22, 10, 6);
      g.fillRect(x + 12, y - 18, 14, 5);
      g.fillStyle = "#c9ced6"; // splash guard
      g.fillRect(x - w / 2, y - 40, w, 6);
    } else if (st.id === "bacon") {
      // grill grates over glowing embers
      g.fillStyle = "#4a3a34";
      g.fillRect(x - w / 2, y - 34, w, 44);
      g.fillStyle = "#b5533c"; // ember glow
      g.fillRect(x - w / 2 + 4, y - 30, w - 8, 20);
      g.fillStyle = "#2c2420";
      for (let gx = x - w / 2 + 6; gx < x + w / 2 - 6; gx += 8) {
        g.fillRect(gx, y - 31, 4, 22);
      }
      g.fillStyle = "#7c4e28"; // side shelf
      g.fillRect(x - w / 2 - 6, y - 20, 6, 24);
    } else if (st.id === "hash") {
      // steel hash top with browned patches and a leaning scraper
      g.fillStyle = "#565e56";
      g.fillRect(x - w / 2, y - 34, w, 44);
      g.fillStyle = "#8a9188";
      g.fillRect(x - w / 2 + 4, y - 31, w - 8, 22);
      g.fillStyle = "#a8742a"; // seasoned patches
      g.fillRect(x - 22, y - 24, 12, 7);
      g.fillRect(x + 8, y - 16, 16, 6);
      g.fillStyle = "#d0d4dc"; // scraper
      g.fillRect(x + w / 2 - 8, y - 44, 3, 16);
      g.fillRect(x + w / 2 - 12, y - 46, 11, 4);
    } else if (st.id === "coffee") {
      // burgundy brewer with a glass carafe and a power light
      g.fillStyle = "#5a2c2c";
      g.fillRect(x - w / 2, y - 48, w, 58);
      g.fillStyle = "#7a3c38";
      g.fillRect(x - w / 2 + 3, y - 45, w - 6, 8);
      g.fillStyle = "#5fd668";
      g.fillRect(x - w / 2 + 6, y - 34, 4, 4);
      // carafe (fills while brewing)
      const slot = st.slots[0];
      g.fillStyle = "rgba(220,228,240,0.35)";
      g.fillRect(x - 12, y - 30, 24, 22);
      const fill = slot.state === "cooking" ? 1 - slot.t / D.FOODS.coffee.cookTime
        : slot.state === "ready" ? 1 : 0;
      if (fill > 0) {
        g.fillStyle = "#4a3428";
        g.fillRect(x - 10, y - 10 - 18 * fill, 20, 18 * fill);
      }
      g.fillStyle = "#3a2c28"; // hotplate
      g.fillRect(x - 16, y - 8, 32, 4);
    }
    // label plate: food icon + big item name, readable in a rush
    const food = foodForStation(st.id);
    g.font = T.font(14, true);
    const tw = g.measureText(st.label).width;
    const pw = Math.max(tw + 34, 56);
    g.fillStyle = "#241f18";
    g.fillRect(x - pw / 2, y + 8, pw, 21);
    g.strokeStyle = "#4a4034";
    g.lineWidth = 1;
    g.strokeRect(x - pw / 2, y + 8, pw, 21);
    g.drawImage(S.foodIcon(food.id), x - pw / 2 + 4, y + 9, 19, 19);
    T.text(g, st.label, x - pw / 2 + 27, y + 24, 14, "#ffd97f");
  }

  function drawStations(g) {
    for (const st of stations) {
      drawStationBody(g, st);
      st.slots.forEach((slot, si) => {
        const sx = slotPos(st, si);
        const sy = st.y - 20;
        if (slot.state === "cooking") {
          const food = foodForStation(st.id);
          const ratio = 1 - slot.t / cookTimeFor(food);
          g.globalAlpha = 0.55;
          g.drawImage(S.foodIcon(st.id === "hash" ? "hash" : food.id), sx - 15, sy - 13);
          g.globalAlpha = 1;
          T.bar(g, sx - 18, sy + 12, 36, 4, ratio, "#ffd23e");
        } else if (slot.state === "ready") {
          const food = foodForStation(st.id);
          g.drawImage(S.foodIcon(food.id), sx - 15, sy - 13);
          if (food.burnTime > 0) {
            const burnRatio = 1 - slot.t2 / food.burnTime;
            T.bar(g, sx - 18, sy + 12, 36, 4, burnRatio, burnRatio < 0.35 ? "#ff5f4e" : "#5fd668");
          }
          // ready sparkle
          if (Math.floor(performance.now() / 300) % 2 === 0) {
            g.drawImage(S.icons.star, sx + 8, sy - 20);
          }
        } else if (slot.state === "burnt") {
          g.drawImage(S.icons.burnt, sx - 15, sy - 13);
        }
      });
    }
    // Junior, proudly manning his single station
    if (N.has("linecook") && N.linecookStation) {
      const st = stations.find((s) => s.id === N.linecookStation);
      if (st) {
        S.drawDude(g, st.x + st.w / 2 + 20, st.y + 6, {
          shirt: "#e8e0cc", apron: true, hat: "paper", skin: "#c98f5e", scale: 0.85,
        }, "idle", t, -1);
        T.text(g, "JR.", st.x + st.w / 2 + 20, st.y + 26, 9, "#8fd9a8", "center");
      }
    }

    // trash — bright galvanized can, classic matching lid
    g.fillStyle = "#b8bfc9";
    g.fillRect(trash.x - 18, trash.y - 36, 36, 42);
    g.fillStyle = "#8a919c"; // ribbing
    for (let ry = trash.y - 30; ry < trash.y + 2; ry += 8) {
      g.fillRect(trash.x - 18, ry, 36, 3);
    }
    g.fillStyle = "#b8bfc9"; // lid, same galvanized steel as the body
    g.fillRect(trash.x - 22, trash.y - 44, 44, 10);
    g.fillRect(trash.x - 6, trash.y - 50, 12, 6); // handle
    g.fillStyle = "#8a919c"; // lid rim shading for depth
    g.fillRect(trash.x - 22, trash.y - 36, 44, 2);
    // label plate, station-style (same size), red so it reads "discard"
    g.font = T.font(14, true);
    const ttw = g.measureText("TRASH").width;
    const tpw = Math.max(ttw + 14, 56);
    g.fillStyle = "#241f18";
    g.fillRect(trash.x - tpw / 2, trash.y + 8, tpw, 21);
    g.strokeStyle = "#4a4034";
    g.lineWidth = 1;
    g.strokeRect(trash.x - tpw / 2, trash.y + 8, tpw, 21);
    T.text(g, "TRASH", trash.x, trash.y + 24, 14, "#ff8f7f", "center");
  }

  function drawCustomers(g) {
    for (const c of customers) {
      if (c.state === "gone") continue;
      const cx = SEATS[c.seat];
      let cy = 246;
      if (c.state === "grudge") cy += Math.min(30, c.stateT * 40); // storms off downward
      if (c.state === "leaving") cy += Math.min(26, c.stateT * 26); // ambles off, no drama
      S.drawDude(g, cx, cy, c.opts, "sit", 0, 1);
      S.drawPlate(g, cx, 262, 16);

      if (c.state === "seated") {
        // order bubble — hash dressings spelled out in the shared vocabulary
        const lines = c.order;
        const hashLine = lines.find((l) => l.food === "hash" && l.mods.length && !l.done);
        const tagText = hashLine ? "HASH: " + D.dressTag(hashLine.mods) : null;
        const glossText = hashLine ? "(" + D.dressGloss(hashLine.mods) + ")" : null;
        const bh = tagText ? 66 : 42;
        let bw = Math.max(30 * lines.length + 10, 44);
        if (tagText) bw = Math.max(bw, tagText.length * 6.6 + 16, glossText.length * 6 + 16);
        const bx = cx - bw / 2, by = tagText ? 118 : 138;
        g.fillStyle = "rgba(20,16,12,0.82)";
        g.strokeStyle = "#8a6a3a";
        g.lineWidth = 2;
        g.beginPath();
        if (g.roundRect) g.roundRect(bx, by, bw, bh, 6); else g.rect(bx, by, bw, bh);
        g.fill(); g.stroke();
        // little tail
        g.fillStyle = "rgba(20,16,12,0.82)";
        g.beginPath();
        g.moveTo(cx - 5, by + bh); g.lineTo(cx + 5, by + bh); g.lineTo(cx, by + bh + 8);
        g.fill();
        lines.forEach((l, li) => {
          const ix = cx - (lines.length * 30 - 6) / 2 + li * 30;
          g.globalAlpha = l.done ? 0.28 : 1;
          g.drawImage(S.foodIcon(l.food, l.mods), ix, by + 5, 24, 24);
          g.globalAlpha = 1;
          if (l.done) T.text(g, "✓", ix + 8, by + 24, 16, "#5fd668");
        });
        // dressing request, big and unmissable, with plain-English gloss
        if (tagText) {
          // does the cook already hold a hash dressed exactly right? show a green tick
          const holdingMatch = player.carry.some(
            (it) => it.food === "hash" && D.dressMatch(it.mods, hashLine.mods)
          );
          const blink = Math.floor(performance.now() / 400) % 2 === 0;
          const col = holdingMatch ? "#5fd668" : (blink ? "#ffd23e" : "#c9a2e8");
          T.text(g, tagText, cx, by + 40, 11, col, "center");
          T.text(g, glossText, cx, by + 53, 9, "#b8ac93", "center");
          if (holdingMatch) T.text(g, "✓ MATCH!", cx + bw / 2 + 4, by + 44, 11, "#5fd668", "left");
        }
        // patience bar
        const pr = c.patience / c.patienceMax;
        T.bar(g, bx + 4, by + bh - 5, bw - 8, 3, pr, pr > 0.5 ? "#5fd668" : pr > 0.25 ? "#ffd23e" : "#ff5f4e");
        if (pr < 0.25 && Math.floor(performance.now() / 200) % 2 === 0) {
          T.text(g, "!", cx + 26, 160, 20, "#ff5f4e", "center");
        }
      }
    }
  }

  function drawPlayer(g) {
    const pose = player.carry.length ? "carry" : player.moving ? "walk" : "idle";
    S.drawDude(g, player.x, player.y, {
      shirt: "#f0ece0", apron: true, hat: "paper", skin: "#e8b48c",
    }, pose, player.animT, player.facing);
    // carried items in a neat row above the hat
    const n = player.carry.length;
    player.carry.forEach((item, i) => {
      const ix = player.x - (n * 28 - 4) / 2 + i * 28;
      g.drawImage(S.foodIcon(item.food, item.mods), ix, player.y - 106, 24, 24);
      // persistent dressing tag on each carried hash, so you always know its state
      if (item.food === "hash") {
        const tag = D.dressTag(item.mods);
        g.font = T.font(9, true);
        const tw = g.measureText(tag).width + 6;
        g.fillStyle = "rgba(20,16,12,0.85)";
        g.fillRect(ix + 12 - tw / 2, player.y - 118, tw, 12);
        T.text(g, tag, ix + 12, player.y - 109, 9, item.mods.length ? "#ffd23e" : "#cbbfa8", "center", true, false);
      }
    });
    // interact prompt
    if (self.hoverIt) {
      const it = self.hoverIt;
      T.text(g, `[${I.prompt("interact")}] ${it.label}`, it.x, it.y - 34, 12, "#ffd97f", "center");
    }
    const heldHash = player.carry.find((c) => c.food === "hash");
    if (heldHash) {
      if (D.isDressed(heldHash.mods)) {
        T.text(g, "HASH: ALL THE WAY ✓", player.x, player.y + 26, 11, "#5fd668", "center");
      } else {
        T.text(g, `[${I.prompt("heavy")}] DRESS HASH`, player.x, player.y + 26, 11, "#c9a2e8", "center");
      }
    }
  }

  function drawHUD(g) {
    // top bar
    g.fillStyle = "rgba(10,8,6,0.72)";
    g.fillRect(0, 0, 960, 30);
    T.text(g, U.clockText(hourIdx, t / HOUR_LEN), 12, 21, 16, "#f0e6c8");
    T.text(g, U.money(N.cash), 130, 21, 16, "#8fe07c");
    // combo
    if (N.combo > 1) T.text(g, `COMBO x${N.combo}`, 240, 21, 14, "#ffd97f");
    // hour title
    T.text(g, D.HOURS[hourIdx].title, 480, 21, 14, "#d8d4c8", "center");
    // WAFL INDEX
    const lvl = N.indexLevel();
    T.text(g, "WAFL INDEX", 700, 20, 12, "#b8ac93");
    D.INDEX_LEVELS.forEach((L, i) => {
      g.fillStyle = i === lvl ? L.color : "#33302c";
      g.beginPath();
      g.arc(800 + i * 22, 15, 7, 0, Math.PI * 2);
      g.fill();
    });
    // grudges
    if (N.grudges.length) {
      T.text(g, `GRUDGES: ${N.grudges.length}`, 890, 20, 12, "#ff8f7f", "center");
    }
    // hp
    T.text(g, "HP", 12, 46, 11, "#b8ac93");
    T.bar(g, 34, 38, 90, 8, N.hp / N.maxHp, "#5fd668");
    // hour timer bar
    T.bar(g, 0, 30, 960, 3, 1 - t / HOUR_LEN, "#8a6a3a", "rgba(0,0,0,0.4)");

    // controls reminder, fight-HUD style
    g.globalAlpha = 0.8;
    T.text(g, `[${I.prompt("dodge")}] DASH`, 480, 498, 12, "#d8d4c8", "center");
    g.globalAlpha = 1;

    // first-hour helper
    if (hourIdx === 0 && t < 20) {
      T.text(g, "Cook at the stations below. Serve the counter above. Don't let the bars run out.",
        480, 520, 13, "#ffd97f", "center");
    }
  }

  self.draw = function (g) {
    g.drawImage(S.bgKitchen, 0, 0);
    // wall clock hands
    const prog = t / HOUR_LEN;
    g.strokeStyle = "#4a3527";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(925, 60);
    g.lineTo(925 + Math.cos(prog * Math.PI * 2 - Math.PI / 2) * 14, 60 + Math.sin(prog * Math.PI * 2 - Math.PI / 2) * 14);
    g.stroke();
    drawCustomers(g);
    drawStations(g);
    drawPlayer(g);
    drawHUD(g);
    // hour-bell wind-down curtain
    if (closing) {
      g.fillStyle = `rgba(10,7,5,${Math.min(0.35, closingT * 0.25)})`;
      g.fillRect(0, 0, 960, 540);
      const sc = Math.min(1, closingT * 3);
      g.save();
      g.translate(480, 240);
      g.scale(sc, sc);
      T.text(g, "THAT'S THE HOUR!", 0, 0, 36, "#ffd97f", "center");
      T.text(g, "(stragglers head out — no hard feelings)", 0, 30, 14, "#b8ac93", "center");
      g.restore();
    }
  };

  return self;
};
