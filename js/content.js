// CUTISE ZOO — game data and balance numbers. Change numbers here, not in the rules (sim.js).
// Design brief: "Cutise Zoo Tycoon — Design Deck" (concept 01, October 2026), summarised in docs/DESIGN.md.
// Every visible thing has an `emoji` stand-in and an `art` key. When ChatGPT's picture for that key
// lands in assets/ (see docs/ART-BRIEF.md), the front end draws it instead of the emoji.
(function (root) {
  'use strict';

  const BALANCE = {
    mapW: 16,
    mapH: 14,
    gate: { x: 7, y: 13 }, // the entrance tile, front middle
    startCoins: 1200,
    dayLength: 120, // active seconds in one zoo day
    offlineCap: 2 * 60 * 60, // most seconds caught up after being away
    offlineRate: 0.5, // while away the zoo runs at half pace

    // animals
    hungerPerSec: 0.2, // bowl used per "eat" point per second
    feedCost: 10, // coins to fill a bowl (by hand or by a keeper)
    poopChance: 0.004, // per animal per second, times the species' and trait's mess
    maxPoopPerPen: 6,
    cleanTip: 1, // coins a guest drops when they see you tidy up
    helloCooldown: 30, // seconds before the same animal enjoys another hello
    helloLasts: 40, // seconds a hello keeps them cheerful
    helloBoost: 10, // added to their happiness target while cheerful
    maxItems: 5, // enrichment items in one habitat
    // happiness = the three bars the player sees, weighted (add up to 1)
    weights: { food: 0.35, comfort: 0.4, social: 0.25 },
    comfortBase: 25, // comfort with nothing in the habitat
    comfortWants: 50, // shared out across the things the animal wants
    comfortFav: 15, // their favourite item is there
    comfortPerPoop: 12,
    comfortCrowdShy: 20, // shy animals when the paths are packed
    comfortSignature: 10, // living in a signature habitat

    // care reputation: never spent, it grows while animals are well and unlocks adoption offers
    repPerAnimal: 0.12, // per second, at full happiness (scaled from 50% up; unhappy animals lose it)
    repPerGuest: 0.08, // each guest who leaves having enjoyed themselves
    repHello: 0.5,

    // babies (a later system in the deck; kept gentle)
    babyHappy: 80,
    babyChance: 0.3, // per happy pair, at the end of each day
    growDays: 3,

    // guests
    guestStay: 45, // average seconds a guest spends in the zoo
    fairPriceBase: 4, // a fair ticket = base + care bonus + a coin per kind of amenity
    fairPriceCare: 8,
    shopEveryGuest: 0.1, // coins per second each guest spends at a shop (up to its seats)
    guestsPerPath: 3, // more than this per reachable path tile is a crowd
    tierAppeal: [0.8, 1, 1.3, 1.7], // habitat tier → how much guests enjoy its animals

    // staff
    keeperPens: 3, // habitats one keeper looks after
    keeperEvery: 8, // seconds between a keeper's rounds (feeds below keeperFeedBelow, picks up poop)
    keeperFeedBelow: 50,

    rehomeShare: 0.5, // coins back when an animal goes to a new home (babies 0.8)
    refund: 0.5, // clearing something gives back this share
    undoSeconds: 15, // a build can be undone for a full refund this long after
  };

  // Zoo stages, from the deck's "A zoo that grows with you".
  const STAGES = [
    { rep: 0, name: 'Opening day', text: 'One small park, a few animals, your first paying visitors.' },
    { rep: 500, name: 'A local favourite', text: 'Woodland and wetland zones, specialist staff, school visits.' },
    { rep: 2500, name: 'Your dream zoo', text: 'Themed areas, signature habitats and conservation projects.' },
  ];

  // Habitats. A habitat is a 3×3 fenced plot in one biome.
  const BIOMES = {
    wetland: { name: 'Wetland', color: '#9EC7C7', edge: '#6fa3a3', emoji: '💧', art: 'habitat-wetland' },
    woodland: { name: 'Woodland', color: '#A7BA91', edge: '#7d9468', emoji: '🌳', art: 'habitat-woodland' },
    meadow: { name: 'Meadow', color: '#C9D9A0', edge: '#9fb46f', emoji: '🌼', art: 'habitat-meadow' },
    ice: { name: 'Ice Coast', color: '#E4F0F2', edge: '#a9c9cf', emoji: '❄️', art: 'habitat-ice' },
    jungle: { name: 'Rainforest', color: '#8DB38B', edge: '#5f8a5d', emoji: '🌴', art: 'habitat-jungle' },
    savanna: { name: 'Savanna', color: '#E8CF94', edge: '#c9a865', emoji: '🌾', art: 'habitat-savanna' },
  };

  // Enrichment: what makes a habitat a home. Every animal wants a shelter, plus its species' wants.
  const ITEMS = {
    shelter: {
      name: 'Shelter',
      emoji: '🛖',
      art: 'item-shelter',
      cost: 80,
      need: 'somewhere to hide',
      desc: 'A safe, dry den. Every animal needs one.',
    },
    shade: { name: 'Shade tree', emoji: '🌳', art: 'item-shade', cost: 50, need: 'shade', desc: 'A cool spot for a long nap.' },
    pool: { name: 'Pool', emoji: '🫧', art: 'item-pool', cost: 150, need: 'a pool', desc: 'For splashing, paddling and floating about.' },
    climb: {
      name: 'Climbing frame',
      emoji: '🪵',
      art: 'item-climb',
      cost: 120,
      need: 'something to climb',
      desc: 'Logs and rope bridges.',
    },
    toy: { name: 'Toy box', emoji: '🧶', art: 'item-toy', cost: 40, need: 'toys', desc: 'Balls, puzzle feeders and a squeaky thing.' },
    bed: { name: 'Straw nest', emoji: '🪺', art: 'item-bed', cost: 30, need: 'a cosy nest', desc: 'Soft straw for curling up.' },
    rocks: { name: 'Sun rocks', emoji: '🪨', art: 'item-rocks', cost: 60, need: 'warm rocks', desc: 'Flat rocks that hold the sun.' },
    slide: { name: 'Ice slide', emoji: '🧊', art: 'item-slide', cost: 140, need: 'an ice slide', desc: 'Belly-first, obviously.' },
  };

  // Each animal gets one trait. It changes how they eat, how messy they are and what they want.
  const TRAITS = {
    sociable: { name: 'Sociable', emoji: '🤗', social: 1, desc: 'Wants one more friend around than most.' },
    shy: { name: 'Shy', emoji: '🙈', crowdShy: true, desc: 'Hides when the paths get packed.' },
    playful: { name: 'Playful', emoji: '🎾', want: 'toy', mess: 1.3, desc: 'Needs toys. Makes a mess having fun.' },
    sleepy: { name: 'Sleepy', emoji: '😴', want: 'bed', eat: 0.8, desc: 'Needs a nest. Eats a bit less.' },
    foodie: { name: 'Foodie', emoji: '🍉', eat: 1.4, desc: 'Empties the bowl fast.' },
    curious: { name: 'Curious', emoji: '🔍', curious: true, desc: 'Happier the more there is to explore.' },
  };

  // eat: how fast it empties the bowl. space: room it needs (a habitat has HABITAT_SPACE).
  // social: how many of its kind it wants around (counting itself). mess: poop rate.
  // appeal: how many guests it draws. rep: care reputation the zoo needs before it's offered.
  // wants: enrichment it needs on top of a shelter (its favourite item is one of these).
  const SPECIES = {
    capybara: {
      name: 'Capybara',
      emoji: '🦫',
      biome: 'wetland',
      cost: 150,
      rep: 0,
      appeal: 6,
      eat: 2,
      space: 2,
      social: 2,
      mess: 1.2,
      wants: ['pool', 'shade'],
      blurb: 'Sociable lounger',
      fact: 'Capybaras are friends with absolutely everyone.',
    },
    redpanda: {
      name: 'Red Panda',
      emoji: '🦊',
      biome: 'woodland',
      cost: 220,
      rep: 0,
      appeal: 8,
      eat: 1.5,
      space: 2,
      social: 1,
      mess: 1,
      wants: ['climb', 'shade'],
      blurb: 'Curious climber',
      fact: 'Red pandas wrap their fluffy tails round themselves like a scarf.',
    },
    bunny: {
      name: 'Rabbit',
      emoji: '🐰',
      biome: 'meadow',
      cost: 80,
      rep: 40,
      appeal: 3,
      eat: 1,
      space: 1,
      social: 2,
      mess: 1,
      wants: ['bed'],
      blurb: 'Binky champion',
      fact: 'Happy rabbits do a twisting jump called a binky.',
    },
    duck: {
      name: 'Duck',
      emoji: '🦆',
      biome: 'wetland',
      cost: 90,
      rep: 60,
      appeal: 3,
      eat: 1,
      space: 1,
      social: 3,
      mess: 1.2,
      wants: ['pool'],
      blurb: 'Puddle enthusiast',
      fact: 'Ducklings follow the first friend they meet.',
    },
    hedgehog: {
      name: 'Hedgehog',
      emoji: '🦔',
      biome: 'meadow',
      cost: 120,
      rep: 100,
      appeal: 4,
      eat: 1,
      space: 1,
      social: 1,
      mess: 1,
      wants: ['bed'],
      blurb: 'Night-time snuffler',
      fact: 'Hedgehogs snore. Loudly. For their size.',
    },
    otter: {
      name: 'Otter',
      emoji: '🦦',
      biome: 'wetland',
      cost: 300,
      rep: 150,
      appeal: 9,
      eat: 2,
      space: 2,
      social: 2,
      mess: 1.5,
      wants: ['pool', 'toy'],
      blurb: 'Energetic explorer',
      fact: "Otters hold hands while they sleep so they don't drift apart.",
    },
    penguin: {
      name: 'Penguin',
      emoji: '🐧',
      biome: 'ice',
      cost: 280,
      rep: 300,
      appeal: 8,
      eat: 2,
      space: 1,
      social: 3,
      mess: 1.5,
      wants: ['pool', 'slide'],
      blurb: 'Playful swimmer',
      fact: 'Penguins give their crush a perfect pebble.',
    },
    seal: {
      name: 'Seal',
      emoji: '🦭',
      biome: 'ice',
      cost: 400,
      rep: 600,
      appeal: 11,
      eat: 3,
      space: 2,
      social: 2,
      mess: 1.6,
      wants: ['pool', 'rocks'],
      blurb: 'Professional napper',
      fact: 'Seal pups can nap underwater.',
    },
    koala: {
      name: 'Koala',
      emoji: '🐨',
      biome: 'woodland',
      cost: 450,
      rep: 800,
      appeal: 12,
      eat: 2,
      space: 2,
      social: 1,
      mess: 1,
      wants: ['climb', 'bed'],
      blurb: 'Champion sleeper',
      fact: 'Koalas sleep up to 22 hours a day. Goals.',
    },
    sloth: {
      name: 'Sloth',
      emoji: '🦥',
      biome: 'jungle',
      cost: 500,
      rep: 900,
      appeal: 12,
      eat: 1,
      space: 2,
      social: 1,
      mess: 0.5,
      wants: ['climb'],
      blurb: 'Takes it easy',
      fact: 'Sloths only come down from their tree about once a week.',
    },
    monkey: {
      name: 'Monkey',
      emoji: '🐒',
      biome: 'jungle',
      cost: 550,
      rep: 1100,
      appeal: 13,
      eat: 2,
      space: 1,
      social: 3,
      mess: 2,
      wants: ['climb', 'toy'],
      blurb: 'Cheeky acrobat',
      fact: 'Monkeys groom each other to say "you\'re my mate".',
    },
    giraffe: {
      name: 'Giraffe',
      emoji: '🦒',
      biome: 'savanna',
      cost: 700,
      rep: 1400,
      appeal: 16,
      eat: 3,
      space: 3,
      social: 2,
      mess: 2,
      wants: ['shade', 'rocks'],
      blurb: 'Gentle lookout',
      fact: "A giraffe's tongue is purple and as long as your arm.",
    },
    panda: {
      name: 'Giant Panda',
      emoji: '🐼',
      biome: 'woodland',
      cost: 900,
      rep: 2000,
      appeal: 22,
      eat: 4,
      space: 3,
      social: 1,
      mess: 2,
      wants: ['climb', 'shade', 'toy'],
      blurb: 'Bamboo devotee',
      fact: 'Pandas spend half the day eating bamboo.',
    },
    lion: {
      name: 'Lion',
      emoji: '🦁',
      biome: 'savanna',
      cost: 1000,
      rep: 2400,
      appeal: 24,
      eat: 4,
      space: 3,
      social: 2,
      mess: 2,
      wants: ['rocks', 'shade'],
      blurb: 'Big softie',
      fact: 'Lion cubs practise roaring and mostly squeak.',
    },
    elephant: {
      name: 'Elephant',
      emoji: '🐘',
      biome: 'savanna',
      cost: 1200,
      rep: 3000,
      appeal: 28,
      eat: 5,
      space: 4,
      social: 2,
      mess: 3,
      wants: ['pool', 'shade'],
      blurb: 'Wise old soul',
      fact: 'Elephants comfort sad friends with a gentle trunk hug.',
    },
    tiger: {
      name: 'Tiger',
      emoji: '🐯',
      biome: 'jungle',
      cost: 1100,
      rep: 3500,
      appeal: 26,
      eat: 4,
      space: 3,
      social: 1,
      mess: 2,
      wants: ['pool', 'toy'],
      blurb: 'Loves a swim',
      fact: "Every tiger's stripes are unique, like fingerprints.",
    },
  };
  const HABITAT_SPACE = 6;

  // Things you can build. kind: path (walkable), habitat (3×3), shop (earns from guests),
  // decor (makes the zoo prettier; planted round a habitat it helps make it a signature habitat).
  // upkeep: coins a day to keep it running. Only things next to a path joined to the gate count.
  const BUILDS = {
    path: {
      name: 'Path',
      kind: 'path',
      cost: 5,
      rep: 0,
      upkeep: 0,
      emoji: '🟫',
      art: 'tile-path',
      desc: 'Guests and keepers can only reach what a path reaches.',
    },
    habitat_wetland: {
      name: 'Wetland habitat',
      kind: 'habitat',
      biome: 'wetland',
      cost: 250,
      rep: 0,
      upkeep: 10,
      emoji: '💧',
      art: 'habitat-wetland',
      desc: 'For capybaras, ducks and otters.',
    },
    habitat_woodland: {
      name: 'Woodland habitat',
      kind: 'habitat',
      biome: 'woodland',
      cost: 300,
      rep: 0,
      upkeep: 10,
      emoji: '🌳',
      art: 'habitat-woodland',
      desc: 'For red pandas, koalas and pandas.',
    },
    habitat_meadow: {
      name: 'Meadow habitat',
      kind: 'habitat',
      biome: 'meadow',
      cost: 200,
      rep: 40,
      upkeep: 8,
      emoji: '🌼',
      art: 'habitat-meadow',
      desc: 'For rabbits and hedgehogs.',
    },
    habitat_ice: {
      name: 'Ice Coast habitat',
      kind: 'habitat',
      biome: 'ice',
      cost: 450,
      rep: 300,
      upkeep: 18,
      emoji: '❄️',
      art: 'habitat-ice',
      desc: 'For penguins and seals.',
    },
    habitat_jungle: {
      name: 'Rainforest habitat',
      kind: 'habitat',
      biome: 'jungle',
      cost: 600,
      rep: 900,
      upkeep: 20,
      emoji: '🌴',
      art: 'habitat-jungle',
      desc: 'For sloths, monkeys and tigers.',
    },
    habitat_savanna: {
      name: 'Savanna habitat',
      kind: 'habitat',
      biome: 'savanna',
      cost: 800,
      rep: 1400,
      upkeep: 25,
      emoji: '🌾',
      art: 'habitat-savanna',
      desc: 'For giraffes, lions and elephants.',
    },
    icecream: {
      name: 'Ice Cream Cart',
      kind: 'shop',
      cost: 120,
      rep: 0,
      upkeep: 5,
      emoji: '🍦',
      art: 'shop-icecream',
      seats: 8,
      spend: 1,
      desc: 'Everyone needs a cone.',
    },
    toilet: {
      name: 'Loos',
      kind: 'shop',
      cost: 150,
      rep: 0,
      upkeep: 5,
      emoji: '🚻',
      art: 'shop-toilet',
      seats: 20,
      spend: 0,
      comfort: 1,
      desc: 'Earns nothing. Guests stay longer and enjoy it more.',
    },
    snacks: {
      name: 'Snack Kiosk',
      kind: 'shop',
      cost: 200,
      rep: 100,
      upkeep: 8,
      emoji: '🥨',
      art: 'shop-snacks',
      seats: 12,
      spend: 1.2,
      desc: 'Pretzels, crisps and carrot sticks (for the humans).',
    },
    cafe: {
      name: 'Tea Room',
      kind: 'shop',
      cost: 450,
      rep: 500,
      upkeep: 15,
      emoji: '☕',
      art: 'shop-cafe',
      seats: 16,
      spend: 1.8,
      comfort: 0.5,
      desc: 'Tea and cake. Very British.',
    },
    gifts: {
      name: 'Gift Shop',
      kind: 'shop',
      cost: 400,
      rep: 300,
      upkeep: 12,
      emoji: '🧸',
      art: 'shop-gifts',
      seats: 10,
      spend: 2.2,
      desc: 'Plushies of your animals. Sells better with more species.',
    },
    flowers: {
      name: 'Flower bed',
      kind: 'decor',
      cost: 20,
      rep: 0,
      upkeep: 0,
      emoji: '🌷',
      art: 'decor-flowers',
      appeal: 0.5,
      desc: 'Planting round a habitat makes it special.',
    },
    bush: {
      name: 'Hedge',
      kind: 'decor',
      cost: 30,
      rep: 0,
      upkeep: 0,
      emoji: '🌿',
      art: 'decor-hedge',
      appeal: 0.5,
      desc: 'Neat and green.',
    },
    bench: {
      name: 'Bench',
      kind: 'decor',
      cost: 50,
      rep: 0,
      upkeep: 0,
      emoji: '🪑',
      art: 'decor-bench',
      appeal: 1,
      comfort: 0.3,
      desc: 'A sit-down by the animals. Guests stay a bit longer.',
    },
    lamp: {
      name: 'Lamp post',
      kind: 'decor',
      cost: 40,
      rep: 40,
      upkeep: 1,
      emoji: '🏮',
      art: 'decor-lamp',
      appeal: 1,
      desc: 'A warm glow at closing time.',
    },
    sign: {
      name: 'Info board',
      kind: 'decor',
      cost: 60,
      rep: 100,
      upkeep: 0,
      emoji: '🪧',
      art: 'decor-sign',
      appeal: 1.5,
      desc: 'Fun facts about who lives here.',
    },
    fountain: {
      name: 'Fountain',
      kind: 'decor',
      cost: 300,
      rep: 500,
      upkeep: 4,
      emoji: '⛲',
      art: 'decor-fountain',
      appeal: 5,
      desc: 'Coins in, wishes out.',
    },
    statue: {
      name: 'Golden Paw',
      kind: 'decor',
      cost: 1500,
      rep: 2500,
      upkeep: 0,
      emoji: '🏆',
      art: 'decor-statue',
      appeal: 15,
      desc: 'For the best zoo in town.',
    },
  };

  const STAFF = {
    keeper: {
      name: 'Keeper',
      emoji: '🧑‍🌾',
      art: 'staff-keeper',
      hire: 100,
      wage: 30,
      rep: 0,
      desc: 'Feeds and tidies up to 3 habitats on their rounds (you pay for the food).',
    },
    guide: {
      name: 'Guide',
      emoji: '🧑‍🏫',
      art: 'staff-guide',
      hire: 250,
      wage: 45,
      rep: 500,
      desc: 'Tells guests about your animals. They enjoy their visit more and spread the word.',
    },
  };

  // Something different most days. guests: multiplier on the crowd.
  const EVENTS = [
    { id: 'sunny', name: 'Sunny day', emoji: '☀️', weight: 5, guests: 1.2, text: "Sun's out! Families are flocking in." },
    { id: 'normal', name: 'Lovely day', emoji: '⛅', weight: 8, guests: 1, text: 'A perfectly pleasant day at the zoo.' },
    { id: 'rain', name: 'Drizzle', emoji: '🌧️', weight: 4, guests: 0.7, text: 'Bit of drizzle. Fewer guests, but the ducks love it.' },
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

  // The goal chain, following the deck's "first 15 minutes" and then "a zoo that grows with you".
  // Each is checked by sim.js `goalDone` against `need`. reward is coins.
  const GOALS = [
    { id: 'name', title: 'Make it yours', text: 'Give your zoo a name', need: { named: true }, reward: 50 },
    { id: 'path', title: 'Make it yours', text: 'Lay 4 tiles of path from the gate', need: { stat: 'paths', n: 4 }, reward: 50 },
    {
      id: 'wetland',
      title: 'Make it yours',
      text: 'Build a Wetland habitat next to the path',
      need: { build: 'habitat_wetland', n: 1 },
      reward: 100,
    },
    { id: 'capys', title: 'Meet the residents', text: 'Welcome two capybaras', need: { species: 'capybara', n: 2 }, reward: 150 },
    { id: 'shelter', title: 'A safe home', text: 'Give them a shelter', need: { item: 'shelter', n: 1 }, reward: 80 },
    { id: 'shade', title: 'A cosy home', text: 'Place a shaded resting spot', need: { item: 'shade', n: 1 }, reward: 80 },
    { id: 'keeper', title: 'Solve a small need', text: 'Hire a keeper', need: { staff: 'keeper', n: 1 }, reward: 100 },
    { id: 'open', title: 'Opening day', text: 'Open the gates to visitors', need: { opened: true }, reward: 50 },
    { id: 'visitors', title: 'Opening day', text: 'Welcome 15 visitors', need: { stat: 'guests', n: 15 }, reward: 120 },
    { id: 'amenity', title: 'Choose what comes next', text: 'Build an amenity for your guests', need: { kind: 'shop', n: 1 }, reward: 120 },
    { id: 'explore', title: 'A place to explore', text: 'Give a habitat everything its residents want', need: { tier: 2 }, reward: 200 },
    { id: 'redpanda', title: 'A new neighbour', text: 'Adopt a red panda', need: { species: 'redpanda', n: 1 }, reward: 200 },
    {
      id: 'signature',
      title: 'A signature habitat',
      text: 'Plant 3 decorations round a well-kept habitat',
      need: { tier: 3 },
      reward: 300,
    },
    { id: 'favourite', title: 'A local favourite', text: 'Reach 500 care reputation', need: { rep: 500 }, reward: 400 },
    { id: 'animals', title: 'Growing family', text: 'Look after 12 animals at once', need: { animals: 12 }, reward: 500 },
    { id: 'baby', title: 'Tiny paws', text: 'Keep a pair so happy they have a baby', need: { stat: 'babies', n: 1 }, reward: 500 },
    { id: 'dream', title: 'Your dream zoo', text: 'Reach 2,500 care reputation', need: { rep: 2500 }, reward: 2000 },
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
  ];

  const DATA = { BALANCE, STAGES, BIOMES, ITEMS, TRAITS, SPECIES, HABITAT_SPACE, BUILDS, STAFF, EVENTS, GOALS, NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  root.ZooData = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
