// CUTISE ZOO — the rules.
// Everything that changes the zoo lives here, as plain functions over one state object:
//   createState(seed)  a brand new zoo
//   tick(s)            advances one second of zoo time
//   apply(s, cmd)      the ONLY way a player changes the zoo (validated, then applied)
//   catchUp(s, secs)   runs the time you were away, at half pace, and says what happened
//   load(json)         turns a save back into a safe state (old saves keep loading)
// No DOM, no Date.now, no Math.random: randomness comes from a seed stored in the state, so a
// zoo can be replayed exactly, tested, and one day run on a server too.
(function (root) {
  'use strict';
  const D = root.ZooData || (typeof require !== 'undefined' ? require('./content.js') : null);
  const B = D.BALANCE;
  const SCHEMA = 1;
  const MAP_W = B.mapW,
    MAP_H = B.mapH;
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  // ---------- small helpers ----------
  class GameError extends Error {}
  const need = (cond, msg) => {
    if (!cond) throw new GameError(msg);
  };
  const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  const idx = (x, y) => y * MAP_W + x;
  const inMap = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

  // Seeded PRNG (mulberry32). The seed lives in state, so saves resume the same random stream.
  function rand(s) {
    let t = (s.seed = (s.seed + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];

  function news(s, text, kind = 'info') {
    s.news.push({ id: ++s.newsId, text, kind });
    if (s.news.length > 30) s.news.shift();
  }

  // ---------- a new zoo ----------
  // An empty park: the gate, a stub of path and a full purse. The goal chain walks the player
  // through the deck's first 15 minutes from here.
  function createState(seed = 1) {
    const s = {
      v: SCHEMA,
      seed: seed >>> 0,
      t: 0,
      day: 1,
      name: '',
      coins: B.startCoins,
      rep: 0,
      opened: false,
      price: 6,
      tiles: new Array(MAP_W * MAP_H).fill(''),
      habitats: [],
      builds: [],
      animals: [],
      staff: { keeper: 0, guide: 0 },
      guests: 0,
      arrive: 0,
      event: 'normal',
      goal: 0,
      offered: ['capybara', 'redpanda'], // species whose adoption offers have arrived
      stats: { guests: 0, paths: 0, babies: 0, cleaned: 0, hellos: 0, earned: 0 },
      today: blankDay(),
      report: null,
      lastBuild: null,
      news: [],
      newsId: 0,
      nextId: 1,
    };
    s.tiles[idx(B.gate.x, B.gate.y)] = 'gate';
    s.tiles[idx(B.gate.x, B.gate.y - 1)] = 'path';
    refresh(s);
    return s;
  }
  function blankDay() {
    return { guests: 0, tickets: 0, shops: 0, food: 0, hellos: 0, babies: [] };
  }

  // ---------- the map ----------
  // Tiles: '' grass, 'gate', 'path', 'h:<id>' part of a habitat, 'b:<id>' a shop or decoration.
  const tileAt = (s, x, y) => (inMap(x, y) ? s.tiles[idx(x, y)] : null);
  const habitatById = (s, id) => s.habitats.find((h) => h.id === id);
  const buildById = (s, id) => s.builds.find((b) => b.id === id);
  const animalById = (s, id) => s.animals.find((a) => a.id === id);
  const residents = (s, hab) => s.animals.filter((a) => a.hab === hab.id);
  const sizeOf = (def) => (def.kind === 'habitat' ? 3 : 1);

  // Every path tile reachable from the gate.
  function reach(s) {
    const seen = new Set([idx(B.gate.x, B.gate.y)]);
    const q = [[B.gate.x, B.gate.y]];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of DIRS) {
        const nx = x + dx,
          ny = y + dy;
        if (tileAt(s, nx, ny) === 'path' && !seen.has(idx(nx, ny))) {
          seen.add(idx(nx, ny));
          q.push([nx, ny]);
        }
      }
    }
    return seen;
  }
  // Does this rectangle touch (side by side, not corner to corner) a path joined to the gate?
  function isOpen(s, x, y, w, h, reached = reach(s)) {
    for (let yy = y - 1; yy <= y + h; yy++)
      for (let xx = x - 1; xx <= x + w; xx++) {
        const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
        const corner = (xx === x - 1 || xx === x + w) && (yy === y - 1 || yy === y + h);
        if (!inside && !corner && inMap(xx, yy) && reached.has(idx(xx, yy))) return true;
      }
    return false;
  }
  // Decorations in the ring of tiles round a habitat (its planting and viewing areas).
  function decorAround(s, hab) {
    return s.builds.filter(
      (b) => D.BUILDS[b.k].kind === 'decor' && b.x >= hab.x - 1 && b.x <= hab.x + 3 && b.y >= hab.y - 1 && b.y <= hab.y + 3
    ).length;
  }

  // Why something can't be built here, or null if it can. The ghost preview shows this reason.
  function buildProblem(s, k, x, y) {
    if (!has(D.BUILDS, k)) return 'Unknown building.';
    const def = D.BUILDS[k];
    if (s.rep < def.rep) return `Needs ${def.rep} care reputation.`;
    const n = sizeOf(def);
    if (!inMap(x, y) || !inMap(x + n - 1, y + n - 1)) return "That doesn't fit there.";
    for (let yy = y; yy < y + n; yy++)
      for (let xx = x; xx < x + n; xx++) {
        const t = s.tiles[idx(xx, yy)];
        if (t) return t === 'path' ? 'There is a path in the way.' : t === 'gate' ? 'The gate is there.' : 'Something is already there.';
      }
    if (s.coins < def.cost) return `You need ${def.cost} coins.`;
    return null;
  }

  // ---------- animals ----------
  const spaceOf = (a) => (a.baby ? Math.ceil(D.SPECIES[a.sp].space / 2) : D.SPECIES[a.sp].space);
  const spaceUsed = (s, hab) => residents(s, hab).reduce((n, a) => n + spaceOf(a), 0);

  function addAnimal(s, sp, habId, baby) {
    const used = new Set(s.animals.map((a) => a.name));
    const free = D.NAMES.filter((n) => !used.has(n));
    const name = free.length ? pick(s, free) : pick(s, D.NAMES) + ' ' + (s.nextId % 100);
    const def = D.SPECIES[sp];
    const a = {
      id: s.nextId++,
      sp,
      name,
      hab: habId,
      happy: 60,
      helloAt: -999,
      baby: !!baby,
      born: s.day,
      trait: pick(s, Object.keys(D.TRAITS)),
      fav: pick(s, def.wants),
    };
    s.animals.push(a);
    return a;
  }
  // Everything this animal wants in its habitat: a shelter, its species' wants, its trait's want.
  function wantsOf(a) {
    const w = new Set(['shelter', ...D.SPECIES[a.sp].wants]);
    const tr = D.TRAITS[a.trait];
    if (tr && tr.want) w.add(tr.want);
    return [...w];
  }

  // The three bars the player sees, 0–100, and the happiness they add up to.
  function needs(s, a) {
    const hab = habitatById(s, a.hab);
    const sp = D.SPECIES[a.sp],
      tr = D.TRAITS[a.trait] || {};
    const kin = residents(s, hab).filter((o) => o.sp === a.sp).length;
    const wants = wantsOf(a);
    const missing = wants.filter((w) => !hab.items.includes(w));
    let comfort = B.comfortBase + (B.comfortWants * (wants.length - missing.length)) / wants.length;
    if (hab.items.includes(a.fav)) comfort += B.comfortFav;
    if (tr.curious) comfort += hab.items.length * 3;
    if (tr.crowdShy && s.crowded) comfort -= B.comfortCrowdShy;
    if ((s.tiers || {})[hab.id] === 3) comfort += B.comfortSignature;
    comfort -= hab.poop.length * B.comfortPerPoop;
    const bars = {
      food: clamp(hab.food * 1.5, 0, 100),
      comfort: clamp(comfort, 0, 100),
      social: clamp((kin / (sp.social + (tr.social || 0))) * 100, 0, 100),
    };
    let target = 0;
    for (const k in B.weights) target += bars[k] * B.weights[k];
    if (s.t - a.helloAt < B.helloLasts) target += B.helloBoost;
    return { ...bars, target: clamp(target, 0, 100), missing };
  }
  const mood = (happy) => (happy >= 85 ? 'love' : happy >= 60 ? 'happy' : happy >= 35 ? 'meh' : 'sad');

  // The most pressing problem for this animal, in words, with the action that fixes it.
  // ("Mochi needs shade" → Add shade tree · 50.) Null when all is well.
  function problem(s, a) {
    const hab = habitatById(s, a.hab);
    const n = needs(s, a);
    const sp = D.SPECIES[a.sp];
    if (!(s.open || []).includes(hab.id))
      return { text: `Keepers can't reach ${a.name}`, why: 'Join the habitat to the gate with a path.', fix: { ui: 'build', k: 'path' } };
    if (n.food < 35)
      return { text: `${a.name} is hungry`, fix: { cmd: { type: 'feed', hab: hab.id }, cost: B.feedCost, label: 'Fill the bowl' } };
    const order = ['shelter', a.fav, ...n.missing];
    const miss = order.find((w) => n.missing.includes(w));
    if (miss && hab.items.length < B.maxItems) {
      const it = D.ITEMS[miss];
      return {
        text: `${a.name} needs ${it.need}`,
        fix: { cmd: { type: 'item', hab: hab.id, item: miss }, cost: it.cost, label: `Add ${it.name.toLowerCase()}` },
      };
    }
    if (hab.poop.length >= 2) return { text: `${a.name}'s home is messy`, why: 'Tap the poop to tidy up, or hire a keeper.' };
    if (n.social < 100)
      return {
        text: `${a.name} is lonely`,
        why: `${sp.name}s like company.`,
        fix: { cmd: { type: 'adopt', sp: a.sp, hab: hab.id }, cost: sp.cost, label: `Adopt a friend` },
      };
    if (!hab.items.includes(a.fav) && hab.items.length < B.maxItems) {
      const it = D.ITEMS[a.fav];
      return {
        text: `${a.name} would love ${it.need}`,
        fix: { cmd: { type: 'item', hab: hab.id, item: a.fav }, cost: it.cost, label: `Add ${it.name.toLowerCase()}` },
      };
    }
    if (D.TRAITS[a.trait].crowdShy && s.crowded)
      return { text: `${a.name} is shy of the crowds`, why: 'More paths give guests room to spread out.' };
    return null;
  }

  // Habitat tiers, from the deck: 1 a safe home (shelter, food, keeper access), 2 a place to explore
  // (everything its residents want), 3 a signature habitat (that, plus planting round it).
  function tierOf(s, hab, open) {
    if (!open.has(hab.id) || !hab.items.includes('shelter') || hab.food <= 0) return 0;
    const who = residents(s, hab);
    if (!who.length) return 1;
    const all = new Set(who.flatMap(wantsOf));
    if (![...all].every((w) => hab.items.includes(w))) return 1;
    return decorAround(s, hab) >= 3 ? 3 : 2;
  }
  const TIER_NAMES = ['Needs work', 'A safe home', 'A place to explore', 'A signature habitat'];

  // ---------- the zoo's pull ----------
  // Works out reach, tiers, care, appeal and the crowd. Called every tick and after every action.
  function refresh(s) {
    const reached = reach(s);
    const open = new Set(s.habitats.filter((h) => isOpen(s, h.x, h.y, 3, 3, reached)).map((h) => h.id));
    s.open = [...open];
    s.tiers = {};
    for (const h of s.habitats) s.tiers[h.id] = tierOf(s, h, open);
    let appeal = 0,
      comfort = 0;
    const amenities = new Set();
    for (const a of s.animals)
      if (open.has(a.hab))
        appeal += D.SPECIES[a.sp].appeal * (0.3 + (0.7 * a.happy) / 100) * B.tierAppeal[s.tiers[a.hab]] * (a.baby ? 1.5 : 1);
    for (const b of s.builds) {
      if (!isOpen(s, b.x, b.y, 1, 1, reached)) continue;
      const def = D.BUILDS[b.k];
      appeal += def.appeal || 0;
      comfort += def.comfort || 0;
      if (def.kind === 'shop') amenities.add(b.k);
    }
    s.care = s.animals.length ? Math.round(s.animals.reduce((n, a) => n + a.happy, 0) / s.animals.length) : 0;
    s.capacity = (reached.size - 1) * B.guestsPerPath;
    s.crowded = s.guests > s.capacity;
    s.appeal = Math.round(appeal * 10) / 10;
    s.comfortGuests = comfort;
    const crowd = s.crowded ? s.capacity / Math.max(1, s.guests) : 1;
    s.enjoy =
      clamp(
        0.5 * (s.care / 100) + 0.1 * Math.min(3, amenities.size) + (amenities.has('toilet') ? 0.1 : 0) + 0.1 * Math.min(2, s.staff.guide),
        0,
        1
      ) * crowd;
    s.fair = Math.round(B.fairPriceBase + (B.fairPriceCare * s.care) / 100 + amenities.size);
    const ev = D.EVENTS.find((e) => e.id === s.event) || D.EVENTS[1];
    s.target = s.opened ? Math.round(appeal * priceMult(s) * ev.guests * 10) / 10 : 0;
    return { reached, open };
  }
  // Cheap tickets bring more guests; dear ones put them off. At a fair price it's exactly 1.
  const priceMult = (s) => clamp(1.5 - (0.5 * s.price) / Math.max(1, s.fair || B.fairPriceBase), 0, 1.5);
  const stage = (s) => D.STAGES.filter((st) => s.rep >= st.rep).pop();
  const upkeep = (s) => s.habitats.reduce((n, h) => n + D.BUILDS[h.k].upkeep, 0) + s.builds.reduce((n, b) => n + D.BUILDS[b.k].upkeep, 0);
  const wages = (s) => Object.keys(D.STAFF).reduce((n, r) => n + s.staff[r] * D.STAFF[r].wage, 0);

  // ---------- money ----------
  function earn(s, coins, where) {
    s.coins += coins;
    s.stats.earned += coins;
    if (where) s.today[where] += coins;
  }
  function spend(s, coins) {
    need(s.coins >= coins, `You need ${Math.ceil(coins)} coins.`);
    s.coins -= coins;
  }
  function gainRep(s, n) {
    const before = s.rep;
    s.rep = Math.max(0, s.rep + n);
    for (const [k, sp] of Object.entries(D.SPECIES))
      if (!s.offered.includes(k) && s.rep >= sp.rep) {
        s.offered.push(k);
        news(s, `${sp.emoji} An adoption offer! ${sp.name}s are looking for a home.`, 'offer');
      }
    for (const st of D.STAGES) if (st.rep && before < st.rep && s.rep >= st.rep) news(s, `🎉 Your zoo is now "${st.name}"!`, 'stage');
  }

  // ---------- one second of zoo time ----------
  function tick(s) {
    s.t++;
    const { reached, open } = refresh(s);

    for (const hab of s.habitats) {
      const herd = residents(s, hab);
      const eat = herd.reduce((n, a) => n + D.SPECIES[a.sp].eat * (D.TRAITS[a.trait].eat || 1) * (a.baby ? 0.5 : 1), 0);
      hab.food = Math.max(0, hab.food - eat * B.hungerPerSec);
      for (const a of herd) {
        const sp = D.SPECIES[a.sp];
        a.happy += (needs(s, a).target - a.happy) * 0.1;
        if (hab.poop.length < B.maxPoopPerPen && rand(s) < B.poopChance * sp.mess * (D.TRAITS[a.trait].mess || 1))
          hab.poop.push({ id: s.nextId++, x: rand(s), y: rand(s) });
        if (s.opened && open.has(hab.id)) gainRep(s, (B.repPerAnimal * (a.happy - 50)) / 50);
      }
    }

    // Guests arrive at a rate that keeps about `target` in the zoo; each pays at the gate.
    const stay = B.guestStay * (1 + Math.min(1, s.comfortGuests / 4));
    s.arrive += s.target / B.guestStay;
    while (s.arrive >= 1) {
      s.arrive -= 1;
      s.guests += 1;
      s.stats.guests++;
      s.today.guests++;
      earn(s, s.price, 'tickets');
    }
    const leaving = s.guests / stay;
    s.guests = Math.max(0, s.guests - leaving);
    gainRep(s, leaving * B.repPerGuest * s.enjoy);
    const variety = new Set(s.animals.map((a) => a.sp)).size;
    for (const b of s.builds) {
      const def = D.BUILDS[b.k];
      if (def.kind !== 'shop' || !def.spend || !isOpen(s, b.x, b.y, 1, 1, reached)) continue;
      const bonus = b.k === 'gifts' ? 1 + variety * 0.1 : 1;
      earn(s, Math.min(s.guests, def.seats) * B.shopEveryGuest * def.spend * bonus * (0.5 + s.enjoy / 2), 'shops');
    }

    // Keepers do their rounds: the habitats that need it most, as many as they can cover.
    if (s.staff.keeper && s.t % B.keeperEvery === 0) {
      const round = s.habitats
        .filter((h) => open.has(h.id) && residents(s, h).length)
        .sort((a, b) => a.food - b.food - (a.poop.length - b.poop.length) * 10)
        .slice(0, s.staff.keeper * B.keeperPens);
      for (const h of round) {
        if (h.food < B.keeperFeedBelow && s.coins >= B.feedCost) {
          s.coins -= B.feedCost;
          s.today.food += B.feedCost;
          h.food = 100;
        }
        h.poop.splice(0, 2);
      }
    }

    if (s.t % B.dayLength === 0) endDay(s);
  }

  function endDay(s) {
    const costs = { wages: wages(s), upkeep: upkeep(s) };
    s.coins -= costs.wages + costs.upkeep;
    if (s.coins < 0) news(s, 'The zoo is in the red! Raise ticket prices or cut back on staff.', 'warn');

    // Babies: every pair of very happy grown-ups of one kind in one habitat might have a little one.
    for (const hab of s.habitats) {
      const groups = {};
      for (const a of residents(s, hab)) if (!a.baby && a.happy >= B.babyHappy) (groups[a.sp] = groups[a.sp] || []).push(a);
      for (const sp in groups)
        for (let i = 0; i < Math.floor(groups[sp].length / 2); i++) {
          if (spaceUsed(s, hab) + Math.ceil(D.SPECIES[sp].space / 2) > D.HABITAT_SPACE) break;
          if (rand(s) >= B.babyChance) continue;
          const baby = addAnimal(s, sp, hab.id, true);
          s.stats.babies++;
          s.today.babies.push(baby.id);
          news(s, `🍼 A baby ${D.SPECIES[sp].name.toLowerCase()} was born! Say hello to ${baby.name}.`, 'baby');
        }
    }
    for (const a of s.animals)
      if (a.baby && s.day + 1 - a.born >= B.growDays) {
        a.baby = false;
        news(s, `${a.name} is all grown up.`, 'info');
      }

    const t = s.today;
    s.report = {
      day: s.day,
      guests: t.guests,
      tickets: Math.floor(t.tickets),
      shops: Math.floor(t.shops),
      food: t.food,
      ...costs,
      net: Math.floor(t.tickets + t.shops - t.food - costs.wages - costs.upkeep),
      babies: t.babies,
      care: s.care,
    };
    s.day++;
    s.today = blankDay();
    const total = D.EVENTS.reduce((n, e) => n + e.weight, 0);
    let r = rand(s) * total;
    const ev = D.EVENTS.find((e) => (r -= e.weight) < 0) || D.EVENTS[1];
    s.event = ev.id;
    if (ev.rep && s.opened) gainRep(s, ev.rep);
    news(s, `Day ${s.day}: ${ev.emoji} ${ev.text}`, 'day');
  }

  // ---------- goals ----------
  function goalDone(s, g) {
    const n = g.need;
    if (n.named) return !!s.name;
    if (n.opened) return s.opened;
    if (n.stat !== undefined) return s.stats[n.stat] >= n.n;
    if (n.build !== undefined)
      return s.habitats.filter((h) => h.k === n.build).length + s.builds.filter((b) => b.k === n.build).length >= n.n;
    if (n.kind !== undefined) return s.builds.filter((b) => D.BUILDS[b.k].kind === n.kind).length >= n.n;
    if (n.species !== undefined) return s.animals.filter((a) => a.sp === n.species).length >= n.n;
    if (n.item !== undefined) return s.habitats.filter((h) => h.items.includes(n.item)).length >= n.n;
    if (n.staff !== undefined) return s.staff[n.staff] >= n.n;
    if (n.tier !== undefined) return Object.values(s.tiers || {}).some((t) => t >= n.tier);
    if (n.rep !== undefined) return s.rep >= n.rep;
    if (n.animals !== undefined) return s.animals.length >= n.animals;
    return false;
  }
  const currentGoal = (s) => D.GOALS[s.goal] || null;

  // ---------- player actions ----------
  // Each handler checks everything with need() before it changes anything.
  const habitatOf = (s, id) => {
    const h = habitatById(s, id);
    need(h, 'Pick a habitat.');
    return h;
  };
  const H = {
    name(s, { name }) {
      const clean = String(name || '')
        .replace(/[\u0000-\u001f]/g, '')
        .trim()
        .slice(0, 28);
      need(clean, 'Give your zoo a name.');
      s.name = clean;
      return {};
    },
    open(s) {
      need(!s.opened, 'The gates are already open.');
      need(s.animals.length, 'Welcome some animals before the visitors!');
      s.opened = true;
      news(s, `🎟️ ${s.name || 'The zoo'} is open! Here come the visitors.`, 'stage');
      return {};
    },
    build(s, { k, x, y }) {
      const why = buildProblem(s, k, x, y);
      need(!why, why);
      const def = D.BUILDS[k];
      spend(s, def.cost);
      let id = null;
      if (def.kind === 'path') {
        s.tiles[idx(x, y)] = 'path';
        s.stats.paths++;
      } else if (def.kind === 'habitat') {
        const h = { id: s.nextId++, k, biome: def.biome, x, y, food: 100, items: [], poop: [] };
        for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 3; xx++) s.tiles[idx(xx, yy)] = 'h:' + h.id;
        s.habitats.push(h);
        id = h.id;
      } else {
        const b = { id: s.nextId++, k, x, y };
        s.builds.push(b);
        s.tiles[idx(x, y)] = 'b:' + b.id;
        id = b.id;
      }
      s.lastBuild = { k, x, y, t: s.t };
      return { id };
    },
    // Takes back the last thing you built, for a full refund, if it's recent and still empty.
    undo(s) {
      const lb = s.lastBuild;
      need(lb && s.t - lb.t <= B.undoSeconds, 'Nothing to undo.');
      const tile = tileAt(s, lb.x, lb.y);
      need(tile && tile !== 'gate', 'Nothing to undo.');
      if (tile.startsWith('h:'))
        need(
          !residents(s, habitatById(s, +tile.slice(2))).length && !habitatById(s, +tile.slice(2)).items.length,
          'Someone has moved in already!'
        );
      clear(s, lb.x, lb.y);
      if (lb.k === 'path') s.stats.paths = Math.max(0, s.stats.paths - 1);
      s.coins += D.BUILDS[lb.k].cost;
      s.lastBuild = null;
      return { coins: D.BUILDS[lb.k].cost };
    },
    bulldoze(s, { x, y }) {
      const tile = tileAt(s, x, y);
      need(tile, 'Nothing to clear there.');
      need(tile !== 'gate', 'The gate stays. Guests need a way in!');
      if (tile.startsWith('h:')) need(!residents(s, habitatById(s, +tile.slice(2))).length, 'Find the animals a new home first.');
      const k = clear(s, x, y);
      const back = Math.floor(D.BUILDS[k].cost * B.refund);
      s.coins += back;
      if (s.lastBuild && s.lastBuild.x === x && s.lastBuild.y === y) s.lastBuild = null;
      return { coins: back };
    },
    adopt(s, { sp, hab: habId }) {
      need(has(D.SPECIES, sp), 'Unknown animal.');
      need(s.offered.includes(sp), `No ${D.SPECIES[sp].name.toLowerCase()}s need a home yet. Keep your animals happy!`);
      const def = D.SPECIES[sp];
      const hab = habitatOf(s, habId);
      need(hab.biome === def.biome, `${def.name}s need a ${D.BIOMES[def.biome].name} habitat.`);
      need(spaceUsed(s, hab) + def.space <= D.HABITAT_SPACE, 'That habitat is full. Build another!');
      spend(s, def.cost);
      const a = addAnimal(s, sp, hab.id, false);
      news(
        s,
        `${def.emoji} Welcome, ${a.name}! (${D.TRAITS[a.trait].name.toLowerCase()}, loves ${D.ITEMS[a.fav].name.toLowerCase()}s)`,
        'baby'
      );
      return { animal: a.id, name: a.name };
    },
    feed(s, { hab: habId }) {
      const hab = habitatOf(s, habId);
      need(hab.food < 95, 'Their bowl is already full.');
      spend(s, B.feedCost);
      s.today.food += B.feedCost;
      hab.food = 100;
      return {};
    },
    item(s, { hab: habId, item }) {
      const hab = habitatOf(s, habId);
      need(has(D.ITEMS, item), 'Unknown item.');
      need(!hab.items.includes(item), 'They already have one.');
      need(hab.items.length < B.maxItems, 'No room for more. Remove something first.');
      spend(s, D.ITEMS[item].cost);
      hab.items.push(item);
      return {};
    },
    removeItem(s, { hab: habId, item }) {
      const hab = habitatOf(s, habId);
      need(hab.items.includes(item), 'Not there.');
      hab.items = hab.items.filter((i) => i !== item);
      const back = Math.floor(D.ITEMS[item].cost * B.refund);
      s.coins += back;
      return { coins: back };
    },
    clean(s, { hab: habId, poop }) {
      const hab = habitatOf(s, habId);
      const i = hab.poop.findIndex((p) => p.id === poop);
      need(i >= 0, 'Already tidied.');
      hab.poop.splice(i, 1);
      s.stats.cleaned++;
      if (s.opened) earn(s, B.cleanTip);
      return { coins: s.opened ? B.cleanTip : 0 };
    },
    hello(s, { animal }) {
      const a = animalById(s, animal);
      need(a, 'Who?');
      need(s.t - a.helloAt >= B.helloCooldown, `${a.name} is having a little rest.`);
      a.helloAt = s.t;
      a.happy = clamp(a.happy + 3, 0, 100);
      s.stats.hellos++;
      gainRep(s, B.repHello);
      return {};
    },
    hire(s, { role }) {
      need(has(D.STAFF, role), 'Unknown job.');
      const def = D.STAFF[role];
      need(s.rep >= def.rep, `Needs ${def.rep} care reputation.`);
      need(s.staff[role] < 5, "That's plenty.");
      spend(s, def.hire);
      s.staff[role]++;
      return {};
    },
    fire(s, { role }) {
      need(has(D.STAFF, role) && s.staff[role] > 0, 'Nobody to let go.');
      s.staff[role]--;
      return {};
    },
    price(s, { price }) {
      need(Number.isInteger(price) && price >= 0 && price <= 99, 'Pick a price from 0 to 99.');
      s.price = price;
      return {};
    },
    claim(s) {
      const g = currentGoal(s);
      need(g && goalDone(s, g), 'Not done yet!');
      s.coins += g.reward;
      s.goal++;
      return { coins: g.reward };
    },
    rename(s, { animal, name }) {
      const a = animalById(s, animal);
      need(a, 'Who?');
      const clean = String(name || '')
        .replace(/[\u0000-\u001f]/g, '')
        .trim()
        .slice(0, 16);
      need(clean, 'Give them a name.');
      a.name = clean;
      return {};
    },
    rehome(s, { animal }) {
      const a = animalById(s, animal);
      need(a, 'Who?');
      const coins = Math.floor(D.SPECIES[a.sp].cost * (a.baby ? 0.8 : B.rehomeShare));
      s.animals = s.animals.filter((o) => o !== a);
      earn(s, coins);
      news(s, `${a.name} went to a lovely new home.`, 'info');
      return { coins };
    },
  };
  // Removes whatever is on this tile (a habitat goes whole). Returns its build key.
  function clear(s, x, y) {
    const tile = tileAt(s, x, y);
    if (tile === 'path') {
      s.tiles[idx(x, y)] = '';
      return 'path';
    }
    if (tile.startsWith('h:')) {
      const hab = habitatById(s, +tile.slice(2));
      s.habitats = s.habitats.filter((h) => h !== hab);
      s.tiles = s.tiles.map((t) => (t === tile ? '' : t));
      return hab.k;
    }
    const b = buildById(s, +tile.slice(2));
    s.builds = s.builds.filter((o) => o !== b);
    s.tiles[idx(x, y)] = '';
    return b.k;
  }

  function apply(s, cmd) {
    if (!cmd || !has(H, cmd.type)) return { ok: false, error: 'Unknown action.' };
    try {
      const out = H[cmd.type](s, cmd) || {};
      refresh(s);
      return { ok: true, ...out };
    } catch (e) {
      if (e instanceof GameError) return { ok: false, error: e.message };
      throw e;
    }
  }

  // ---------- time away ----------
  function catchUp(s, seconds) {
    const n = Math.floor(clamp(num(seconds, 0), 0, B.offlineCap) * B.offlineRate);
    const before = { coins: s.coins, rep: s.rep, guests: s.stats.guests, babies: s.stats.babies, day: s.day };
    for (let i = 0; i < n; i++) tick(s);
    return {
      seconds: n,
      coins: Math.floor(s.coins - before.coins),
      rep: Math.floor(s.rep - before.rep),
      guests: s.stats.guests - before.guests,
      babies: s.stats.babies - before.babies,
      days: s.day - before.day,
    };
  }

  // ---------- saves ----------
  // Fills anything missing from a fresh zoo and drops anything that can't be trusted, so old or
  // hand-edited saves load instead of breaking the game.
  function load(data) {
    const fresh = createState(1);
    if (!data || typeof data !== 'object') return fresh;
    const s = { ...fresh };
    for (const k of ['seed', 't', 'day', 'coins', 'rep', 'price', 'guests', 'arrive', 'goal', 'newsId', 'nextId'])
      s[k] = num(data[k], fresh[k]);
    s.seed = s.seed >>> 0;
    s.price = clamp(Math.floor(s.price), 0, 99);
    s.goal = clamp(Math.floor(s.goal), 0, D.GOALS.length);
    s.rep = Math.max(0, s.rep);
    s.name = typeof data.name === 'string' ? data.name.slice(0, 28) : '';
    s.opened = !!data.opened;
    s.event = D.EVENTS.some((e) => e.id === data.event) ? data.event : 'normal';
    s.stats = { ...fresh.stats };
    for (const k in fresh.stats) s.stats[k] = num((data.stats || {})[k], 0);
    s.staff = {};
    for (const r in D.STAFF) s.staff[r] = clamp(Math.floor(num((data.staff || {})[r], 0)), 0, 5);
    s.offered = [...new Set([...fresh.offered, ...(Array.isArray(data.offered) ? data.offered : []).filter((k) => has(D.SPECIES, k))])];
    s.today = { ...blankDay(), ...(data.today && typeof data.today === 'object' ? data.today : {}) };
    s.report = data.report && typeof data.report === 'object' ? data.report : null;
    s.news = Array.isArray(data.news) ? data.news.slice(-30) : [];
    s.lastBuild = null;

    // Rebuild the map from what's on it. Anything that would land on something else is dropped.
    s.tiles = new Array(MAP_W * MAP_H).fill('');
    s.tiles[idx(B.gate.x, B.gate.y)] = 'gate';
    s.habitats = [];
    for (const h of Array.isArray(data.habitats) ? data.habitats : []) {
      if (
        !h ||
        !has(D.BUILDS, h.k) ||
        D.BUILDS[h.k].kind !== 'habitat' ||
        !inMap(h.x, h.y) ||
        !inMap(h.x + 2, h.y + 2) ||
        !Number.isInteger(h.id)
      )
        continue;
      const cells = [];
      for (let yy = h.y; yy < h.y + 3; yy++) for (let xx = h.x; xx < h.x + 3; xx++) cells.push(idx(xx, yy));
      if (cells.some((c) => s.tiles[c])) continue;
      for (const c of cells) s.tiles[c] = 'h:' + h.id;
      s.habitats.push({
        id: h.id,
        k: h.k,
        biome: D.BUILDS[h.k].biome,
        x: h.x,
        y: h.y,
        food: clamp(num(h.food, 100), 0, 100),
        items: [...new Set((Array.isArray(h.items) ? h.items : []).filter((i) => has(D.ITEMS, i)))].slice(0, B.maxItems),
        poop: (Array.isArray(h.poop) ? h.poop : []).filter((p) => p && Number.isInteger(p.id)).slice(0, B.maxPoopPerPen),
      });
    }
    s.builds = [];
    for (const b of Array.isArray(data.builds) ? data.builds : []) {
      if (
        !b ||
        !has(D.BUILDS, b.k) ||
        !['shop', 'decor'].includes(D.BUILDS[b.k].kind) ||
        !inMap(b.x, b.y) ||
        s.tiles[idx(b.x, b.y)] ||
        !Number.isInteger(b.id)
      )
        continue;
      s.tiles[idx(b.x, b.y)] = 'b:' + b.id;
      s.builds.push({ id: b.id, k: b.k, x: b.x, y: b.y });
    }
    const savedTiles = Array.isArray(data.tiles) && data.tiles.length === MAP_W * MAP_H ? data.tiles : [];
    savedTiles.forEach((t, i) => {
      if (t === 'path' && !s.tiles[i]) s.tiles[i] = 'path';
    });
    s.animals = [];
    for (const a of Array.isArray(data.animals) ? data.animals : []) {
      if (!a || !has(D.SPECIES, a.sp) || !Number.isInteger(a.id)) continue;
      const hab = s.habitats.find((h) => h.id === a.hab && h.biome === D.SPECIES[a.sp].biome);
      if (!hab) continue;
      s.animals.push({
        id: a.id,
        sp: a.sp,
        hab: hab.id,
        name: String(a.name || 'Friend').slice(0, 16),
        happy: clamp(num(a.happy, 60), 0, 100),
        helloAt: num(a.helloAt, -999),
        baby: !!a.baby,
        born: num(a.born, s.day),
        trait: has(D.TRAITS, a.trait) ? a.trait : 'sociable',
        fav: D.SPECIES[a.sp].wants.includes(a.fav) ? a.fav : D.SPECIES[a.sp].wants[0],
      });
    }
    const maxId = Math.max(
      0,
      ...s.habitats.map((h) => h.id),
      ...s.builds.map((b) => b.id),
      ...s.animals.map((a) => a.id),
      ...s.habitats.flatMap((h) => h.poop.map((p) => p.id))
    );
    s.nextId = Math.max(Math.floor(s.nextId), maxId + 1);
    refresh(s);
    return s;
  }

  const Sim = {
    SCHEMA,
    TIER_NAMES,
    createState,
    tick,
    apply,
    catchUp,
    load,
    refresh,
    reach,
    isOpen,
    buildProblem,
    needs,
    wantsOf,
    problem,
    mood,
    goalDone,
    currentGoal,
    priceMult,
    stage,
    upkeep,
    wages,
    spaceUsed,
    residents,
    decorAround,
    habitatById,
    buildById,
    animalById,
    tileAt,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
  root.ZooSim = Sim;
})(typeof globalThis !== 'undefined' ? globalThis : this);
