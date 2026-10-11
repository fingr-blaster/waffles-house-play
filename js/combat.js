/* WAFFLE'S HOUSE — combat.js
   The 3 AM brawl. Real-time beat-em-up in the dining room: punch combos,
   dodge rolls, flying chairs (catchable, if you've earned it), syrup
   hazards, and two bosses who have both asked for the manager. */
"use strict";
window.WH = window.WH || {};

WH.FightScene = function (hourIdx, config, onWin, onLose) {
  const U = WH.U, D = WH.Data, S = WH.Sprites, T = WH.T, N = WH.Night, I = WH.Input, G = WH.Game;

  const ARENA = { x0: 70, x1: 890, y0: 285, y1: 495 };
  const self = { kind: "fight" };
  let phase = config.boss ? "intro" : "banner"; // intro -> banner -> fight -> win/lose
  let phaseT = 0;
  let introLine = 0;
  let hitCount = 0, hitCountT = 0;
  let tookDamage = false;
  let t = 0;

  // ---------------------------------------------------------------- player
  const player = {
    x: 200, y: 400, facing: 1, animT: 0, moving: false,
    state: "idle", stateT: 0,
    chain: 0, chainWindow: 0,
    dodgeCd: 0, iframes: 0,
    blockT: 0, parryCd: 0,
    tossCd: 0,
    speedBoost: 0,
    chair: false, // caught chair in hands
  };

  const enemies = [];
  const projectiles = []; // {kind:'chair'|'waffle'|'coupon', x,y,vx,vy,fromEnemy,spin,dmg}
  const puddles = [];     // syrup {x,y,t}
  const pickups = [];     // {x,y,item}
  const rings = [];       // karen shout rings {x,y,r,t,maxR}

  // ---------------------------------------------------------------- setup
  function spawnEnemy(typeId, x, y, isBoss) {
    const def = isBoss ? D.BOSSES[typeId] : D.ENEMIES[typeId];
    const e = {
      def, boss: !!isBoss,
      x, y: U.clamp(y, ARENA.y0, ARENA.y1),
      hp: def.hp, maxHp: def.hp,
      state: "enter", stateT: U.rand(0, 0.4),
      facing: -1, animT: U.rand(0, 5),
      atkCd: U.rand(0.6, 1.6),
      stun: 0, wobbleT: U.rand(0, 6),
      summoned: { half: false, third: false },
      opts: {
        shirt: def.color, hat: def.hat === "none" ? "hair" : def.hat,
        skin: U.pick(["#e8b48c", "#c98f5e", "#8f5f3c", "#f0c8a0"]),
        scale: def.scale || 1, mood: "angry",
        hairColor: "#3a2c20",
      },
    };
    enemies.push(e);
    return e;
  }

  function buildWave() {
    const list = config.enemies || [];
    list.forEach((typeId, i) => {
      const side = i % 2 === 0 ? 1 : 0;
      spawnEnemy(typeId, side ? 940 + i * 40 : -40 - i * 40, U.rand(ARENA.y0 + 20, ARENA.y1 - 20));
    });
    if (config.boss) {
      const b = spawnEnemy(config.boss, 1000, 390, true);
      b.state = "enter";
    }
    // leftovers become snacks on the counter
    N.leftovers.forEach((item, i) => {
      pickups.push({ x: 160 + i * 110, y: 300, item });
    });
    N.leftovers = [];
  }

  self.enter = function () {
    WH.Audio.playMusic(config.boss ? "boss" : "fight");
    buildWave();
    if (config.boss) WH.Audio.sfx("roar");
  };

  self.debugSkip = function () {
    enemies.forEach((e) => {
      if (e.state !== "dead") { e.state = "koing"; e.stateT = 0; e.hp = 0; }
    });
  };

  // debug-only state probe for automated playtesting
  self.debugInfo = function () {
    if (!G.debug) return null;
    return {
      phase,
      player: { x: Math.round(player.x), y: Math.round(player.y), hp: Math.round(N.hp), state: player.state },
      enemies: aliveEnemies().map((e) => ({
        id: e.def.id, x: Math.round(e.x), y: Math.round(e.y), hp: e.hp, state: e.state,
      })),
    };
  };

  // ---------------------------------------------------------------- helpers
  function aliveEnemies() {
    return enemies.filter((e) => e.state !== "dead");
  }

  function playerRect() {
    return { x: player.x - 16, y: player.y - 60, w: 32, h: 60 };
  }

  function hurtPlayer(dmg, srcX) {
    if (player.iframes > 0 || G.debugInvuln) return;
    if (player.state === "dodge") return;
    // parry window
    if (player.blockT > 0 && N.has("parry")) {
      WH.Audio.sfx("parry");
      G.hitstop(4);
      G.shake(3, 0.15);
      WH.FX.float(player.x, player.y - 80, "PARRIED!", "#48d0c8", 16);
      WH.FX.burst(player.x + player.facing * 20, player.y - 40, "#48d0c8", 8, 140, 0.4);
      // stun nearby attacker
      for (const e of aliveEnemies()) {
        if (Math.abs(e.x - player.x) < 90 && Math.abs(e.y - player.y) < 40) {
          e.stun = Math.max(e.stun, 1.5);
          e.state = "stunned";
          e.stateT = 0;
        }
      }
      return;
    }
    if (N.has("grease")) dmg = Math.ceil(dmg * 0.75);
    N.hp -= dmg;
    tookDamage = true;
    player.state = "hurt";
    player.stateT = 0;
    player.iframes = 0.7;
    player.x += (player.x < srcX ? -1 : 1) * 26;
    WH.Audio.sfx("hurt");
    I.rumble(0.7, 0.4, 180);
    G.shake(5, 0.2);
    G.hitstop(3);
    WH.FX.float(player.x, player.y - 84, `-${dmg}`, "#ff5f4e", 15);
    if (N.hp <= 0) {
      if (N.has("wind") && !N.usedSecondWind) {
        N.usedSecondWind = true;
        N.hp = Math.floor(N.maxHp / 2);
        player.iframes = 1.6;
        WH.Audio.sfx("perk");
        WH.FX.float(player.x, player.y - 100, "SECOND WIND!", "#ffd97f", 20);
        WH.FX.burst(player.x, player.y - 40, "#ffd97f", 16, 180, 0.7);
      } else {
        phase = "lose";
        phaseT = 0;
        player.state = "ko";
        WH.Audio.stopMusic();
        WH.Audio.sfx("ko");
      }
    }
  }

  function hurtEnemy(e, dmg, opts) {
    opts = opts || {};
    e.hp -= dmg;
    hitCount++;
    hitCountT = 2;
    WH.Audio.sfx(opts.heavy ? "heavyHit" : "punchHit");
    G.hitstop(opts.heavy ? 4 : 2);
    G.shake(opts.heavy ? 5 : 2.5, 0.12);
    WH.FX.float(e.x, e.y - 70 * (e.def.scale || 1), `${dmg}`, "#ffe066", opts.heavy ? 18 : 14);
    WH.FX.burst(e.x, e.y - 40, "#ffe066", opts.heavy ? 10 : 5, 130, 0.35);
    const armored = e.def.id === "sleeper" || (e.boss && !opts.heavy && U.chance(0.6));
    if (!armored || e.hp <= 0) {
      e.state = "hurt";
      e.stateT = 0;
      e.x += (opts.fromX !== undefined && e.x < opts.fromX ? -1 : 1) * (opts.knock || 18);
    }
    if (e.hp <= 0 && e.state !== "dead") {
      e.state = "koing";
      e.stateT = 0;
      N.stats.kos++;
      if (e.boss) {
        N.stats.bosses++;
        if (e.def.id === "karenator") N.stats.karen++;
      }
      N.addCash(e.def.score / 10);
      WH.FX.float(e.x, e.y - 90, `+$${Math.round(e.def.score / 10)}`, "#8fe07c", 14);
      WH.Audio.sfx("chairBreak");
      I.rumble(e.boss ? 0.8 : 0.15, e.boss ? 0.8 : 0.3, e.boss ? 350 : 90);
    }
  }

  function throwChairAt(fromX, fromY, targetX, targetY, fromEnemy, dmg) {
    const d = Math.max(1, U.dist(fromX, fromY, targetX, targetY));
    const sp = fromEnemy ? 330 : 460;
    projectiles.push({
      kind: "chair", x: fromX, y: fromY - 40,
      vx: ((targetX - fromX) / d) * sp,
      vy: ((targetY - 40 - (fromY - 40)) / d) * sp,
      spin: 0, fromEnemy, dmg: dmg || 12,
    });
    WH.Audio.sfx("chairFly");
  }

  // ---------------------------------------------------------------- player update
  function updatePlayer(dt) {
    player.animT += dt;
    player.stateT += dt;
    player.iframes = Math.max(0, player.iframes - dt);
    player.dodgeCd = Math.max(0, player.dodgeCd - dt);
    player.tossCd = Math.max(0, player.tossCd - dt);
    player.parryCd = Math.max(0, player.parryCd - dt);
    player.blockT = Math.max(0, player.blockT - dt);
    player.chainWindow = Math.max(0, player.chainWindow - dt);
    player.speedBoost = Math.max(0, player.speedBoost - dt);
    if (player.chainWindow <= 0) player.chain = 0;

    const busy = ["attack", "heavy", "hurt", "dodge", "throw"].includes(player.state);
    if (player.state === "hurt" && player.stateT > 0.32) { player.state = "idle"; }
    if ((player.state === "attack" || player.state === "heavy" || player.state === "throw") && player.stateT > (player.state === "heavy" ? 0.42 : 0.24)) {
      player.state = "idle";
    }
    if (player.state === "dodge") {
      const sp = 430;
      player.x += player.facing * sp * dt;
      if (N.has("slick") && Math.floor(player.stateT * 20) % 4 === 0) {
        puddles.push({ x: player.x, y: player.y, t: 5 });
      }
      // chair catch!
      if (N.has("catch") && !player.chair) {
        for (const p of projectiles) {
          if (p.kind === "chair" && p.fromEnemy && U.dist(p.x, p.y, player.x, player.y - 40) < 46) {
            p.dead = true;
            player.chair = true;
            N.stats.chairsCaught++;
            WH.Audio.sfx("parry");
            I.rumble(0.4, 0.4, 150);
            G.hitstop(6);
            WH.FX.float(player.x, player.y - 95, "CAUGHT IT!", "#48d0c8", 18);
            WH.FX.burst(player.x, player.y - 50, "#48d0c8", 12, 160, 0.5);
          }
        }
      }
      if (player.stateT > 0.30) player.state = "idle";
    }

    if (!busy) {
      const ax = I.axisX(), ay = I.axisY();
      const sp = 300 * (player.speedBoost > 0 ? 1.25 : 1);
      player.x += ax * sp * dt;
      player.y += ay * sp * dt;
      player.moving = Math.abs(ax) > 0.1 || Math.abs(ay) > 0.1;
      if (Math.abs(ax) > 0.1) player.facing = ax > 0 ? 1 : -1;

      if (I.pressed("attack")) {
        if (player.chair) {
          // hurl the caught chair — strong, but not a bowling ball
          player.chair = false;
          player.state = "throw";
          player.stateT = 0;
          const tgt = nearestEnemy();
          throwChairAt(player.x, player.y, tgt ? tgt.x : player.x + player.facing * 300, tgt ? tgt.y : player.y, false, 20);
        } else {
          player.state = "attack";
          player.stateT = 0;
          player.chain = player.chainWindow > 0 ? (player.chain + 1) % 3 : 0;
          player.chainWindow = 0.65;
          WH.Audio.sfx("whoosh");
          doMeleeHit();
        }
      } else if (I.pressed("heavy")) {
        if (N.has("toss") && player.tossCd <= 0) {
          player.state = "throw";
          player.stateT = 0;
          player.tossCd = 2.2;
          const tgt = nearestEnemy();
          const tx = tgt ? tgt.x : player.x + player.facing * 320;
          const ty = tgt ? tgt.y : player.y;
          const d = Math.max(1, U.dist(player.x, player.y, tx, ty));
          projectiles.push({
            kind: "waffle", x: player.x, y: player.y - 44,
            vx: ((tx - player.x) / d) * 420, vy: ((ty - player.y) / d) * 420,
            spin: 0, fromEnemy: false, dmg: 12,
          });
          WH.Audio.sfx("throwF");
        } else {
          player.state = "heavy";
          player.stateT = 0;
          WH.Audio.sfx("whoosh");
          setTimeout(() => {}, 0);
          doMeleeHit(true);
        }
      } else if (I.pressed("dodge") && player.dodgeCd <= 0) {
        player.state = "dodge";
        player.stateT = 0;
        player.dodgeCd = 0.5;
        player.iframes = 0.28;
        WH.Audio.sfx("dodge");
      } else if (I.pressed("interact")) {
        // eat a snack if near one, else parry stance
        const pk = pickups.find((p) => U.dist(p.x, p.y, player.x, player.y - 20) < 52);
        if (pk) {
          eatPickup(pk);
        } else if (N.has("parry") && player.parryCd <= 0) {
          player.blockT = 0.22;
          player.parryCd = 0.55;
          player.state = "idle";
        }
      }
    }
    player.x = U.clamp(player.x, ARENA.x0, ARENA.x1);
    player.y = U.clamp(player.y, ARENA.y0, ARENA.y1);
  }

  function eatPickup(pk) {
    const f = D.FOODS[pk.item.food];
    let heal = f.heal + (pk.item.mods ? pk.item.mods.length * 5 : 0);
    N.hp = Math.min(N.maxHp, N.hp + heal);
    pickups.splice(pickups.indexOf(pk), 1);
    WH.Audio.sfx("heal");
    WH.FX.float(player.x, player.y - 90, `+${heal} HP`, "#8fe07c", 16);
    WH.FX.burst(player.x, player.y - 50, "#8fe07c", 8, 100, 0.4);
  }

  function nearestEnemy() {
    let best = null, bd = 1e9;
    for (const e of aliveEnemies()) {
      if (e.state === "koing") continue;
      const d = U.dist(player.x, player.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function doMeleeHit(heavy) {
    const isFinisher = !heavy && player.chain === 2;
    const haymaker = isFinisher && N.has("haymaker");
    const range = heavy ? 80 : 74;
    const dmg = heavy ? 18 : isFinisher ? (haymaker ? 24 : 14) : 8;
    let hit = false;
    for (const e of aliveEnemies()) {
      if (e.state === "koing") continue;
      const dx = e.x - player.x;
      const inFront = U.sign(dx) === player.facing || Math.abs(dx) < 26; // point-blank always counts
      if (Math.abs(dx) < range && inFront && Math.abs(e.y - player.y) < 34) {
        hurtEnemy(e, dmg, { heavy: heavy || isFinisher, fromX: player.x, knock: haymaker ? 55 : heavy ? 30 : 16 });
        hit = true;
      }
    }
    if (haymaker && hit) {
      G.shake(7, 0.25);
      I.rumble(0.3, 0.6, 120);
      WH.FX.float(player.x + player.facing * 50, player.y - 100, "HAYMAKER!", "#ffd97f", 18);
    }
  }

  // ---------------------------------------------------------------- enemy update
  function updateEnemy(e, dt) {
    e.animT += dt;
    e.stateT += dt;
    e.wobbleT += dt;
    if (e.stun > 0) {
      e.stun -= dt;
      if (e.stun <= 0 && e.state === "stunned") e.state = "approach";
      return;
    }
    const def = e.def;
    const speedMult = puddles.some((p) => U.dist(p.x, p.y, e.x, e.y) < 46) ? 0.45 : 1;
    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (e.state !== "koing" && e.state !== "dead") e.facing = dx > 0 ? 1 : -1;

    switch (e.state) {
      case "enter": {
        e.x += (e.x > 480 ? -1 : 1) * def.speed * 1.4 * dt;
        if (e.x > ARENA.x0 + 30 && e.x < ARENA.x1 - 30) {
          e.state = "approach";
          if (U.chance(0.5)) WH.FX.float(e.x, e.y - 80 * (def.scale || 1), U.pick(def.taunts), "#ff9f8f", 12);
        }
        break;
      }
      case "approach": {
        e.atkCd -= dt;
        // Axis-separated pursuit: ALWAYS close the vertical gap first, then
        // manage spacing on X only. Euclidean spacing let enemies hover a
        // legal distance directly above/below a player hugging the arena
        // edge — permanently out of swing range, whiffing forever.
        let wantX = 46;
        if (def.id === "chucker") wantX = 240;
        if (def.id === "karen") wantX = 88;
        if (e.boss && def.id === "karenator") wantX = 150;
        const adx = Math.abs(dx), ady = Math.abs(dy);
        const wob = def.id === "tipsy" ? Math.sin(e.wobbleT * 3) * 40 * dt : 0;
        if (ady > 14) {
          e.y += U.sign(dy) * Math.min(def.speed * speedMult * dt, ady) + wob;
        }
        if (adx > wantX + 12) {
          e.x += U.sign(dx) * def.speed * speedMult * dt;
        } else if (adx < wantX - 30) {
          e.x -= U.sign(dx) * def.speed * 0.7 * speedMult * dt;
        }
        // philosopher drifts and quotes
        if (def.id === "philosopher") {
          e.x += Math.sin(e.wobbleT * 1.7) * 50 * dt;
          e.y += Math.cos(e.wobbleT * 1.3) * 40 * dt;
          if (U.chance(dt * 0.15)) WH.FX.float(e.x, e.y - 78, U.pick(def.taunts), "#8fd9a8", 11);
        }
        if (e.atkCd <= 0) {
          // choose attack (per-axis checks so edge rows are never safe spots)
          if (e.boss) bossChooseAttack(e);
          else if (def.id === "chucker" && adx > 130) startAttack(e, "chuck", 0.55);
          else if (def.id === "karen" && adx < 130 && ady < 40) startAttack(e, "shout", 0.5);
          else if (def.id === "philosopher" && dist < 190 && ady < 30) startAttack(e, "lunge", 0.3);
          else if (adx < 62 && ady < 30) startAttack(e, "swing", def.id === "sleeper" ? 0.65 : 0.4);
          else e.atkCd = 0.25;
        }
        break;
      }
      case "windup": {
        if (e.stateT >= e.windupDur) {
          e.state = "attacking";
          e.stateT = 0;
          resolveEnemyAttack(e);
        }
        break;
      }
      case "attacking": {
        if (e.atk === "lunge" || e.atk === "charge") {
          const sp = e.atk === "charge" ? 520 : 430;
          e.x += e.facing * sp * dt;
          // contact damage during dash
          if (Math.abs(e.x - player.x) < 42 && Math.abs(e.y - player.y) < 30 && !e.dashHit) {
            e.dashHit = true;
            hurtPlayer(e.def.dmg, e.x);
          }
          if (e.x <= ARENA.x0 + 4 || e.x >= ARENA.x1 - 4) {
            e.x = U.clamp(e.x, ARENA.x0, ARENA.x1);
            e.state = "stunned";
            e.stun = e.atk === "charge" ? 1.4 : 0.5;
            e.stateT = 0;
            if (e.atk === "charge") {
              G.shake(8, 0.3);
              WH.Audio.sfx("chairBreak");
              WH.FX.burst(e.x, e.y - 30, "#d0d4dc", 12, 180, 0.5);
            }
            break;
          }
          if (e.stateT > (e.atk === "charge" ? 1.1 : 0.42)) { e.state = "recover"; e.stateT = 0; }
        } else if (e.stateT > 0.22) {
          e.state = "recover";
          e.stateT = 0;
        }
        break;
      }
      case "recover": {
        if (e.stateT > (e.boss ? 0.5 : 0.6)) {
          e.state = "approach";
          e.atkCd = e.boss ? U.rand(0.7, 1.4) : U.rand(1.1, 2.4);
        }
        break;
      }
      case "hurt": {
        if (e.stateT > 0.26) e.state = "approach";
        break;
      }
      case "stunned": {
        // waiting on stun timer above
        if (Math.floor(e.stateT * 10) % 3 === 0 && U.chance(0.3)) {
          WH.FX.steam(e.x + U.rand(-10, 10), e.y - 80 * (e.def.scale || 1));
        }
        break;
      }
      case "koing": {
        if (e.stateT > 1.0) e.state = "dead";
        break;
      }
    }

    // boss summons
    if (e.boss && e.state !== "dead") {
      if (e.hp < e.maxHp * 0.5 && !e.summoned.half) {
        e.summoned.half = true;
        const addType = e.def.id === "earl" ? "tipsy" : "karen";
        spawnEnemy(addType, -40, U.rand(ARENA.y0 + 20, ARENA.y1 - 20));
        spawnEnemy(addType, 1000, U.rand(ARENA.y0 + 20, ARENA.y1 - 20));
        WH.FX.float(e.x, e.y - 110, e.def.id === "earl" ? "BOYS! GET IN HERE!" : "I'VE CALLED CORPORATE!", "#ff9f8f", 15);
        WH.Audio.sfx("roar");
      }
    }

    // free range while entering; locked to the arena once inside
    if (e.state === "enter") e.x = U.clamp(e.x, ARENA.x0 - 80, ARENA.x1 + 80);
    else e.x = U.clamp(e.x, ARENA.x0, ARENA.x1);
    e.y = U.clamp(e.y, ARENA.y0, ARENA.y1);
  }

  function startAttack(e, atk, windup) {
    e.atk = atk;
    e.state = "windup";
    e.stateT = 0;
    e.windupDur = windup;
    e.dashHit = false;
  }

  function bossChooseAttack(e) {
    // Per-axis gating: swings need the boss in your row, charges need rough
    // row alignment (they dash horizontally). Projectiles reach every row,
    // so no camping spot starves the boss of options.
    const adx = Math.abs(player.x - e.x);
    const ady = Math.abs(player.y - e.y);
    if (e.def.id === "earl") {
      const roll = Math.random();
      if (roll < 0.4 && adx > 140) startAttack(e, "barrage", 0.7);
      else if (adx < 90 && ady < 32) startAttack(e, "swing", 0.55);
      else if (roll < 0.75 && ady < 40) startAttack(e, "charge", 0.8);
      else startAttack(e, "barrage", 0.7);
    } else {
      const enraged = e.hp < e.maxHp * 0.25;
      const roll = Math.random();
      if (adx < 100 && ady < 32 && roll < 0.35) startAttack(e, "swing", 0.4);
      else if (roll < 0.55) startAttack(e, "coupons", enraged ? 0.4 : 0.6);
      else startAttack(e, "shoutring", enraged ? 0.5 : 0.75);
    }
  }

  function resolveEnemyAttack(e) {
    const def = e.def;
    switch (e.atk) {
      case "swing": {
        if (Math.abs(e.x - player.x) < 66 * (def.scale || 1) && Math.abs(e.y - player.y) < 34) {
          hurtPlayer(def.dmg, e.x);
        }
        WH.Audio.sfx("whoosh");
        break;
      }
      case "chuck": {
        throwChairAt(e.x, e.y, player.x, player.y, true, def.dmg);
        break;
      }
      case "shout": {
        WH.Audio.sfx("karen");
        WH.FX.float(e.x, e.y - 80, U.pick(["MANAGER!!", "UNACCEPTABLE!!", "I'M CALLING CORPORATE!!"]), "#ff9f8f", 14);
        if (Math.abs(e.x - player.x) < 130 && Math.abs(e.y - player.y) < 46 && U.sign(player.x - e.x) === e.facing) {
          hurtPlayer(def.dmg, e.x);
        }
        break;
      }
      case "lunge": {
        WH.Audio.sfx("whoosh");
        break; // handled in attacking state (dash)
      }
      case "charge": {
        WH.Audio.sfx("roar");
        break; // dash handled in attacking state
      }
      case "barrage": {
        for (let i = -1; i <= 1; i++) {
          throwChairAt(e.x, e.y, player.x + i * 130, player.y + i * 40, true, def.dmg);
        }
        break;
      }
      case "coupons": {
        WH.Audio.sfx("karen");
        for (let i = -2; i <= 2; i++) {
          const ang = Math.atan2(player.y - e.y, player.x - e.x) + i * 0.22;
          projectiles.push({
            kind: "coupon", x: e.x, y: e.y - 46,
            vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300,
            spin: 0, fromEnemy: true, dmg: 8,
          });
        }
        break;
      }
      case "shoutring": {
        WH.Audio.sfx("karen");
        rings.push({ x: e.x, y: e.y - 20, r: 30, t: 0, maxR: 240, hit: false });
        break;
      }
    }
  }

  // ---------------------------------------------------------------- projectiles etc
  function updateProjectiles(dt) {
    for (const p of projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += dt * 10;
      if (p.x < -60 || p.x > 1020 || p.y < -60 || p.y > 600) p.dead = true;
      if (p.fromEnemy) {
        if (U.dist(p.x, p.y, player.x, player.y - 34) < 34) {
          // parry deflects chairs back
          if (player.blockT > 0 && N.has("parry")) {
            p.fromEnemy = false;
            p.vx = -p.vx * 1.2;
            p.vy = -p.vy * 0.6;
            p.dmg = 18;
            WH.Audio.sfx("parry");
            WH.FX.float(player.x, player.y - 90, "RETURN TO SENDER", "#48d0c8", 14);
          } else if (player.iframes <= 0 && player.state !== "dodge") {
            p.dead = true;
            hurtPlayer(p.dmg, p.x);
            if (p.kind === "chair") WH.Audio.sfx("chairBreak");
          }
        }
      } else {
        for (const e of aliveEnemies()) {
          if (e.state === "koing") continue;
          if (U.dist(p.x, p.y, e.x, e.y - 30 * (e.def.scale || 1)) < 40 * (e.def.scale || 1)) {
            hurtEnemy(e, p.dmg, { heavy: p.kind === "chair", fromX: p.x });
            if (p.kind === "waffle") WH.Audio.sfx("splat");
            // chairs punch through ONE extra body, then break — no more
            // bowling a whole lineup with a single lucky catch
            p.hits = (p.hits || 0) + 1;
            if (p.kind !== "chair" || p.hits >= 2) {
              p.dead = true;
              if (p.kind === "chair") WH.Audio.sfx("chairBreak");
            }
            break;
          }
        }
      }
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (projectiles[i].dead) projectiles.splice(i, 1);
    }

    for (const pd of puddles) pd.t -= dt;
    for (let i = puddles.length - 1; i >= 0; i--) if (puddles[i].t <= 0) puddles.splice(i, 1);

    for (const r of rings) {
      r.t += dt;
      r.r += 180 * dt;
      const d = U.dist(r.x, r.y, player.x, player.y - 20);
      if (!r.hit && Math.abs(d - r.r) < 22 && player.iframes <= 0 && player.state !== "dodge") {
        r.hit = true;
        hurtPlayer(10, r.x);
      }
    }
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].r > rings[i].maxR) rings.splice(i, 1);
  }

  // ---------------------------------------------------------------- update
  self.update = function (dt) {
    t += dt;
    phaseT += dt;
    hitCountT -= dt;
    if (hitCountT <= 0) hitCount = 0;

    if (I.pressed("pause") && phase !== "lose" && phase !== "win") {
      WH.Menus.openPause(self);
      return;
    }
    WH.Scenery.update(dt);

    if (phase === "intro") {
      const lines = D.BOSSES[config.boss].intro;
      if (I.pressed("interact") || I.pressed("attack")) {
        introLine++;
        WH.Audio.sfx("uiSelect");
        if (introLine >= lines.length) { phase = "banner"; phaseT = 0; }
      }
      return;
    }
    if (phase === "banner") {
      if (phaseT > 1.1) { phase = "fight"; phaseT = 0; }
      return;
    }
    if (phase === "win") {
      if (phaseT > 1.4) onWin();
      return;
    }
    if (phase === "lose") {
      if (phaseT > 2.2) onLose();
      return;
    }

    updatePlayer(dt);
    for (const e of enemies) if (e.state !== "dead") updateEnemy(e, dt);
    updateProjectiles(dt);

    // win check
    if (aliveEnemies().length === 0 && phase === "fight") {
      phase = "win";
      phaseT = 0;
      const bonus = 20 + hourIdx * 10 + (tookDamage ? 0 : 40);
      N.addCash(bonus);
      WH.Audio.sfx("victory");
      WH.FX.float(480, 240, `ORDER RESTORED  +$${bonus}${tookDamage ? "" : "  (FLAWLESS!)"}`, "#8fe07c", 20);
    }
  };

  // ---------------------------------------------------------------- draw
  function drawEnemy(g, e) {
    const def = e.def;
    let pose = "idle";
    if (e.state === "enter" || e.state === "approach") pose = "walk";
    if (e.state === "windup") pose = "block";
    if (e.state === "attacking") pose = e.atk === "swing" || e.atk === "shout" ? "punch" : "walk";
    if (e.state === "hurt") pose = "hurt";
    if (e.state === "koing" || e.state === "dead") pose = "ko";
    if (e.state === "stunned") pose = "hurt";

    // windup flash
    if (e.state === "windup" && Math.floor(e.stateT * 14) % 2 === 0) {
      WH.T.text(g, "!", e.x, e.y - 86 * (def.scale || 1), 22, "#ff5f4e", "center");
    }
    S.drawDude(g, e.x, e.y, e.opts, pose, e.animT, e.facing);
    // hp pip (non-boss)
    if (!e.boss && e.state !== "koing" && e.state !== "dead" && e.hp < e.maxHp) {
      T.bar(g, e.x - 20, e.y - 78 * (def.scale || 1), 40, 4, e.hp / e.maxHp, "#ff8f7f");
    }
    if (e.state === "stunned") {
      const a = e.animT * 6;
      for (let i = 0; i < 3; i++) {
        g.drawImage(S.icons.star, e.x - 10 + Math.cos(a + i * 2.1) * 18, e.y - 92 * (def.scale || 1) + Math.sin(a + i * 2.1) * 6);
      }
    }
  }

  self.draw = function (g) {
    g.drawImage(S.bgArena, 0, 0);
    WH.Scenery.draw(g);

    // puddles under everything
    for (const pd of puddles) {
      g.fillStyle = "rgba(150,90,20,0.5)";
      g.beginPath();
      g.ellipse(pd.x, pd.y, 30, 11, 0, 0, Math.PI * 2);
      g.fill();
    }
    // shout rings
    for (const r of rings) {
      g.strokeStyle = `rgba(255,140,160,${1 - r.r / r.maxR})`;
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(r.x, r.y, r.r, r.r * 0.45, 0, 0, Math.PI * 2);
      g.stroke();
    }
    // pickups
    for (const pk of pickups) {
      S.drawPlate(g, pk.x, pk.y + 8, 16);
      g.drawImage(S.foodIcon(pk.item.food, pk.item.mods), pk.x - 12, pk.y - 14, 24, 24);
      if (U.dist(pk.x, pk.y, player.x, player.y - 20) < 52) {
        T.text(g, `[${I.prompt("interact")}] EAT`, pk.x, pk.y - 24, 11, "#8fe07c", "center");
      }
    }

    // y-sort entities
    const drawables = [];
    for (const e of enemies) if (e.state !== "dead") drawables.push({ y: e.y, fn: () => drawEnemy(g, e) });
    drawables.push({
      y: player.y,
      fn: () => {
        let pose = player.moving ? "walk" : "idle";
        if (player.state === "attack") pose = player.chain === 1 ? "punch2" : "punch";
        if (player.state === "heavy") pose = "heavy";
        if (player.state === "throw") pose = "throw";
        if (player.state === "hurt") pose = "hurt";
        if (player.state === "dodge") pose = "walk";
        if (player.state === "ko") pose = "ko";
        if (player.blockT > 0) pose = "block";
        if (player.iframes > 0 && Math.floor(performance.now() / 80) % 2 === 0) g.globalAlpha = 0.5;
        S.drawDude(g, player.x, player.y, WH.Cosmetics.cookOpts(), pose, player.animT, player.facing);
        g.globalAlpha = 1;
        if (player.chair) {
          S.drawChair(g, player.x + player.facing * 6, player.y - 66, player.facing * -0.4);
        }
      },
    });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();

    // projectiles on top
    for (const p of projectiles) {
      if (p.kind === "chair") {
        S.drawChair(g, p.x, p.y, p.spin);
      } else if (p.kind === "waffle") {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.spin);
        g.drawImage(S.icons.waffle, -15, -13);
        g.restore();
      } else {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.spin * 0.5);
        g.fillStyle = "#f0e6c8";
        g.fillRect(-10, -6, 20, 12);
        g.fillStyle = "#c93a2e";
        g.font = 'bold 8px "Courier New", monospace';
        g.fillText("-50%", -9, 3);
        g.restore();
      }
    }

    drawHUD(g);

    if (phase === "intro") {
      g.fillStyle = "rgba(8,6,10,0.78)";
      g.fillRect(0, 0, 960, 540);
      const lines = D.BOSSES[config.boss].intro;
      for (let i = 0; i <= Math.min(introLine, lines.length - 1); i++) {
        T.text(g, lines[i], 480, 220 + i * 34, 17, i === introLine ? "#ffd97f" : "#b8ac93", "center");
      }
      T.text(g, `[${I.prompt("interact")}] ...uh oh`, 480, 420, 13, "#8f8878", "center");
    }
    if (phase === "banner") {
      const sc = Math.min(1, phaseT * 4);
      g.save();
      g.translate(480, 250);
      g.scale(sc, sc);
      T.text(g, config.boss ? D.BOSSES[config.boss].name : "FIGHT!", 0, 0, config.boss ? 34 : 52, "#ff5f4e", "center");
      if (!config.boss) T.text(g, config.sub || "(the furniture is not insured)", 0, 34, 14, "#b8ac93", "center");
      g.restore();
    }
    if (phase === "lose") {
      g.fillStyle = `rgba(8,6,10,${Math.min(0.7, phaseT * 0.5)})`;
      g.fillRect(0, 0, 960, 540);
      T.text(g, "KNOCKED OUT", 480, 260, 44, "#ff5f4e", "center");
    }
  };

  function drawHUD(g) {
    // player HP
    T.text(g, "COOK", 16, 508, 12, "#b8ac93");
    T.bar(g, 16, 514, 220, 14, N.hp / N.maxHp, N.hp > 30 ? "#5fd668" : "#ff5f4e");
    T.text(g, `${Math.max(0, Math.ceil(N.hp))}/${N.maxHp}`, 126, 526, 11, "#0c0c0c", "center", true, false);
    // cash
    T.text(g, U.money(N.cash), 940, 526, 14, "#8fe07c", "right");
    // hits
    if (hitCount > 2) {
      T.text(g, `${hitCount} HITS`, 940, 500, 18, "#ffd97f", "right");
    }
    // boss bar
    const boss = enemies.find((e) => e.boss && e.state !== "dead");
    if (boss && phase === "fight") {
      T.text(g, boss.def.name, 480, 496, 13, "#ff9f8f", "center");
      T.bar(g, 280, 504, 400, 12, boss.hp / boss.maxHp, "#c93a2e");
    } else if (phase === "fight") {
      const n = aliveEnemies().length;
      T.text(g, `${n} ANGRY CUSTOMER${n === 1 ? "" : "S"}`, 480, 508, 13, "#ff9f8f", "center");
    }
    // move hints — always visible during the brawl, in two tidy rows so
    // the list never overflows as you unlock more moves
    if (phase === "fight") {
      const core = [`[${I.prompt("attack")}] PUNCH`, `[${I.prompt("dodge")}] DODGE`];
      if (N.has("toss")) core.push(`[${I.prompt("heavy")}] WAFFLE TOSS`);
      else core.push(`[${I.prompt("heavy")}] HEAVY`);

      const special = [];
      if (N.has("parry")) special.push(`[${I.prompt("interact")}] PARRY`);
      // Chair Catch: earned skill — always show HOW to do it once unlocked
      if (N.has("catch")) special.push(`[${I.prompt("dodge")}] INTO CHAIR = CATCH`);
      if (pickups.length > 0) special.push(`[${I.prompt("interact")}] EAT SNACK`);

      g.globalAlpha = 0.85;
      if (special.length) {
        T.text(g, special.join("    "), 480, 462, 12, "#cbbfa8", "center");
      }
      T.text(g, core.join("    "), 480, 480, 12, "#d8d4c8", "center");
      g.globalAlpha = 1;
      // holding a caught chair: loud, unmissable prompt
      if (player.chair) {
        const blink = Math.floor(performance.now() / 250) % 2 === 0;
        T.text(g, `[${I.prompt("attack")}] THROW THE CHAIR!`, 480, 442, 15,
          blink ? "#ffd23e" : "#ff9f4e", "center");
      }
    }
  }

  return self;
};
