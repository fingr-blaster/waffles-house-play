/* WAFFLE'S HOUSE — menus.js
   Title, how-to, settings, pause, hour cards, perk draft, results,
   and the game-over screen. */
"use strict";
window.WH = window.WH || {};

WH.Menus = (function () {
  const M = {};
  const U = WH.U, D = WH.Data, S = WH.Sprites, T = WH.T, N = WH.Night, I = WH.Input, G = WH.Game;

  function menuNav(state, itemCount) {
    if (I.pressed("up")) { state.sel = (state.sel + itemCount - 1) % itemCount; WH.Audio.sfx("uiMove"); }
    if (I.pressed("down")) { state.sel = (state.sel + 1) % itemCount; WH.Audio.sfx("uiMove"); }
    if (I.pressed("interact") || I.pressed("attack")) { WH.Audio.sfx("uiSelect"); return true; }
    return false;
  }

  function drawVignette(g) {
    const grad = g.createRadialGradient(480, 270, 260, 480, 270, 620);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.55)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 960, 540);
  }

  // ---------------------------------------------------------------- TITLE
  M.TitleScene = function () {
    const self = { sel: 0, kind: "title" };
    let t = 0;
    let chair = null;
    const items = ["START SHIFT", "THE LOCKER", "HOW TO PLAY", "SETTINGS"];

    self.enter = function () {
      WH.Audio.playMusic("title");
      WH.FX.clear();
    };

    self.update = function (dt) {
      t += dt;
      // ambient flying chair, as is tradition
      if (!chair && U.chance(dt * 0.15)) {
        chair = { x: -40, y: U.rand(160, 240), vx: U.rand(220, 320), spin: 0 };
        WH.Audio.sfx("chairFly");
      }
      if (chair) {
        chair.x += chair.vx * dt;
        chair.spin += dt * 9;
        if (chair.x > 1020) chair = null;
      }
      if (menuNav(self, items.length)) {
        if (self.sel === 0) {
          if (!WH.Save.data.seenHowTo) {
            WH.Save.data.seenHowTo = true;
            WH.Save.save();
            G.transition(() => G.setScene(M.HowToScene(true)));
          } else {
            G.transition(() => WH.Flow.startNight());
          }
        } else if (self.sel === 1) {
          G.transition(() => G.setScene(M.LockerScene()));
        } else if (self.sel === 2) {
          G.transition(() => G.setScene(M.HowToScene(false)));
        } else {
          G.transition(() => G.setScene(M.SettingsScene()));
        }
      }
    };

    self.draw = function (g) {
      g.drawImage(S.bgArena, 0, 0);
      g.fillStyle = "rgba(10,7,5,0.55)";
      g.fillRect(0, 0, 960, 540);

      if (chair) S.drawChair(g, chair.x, chair.y, chair.spin);

      // the cook, unbothered, mid-mop — wearing whatever's in the Locker
      S.drawDude(g, 780, 460, WH.Cosmetics.cookOpts(), "idle", t, -1);

      S.drawNeonSign(g, 480, 88, 1.35, t, "WAFFLE'S");
      S.drawNeonSign(g, 480, 152, 0.95, t + 1.3, "HOUSE");
      T.text(g, "— GRAVEYARD SHIFT —", 480, 216, 17, "#ffd97f", "center");
      T.text(g, "Cook. Serve. Survive till 6 AM.", 480, 240, 13, "#b8ac93", "center");

      const fresh = WH.Cosmetics.hasNew();
      items.forEach((it, i) => {
        const sel = i === self.sel;
        const y = 300 + i * 34;
        T.text(g, (sel ? "► " : "") + it, 480, y, sel ? 22 : 18, sel ? "#ffd97f" : "#d8d4c8", "center");
        if (i === 1 && fresh && Math.floor(t * 3) % 2 === 0) {
          T.text(g, "NEW!", 480 + (sel ? 112 : 92), y, 12, "#48d0c8", "left");
        }
      });

      const hi = WH.Save.data.high;
      if (hi.score > 0) {
        T.text(g, `BEST NIGHT: ${U.money(hi.score)} — "${hi.title}" (${hi.grade})`, 480, 448, 13, "#8fe07c", "center");
      }
      T.text(g, D.DISCLAIMER, 480, 512, 10, "#726a5c", "center", false);
      T.text(g, `${I.hasPad() ? "GAMEPAD CONNECTED" : "KEYBOARD"} · [${I.prompt("interact")}] SELECT`, 480, 528, 10, "#726a5c", "center", false);
      T.text(g, "v1.4", 946, 528, 10, "#726a5c", "right", false);
      drawVignette(g);
    };
    return self;
  };

  // ---------------------------------------------------------------- THE LOCKER
  // Character customizer. Skin tone & hair: free. Headwear & uniforms: some
  // unlock from lifetime stats. Locked items can be PREVIEWED but not worn.
  M.LockerScene = function () {
    const self = { kind: "locker", row: 0 };
    const C = WH.Cosmetics;
    const cos = WH.Save.data.cosmetics;
    const ROWS = ["skin", "hair", "headwear", "uniform", "done"];
    const seenBefore = new Set(cos.seen || []);
    const freshIds = new Set(C.earnedIds().filter((id) => !seenBefore.has(id)));
    let t = 0;
    let lockedPing = 0;

    const idxOf = (list, id) => {
      const i = list.findIndex((x) => x.id === id);
      return i >= 0 && C.isUnlocked(list[i]) ? i : 0;
    };
    const cur = {
      skin: U.clamp(cos.skin | 0, 0, D.SKIN_TONES.length - 1),
      hair: U.clamp(cos.hair | 0, 0, D.HAIR_COLORS.length - 1),
      headwear: idxOf(D.HEADWEAR, cos.headwear),
      uniform: idxOf(D.UNIFORMS, cos.uniform),
    };
    const listFor = (r) => ({ skin: D.SKIN_TONES, hair: D.HAIR_COLORS, headwear: D.HEADWEAR, uniform: D.UNIFORMS })[r];

    // leaving a row while previewing a locked item snaps back to what's worn
    function snapBack(r) {
      if (r === "headwear") cur.headwear = idxOf(D.HEADWEAR, cos.headwear);
      if (r === "uniform") cur.uniform = idxOf(D.UNIFORMS, cos.uniform);
    }
    function moveRow(n) {
      snapBack(ROWS[self.row]);
      self.row = (self.row + n + ROWS.length) % ROWS.length;
      WH.Audio.sfx("uiMove");
    }
    function cycle(dir) {
      const r = ROWS[self.row];
      if (r === "done") return;
      const L = listFor(r);
      cur[r] = (cur[r] + dir + L.length) % L.length;
      if (r === "skin") cos.skin = cur.skin;
      else if (r === "hair") cos.hair = cur.hair;
      else if (C.isUnlocked(L[cur[r]])) cos[r] = L[cur[r]].id;
      WH.Save.save();
      WH.Audio.sfx("uiMove");
    }
    function leave() {
      snapBack("headwear");
      snapBack("uniform");
      WH.Save.save();
      WH.Audio.sfx("uiBack");
      G.transition(() => G.setScene(M.TitleScene()));
    }

    self.enter = function () { C.markSeen(); };

    self.update = function (dt) {
      t += dt;
      lockedPing = Math.max(0, lockedPing - dt);
      if (I.pressed("up")) moveRow(-1);
      else if (I.pressed("down")) moveRow(1);
      if (I.pressed("left")) cycle(-1);
      if (I.pressed("right")) cycle(1);
      if (I.pressed("interact") || I.pressed("attack")) {
        const r = ROWS[self.row];
        if (r === "done") leave();
        else if ((r === "headwear" || r === "uniform") && !C.isUnlocked(listFor(r)[cur[r]])) {
          lockedPing = 0.5;
          WH.Audio.sfx("buzz");
        } else {
          moveRow(1);
        }
      }
      if (I.pressed("pause")) leave();
    };

    function swatch(g, x, y, c, sel) {
      g.fillStyle = c;
      g.fillRect(x, y, 26, 26);
      g.strokeStyle = sel ? "#ffd97f" : "#4a4034";
      g.lineWidth = sel ? 3 : 1;
      if (sel) g.strokeRect(x - 2, y - 2, 30, 30); else g.strokeRect(x, y, 26, 26);
    }
    function lockIcon(g, x, y) {
      g.strokeStyle = "#c93a2e";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x + 5, y, 3.5, Math.PI, 0);
      g.stroke();
      g.fillStyle = "#c93a2e";
      g.fillRect(x, y, 10, 8);
    }
    function itemLine(g, item, x, y, on) {
      const locked = !C.isUnlocked(item);
      const name = (on ? "◄ " : "") + item.name + (on ? " ►" : "");
      T.text(g, name, x, y, 17, locked ? "#7a7362" : on ? "#f0e6c8" : "#d8d4c8");
      g.font = T.font(17, true);
      let tx = x + g.measureText(name).width + 10;
      if (locked) { lockIcon(g, tx, y - 10); tx += 18; }
      if (freshIds.has(item.id) && Math.floor(t * 3) % 2 === 0) {
        T.text(g, "NEW!", tx, y, 12, "#48d0c8");
      }
    }

    self.draw = function (g) {
      g.drawImage(S.bgKitchen, 0, 0);
      g.fillStyle = "rgba(10,7,5,0.84)";
      g.fillRect(0, 0, 960, 540);
      T.text(g, "THE LOCKER", 480, 56, 32, "#ffd97f", "center");
      T.text(g, "Employee of the Month starts with the uniform.", 480, 80, 13, "#b8ac93", "center");

      const uni = D.UNIFORMS[cur.uniform], hw = D.HEADWEAR[cur.headwear];
      const previewLocked = !C.isUnlocked(uni) || !C.isUnlocked(hw);

      // left: the employee locker, your cook posing in front of it
      const lx = 60, ly = 104, lw = 320, lh = 340;
      g.fillStyle = "#4a4e57";
      g.fillRect(lx, ly, lw, lh);
      g.fillStyle = "#5a5e66";
      g.fillRect(lx + 10, ly + 10, lw - 20, lh - 20);
      g.fillStyle = "#3a3d44"; // vents
      for (let v = 0; v < 5; v++) g.fillRect(lx + 110, ly + 28 + v * 9, 100, 4);
      g.fillStyle = "#c9c2a8"; // name plate
      g.fillRect(lx + 120, ly + 82, 80, 16);
      T.text(g, "COOK", lx + 160, ly + 94, 11, "#3a3428", "center", true, false);
      g.fillStyle = "#8a919c"; // handle
      g.fillRect(lx + lw - 40, ly + 150, 8, 40);
      g.fillStyle = "rgba(255,217,127,0.12)"; // spotlight
      g.beginPath();
      g.ellipse(lx + lw / 2, ly + lh - 24, 110, 20, 0, 0, Math.PI * 2);
      g.fill();
      const opts = C.buildOpts(uni, hw, cur.skin, cur.hair);
      opts.scale = 2.6;
      const facing = Math.floor(t / 2.5) % 2 === 0 ? 1 : -1;
      S.drawDude(g, lx + lw / 2, ly + lh - 24, opts, "idle", t, facing);
      if (previewLocked) {
        g.fillStyle = "rgba(10,7,5,0.45)";
        g.fillRect(lx, ly, lw, lh);
        g.save();
        g.translate(lx + lw / 2, ly + lh / 2);
        g.rotate(-0.18);
        g.strokeStyle = "#c93a2e";
        g.lineWidth = 4;
        g.strokeRect(-90, -28, 180, 56);
        T.text(g, "LOCKED", 0, 14, 36, "#c93a2e", "center");
        g.restore();
      }

      // right: the rows
      const rx = 440;
      const rowY = { skin: 124, hair: 184, headwear: 244, uniform: 304, done: 424 };
      const focus = ROWS[self.row];
      const label = (r, text) => {
        const on = focus === r;
        T.text(g, (on ? "► " : "") + text, rx, rowY[r], 13, on ? "#ffd97f" : "#b8ac93");
      };

      label("skin", "SKIN TONE");
      D.SKIN_TONES.forEach((c, i) => swatch(g, rx + 4 + i * 36, rowY.skin + 9, c, i === cur.skin));
      label("hair", "HAIR");
      D.HAIR_COLORS.forEach((c, i) => swatch(g, rx + 4 + i * 36, rowY.hair + 9, c, i === cur.hair));

      label("headwear", "HEADWEAR");
      itemLine(g, hw, rx, rowY.headwear + 27, focus === "headwear");

      label("uniform", "UNIFORM");
      itemLine(g, uni, rx, rowY.uniform + 27, focus === "uniform");
      // shirt / apron color chips
      g.fillStyle = uni.shirt;
      g.fillRect(rx + 420, rowY.uniform + 12, 18, 18);
      g.strokeStyle = "#4a4034";
      g.lineWidth = 1;
      g.strokeRect(rx + 420, rowY.uniform + 12, 18, 18);
      if (uni.apron) {
        g.fillStyle = uni.apron;
        g.fillRect(rx + 444, rowY.uniform + 12, 18, 18);
        g.strokeRect(rx + 444, rowY.uniform + 12, 18, 18);
      }
      g.font = T.font(11, false);
      U.wrapText(g, uni.desc, 460).forEach((ln, i) => {
        T.text(g, ln, rx, rowY.uniform + 48 + i * 14, 11, "#8f8878", "left", false);
      });

      // lock status for the focused locked item
      const focusItem = focus === "headwear" ? hw : focus === "uniform" ? uni : null;
      if (focusItem && !C.isUnlocked(focusItem)) {
        const req = focusItem.unlock;
        const have = Math.min(C.stat(req.stat), req.n);
        const fmt = (v) => (req.stat === "cashLifetime" ? U.money(v) : String(Math.floor(v)));
        const sx = lockedPing > 0 ? Math.sin(t * 60) * 3 : 0;
        T.text(g, `LOCKED — ${req.text}`, rx + sx, 386, 13, "#ff8f7f");
        T.bar(g, rx, 394, 260, 6, C.progress(focusItem), "#ffd23e");
        T.text(g, `${fmt(have)} / ${fmt(req.n)}`, rx + 272, 401, 11, "#b8ac93");
      }

      const doneOn = focus === "done";
      T.text(g, (doneOn ? "► " : "") + "DONE", rx, rowY.done, doneOn ? 18 : 15, doneOn ? "#ffd97f" : "#d8d4c8");

      const uCount = D.UNIFORMS.filter(C.isUnlocked).length;
      const hCount = D.HEADWEAR.filter(C.isUnlocked).length;
      T.text(g, `UNIFORMS ${uCount}/${D.UNIFORMS.length}   ·   HEADWEAR ${hCount}/${D.HEADWEAR.length}`,
        480, 476, 13, "#8fd9a8", "center");
      T.text(g, `▲▼ choose   ◄► change   [${I.prompt("interact")}] next   [${I.prompt("pause")}] back`,
        480, 502, 12, "#8f8878", "center");
    };
    return self;
  };

  // ---------------------------------------------------------------- HOW TO
  M.HowToScene = function (thenStart) {
    const self = { page: 0, kind: "howto" };
    const pages = [
      {
        title: "1. COOK",
        lines: [
          "Walk the line with MOVE. Start food at a station with [INTERACT].",
          "Take it off the heat when it dings — leave it too long and it BURNS.",
          "Some folks want hashbrowns ALL THE WAY (onions & cheese).",
          "Just press [HEAVY] once while holding the hash. Plain? Don't press it.",
        ],
      },
      {
        title: "2. SERVE",
        lines: [
          "Match plates to the order bubbles at the counter. [INTERACT] to serve.",
          "Patience bars drain fast — a served regular pays cash and tips.",
          "A timed-out customer leaves with a GRUDGE. Grudges come back...",
          "...at the end of the hour. With friends. And opinions.",
        ],
      },
      {
        title: "3. FIGHT",
        lines: [
          "[ATTACK] to punch (3-hit combo). [DODGE] to roll through anything.",
          "Take the DOGGY BAG perk and unserved food follows you in as snacks.",
          "WAFL INDEX = how bad the night is. Failed orders heat it up:",
          "patience drains faster, and at RED grudges bring an extra friend.",
        ],
      },
    ];

    self.update = function (dt) {
      if (I.pressed("right") || I.pressed("interact") || I.pressed("attack")) {
        WH.Audio.sfx("uiSelect");
        self.page++;
        if (self.page >= pages.length) {
          if (thenStart) G.transition(() => WH.Flow.startNight());
          else G.transition(() => G.setScene(M.TitleScene()));
        }
      }
      if (I.pressed("left") && self.page > 0) { self.page--; WH.Audio.sfx("uiMove"); }
      if (I.pressed("pause")) {
        WH.Audio.sfx("uiBack");
        G.transition(() => G.setScene(M.TitleScene()));
      }
    };

    self.draw = function (g) {
      g.drawImage(S.bgKitchen, 0, 0);
      g.fillStyle = "rgba(10,7,5,0.72)";
      g.fillRect(0, 0, 960, 540);
      const p = pages[Math.min(self.page, pages.length - 1)];
      T.text(g, p.title, 480, 120, 34, "#ffd97f", "center");
      p.lines.forEach((ln, i) => {
        T.text(g, ln
          .replace("[INTERACT]", `[${I.prompt("interact")}]`)
          .replace("[HEAVY]", `[${I.prompt("heavy")}]`)
          .replace("[ATTACK]", `[${I.prompt("attack")}]`)
          .replace("[DODGE]", `[${I.prompt("dodge")}]`),
          480, 190 + i * 34, 15, "#e8e0cc", "center");
      });
      // little demo art per page
      if (self.page === 0) {
        S.drawStationBase(g, 480, 400, 120, "WAFFLE IRON", "#7a5c34");
        g.drawImage(S.icons.waffle, 465, 362);
      } else if (self.page === 1) {
        S.drawDude(g, 420, 400, { shirt: "#6a7fd1", hat: "cap", mood: "happy" }, "sit", 0, 1);
        g.drawImage(S.icons.hash, 500, 360, 30, 24);
      } else {
        S.drawDude(g, 420, 410, WH.Cosmetics.cookOpts(), "punch", 0, 1);
        S.drawDude(g, 520, 410, { shirt: "#7fb2d9", hat: "beanie", mood: "angry" }, "hurt", 0, -1);
      }
      T.text(g, `PAGE ${Math.min(self.page + 1, 3)}/3 — [${I.prompt("interact")}] NEXT`, 480, 500, 12, "#8f8878", "center");
    };
    return self;
  };

  // ---------------------------------------------------------------- SETTINGS
  M.SettingsScene = function (isOverlay, underScene) {
    const self = { sel: 0, kind: "settings" };
    const st = WH.Save.data.settings;
    const items = () => [
      { label: "MASTER VOLUME", value: Math.round(st.master * 10) },
      { label: "MUSIC VOLUME", value: Math.round(st.music * 10) },
      { label: "SFX VOLUME", value: Math.round(st.sfx * 10) },
      { label: "SCREEN SHAKE", value: st.shake ? "ON" : "OFF" },
      { label: "BACK", value: "" },
    ];

    function adjust(dir) {
      if (self.sel === 0) st.master = U.clamp(st.master + dir * 0.1, 0, 1);
      if (self.sel === 1) st.music = U.clamp(st.music + dir * 0.1, 0, 1);
      if (self.sel === 2) st.sfx = U.clamp(st.sfx + dir * 0.1, 0, 1);
      if (self.sel === 3) st.shake = !st.shake;
      WH.Audio.settings.master = st.master;
      WH.Audio.settings.music = st.music;
      WH.Audio.settings.sfx = st.sfx;
      WH.Audio.applyVolumes();
      WH.Save.save();
      WH.Audio.sfx("uiMove");
    }

    function leave() {
      WH.Save.save();
      WH.Audio.sfx("uiBack");
      if (isOverlay) G.pushOverlay(M.PauseOverlay(underScene));
      else G.transition(() => G.setScene(M.TitleScene()));
    }

    self.update = function (dt) {
      const its = items();
      if (I.pressed("up")) { self.sel = (self.sel + its.length - 1) % its.length; WH.Audio.sfx("uiMove"); }
      if (I.pressed("down")) { self.sel = (self.sel + 1) % its.length; WH.Audio.sfx("uiMove"); }
      if (I.pressed("left")) adjust(-1);
      if (I.pressed("right")) adjust(1);
      if (I.pressed("interact") || I.pressed("attack")) {
        if (self.sel === 3) adjust(1);
        else if (self.sel === 4) leave();
      }
      if (I.pressed("pause")) leave();
    };

    self.draw = function (g) {
      if (underScene && underScene.draw) underScene.draw(g);
      else g.drawImage(S.bgArena, 0, 0);
      g.fillStyle = "rgba(10,7,5,0.8)";
      g.fillRect(0, 0, 960, 540);
      T.text(g, "SETTINGS", 480, 130, 32, "#ffd97f", "center");
      items().forEach((it, i) => {
        const sel = i === self.sel;
        const y = 210 + i * 44;
        T.text(g, (sel ? "► " : "") + it.label, 340, y, sel ? 19 : 16, sel ? "#ffd97f" : "#d8d4c8");
        if (it.value !== "") {
          if (typeof it.value === "number") {
            for (let b = 0; b < 10; b++) {
              g.fillStyle = b < it.value ? "#ffd97f" : "#3a352c";
              g.fillRect(600 + b * 16, y - 12, 12, 14);
            }
          } else {
            T.text(g, String(it.value), 600, y, 16, "#8fe07c");
          }
        }
      });
      T.text(g, "◄ ► to adjust", 480, 460, 12, "#8f8878", "center");
    };
    return self;
  };

  // ---------------------------------------------------------------- PAUSE
  M.PauseOverlay = function (underScene) {
    const self = { sel: 0, kind: "pause" };
    const items = ["RESUME", "SETTINGS", "QUIT TO TITLE"];
    self.update = function (dt) {
      if (I.pressed("pause")) { WH.Audio.sfx("uiBack"); G.popOverlay(); return; }
      if (menuNav(self, items.length)) {
        if (self.sel === 0) G.popOverlay();
        else if (self.sel === 1) {
          G.popOverlay();
          G.pushOverlay(M.SettingsScene(true, underScene));
        } else {
          G.popOverlay();
          WH.Audio.stopMusic();
          WH.Audio.currentTrack = null;
          G.transition(() => G.setScene(M.TitleScene()));
        }
      }
    };
    self.draw = function (g) {
      g.fillStyle = "rgba(8,6,10,0.66)";
      g.fillRect(0, 0, 960, 540);
      T.text(g, "PAUSED", 480, 180, 38, "#ffd97f", "center");
      T.text(g, "(the grease is also paused)", 480, 210, 12, "#8f8878", "center");
      items.forEach((it, i) => {
        const sel = i === self.sel;
        T.text(g, (sel ? "► " : "") + it, 480, 280 + i * 40, sel ? 20 : 17, sel ? "#ffd97f" : "#d8d4c8", "center");
      });
    };
    return self;
  };
  M.openPause = function (underScene) {
    WH.Audio.sfx("uiSelect");
    G.pushOverlay(M.PauseOverlay(underScene));
  };

  // ---------------------------------------------------------------- HOUR CARD
  M.HourCardScene = function (hourIdx, next) {
    const self = { kind: "hourcard" };
    let t = 0;
    const H = D.HOURS[hourIdx];
    self.update = function (dt) {
      t += dt;
      if (t > 0.6 && (I.pressed("interact") || I.pressed("attack"))) { WH.Audio.sfx("uiSelect"); next(); }
      if (t > 3.2) next();
    };
    self.draw = function (g) {
      g.drawImage(S.bgKitchen, 0, 0);
      g.fillStyle = "rgba(10,7,5,0.82)";
      g.fillRect(0, 0, 960, 540);
      T.text(g, H.label, 480, 200, 26, "#b8ac93", "center");
      T.text(g, H.title, 480, 258, 42, "#ffd97f", "center");
      T.text(g, H.sub, 480, 300, 16, "#d8d4c8", "center");
      if (H.boss) {
        if (Math.floor(t * 3) % 2 === 0) T.text(g, "⚠ SOMETHING'S COMING ⚠", 480, 350, 18, "#ff5f4e", "center");
      }
      const lvl = N.indexLevel();
      const L = D.INDEX_LEVELS[lvl];
      T.text(g, `WAFL INDEX: ${L.name} — ${L.desc}`, 480, 420, 13, L.color, "center");
      const fxLine = [
        "(patience drains at normal speed — keep it that way)",
        "(customers lose patience 22% faster — serve well to cool it)",
        "(patience drains 50% faster & grudge fights add an extra friend)",
      ][lvl];
      T.text(g, fxLine, 480, 436, 11, "#8f8878", "center", false);
      if (N.lastPerk) {
        T.text(g, `NEW PERK: ${N.lastPerk.toUpperCase()}`, 480, 388, 15, "#8fd9a8", "center");
      }
      T.text(g, `HP ${Math.ceil(N.hp)}/${N.maxHp}   ${U.money(N.cash)}   GRUDGES: ${N.grudges.length}`, 480, 450, 13, "#b8ac93", "center");
    };
    return self;
  };

  // ---------------------------------------------------------------- PERK DRAFT
  M.PerkScene = function (next) {
    const self = { sel: 1, kind: "perk" };
    const owned = N.perks;
    // some perks (like hiring Junior) only show up once the night gets rough
    const pool = D.PERKS.filter(
      (p) => !owned.has(p.id) && (!p.minHour || N.hour + 1 >= p.minHour)
    );
    const cards = U.pickN(pool, Math.min(3, pool.length)).map((p) => Object.assign({}, p));
    self.debugCards = () => (WH.Game.debug ? cards.map((c) => c.id) : null);
    for (const card of cards) {
      if (card.id === "linecook") {
        card.station = U.pick(["iron", "eggs", "bacon", "hash"]);
        card.desc += ` Tonight he's on the ${D.STATION_NAMES[card.station]}.`;
      }
    }
    let t = 0;

    self.update = function (dt) {
      t += dt;
      if (cards.length === 0) { next(); return; }
      // grace period: mashing punch through the fight's last hit must not
      // blind-pick the middle card the instant this screen appears
      if (t < 0.6) return;
      if (I.pressed("left")) { self.sel = (self.sel + cards.length - 1) % cards.length; WH.Audio.sfx("uiMove"); }
      if (I.pressed("right")) { self.sel = (self.sel + 1) % cards.length; WH.Audio.sfx("uiMove"); }
      if (I.pressed("interact") || I.pressed("attack")) {
        const perk = cards[self.sel];
        N.perks.add(perk.id);
        N.lastPerk = perk.name;
        if (perk.id === "linecook") N.linecookStation = perk.station;
        WH.Audio.sfx("perk");
        next();
      }
    };

    self.draw = function (g) {
      g.drawImage(S.bgKitchen, 0, 0);
      g.fillStyle = "rgba(10,7,5,0.82)";
      g.fillRect(0, 0, 960, 540);
      T.text(g, "SHIFT PERK", 480, 100, 32, "#ffd97f", "center");
      T.text(g, "The night is long. Pick a friend.", 480, 130, 14, "#b8ac93", "center");

      const n = cards.length;
      const cw = 250, ch = 260;
      cards.forEach((perk, i) => {
        const cx = 480 + (i - (n - 1) / 2) * 290;
        const sel = i === self.sel;
        const y0 = 180 - (sel ? 12 : 0);
        g.fillStyle = sel ? "rgba(50,38,22,0.96)" : "rgba(28,22,16,0.92)";
        g.strokeStyle = sel ? "#ffd97f" : "#5a4c38";
        g.lineWidth = sel ? 4 : 2;
        g.beginPath();
        if (g.roundRect) g.roundRect(cx - cw / 2, y0, cw, ch, 10); else g.rect(cx - cw / 2, y0, cw, ch);
        g.fill(); g.stroke();

        const tagColor = perk.kind === "combat" ? "#ff8f7f" : "#8fd9a8";
        T.text(g, perk.kind === "combat" ? "◆ COMBAT" : "◆ KITCHEN", cx, y0 + 28, 11, tagColor, "center");
        T.text(g, perk.name, cx, y0 + 58, 18, sel ? "#ffd97f" : "#e8e0cc", "center");
        g.font = T.font(12, false);
        const lines = U.wrapText(g, perk.desc, cw - 36);
        lines.forEach((ln, li) => T.text(g, ln, cx, y0 + 92 + li * 17, 12, "#d8d4c8", "center", false));
        g.font = T.font(11, false);
        const fl = U.wrapText(g, '"' + perk.flavor + '"', cw - 40);
        fl.forEach((ln, li) => T.text(g, ln, cx, y0 + ch - 40 + li * 14, 11, "#8f8878", "center", false));
      });
      // receipts: what you already own can never be offered again
      if (N.perks.size > 0) {
        const names = D.PERKS.filter((p) => N.perks.has(p.id)).map((p) => p.name).join("  ·  ");
        T.text(g, "YOU ALREADY HAVE: " + names, 480, 474, 11, "#8f8878", "center", false);
      }
      T.text(g, `◄ ► choose   [${I.prompt("interact")}] take it`, 480, 500, 13, "#8f8878", "center");
    };
    return self;
  };

  // ---------------------------------------------------------------- RESULTS
  M.ResultsScene = function (won) {
    const self = { sel: 0, kind: "results" };
    let t = 0;
    const score = N.cash;
    let grade = D.GRADES[0];
    for (const gr of D.GRADES) if (score >= gr.min) grade = gr;
    const items = ["CLOCK IN AGAIN", "BACK TO TITLE"];
    const isHigh = score > WH.Save.data.high.score;
    const failLine = U.pick(D.GAMEOVER_LINES); // picked once — no per-frame flicker
    let newUnlocks = [];

    self.enter = function () {
      WH.Audio.playMusic(won ? "results" : "title");
      const sv = WH.Save.data;
      const before = new Set(WH.Cosmetics.earnedIds());
      sv.totals.nights++;
      if (won) sv.totals.wins++;
      sv.totals.customersFed += N.stats.served;
      sv.totals.enemiesKOd += N.stats.kos;
      sv.totals.chairsCaught += N.stats.chairsCaught;
      sv.totals.cashLifetime += score;
      sv.totals.bossesBeaten += N.stats.bosses;
      sv.totals.karenBeaten += N.stats.karen;
      if (isHigh) {
        sv.high = { score, grade: grade.grade, title: grade.title };
      }
      WH.Save.save();
      newUnlocks = WH.Cosmetics.earnedIds()
        .filter((id) => !before.has(id))
        .map((id) => WH.Cosmetics.itemById(id).name);
      if (newUnlocks.length) WH.Audio.sfx("perk");
    };

    self.update = function (dt) {
      t += dt;
      if (t < 0.8) return;
      if (menuNav(self, items.length)) {
        if (self.sel === 0) G.transition(() => WH.Flow.startNight());
        else G.transition(() => G.setScene(M.TitleScene()));
      }
    };

    self.draw = function (g) {
      g.drawImage(S.bgKitchen, 0, 0);
      // dawn tint if you made it
      if (won) {
        g.fillStyle = "rgba(255,170,80,0.14)";
        g.fillRect(0, 0, 960, 540);
      }
      g.fillStyle = "rgba(10,7,5,0.8)";
      g.fillRect(0, 0, 960, 540);

      if (won) {
        T.text(g, "6:00 AM — YOU SURVIVED THE NIGHT", 480, 92, 24, "#ffd97f", "center");
        T.text(g, "The sun rises. The grease endures.", 480, 120, 13, "#b8ac93", "center");
      } else {
        T.text(g, "SHIFT REPORT (POSTHUMOUS)", 480, 92, 24, "#ff8f7f", "center");
        T.text(g, failLine, 480, 120, 13, "#b8ac93", "center");
      }

      // grade stamp
      g.save();
      g.translate(760, 210);
      g.rotate(-0.14);
      g.strokeStyle = grade.grade === "S" ? "#ffd97f" : "#c93a2e";
      g.lineWidth = 5;
      g.strokeRect(-64, -52, 128, 104);
      T.text(g, grade.grade, 0, 26, 72, grade.grade === "S" ? "#ffd97f" : "#c93a2e", "center");
      g.restore();

      T.text(g, `RANK EARNED: "${grade.title}"`, 380, 190, 20, "#ffd97f", "center");
      T.text(g, grade.line, 380, 216, 12, "#b8ac93", "center");
      if (newUnlocks.length) {
        const shown = newUnlocks.slice(0, 2).join(", ") +
          (newUnlocks.length > 2 ? ` +${newUnlocks.length - 2} more` : "");
        T.text(g, `NEW IN YOUR LOCKER: ${shown}`, 380, 246, 13, "#48d0c8", "center");
      }

      const st = N.stats;
      const rows = [
        ["CASH & TIPS", U.money(score)],
        ["ORDERS SERVED", st.served],
        ["ORDERS FUMBLED", st.failed],
        ["CUSTOMERS DECKED", st.kos],
        ["CHAIRS CAUGHT", st.chairsCaught],
        ["FOOD BURNED", st.burned],
      ];
      rows.forEach((r, i) => {
        T.text(g, r[0], 300, 270 + i * 26, 14, "#b8ac93");
        T.text(g, String(r[1]), 640, 270 + i * 26, 14, "#8fe07c", "right");
      });
      if (isHigh && Math.floor(t * 3) % 2 === 0) {
        T.text(g, "★ NEW BEST NIGHT ★", 480, 445, 18, "#ffd97f", "center");
      }
      items.forEach((it, i) => {
        const sel = i === self.sel;
        T.text(g, (sel ? "► " : "") + it, 480, 480 + i * 28, sel ? 17 : 14, sel ? "#ffd97f" : "#d8d4c8", "center");
      });
    };
    return self;
  };

  return M;
})();
