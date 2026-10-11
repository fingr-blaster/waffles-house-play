/* WAFFLE'S HOUSE — audio.js
   Procedural WebAudio: every sound and song is synthesized at runtime.
   No samples, no royalties, no lawyers. */
"use strict";
window.WH = window.WH || {};

WH.Audio = (function () {
  const A = {};
  let ctx = null;
  let masterGain, musicGain, sfxGain;
  let noiseBuf = null;

  A.settings = { master: 0.8, music: 0.6, sfx: 0.8 };

  A.unlock = function () {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return; // no audio available; game still runs
    }
    masterGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    A.applyVolumes();
    // reusable noise buffer (1s white noise)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };

  A.applyVolumes = function () {
    if (!ctx) return;
    masterGain.gain.value = A.settings.master;
    musicGain.gain.value = A.settings.music * 0.5;
    sfxGain.gain.value = A.settings.sfx;
  };

  // mute when tab hidden
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    masterGain.gain.value = document.hidden ? 0 : A.settings.master;
  });

  // ------------------------------------------------------------ primitives
  function tone(o) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + (o.dur || 0.2));
    const vol = (o.vol || 0.2);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (o.dur || 0.2));
    osc.connect(g);
    g.connect(o.dest || sfxGain);
    osc.start(t0);
    osc.stop(t0 + (o.dur || 0.2) + 0.05);
  }

  function noise(o) {
    if (!ctx || !noiseBuf) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const g = ctx.createGain();
    const vol = o.vol || 0.15;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (o.dur || 0.15));
    let node = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.value = o.freq || 1000;
      if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.slide), t0 + (o.dur || 0.15));
      src.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.dest || sfxGain);
    src.start(t0);
    src.stop(t0 + (o.dur || 0.15) + 0.05);
  }

  // ------------------------------------------------------------ sfx bank
  const SFX = {
    uiMove:   () => tone({ freq: 520, type: "square", dur: 0.05, vol: 0.10 }),
    uiSelect: () => { tone({ freq: 620, dur: 0.06, vol: 0.12 }); tone({ freq: 930, dur: 0.09, vol: 0.12, delay: 0.06 }); },
    uiBack:   () => tone({ freq: 320, dur: 0.08, vol: 0.10, slide: 210 }),
    ding:     () => { tone({ freq: 1560, type: "triangle", dur: 0.5, vol: 0.22 }); tone({ freq: 2340, type: "sine", dur: 0.4, vol: 0.10 }); },
    serve:    () => { tone({ freq: 660, type: "triangle", dur: 0.08, vol: 0.16 }); tone({ freq: 880, type: "triangle", dur: 0.10, vol: 0.16, delay: 0.07 }); tone({ freq: 1320, type: "triangle", dur: 0.16, vol: 0.16, delay: 0.15 }); },
    cash:     () => { tone({ freq: 990, type: "square", dur: 0.05, vol: 0.12 }); tone({ freq: 1320, type: "square", dur: 0.12, vol: 0.12, delay: 0.05 }); },
    sizzle:   () => noise({ dur: 0.25, vol: 0.045, filter: "highpass", freq: 3200 }),
    burn:     () => { noise({ dur: 0.5, vol: 0.14, filter: "lowpass", freq: 900, slide: 200 }); tone({ freq: 190, type: "sawtooth", dur: 0.4, vol: 0.08, slide: 60 }); },
    pickup:   () => tone({ freq: 480, type: "triangle", dur: 0.06, vol: 0.12, slide: 700 }),
    trash:    () => noise({ dur: 0.2, vol: 0.10, filter: "lowpass", freq: 500 }),
    buzz:     () => tone({ freq: 130, type: "sawtooth", dur: 0.18, vol: 0.12 }),
    whoosh:   () => noise({ dur: 0.14, vol: 0.10, filter: "bandpass", freq: 900, slide: 2400 }),
    punchHit: () => { noise({ dur: 0.09, vol: 0.20, filter: "lowpass", freq: 1400 }); tone({ freq: 150, type: "square", dur: 0.09, vol: 0.20, slide: 70 }); },
    heavyHit: () => { noise({ dur: 0.16, vol: 0.26, filter: "lowpass", freq: 1000 }); tone({ freq: 110, type: "square", dur: 0.18, vol: 0.26, slide: 45 }); },
    hurt:     () => { tone({ freq: 260, type: "sawtooth", dur: 0.18, vol: 0.18, slide: 120 }); noise({ dur: 0.1, vol: 0.1, filter: "lowpass", freq: 1200 }); },
    parry:    () => { tone({ freq: 2200, type: "square", dur: 0.09, vol: 0.16 }); tone({ freq: 3300, type: "square", dur: 0.14, vol: 0.10, delay: 0.03 }); },
    chairFly: () => noise({ dur: 0.3, vol: 0.10, filter: "bandpass", freq: 500, slide: 1600 }),
    chairBreak: () => { noise({ dur: 0.3, vol: 0.24, filter: "lowpass", freq: 2200, slide: 300 }); tone({ freq: 180, type: "square", dur: 0.2, vol: 0.14, slide: 60 }); },
    karen:    () => tone({ freq: 1150, type: "sawtooth", dur: 0.45, vol: 0.14, slide: 700 }),
    roar:     () => { tone({ freq: 90, type: "sawtooth", dur: 0.7, vol: 0.24, slide: 55 }); noise({ dur: 0.6, vol: 0.12, filter: "lowpass", freq: 400 }); },
    heal:     () => { tone({ freq: 520, type: "sine", dur: 0.1, vol: 0.14 }); tone({ freq: 660, type: "sine", dur: 0.1, vol: 0.14, delay: 0.08 }); tone({ freq: 780, type: "sine", dur: 0.18, vol: 0.14, delay: 0.16 }); },
    slurp:    () => noise({ dur: 0.25, vol: 0.10, filter: "bandpass", freq: 700, slide: 2400 }),
    chime:    () => { tone({ freq: 880, type: "triangle", dur: 0.25, vol: 0.14 }); tone({ freq: 1100, type: "triangle", dur: 0.35, vol: 0.14, delay: 0.12 }); },
    grudge:   () => { tone({ freq: 220, type: "sawtooth", dur: 0.25, vol: 0.16, slide: 110 }); tone({ freq: 165, type: "sawtooth", dur: 0.3, vol: 0.14, delay: 0.14, slide: 82 }); },
    perk:     () => { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.16, vol: 0.15, delay: i * 0.08 })); },
    ko:       () => { [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, type: "sawtooth", dur: 0.3, vol: 0.16, delay: i * 0.18 })); },
    victory:  () => { [523, 523, 523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: "square", dur: 0.14, vol: 0.13, delay: i * 0.11 })); },
    dodge:    () => noise({ dur: 0.1, vol: 0.07, filter: "highpass", freq: 2000 }),
    throwF:   () => noise({ dur: 0.18, vol: 0.10, filter: "bandpass", freq: 1200, slide: 3000 }),
    splat:    () => { noise({ dur: 0.12, vol: 0.16, filter: "lowpass", freq: 800 }); tone({ freq: 300, type: "triangle", dur: 0.1, vol: 0.1, slide: 100 }); },
    // street life outside the windows — deliberately quiet, it's background
    bass:     () => tone({ freq: 52, type: "sine", dur: 0.18, vol: 0.10, slide: 40 }),
    siren:    () => { [880, 660, 880, 660].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.28, vol: 0.035, delay: i * 0.3 })); },
    ufo:      () => { tone({ freq: 300, type: "sine", dur: 1.4, vol: 0.05, slide: 1200 }); tone({ freq: 312, type: "sine", dur: 1.4, vol: 0.04, slide: 1150, delay: 0.05 }); },
    beep:     () => { tone({ freq: 1200, type: "square", dur: 0.07, vol: 0.04 }); tone({ freq: 1200, type: "square", dur: 0.07, vol: 0.04, delay: 0.12 }); },
  };

  A.sfx = function (name) {
    if (!ctx) return;
    const fn = SFX[name];
    if (fn) fn();
  };

  // ------------------------------------------------------------ music
  // Tiny lookahead sequencer. Songs = 8th-note step patterns, semitones
  // relative to root A (110 Hz). null = rest.
  const SONGS = {
    title: {
      bpm: 92, rootBass: 55, rootLead: 220, leadType: "triangle",
      bass: [0, null, 0, null, 3, null, 5, null, 0, null, 0, null, -2, null, 3, null],
      lead: [12, null, 15, 12, null, 10, null, null, 7, 10, 12, null, null, null, 15, null],
      hat:  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
    },
    diner: {
      bpm: 118, rootBass: 55, rootLead: 220, leadType: "square",
      bass: [0, 0, 7, 0, 10, 0, 7, 0, 5, 5, 12, 5, 0, 0, 7, 10],
      lead: [12, null, null, 12, 15, null, 12, null, null, 10, null, 12, null, null, null, null],
      hat:  [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    },
    diner2: {
      bpm: 108, rootBass: 49, rootLead: 196, leadType: "triangle",
      bass: [0, null, 0, 7, null, 7, 5, null, 3, null, 3, 10, null, 10, 7, null],
      lead: [null, 12, 10, null, 12, null, null, 15, null, 12, 10, null, 7, null, 10, null],
      hat:  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    },
    diner3: {
      bpm: 126, rootBass: 62, rootLead: 247, leadType: "square",
      bass: [0, 0, null, 0, 5, null, 3, null, 0, 0, null, 0, -4, null, -2, null],
      lead: [7, null, 7, 8, null, 7, null, 3, 5, null, 5, 7, null, 5, null, null],
      hat:  [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1],
    },
    fight: {
      bpm: 152, rootBass: 55, rootLead: 220, leadType: "sawtooth",
      bass: [0, 0, 0, 3, 0, 0, 5, 3, 0, 0, 0, 3, 7, 5, 3, 2],
      lead: [12, null, 12, null, 15, 14, 12, null, 10, null, 12, null, null, 15, 17, null],
      hat:  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    },
    boss: {
      bpm: 140, rootBass: 46, rootLead: 185, leadType: "sawtooth",
      bass: [0, 0, 1, 0, 0, 0, 1, 0, 6, 6, 7, 6, 5, 5, 1, 1],
      lead: [null, 12, null, 13, null, 12, null, null, 18, null, 17, null, 13, 12, null, null],
      hat:  [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1],
    },
    results: {
      bpm: 84, rootBass: 65, rootLead: 262, leadType: "sine",
      bass: [0, null, null, null, 5, null, null, null, 3, null, null, null, 7, null, null, null],
      lead: [12, null, 16, null, 19, null, 16, null, 17, null, 14, null, 12, null, null, null],
      hat:  [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    },
  };

  let curSong = null, step = 0, nextTime = 0, timerId = null;

  function scheduleStep(song, when) {
    const stepDur = 30 / song.bpm; // 8th note
    const b = song.bass[step % 16];
    const l = song.lead[step % 16];
    const h = song.hat[step % 16];
    if (b !== null && b !== undefined) {
      tone({ freq: song.rootBass * Math.pow(2, b / 12), type: "triangle", dur: stepDur * 0.9, vol: 0.16, dest: musicGain, delay: when - ctx.currentTime, attack: 0.01 });
    }
    if (l !== null && l !== undefined) {
      tone({ freq: song.rootLead * Math.pow(2, l / 12), type: song.leadType, dur: stepDur * 0.85, vol: 0.07, dest: musicGain, delay: when - ctx.currentTime, attack: 0.01 });
    }
    if (h) {
      noise({ dur: 0.03, vol: 0.035, filter: "highpass", freq: 6000, dest: musicGain, delay: when - ctx.currentTime });
    }
    step++;
  }

  A.playMusic = function (name) {
    if (A.currentTrack === name) return;
    A.currentTrack = name;
    A.stopMusic();
    if (!ctx) { A.pendingTrack = name; return; }
    const song = SONGS[name];
    if (!song) return;
    curSong = song;
    step = 0;
    nextTime = ctx.currentTime + 0.06;
    timerId = setInterval(() => {
      if (!ctx || !curSong) return;
      const stepDur = 30 / curSong.bpm;
      while (nextTime < ctx.currentTime + 0.12) {
        scheduleStep(curSong, nextTime);
        nextTime += stepDur;
      }
    }, 30);
  };

  A.stopMusic = function () {
    if (timerId) clearInterval(timerId);
    timerId = null;
    curSong = null;
  };

  // if music was requested before the AudioContext was unlocked
  A.resumePending = function () {
    if (A.pendingTrack && ctx) {
      const t = A.pendingTrack;
      A.pendingTrack = null;
      A.currentTrack = null;
      A.playMusic(t);
    }
  };

  return A;
})();
