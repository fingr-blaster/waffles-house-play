/* WAFFLE'S HOUSE — data.js
   All game content: food, orders, customers, enemies, bosses, perks, writing.
   Parody notice: every name, character, song and slogan in here is original
   invention. Any resemblance to a real 24-hour breakfast institution is the
   whole joke, and only the joke. */
"use strict";
window.WH = window.WH || {};

WH.Data = (function () {
  const D = {};

  // ---------------------------------------------------------------- FOOD
  // cookTime: seconds to ready. burnTime: seconds after ready until burnt
  // (0 = cannot burn). heal: HP restored when eaten during a brawl.
  D.FOODS = {
    waffle: { id: "waffle", name: "Waffle", short: "WFL", cookTime: 6.0, burnTime: 0,   price: 6, heal: 25, station: "iron" },
    eggs:   { id: "eggs",   name: "Eggs",   short: "EGG", cookTime: 4.5, burnTime: 5.0, price: 4, heal: 14, station: "eggs" },
    bacon:  { id: "bacon",  name: "Bacon",  short: "BCN", cookTime: 6.5, burnTime: 4.0, price: 5, heal: 14, station: "bacon" },
    hash:   { id: "hash",   name: "Hashbrowns", short: "HSH", cookTime: 5.5, burnTime: 6.0, price: 5, heal: 18, station: "hash" },
    coffee: { id: "coffee", name: "Coffee", short: "CFE", cookTime: 1.2, burnTime: 0,   price: 2, heal: 0,  station: "coffee" },
  };

  // Hashbrown "dressings" — a loving parody of a certain sacred hashbrown
  // liturgy. Ours goes: scattered, smothered, covered... threatened.
  D.HASH_MODS = [
    { id: "smothered", name: "Smothered", desc: "onions", color: "#c9a2e8" },
    { id: "covered",   name: "Covered",   desc: "cheese", color: "#ffd23e" },
  ];
  D.HASH_MOD_BY_ID = { smothered: D.HASH_MODS[0], covered: D.HASH_MODS[1] };

  D.hashModLabel = function (mods) {
    if (!mods || mods.length === 0) return "scattered";
    return "scattered, " + mods.map((m) => m).join(", ");
  };

  // Hash dressing is BINARY: plain, or "all the way" (onions & cheese).
  // These helpers give one shared vocabulary to the customer's request and
  // the cook's carried plate so they can never disagree. Anything with at
  // least one mod counts as fully dressed.
  D.isDressed = function (mods) { return !!(mods && mods.length > 0); };
  D.dressTag = function (mods) {
    return D.isDressed(mods) ? "ALL THE WAY" : "PLAIN";
  };
  D.dressGloss = function (mods) {
    return D.isDressed(mods) ? "onions & cheese" : "just potatoes";
  };
  D.dressMatch = function (a, b) {
    return D.isDressed(a) === D.isDressed(b);
  };

  // ---------------------------------------------------------------- ORDERS
  // Call-out templates. {items} is replaced with the lingo line.
  D.CALLOUTS = [
    "MARK: {items}!",
    "Drop {items}, hold the drama!",
    "{items} — and make it pretty!",
    "One order: {items}. You got this, sugar.",
    "{items}, table's hungry and so is fate.",
  ];

  // ---------------------------------------------------------------- CUSTOMERS
  D.CUSTOMER_NAMES = [
    "Earlene", "Dale", "Tammy", "Big Rick", "Trish", "Cletus", "Donna",
    "Skeeter", "Brenda", "Hollis", "Peggy", "Duane", "Loretta", "Bubba",
    "Marlene", "Junior", "Dot", "Ray-Ray", "Charlene", "Otis",
  ];

  D.ARRIVE_LINES = [
    "I've been awake for 41 hours.",
    "My ex is in the parking lot. Take your time.",
    "The bar closed. I did not.",
    "Y'all got waffles? Rhetorical. Move.",
    "I walked here from a decision I regret.",
    "It's my birthday. Legally, one of them.",
    "The moon told me to come here.",
    "Just got outta a wedding. Not mine. Long story.",
    "I can only pay in exact change and secrets.",
    "This booth knows me better than my family.",
    "I'm not drunk, the floor is just enthusiastic.",
    "Whatever's fastest and mostly legal.",
  ];

  D.HAPPY_LINES = [
    "God bless this greasy palace.",
    "You're the only one who's never lied to me.",
    "I'd tip more but child support exists.",
    "This waffle fixed my whole personality.",
    "Tell the grill I said thank you. Personally.",
    "I'm naming my next dog after you.",
    "Five stars. Would weep here again.",
  ];

  D.ANGRY_LINES = [
    "I've been patient. The patience is GONE.",
    "You just made the list, cook.",
    "I didn't come here to WAIT. I came here to EAT.",
    "That's it. Hold my earrings, Brenda.",
    "My hunger has turned to STRENGTH.",
    "You wouldn't like me un-breakfasted.",
  ];

  // Escalating impatience: first a grumble, then a threat (9)
  D.WARN_LINES = [
    "Tick tock, sugar.",
    "My stomach is writing the Yelp review.",
    "I can hear my eggs aging.",
    "You good back there?!",
    "This hunger is becoming a personality.",
    "I've seen faster service at the DMV.",
  ];
  D.WARN_LINES_FINAL = [
    "HOW LONG does a WAFFLE take?!",
    "I'm about to flip MORE than tables!",
    "LAST CHANCE, grill jockey!!",
    "My lawyer eats here too, you know!!",
    "I WILL climb this counter!!",
    "Countin' to three, sugar. THREE!!",
  ];

  D.FIGHT_TAUNTS = [
    "Them's fightin' hashbrowns!",
    "I've seen the videos. I know how this goes.",
    "You and me. Booth four. NOW.",
    "I do my best work before sunrise.",
    "This is going on the internet!",
  ];

  D.SERVE_LINES = [
    "ORDER UP!", "HOT PLATE!", "EAT UP, SUGAR!", "BON APPE-TITE!", "GREASE BE WITH YOU!",
  ];

  // ---------------------------------------------------------------- ENEMIES
  // dps values are per-hit damage. speed in px/s.
  D.ENEMIES = {
    tipsy: {
      id: "tipsy", name: "Tipsy Pete", hp: 30, dmg: 8, speed: 95, score: 50,
      color: "#7fb2d9", hat: "beanie",
      taunts: ["*hic* You spilled my... floor.", "I float like a butterfly, mostly sideways."],
    },
    karen: {
      id: "karen", name: "Karen", hp: 26, dmg: 10, speed: 110, score: 70,
      color: "#e8a1a1", hat: "bob",
      taunts: ["I want the manager. I AM the manager now.", "This is going in my review!"],
    },
    chucker: {
      id: "chucker", name: "Chair Chucker", hp: 34, dmg: 12, speed: 85, score: 90,
      color: "#d9c27f", hat: "cap",
      taunts: ["Catch THIS!", "Furniture is a projectile if you believe."],
    },
    sleeper: {
      id: "sleeper", name: "The Sleeper", hp: 62, dmg: 16, speed: 55, score: 120,
      color: "#9a8fd9", hat: "none",
      taunts: ["...you woke me up.", "Five more minutes. Of VIOLENCE."],
    },
    philosopher: {
      id: "philosopher", name: "The Philosopher", hp: 24, dmg: 11, speed: 130, score: 80,
      color: "#8fd9a8", hat: "fedora",
      taunts: ["Is a waffle not merely a pancake with ambition?", "We are ALL short-order cooks of the soul."],
    },
  };

  // Which enemies unlock at which hour (index 0 = 10 PM)
  D.ENEMY_UNLOCK = [
    ["tipsy"],
    ["tipsy", "karen"],
    ["tipsy", "karen", "chucker"],
    ["tipsy", "karen", "chucker"],
    ["tipsy", "karen", "chucker", "sleeper"],
    ["tipsy", "karen", "chucker", "sleeper", "philosopher"],
    ["karen", "chucker", "sleeper", "philosopher"],
    ["karen", "chucker", "sleeper", "philosopher"],
  ];

  // Base brawler count per hour (grudges are added on top)
  D.BASE_BRAWLERS = [0, 1, 1, 2, 0, 2, 0, 3]; // 0 on boss hours; bosses bring adds

  // ---------------------------------------------------------------- BOSSES
  D.BOSSES = {
    earl: {
      id: "earl", name: 'BIG EARL "CHAIRZILLA"', hp: 230, dmg: 14, speed: 70, score: 600,
      color: "#d97f7f", hat: "cap", scale: 1.6, hour: 4, // 2 AM
      intro: [
        "The door chime plays a minor chord.",
        "BIG EARL: \"I heard somebody's been servin' waffles...\"",
        "BIG EARL: \"...without payin' the FURNITURE TAX.\"",
      ],
      taunts: ["EVERY CHAIR IS MY CHAIR!", "I bench-press booths, kid."],
    },
    karenator: {
      id: "karenator", name: "THE FINAL KAREN", hp: 260, dmg: 12, speed: 90, score: 800,
      color: "#f2b6d0", hat: "megabob", scale: 1.45, hour: 6, // 4 AM
      intro: [
        "A minivan parks across three spaces.",
        "THE FINAL KAREN: \"I'd like to speak to the manager.\"",
        "YOU: \"There is no manager. It's 4 AM.\"",
        "THE FINAL KAREN: \"Then I'd like to speak... to YOUR FISTS.\"",
      ],
      taunts: ["ONE STAR!", "I know the owner! I know EVERYONE!", "My coupons are LEGAL TENDER!"],
    },
  };

  // ---------------------------------------------------------------- PERKS
  D.PERKS = [
    // Combat
    { id: "parry",    kind: "combat", name: "Spatula Parry",
      desc: "Tap BLOCK just before a hit to deflect it — even flying chairs. Attacker gets stunned.",
      flavor: "The spatula is a shield, a sword, and a mirror." },
    { id: "toss",     kind: "combat", name: "Waffle Toss",
      desc: "Press HEAVY to hurl a piping-hot waffle. Ranged damage, syrup included.",
      flavor: "Frisbee rules apply. Breakfast rules do not." },
    { id: "slick",    kind: "combat", name: "Syrup Slick",
      desc: "Your dodge roll leaves a syrup puddle that slows enemies to a sticky crawl.",
      flavor: "OSHA has left the chat." },
    { id: "haymaker", kind: "combat", name: "Hashbrown Haymaker",
      desc: "Your 3rd punch becomes a huge uppercut that sends folks airborne.",
      flavor: "Scattered. Smothered. LAUNCHED." },
    { id: "catch",    kind: "combat", name: "The Chair Catch",
      desc: "Dodge into a flying chair to CATCH it. Press PUNCH to throw it right back.",
      flavor: "Inspired by a legend. You know the one." },
    { id: "grease",   kind: "combat", name: "Grease Armor",
      desc: "A protective sheen of griddle grease. Take 25% less damage.",
      flavor: "It's not sweat, it's seasoning." },
    { id: "wind",     kind: "combat", name: "Second Wind",
      desc: "Once per night, getting knocked out instead revives you at half health.",
      flavor: "The shift ain't over till YOU say it's over." },
    // Kitchen
    { id: "quickiron", kind: "kitchen", name: "Quick Iron",
      desc: "Waffles cook 40% faster. The iron fears you now.",
      flavor: "Patented Waffle respect technique." },
    { id: "thirdarm",  kind: "kitchen", name: "Server's Shoulder",
      desc: "Carry a third item. Physics called; you declined.",
      flavor: "Three plates, zero fear." },
    { id: "charm",     kind: "kitchen", name: "Charm School",
      desc: "Customers stay patient 30% longer. It's the wink that does it.",
      flavor: "\"Sugar\" is a unit of time." },
    { id: "bigtips",   kind: "kitchen", name: "Big Tips Energy",
      desc: "Earn 50% bigger tips.",
      flavor: "The jar overfloweth." },
    { id: "doggybag",  kind: "kitchen", name: "Doggy Bag",
      desc: "Unserved cooked food carries into brawls as extra healing snacks.",
      flavor: "Waste not, whomp lots." },
    { id: "decaf",     kind: "kitchen", name: "Emergency Decaf",
      desc: "The WAFL INDEX cools down twice as fast. Crisis, averted-ish.",
      flavor: "Switch the pot. Tell no one." },
    { id: "linecook",  kind: "kitchen", name: "Hire Junior", minHour: 3,
      desc: "A line cook clocks in and runs ONE station for you — starts the food, never lets it burn.",
      flavor: "He knows one thing. He knows it perfectly." },
  ];

  D.STATION_NAMES = { iron: "Waffle Iron", eggs: "Egg Griddle", bacon: "Bacon Rack", hash: "Hash Top" };

  // ---------------------------------------------------------------- THE LOCKER
  // Cook customization. Skin tone and hair are always free choices; uniforms
  // and some headwear unlock from LIFETIME stats (WH.Save totals), so every
  // shift you've ever worked counts toward them.
  D.SKIN_TONES = ["#f0c8a0", "#e8b48c", "#c98f5e", "#a8724a", "#8f5f3c", "#6e4428"];
  D.HAIR_COLORS = ["#2c2c34", "#4a3428", "#8a5a1a", "#c9973e", "#b5533c", "#8a8a8a"];

  // shirt, apron (null = no apron), accent (tints caps & beanies)
  D.UNIFORMS = [
    { id: "rookie", name: "The Rookie", shirt: "#f0ece0", apron: "#f0ece0", accent: "#b5533c",
      desc: "Fresh off orientation. Still smells like optimism.", unlock: null },
    { id: "nightowl", name: "Night Owl", shirt: "#2c3654", apron: "#8a919c", accent: "#48d0c8",
      desc: "Sleeps when the sun's up. Like a vampire, but with hashbrowns.",
      unlock: { stat: "nights", n: 3, text: "Work 3 shifts" } },
    { id: "grillmaster", name: "Grill Master", shirt: "#2c2c34", apron: "#c93a2e", accent: "#c93a2e",
      desc: "The grill doesn't sizzle for you. It sizzles AT you.",
      unlock: { stat: "customersFed", n: 50, text: "Serve 50 customers" } },
    { id: "sunrise", name: "Sunrise Survivor", shirt: "#e8a53a", apron: "#f5f0e6", accent: "#ff5f4e",
      desc: "Saw 6 AM. Lived to tell it. Won't.",
      unlock: { stat: "wins", n: 1, text: "Survive a full night" } },
    { id: "chairbender", name: "The Chairbender", shirt: "#48d0c8", apron: "#ffd23e", accent: "#ffd23e",
      desc: "Furniture fears you. As it should.",
      unlock: { stat: "chairsCaught", n: 5, text: "Catch 5 flying chairs" } },
    { id: "bouncer", name: "The Bouncer", shirt: "#3a3a44", apron: null, accent: "#c93a2e",
      desc: "No apron. Aprons are for people who plan to stay clean.",
      unlock: { stat: "enemiesKOd", n: 40, text: "Deck 40 troublemakers" } },
    { id: "tycoon", name: "Tip Jar Tycoon", shirt: "#4a7c59", apron: "#ffd23e", accent: "#8fe07c",
      desc: "Every dollar earned in quarters. Every quarter earned in sweat.",
      unlock: { stat: "cashLifetime", n: 5000, text: "Earn $5,000 lifetime" } },
    { id: "bossbreaker", name: "Boss Breaker", shirt: "#8a5c8f", apron: "#2c2c34", accent: "#ff5f4e",
      desc: "Big Earl tells stories about you now.",
      unlock: { stat: "bossesBeaten", n: 4, text: "Defeat 4 bosses" } },
    { id: "legend", name: "Graveyard Legend", shirt: "#ffd23e", apron: "#2c2c34", accent: "#2c2c34",
      desc: "Five sunrises. The neon sign flickers in your honor.",
      unlock: { stat: "wins", n: 5, text: "Survive 5 full nights" } },
  ];

  D.HEADWEAR = [
    { id: "paper", name: "Paper Hat", unlock: null },
    { id: "cap", name: "Ball Cap", unlock: null },
    { id: "beanie", name: "Beanie", unlock: null },
    { id: "hair", name: "Just Hair", unlock: null },
    { id: "fedora", name: "Philosopher's Fedora",
      unlock: { stat: "nights", n: 10, text: "Work 10 shifts" } },
    { id: "crown", name: "The Syrup Crown",
      unlock: { stat: "karenBeaten", n: 1, text: "Defeat The Final Karen" } },
  ];

  // ---------------------------------------------------------------- JUKEBOX
  D.JUKEBOX = [
    { title: "Raisins? In MY Toast?", artist: "The Grease Tones", track: "diner" },
    { title: "Grits Happen", artist: "Loretta & The Late Plates", track: "diner2" },
    { title: "Love Me Like the Health Inspector's Watchin'", artist: "Hank Syrup", track: "diner3" },
  ];

  // ---------------------------------------------------------------- WAFL INDEX
  // Parody of a certain federal disaster metric.
  D.INDEX_LEVELS = [
    { id: 0, name: "GREEN",  color: "#5fd668", desc: "All is well. Suspiciously well." },
    { id: 1, name: "YELLOW", color: "#ffd23e", desc: "Somebody's ex just walked in." },
    { id: 2, name: "RED",    color: "#ff5f4e", desc: "FEMA has been notified." },
  ];

  // ---------------------------------------------------------------- HOURS
  D.HOURS = [
    { label: "10 PM", title: "THE CALM",           sub: "Regulars only. Enjoy it while it lasts.", customers: 5 },
    { label: "11 PM", title: "FIRST WOBBLES",      sub: "The bar crowd is warming up.",           customers: 6 },
    { label: "12 AM", title: "THE MIDNIGHT OATH",  sub: "Nothing good is open. You are.",         customers: 7 },
    { label: "1 AM",  title: "LAST CALL FALLOUT",  sub: "The bars just closed. Brace.",           customers: 8 },
    { label: "2 AM",  title: "FURNITURE TAX",      sub: "Something huge blots out the neon.",     customers: 6, boss: "earl" },
    { label: "3 AM",  title: "THE WITCHING SHIFT", sub: "Statistically, the weirdest hour alive.", customers: 8 },
    { label: "4 AM",  title: "MANAGER'S SPECIAL",  sub: "A minivan approaches at speed.",         customers: 7, boss: "karenator" },
    { label: "5 AM",  title: "ALMOST DAWN",        sub: "Hold the line. Sunrise is coming.",      customers: 9 },
  ];

  // ---------------------------------------------------------------- GRADES
  // Grade by final score.
  D.GRADES = [
    { min: 0,     grade: "D",  title: "DISH PIG",        line: "You survived. The dishes did not." },
    { min: 900,   grade: "C",  title: "BATTER PRIVATE",  line: "Some waffles were harmed in the making of this shift." },
    { min: 1800,  grade: "B",  title: "GRIDDLE SERGEANT", line: "Crisp on the outside. Unbothered on the inside." },
    { min: 2800,  grade: "A",  title: "GRILL SERGEANT MAJOR", line: "The regulars whisper your name with syrupy reverence." },
    { min: 4000,  grade: "S",  title: "WAFL GOD",        line: "FEMA lists YOU as critical infrastructure." },
  ];

  D.GAMEOVER_LINES = [
    "You got 86'd.",
    "The floor got you. The floor gets everyone eventually.",
    "Your apron has been retired to the Wall of the Fallen.",
    "Somewhere, a jukebox plays a sad song about you.",
  ];

  // Flavor toasts that pop during quiet cooking moments.
  D.AMBIENT_TOASTS = [
    "The jukebox plays a song about a truck that left.",
    "A regular salutes you with a fork.",
    "Someone in booth 3 is explaining crypto to a plate.",
    "The neon sign flickers. It knows something.",
    "A moth headbutts the window in solidarity.",
    "Somebody's laminated coupon is from 1998.",
  ];

  D.DISCLAIMER =
    "A loving parody. Not affiliated with, endorsed by, or associated with any " +
    "real restaurant, living or 24-hour. All characters, chairs, and syrup are fictional.";

  return D;
})();
