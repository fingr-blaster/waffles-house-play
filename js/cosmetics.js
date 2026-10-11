/* WAFFLE'S HOUSE — cosmetics.js
   The Locker: resolves the cook's look from save data, and decides what's
   unlocked from lifetime stats. Every scene that draws the cook asks here. */
"use strict";
window.WH = window.WH || {};

WH.Cosmetics = (function () {
  const C = {};
  const D = WH.Data;

  C.stat = function (key) {
    const t = WH.Save.data.totals;
    return (t && t[key]) || 0;
  };

  C.isUnlocked = function (item) {
    return !item.unlock || C.stat(item.unlock.stat) >= item.unlock.n;
  };

  C.progress = function (item) {
    if (!item.unlock) return 1;
    return Math.min(1, C.stat(item.unlock.stat) / item.unlock.n);
  };

  // ids of every unlockable (non-default) item the player has earned
  C.earnedIds = function () {
    return D.UNIFORMS.concat(D.HEADWEAR)
      .filter((i) => i.unlock && C.isUnlocked(i))
      .map((i) => i.id);
  };

  C.itemById = function (id) {
    return D.UNIFORMS.concat(D.HEADWEAR).find((i) => i.id === id) || null;
  };

  C.hasNew = function () {
    const seen = new Set(WH.Save.data.cosmetics.seen || []);
    return C.earnedIds().some((id) => !seen.has(id));
  };

  C.markSeen = function () {
    WH.Save.data.cosmetics.seen = C.earnedIds();
    WH.Save.save();
  };

  // drawDude opts for any combination — used directly by the Locker preview
  C.buildOpts = function (uniform, headwear, skinIdx, hairIdx) {
    const skin = D.SKIN_TONES[WH.U.clamp(skinIdx | 0, 0, D.SKIN_TONES.length - 1)];
    const hair = D.HAIR_COLORS[WH.U.clamp(hairIdx | 0, 0, D.HAIR_COLORS.length - 1)];
    // hatColor also tints the KO pose's hat strip, so match each hat
    const hatColor = {
      paper: "#f5f0e6", crown: "#ffd23e", fedora: "#3a3a44", hair,
    }[headwear.id] || uniform.accent;
    return {
      shirt: uniform.shirt,
      apron: !!uniform.apron,
      apronColor: uniform.apron || undefined,
      hat: headwear.id,
      hatColor,
      hairColor: hair,
      skin,
      sideburns: true,
    };
  };

  // the equipped look; anything missing or no-longer-unlocked falls back
  // to the defaults rather than ever drawing a locked item in play
  C.cookOpts = function () {
    const cos = WH.Save.data.cosmetics;
    let u = D.UNIFORMS.find((x) => x.id === cos.uniform);
    if (!u || !C.isUnlocked(u)) u = D.UNIFORMS[0];
    let h = D.HEADWEAR.find((x) => x.id === cos.headwear);
    if (!h || !C.isUnlocked(h)) h = D.HEADWEAR[0];
    return C.buildOpts(u, h, cos.skin, cos.hair);
  };

  return C;
})();
