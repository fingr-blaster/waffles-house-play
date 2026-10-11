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
    const items = ["START SHIFT", "HOW TO PLAY", "SETTINGS"];

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

      // the cook, unbothered, mid-mop
      S.drawDude(g, 780, 460, { shirt: "#f0ece0", apron: true, hat: "paper" }, "idle", t, -1);

      S.drawNeonSign(g, 480, 88, 1.35, t, "WAFFLE'S");
      S.drawNeonSign(g, 480, 152, 0.95, t + 1.3, "HOUSE");
      T.text(g, "— GRAVEYARD SHIFT —", 480, 216, 17, "#ffd97f", "center");
      T.text(g, "Cook. Serve. Survive till 6 AM.", 480, 240, 13, "#b8ac93", "center");

      items.forEach((it, i) => {
        const sel = i === self.sel;
        T.text(g, (sel ? "► " : "") + it, 480, 315 + i * 38, sel ? 22 : 18, sel ? "#ffd97f" : "#d8d4c8", "center");
      });

      const hi = WH.Save.data.high;
      if (hi.score > 0) {
        T.text(g, `BEST NIGHT: ${U.money(hi.score)} — "${hi.title}" (${hi.grade})`, 480, 448, 13, "#8fe07c", "center");
      }
      T.text(g, D.DISCLAIMER, 480, 512, 10, "#726a5c", "center", false);
      T.text(g, `${I.hasPad() ? "GAMEPAD CONNECTED" : "KEYBOARD"} · [${I.prompt("interact")}] SELECT`, 480, 528, 10, "#726a5c", "center", false);
      T.text(g, "v1.3", 946, 528, 10, "#726a5c", "right", false);
      drawVignette(g);
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
        S.drawDude(g, 420, 410, { shirt: "#f0ece0", apron: true, hat: "paper" }, "punch", 0, 1);
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

    self.enter = function () {
      WH.Audio.playMusic(won ? "results" : "title");
      const sv = WH.Save.data;
      sv.totals.nights++;
      if (won) sv.totals.wins++;
      sv.totals.customersFed += N.stats.served;
      sv.totals.enemiesKOd += N.stats.kos;
      sv.totals.chairsCaught += N.stats.chairsCaught;
      sv.totals.cashLifetime += score;
      if (isHigh) {
        sv.high = { score, grade: grade.grade, title: grade.title };
      }
      WH.Save.save();
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
