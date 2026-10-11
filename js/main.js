/* WAFFLE'S HOUSE — main.js
   Night flow: 10 PM → 6 AM. Cook the hour, brawl the fallout,
   pick a perk, repeat. Bosses at 2 AM and 4 AM. Bootstraps the game. */
"use strict";
window.WH = window.WH || {};

WH.Flow = (function () {
  const F = {};
  const U = WH.U, D = WH.Data, N = WH.Night, G = WH.Game;

  // fresh run state, plus any developer-mode modifiers
  function freshRun() {
    N.reset();
    const dev = WH.Save.data.dev;
    if (!dev.enabled) return;
    if (dev.allPerks) {
      N.perks = new Set(D.PERKS.map((p) => p.id));
      N.linecookStation = U.pick(["iron", "eggs", "bacon", "hash"]);
    }
    N.heat = dev.heat || 0;
  }

  F.startNight = function () {
    freshRun();
    F.gotoHour(0);
  };

  // developer mode: start a normal night from any hour
  F.startNightAt = function (h) {
    freshRun();
    F.gotoHour(h);
  };

  // developer mode: a single fight that returns to the dev menu either way
  F.devFight = function (hour, config) {
    freshRun();
    N.hour = hour;
    const back = (msg) => G.transition(() => G.setScene(WH.Menus.DevScene(msg)));
    G.setScene(WH.FightScene(hour, config,
      () => back("FIGHT WON — back in the lab"),
      () => back("KNOCKED OUT — try god mode?")));
  };

  F.gotoHour = function (h) {
    N.hour = h;
    G.setScene(WH.Menus.HourCardScene(h, () => {
      G.transition(() => F.startCooking(h));
    }));
  };

  F.startCooking = function (h) {
    G.setScene(WH.CookScene(h, () => {
      G.transition(() => F.afterCooking(h));
    }));
  };

  F.afterCooking = function (h) {
    const H = D.HOURS[h];
    // The fight is exactly who you failed — plus the friends they text.
    // Perfect service = no brawl (bosses excepted; they have a schedule).
    const grudgeCount = N.grudges.length;
    const wave = N.grudges.slice();
    N.grudges = [];
    let friends = 0;
    if (grudgeCount > 0) {
      friends = Math.min(3, Math.floor(grudgeCount / 2) + (N.indexLevel() === 2 ? 1 : 0));
      for (let i = 0; i < friends; i++) {
        wave.push(U.pick(D.ENEMY_UNLOCK[h]));
      }
    }

    if (H.boss || wave.length > 0) {
      const plural = (n) => (n === 1 ? "" : "s");
      const sub = friends > 0
        ? `(${grudgeCount} grudge${plural(grudgeCount)} — and they texted ${friends} friend${plural(friends)})`
        : `(everyone you disappointed this hour)`;
      G.setScene(WH.FightScene(h, { enemies: wave, boss: H.boss || null, sub },
        () => G.transition(() => F.afterFight(h)),   // win
        () => G.transition(() => F.gameOver())        // loss
      ));
    } else {
      F.afterFight(h);
    }
  };

  F.afterFight = function (h) {
    // catch your breath: small heal between hours
    N.hp = Math.min(N.maxHp, N.hp + 12);
    if (h >= D.HOURS.length - 1) {
      G.setScene(WH.Menus.ResultsScene(true));
    } else {
      G.setScene(WH.Menus.PerkScene(() => {
        G.transition(() => F.gotoHour(h + 1));
      }));
    }
  };

  F.gameOver = function () {
    G.setScene(WH.Menus.ResultsScene(false));
  };

  return F;
})();

window.addEventListener("load", () => {
  WH.Game.init();
  WH.Game.setScene(WH.Menus.TitleScene());
});
