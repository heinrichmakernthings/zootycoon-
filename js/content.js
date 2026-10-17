// CUTISE ZOO — game data and balance numbers. Change numbers here, not in the rules (sim.js).
// Species and the build catalogue come from the animal design pack (pack/, loaded as js/pack-data.js).
// This file adds what the pack leaves to the game: the park, visitors, staff, goals and tuning.
// Every visible thing has an `emoji` stand-in until its runtime sprite exists (docs/ART-BRIEF.md).
(function (root) {
  'use strict';
  const PACK = root.ZooPack || (typeof require !== 'undefined' ? require('./pack-data.js') : null);
  const SYS = PACK.systems;

  const BALANCE = {
    chunk: SYS.expansion.chunk_size_tiles[0], // land comes in 32×32 chunks
    maxChunks: SYS.expansion.maximum_chunk_grid[0], // up to a 6×6 grid of them
    startChunks: SYS.expansion.starting_chunks,
    landCostBase: 750, // price of the next chunk = round(750 × 1.35^chunks already bought)
    landCostGrowth: 1.35,
    landUpkeep: SYS.expansion.upkeep_cost_per_owned_chunk_per_day,
    fencePerEdge: SYS.expansion.fence_cost_per_edge,
    terrainPerTile: SYS.expansion.terrain_cost_per_new_tile,
    gate: { x: 32, y: 63 }, // the entrance, bottom middle of the starting land
    startCoins: 3000,
    dayLength: SYS.clock.game_day_seconds_at_1x, // 300 simulated seconds; paused time doesn't count
    enclosureMin: 4,
    enclosureMax: 40,

    // needs (0–100). Wellbeing is the plain average of food, water, comfort, social, enrichment.
    hungerPerSec: 0.12, // bowl used per resident per second (babies eat half, juveniles ¾)
    keeperFeedBelow: 50,
    keeperEvery: 10, // seconds between a keeper's rounds
    keeperHabitats: 3, // enclosures one keeper covers
    wellbeingRate: 0.05, // how fast wellbeing drifts to what the needs say, per second
    poopChance: 0.003, // per resident per second
    maxPoop: 8,
    cleanTip: 1,
    helloCooldown: 30,
    helloBoost: 5,
    caps: { shade: 20, privacy: 15, terrain: 15, variety: 3 }, // points stop counting past these
    priorityPenalty: 15, // missing the species' priority need costs this much comfort and enrichment
    crowdPenalty: 20, // comfort lost while more live there than the space supports

    // behaviour: residents pick a reachable activity, commit to it for a while, then choose again
    actMin: 18,
    actMax: 45,
    newItemPull: 4, // a freshly placed item is this many times more tempting (so you see it used)
    newItemSeconds: 150,

    // breeding (pack: docs/BREEDING-AND-TRADING.md and data/systems.json)
    breedWellbeing: SYS.breeding.wellbeing_min,
    breedReadyDays: SYS.breeding.ready_days,
    relatedGenerations: SYS.breeding.block_related_pair_within_generations,
    healthyAt: 50,

    // trading
    saleFraction: SYS.trading.base_sale_fraction,
    offerCount: SYS.trading.offer_count,
    txMemory: 300, // completed transaction IDs kept so a repeat click or reload never double-charges

    // guests
    guestStay: 45,
    fairPriceBase: 4,
    fairPriceCare: 8,
    shopEveryGuest: 0.1,
    guestsPerPath: 3,
    tierAppeal: [0.8, 1, 1.3, 1.7],
    babyAppeal: 1.5,

    // care reputation: never spent; grows while animals are well and unlocks the next species
    repPerResident: 0.04, // per second at full wellbeing (scaled from 50% up; unwell animals lose it)
    repPerGuest: 0.08,
    repHello: 0.5,

    refund: 0.5,
    undoSeconds: 15,
  };

  // Unlock stages from the pack, reached with care reputation.
  const STAGES = [
    { id: 'starter', rep: 0, name: 'Opening day', text: 'One small park, a few animals, your first paying visitors.' },
    { id: 'early', rep: 150, name: 'A friendly little zoo', text: 'Red pandas, otters, penguins and more are looking for homes.' },
    { id: 'mid', rep: 700, name: 'A local favourite', text: 'Flamingos, lemurs, sloths, zebras and arctic foxes.' },
    { id: 'late', rep: 2000, name: 'Your dream zoo', text: 'Elephants, giraffes and snow leopards.' },
  ];

  // Ground colour per pack zone (enclosure floors until terrain art exists).
  const ZONES = {
    Wetlands: { color: '#a9cbb4', edge: '#7aa58b', pond: true },
    Woodland: { color: '#a7ba91', edge: '#7d9468' },
    Meadow: { color: '#c3d69a', edge: '#97ad69' },
    Drylands: { color: '#e6cf9c', edge: '#c9ab6c' },
    Tropical: { color: '#8fbf8a', edge: '#5f9160' },
    Savanna: { color: '#e3cb8a', edge: '#c2a45c' },
    Coastal: { color: '#cfd8cc', edge: '#9fb0a4', pond: true },
    Coollands: { color: '#e4ecef', edge: '#b4c6cc' },
  };

  // Templates that block movement (animals walk round them); everything else is walkable or usable.
  const SOLID = ['shelter', 'feeder', 'water', 'nursery', 'privacy'];
  // How a species' priority need is met. Anything not listed is met by its first signature item.
  const NEED_BY = { shade: 'template:shade', privacy: 'template:privacy', space: 'space', social: 'group', herd: 'group', flock: 'group' };
  const CATEGORIES = {
    care: 'Care',
    comfort: 'Comfort',
    family: 'Family',
    terrain: 'Terrain',
    viewing: 'Viewing',
    decoration: 'Decoration',
    species_enrichment: 'Enrichment',
    access: 'Access',
  };

  // Each animal gets a trait (the pack's traitId). It nudges one need and how often they wander.
  const TRAITS = {
    sociable: { name: 'Sociable', emoji: '🤗', social: 1.2, desc: 'Happiest in a crowd of their own kind.' },
    shy: { name: 'Shy', emoji: '🙈', privacy: true, desc: 'Needs a quiet corner to feel safe.' },
    playful: { name: 'Playful', emoji: '🎾', enrich: 1.2, desc: 'Lives for new things to do.' },
    sleepy: { name: 'Sleepy', emoji: '😴', rest: true, desc: 'Loves a resting spot. Eats a bit less.', eat: 0.8 },
    foodie: { name: 'Foodie', emoji: '🍉', eat: 1.4, desc: 'Empties the feeder fast.' },
    curious: { name: 'Curious', emoji: '🔍', curious: true, desc: 'Always first to try something new.' },
  };

  // Park-wide buildings (not tied to an enclosure). Only things next to a path joined to the gate count.
  const BUILDS = {
    path: {
      name: 'Path',
      kind: 'path',
      cost: 5,
      stage: 'starter',
      upkeep: 0,
      emoji: '🟫',
      desc: 'Guests and keepers can only reach what a path reaches.',
    },
    icecream: {
      name: 'Ice Cream Cart',
      kind: 'shop',
      cost: 150,
      stage: 'starter',
      upkeep: 5,
      emoji: '🍦',
      seats: 8,
      spend: 1,
      desc: 'Everyone needs a cone.',
    },
    toilet: {
      name: 'Loos',
      kind: 'shop',
      cost: 200,
      stage: 'starter',
      upkeep: 5,
      emoji: '🚻',
      seats: 20,
      spend: 0,
      comfort: 1,
      desc: 'Earns nothing. Guests stay longer and enjoy it more.',
    },
    snacks: {
      name: 'Snack Kiosk',
      kind: 'shop',
      cost: 250,
      stage: 'early',
      upkeep: 8,
      emoji: '🥨',
      seats: 12,
      spend: 1.2,
      desc: 'Pretzels, crisps and carrot sticks (for the humans).',
    },
    gifts: {
      name: 'Gift Shop',
      kind: 'shop',
      cost: 500,
      stage: 'early',
      upkeep: 12,
      emoji: '🧸',
      seats: 10,
      spend: 2.2,
      desc: 'Plushies of your animals. Sells better with more species.',
    },
    cafe: {
      name: 'Tea Room',
      kind: 'shop',
      cost: 600,
      stage: 'mid',
      upkeep: 15,
      emoji: '☕',
      seats: 16,
      spend: 1.8,
      comfort: 0.5,
      desc: 'Tea and cake. Very British.',
    },
    flowers: {
      name: 'Flower bed',
      kind: 'decor',
      cost: 20,
      stage: 'starter',
      upkeep: 0,
      emoji: '🌷',
      appeal: 0.5,
      desc: 'A splash of colour.',
    },
    tree: { name: 'Tree', kind: 'decor', cost: 40, stage: 'starter', upkeep: 0, emoji: '🌳', appeal: 0.5, desc: 'Shade for tired legs.' },
    bench: {
      name: 'Bench',
      kind: 'decor',
      cost: 50,
      stage: 'starter',
      upkeep: 0,
      emoji: '🪑',
      appeal: 1,
      comfort: 0.3,
      desc: 'Guests stay a bit longer.',
    },
    lamp: {
      name: 'Lamp post',
      kind: 'decor',
      cost: 40,
      stage: 'early',
      upkeep: 1,
      emoji: '🏮',
      appeal: 1,
      desc: 'A warm glow at closing time.',
    },
    fountain: {
      name: 'Fountain',
      kind: 'decor',
      cost: 400,
      stage: 'mid',
      upkeep: 4,
      emoji: '⛲',
      appeal: 5,
      desc: 'Coins in, wishes out.',
    },
    statue: {
      name: 'Golden Paw',
      kind: 'decor',
      cost: 2000,
      stage: 'late',
      upkeep: 0,
      emoji: '🏆',
      appeal: 15,
      desc: 'For the best zoo in town.',
    },
  };

  const STAFF = {
    keeper: {
      name: 'Keeper',
      emoji: '🧑‍🌾',
      hire: 150,
      wage: 30,
      stage: 'starter',
      desc: 'Keeps feeders topped up and tidies up to 3 enclosures. Needs a keeper gate next to a path.',
    },
    guide: {
      name: 'Guide',
      emoji: '🧑‍🏫',
      hire: 300,
      wage: 45,
      stage: 'early',
      desc: 'Tells guests about your animals. They enjoy their visit more and spread the word.',
    },
  };

  const EVENTS = [
    { id: 'sunny', name: 'Sunny day', emoji: '☀️', weight: 5, guests: 1.2, text: "Sun's out! Families are flocking in." },
    { id: 'normal', name: 'Lovely day', emoji: '⛅', weight: 8, guests: 1, text: 'A perfectly pleasant day at the zoo.' },
    { id: 'rain', name: 'Drizzle', emoji: '🌧️', weight: 4, guests: 0.7, text: 'Bit of drizzle. Fewer guests, but the capybaras love it.' },
    {
      id: 'school',
      name: 'School visit',
      emoji: '🚌',
      weight: 2,
      guests: 1.5,
      rep: 25,
      text: 'A school visit! Thirty very excited children.',
    },
    { id: 'bank', name: 'Bank holiday', emoji: '🎉', weight: 1, guests: 1.8, text: "Bank holiday! It's packed!" },
  ];

  // The goal chain: the design deck's first 15 minutes, then the pack's build order.
  // Each is checked by sim.js `goalDone` against `need`. reward is coins.
  const GOALS = [
    { id: 'name', title: 'Make it yours', text: 'Give your zoo a name', need: { named: true }, reward: 50 },
    { id: 'path', title: 'Make it yours', text: 'Lay 4 tiles of path from the gate', need: { stat: 'paths', n: 4 }, reward: 50 },
    {
      id: 'enclose',
      title: 'A home for capybaras',
      text: 'Fence a Pondside Meadow beside the path',
      need: { enclosure: 'capybara' },
      reward: 150,
    },
    { id: 'gate', title: 'Keeper access', text: 'Put a keeper gate in the fence, next to the path', need: { access: true }, reward: 60 },
    { id: 'safe', title: 'A safe home', text: 'Add a shelter, a feeder and a drinking station', need: { tier: 1 }, reward: 200 },
    {
      id: 'capys',
      title: 'Meet the residents',
      text: 'Buy two capybaras from the market',
      need: { species: 'capybara', n: 2 },
      reward: 200,
    },
    { id: 'shade', title: 'A cosy home', text: 'Add shade and watch a capybara rest in it', need: { seen: 'shade_rest' }, reward: 100 },
    { id: 'keeper', title: 'Solve a small need', text: 'Hire a keeper', need: { staff: 'keeper', n: 1 }, reward: 100 },
    { id: 'open', title: 'Opening day', text: 'Open the gates to visitors', need: { opened: true }, reward: 50 },
    { id: 'visitors', title: 'Opening day', text: 'Welcome 15 visitors', need: { stat: 'guests', n: 15 }, reward: 150 },
    { id: 'amenity', title: 'Choose what comes next', text: 'Build an amenity for your guests', need: { kind: 'shop', n: 1 }, reward: 150 },
    {
      id: 'explore',
      title: 'A place to explore',
      text: 'Meet a species’ priority need and add a signature item',
      need: { tier: 2 },
      reward: 250,
    },
    {
      id: 'family',
      title: 'Tiny paws',
      text: 'Add a nursery nook and start a breeding pair',
      need: { stat: 'breedings', n: 1 },
      reward: 200,
    },
    { id: 'baby', title: 'Tiny paws', text: 'Welcome your first baby', need: { stat: 'babies', n: 1 }, reward: 300 },
    { id: 'land', title: 'Growing the park', text: 'Buy a new plot of land', need: { stat: 'land', n: 1 }, reward: 300 },
    { id: 'friendly', title: 'A friendly little zoo', text: 'Reach 150 care reputation', need: { rep: 150 }, reward: 300 },
    {
      id: 'signature',
      title: 'A signature habitat',
      text: 'Three signature items, a viewing window and planting outside',
      need: { tier: 3 },
      reward: 500,
    },
    { id: 'favourite', title: 'A local favourite', text: 'Reach 700 care reputation', need: { rep: 700 }, reward: 600 },
    { id: 'animals', title: 'Growing family', text: 'Look after 20 animals at once', need: { animals: 20 }, reward: 800 },
    { id: 'dream', title: 'Your dream zoo', text: 'Reach 2,000 care reputation', need: { rep: 2000 }, reward: 2000 },
  ];

  const NAMES = [
    'Mochi',
    'Biscuit',
    'Pickle',
    'Crumpet',
    'Bramble',
    'Nibbles',
    'Waffle',
    'Muffin',
    'Pudding',
    'Sprout',
    'Toffee',
    'Pebble',
    'Clover',
    'Button',
    'Scone',
    'Hazel',
    'Peanut',
    'Bean',
    'Dumpling',
    'Fudge',
    'Wiggles',
    'Bubbles',
    'Teacake',
    'Bluebell',
    'Custard',
    'Jellybean',
    'Pip',
    'Honey',
    'Snuffles',
    'Maple',
    'Juniper',
    'Basil',
    'Olive',
    'Tofu',
    'Nori',
    'Cocoa',
    'Mallow',
    'Pippin',
    'Rosie',
    'Bramley',
    'Poppy',
    'Willow',
    'Barley',
    'Sage',
    'Thistle',
    'Acorn',
    'Fern',
    'Kipper',
    'Marmalade',
    'Treacle',
  ];

  const SPECIES = {};
  for (const sp of PACK.species) SPECIES[sp.id] = { ...sp, appeal: Math.max(2, Math.round(Math.sqrt(sp.buy) / 6)) }; // how many visitors it draws
  const ITEMS = {};
  for (const it of PACK.items) ITEMS[it.id] = { ...it, solid: SOLID.includes(it.template) };
  const CATALOGUE = {}; // species id → its 15 item ids, in pack order
  for (const it of PACK.items) (CATALOGUE[it.sp] = CATALOGUE[it.sp] || []).push(it.id);

  // Every picture the game can use, by key (docs/ART-BRIEF.md and docs/ART-BRIEF-BATCH-2.md).
  // Batch 1 is delivered; batch 2 is briefed. A key draws its emoji or flat colour until its file exists.
  const GUESTS = ['guest-1', 'guest-2', 'guest-3', 'guest-4', 'guest-5', 'guest-6'];
  const ICONS = ['icon-coins', 'icon-visitors', 'icon-care', 'icon-day', 'icon-build', 'icon-animals', 'icon-staff', 'icon-zoo'];
  function artKeys() {
    const batch1 = [],
      batch2 = [
        'gate',
        'tile-grass',
        'tile-path',
        'poop',
        'logo',
        ...GUESTS,
        'staff-keeper',
        'staff-guide',
        'fence-post',
        'fence-rail-a',
        'fence-rail-b',
        ...ICONS,
        'animal-indian-peafowl-female',
      ];
    for (const sp in SPECIES) {
      batch1.push('animal-' + sp, 'animal-' + sp + '-baby');
      batch2.push('portrait-' + sp, 'animal-' + sp + '-juvenile', 'item-sign-' + sp);
    }
    for (const k in ITEMS) {
      const key = ITEMS[k].template ? 'item-' + ITEMS[k].template : 'item-' + k;
      if (!batch1.includes(key)) batch1.push(key);
    }
    for (const k in BUILDS) batch1.push('build-' + k);
    for (const z in ZONES) batch2.push('ground-' + z.toLowerCase());
    return { batch1, batch2, all: [...batch1, ...batch2] };
  }

  const DATA = {
    artKeys,
    GUESTS,
    ICONS,
    BALANCE,
    STAGES,
    ZONES,
    SOLID,
    NEED_BY,
    CATEGORIES,
    TRAITS,
    BUILDS,
    STAFF,
    EVENTS,
    GOALS,
    NAMES,
    SPECIES,
    ITEMS,
    CATALOGUE,
    SYSTEMS: SYS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  root.ZooData = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
