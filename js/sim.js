// CUTISE ZOO — the rules.
// Everything that changes the zoo lives here, as plain functions over one state object:
//   createState(seed)  a brand new zoo
//   tick(s)            advances one second of zoo time (paused time never reaches here)
//   apply(s, cmd)      the ONLY way a player changes the zoo (validated first, then applied in one go)
//   load(json)         turns a save back into a safe state, upgrading old versions
// No DOM, no Date.now, no Math.random: randomness comes from a seed stored in the state, so a zoo
// replays exactly, tests are reliable, and a due birth replayed after a reload can't happen twice.
// Design contract: pack/docs/GAME-SYSTEMS.md, BREEDING-AND-TRADING.md, EXPANSION-AND-DYNAMIC-LIFE.md.
(function (root) {
  'use strict';
  const D = root.ZooData || (typeof require !== 'undefined' ? require('./content.js') : null);
  const B = D.BALANCE;
  const SCHEMA = 2;
  const SIZE = B.chunk * B.maxChunks; // the whole possible map is SIZE × SIZE tiles
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const STAGE_ORDER = D.STAGES.map((st) => st.id);

  // ---------- small helpers ----------
  class GameError extends Error {}
  const need = (cond, msg) => {
    if (!cond) throw new GameError(msg);
  };
  const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  const int = (v) => Number.isInteger(v);
  const idx = (x, y) => y * SIZE + x;
  const inWorld = (x, y) => int(x) && int(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  const chunkKey = (cx, cy) => cx + ',' + cy;
  const owned = (s, x, y) => inWorld(x, y) && s.land.includes(chunkKey(Math.floor(x / B.chunk), Math.floor(y / B.chunk)));
  const cleanText = (v, max) =>
    String(v || '')
      .replace(/[\u0000-\u001f]/g, '')
      .trim()
      .slice(0, max);

  // Seeded PRNG (mulberry32). The seed lives in state, so saves resume the same random stream.
  function rand(s) {
    let t = (s.seed = (s.seed + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
  function weighted(s, options) {
    const total = options.reduce((n, o) => n + o.w, 0);
    let r = rand(s) * total;
    for (const o of options) if ((r -= o.w) < 0) return o;
    return options[options.length - 1];
  }

  function news(s, text, kind = 'info', extra) {
    s.news.push({ id: ++s.newsId, text, kind, ...(extra || {}) });
    if (s.news.length > 40) s.news.shift();
  }

  // ---------- a new zoo ----------
  // Four chunks of empty land, the gate, a stub of path and a full purse. The goal chain walks the
  // player through building their first enclosure from here.
  function createState(seed = 1) {
    const g = B.gate;
    const s = {
      v: SCHEMA,
      seed: seed >>> 0,
      t: 0,
      day: 1,
      name: '',
      coins: B.startCoins,
      rep: 0,
      opened: false,
      price: 8,
      land: B.startChunks.map(([cx, cy]) => chunkKey(cx, cy)),
      landBought: 0,
      paths: [idx(g.x, g.y - 1)],
      habs: [],
      builds: [],
      animals: [],
      events: [],
      market: { day: 1, offers: [] },
      tx: [],
      departed: [],
      album: [],
      seen: {},
      staff: { keeper: 0, guide: 0 },
      guests: 0,
      arrive: 0,
      event: 'normal',
      goal: 0,
      stats: { guests: 0, paths: 0, babies: 0, breedings: 0, cleaned: 0, hellos: 0, earned: 0, land: 0, bought: 0, sold: 0 },
      today: blankDay(),
      report: null,
      lastBuild: null,
      reveal: [], // newborns waiting for the player to see (and name) them
      news: [],
      newsId: 0,
      nextId: 1,
      rev: 0, // bumped whenever the map changes, so derived data can be cached
    };
    // The first market: one of each sex of the starter species, so a pair is always on offer.
    for (const sp of ['capybara', 'meerkat', 'rabbit', 'pygmy-goat'].filter((k) => has(D.SPECIES, k)))
      for (const sex of ['f', 'm']) s.market.offers.push(makeOffer(s, sp, sex));
    s.market.offers = s.market.offers.slice(0, Math.max(B.offerCount, 6));
    refresh(s);
    return s;
  }
  const blankDay = () => ({ guests: 0, tickets: 0, shops: 0, bought: 0, sold: 0, babies: [] });

  // ---------- unlocking ----------
  const stageIndex = (s) => D.STAGES.filter((st) => s.rep >= st.rep).length - 1;
  const stage = (s) => D.STAGES[stageIndex(s)];
  const unlocked = (s, stageId) => STAGE_ORDER.indexOf(stageId) <= stageIndex(s);
  const stageOf = (id) => D.STAGES.find((st) => st.id === id);

  // ---------- the map (derived, cached by revision) ----------
  // occ: tile → 'gate' | 'path' | 'h:<id>' (inside an enclosure) | 'b:<id>' (a park build or an
  // outside item). reached: path tiles joined to the gate.
  const caches = new WeakMap();
  function map(s) {
    let c = caches.get(s);
    if (c && c.rev === s.rev) return c;
    const occ = new Map();
    const g = B.gate;
    occ.set(idx(g.x, g.y), 'gate');
    for (const p of s.paths) occ.set(p, 'path');
    for (const h of s.habs) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) occ.set(idx(x, y), 'h:' + h.id);
    for (const b of s.builds) for (const [x, y] of cellsOf(b.x, b.y, ...sizeOfBuild(b))) occ.set(idx(x, y), 'b:' + b.id);
    const reached = new Set([idx(g.x, g.y)]);
    const q = [[g.x, g.y]];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of DIRS) {
        const k = idx(x + dx, y + dy);
        if (inWorld(x + dx, y + dy) && occ.get(k) === 'path' && !reached.has(k)) {
          reached.add(k);
          q.push([x + dx, y + dy]);
        }
      }
    }
    c = { rev: s.rev, occ, reached };
    caches.set(s, c);
    return c;
  }
  const touch = (s) => (s.rev = (s.rev + 1) % 1e9);
  const tileAt = (s, x, y) => (inWorld(x, y) ? map(s).occ.get(idx(x, y)) || '' : null);
  function cellsOf(x, y, w, h) {
    const out = [];
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) out.push([xx, yy]);
    return out;
  }
  const footprint = (def, r) => (r === 90 || r === 270 ? [def.fp[1], def.fp[0]] : [def.fp[0], def.fp[1]]);
  const sizeOfBuild = (b) => (D.ITEMS[b.k] ? footprint(D.ITEMS[b.k], b.r || 0) : [1, 1]);
  // Does this rectangle touch (side by side) a path joined to the gate?
  function besidePath(s, x, y, w, h) {
    const { reached } = map(s);
    for (let yy = y - 1; yy <= y + h; yy++)
      for (let xx = x - 1; xx <= x + w; xx++) {
        const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
        const corner = (xx === x - 1 || xx === x + w) && (yy === y - 1 || yy === y + h);
        if (!inside && !corner && inWorld(xx, yy) && reached.has(idx(xx, yy))) return true;
      }
    return false;
  }

  const habById = (s, id) => s.habs.find((h) => h.id === id);
  const buildById = (s, id) => s.builds.find((b) => b.id === id);
  const animalById = (s, id) => s.animals.find((a) => a.id === id);
  const residents = (s, hab) => s.animals.filter((a) => a.hab === hab.id);
  const itemsIn = (hab) => hab.items.map((i) => ({ ...i, def: D.ITEMS[i.k] }));

  // A boundary cell's neighbour on the far side of the fence.
  function outward(hab, x, y) {
    const out = [];
    if (x === hab.x) out.push([x - 1, y]);
    if (x === hab.x + hab.w - 1) out.push([x + 1, y]);
    if (y === hab.y) out.push([x, y - 1]);
    if (y === hab.y + hab.h - 1) out.push([x, y + 1]);
    return out;
  }
  // Is a boundary item on the fence next to a reachable path (guests and keepers can get to it)?
  function opensOntoPath(s, hab, item) {
    const { reached } = map(s);
    const [w, h] = footprint(D.ITEMS[item.k], item.r);
    return cellsOf(item.x, item.y, w, h).some(([x, y]) =>
      outward(hab, x, y).some(([ox, oy]) => inWorld(ox, oy) && reached.has(idx(ox, oy)))
    );
  }

  // ---------- what an enclosure supports (pack: GAME-SYSTEMS "Population capacity") ----------
  // physical = floor(usable tiles / tiles per resident slot)
  // supported = min(physical, shelter slots, feed slots, water slots); free = supported − residents − reserved births.
  // A feeder only counts if keepers can reach it through a keeper gate next to a path.
  function habStats(s, hab, rect = hab, items = hab.items) {
    const sp = D.SPECIES[hab.sp];
    const st = {
      access: false,
      shelter: 0,
      feed: 0,
      water: 0,
      rest: 0,
      nursery: 0,
      shade: 0,
      privacy: 0,
      terrain: 0,
      view: 0,
      education: 0,
      appearance: 0,
      variety: 0,
    };
    const signature = new Set();
    let solid = 0;
    const r = { ...hab, ...rect };
    for (const it of items) {
      const def = D.ITEMS[it.k];
      const [w, h] = footprint(def, it.r);
      if (def.solid) solid += w * h;
      switch (def.effect) {
        case 'keeper_access':
          if (opensOntoPath(s, r, it)) st.access = true;
          break;
        case 'shelter_slots':
          st.shelter += def.value;
          break;
        case 'feed_slots':
          st.feed += def.value;
          break;
        case 'water_slots':
          st.water += def.value;
          break;
        case 'rest_slots':
          st.rest += def.value;
          break;
        case 'nursery_capacity':
          st.nursery += def.value;
          break;
        case 'view_quality':
          if (opensOntoPath(s, r, it)) st.view += def.value;
          break;
        case 'enrichment_variety':
          signature.add(it.k);
          break;
        default:
          if (has(st, def.effect)) st[def.effect] += def.value;
      }
    }
    for (const b of s.builds) if (b.hab === hab.id && D.ITEMS[b.k]) st[D.ITEMS[b.k].effect] += D.ITEMS[b.k].value;
    if (!st.access) st.feed = 0; // a feeder keepers can't reach supplies nothing
    st.shade = Math.min(st.shade, B.caps.shade);
    st.privacy = Math.min(st.privacy, B.caps.privacy);
    st.terrain = Math.min(st.terrain, B.caps.terrain);
    st.variety = Math.min(signature.size, B.caps.variety);
    st.usable = r.w * r.h - solid;
    st.physical = Math.floor(st.usable / sp.tilesPerSlot);
    st.supported = Math.min(st.physical, st.shelter, st.feed, st.water);
    st.residents = residents(s, hab).length;
    st.reserved = s.events.filter((e) => e.hab === hab.id && !e.done).length;
    st.free = st.supported - st.residents - st.reserved;
    // what holds the population back, for the panel ("shelter is the bottleneck: add a shelter")
    const limits = { space: st.physical, shelter: st.shelter, food: st.feed, water: st.water };
    st.bottleneck = Object.keys(limits).reduce((a, b) => (limits[b] < limits[a] ? b : a));
    st.prioMet = priorityMet(s, hab, items, r);
    st.tier = 0;
    if (st.access && st.shelter > 0 && st.feed > 0 && st.water > 0) {
      st.tier = 1;
      if (st.prioMet && st.variety >= 1 && st.rest > 0) {
        st.tier = 2;
        if (st.variety >= 3 && st.view > 0 && st.education + st.appearance >= 10) st.tier = 3;
      }
    }
    return st;
  }
  function priorityMet(s, hab, items = hab.items, rect = hab) {
    const sp = D.SPECIES[hab.sp];
    const how = D.NEED_BY[sp.need] || 'signature';
    if (how.startsWith('template:')) return items.some((i) => D.ITEMS[i.k].template === how.slice(9));
    if (how === 'space') return rect.w * rect.h >= sp.footprint[0] * sp.footprint[1];
    if (how === 'group') return residents(s, hab).length >= sp.group[0];
    return items.some((i) => i.k === hab.sp + '__signature-1');
  }
  // The catalogue item that answers the priority need, if an item can.
  function priorityItem(hab) {
    const how = D.NEED_BY[D.SPECIES[hab.sp].need] || 'signature';
    if (how.startsWith('template:')) return D.CATALOGUE[hab.sp].find((k) => D.ITEMS[k].template === how.slice(9));
    if (how === 'signature') return hab.sp + '__signature-1';
    return null;
  }
  const TIER_NAMES = ['Needs work', 'A safe home', 'A place to explore', 'A signature habitat'];

  // ---------- needs (pack: food, water, comfort, social, enrichment, 0–100; wellbeing is their mean) ----------
  function needs(s, a, st = habStats(s, habById(s, a.hab))) {
    const hab = habById(s, a.hab);
    const sp = D.SPECIES[a.sp];
    const tr = D.TRAITS[a.trait] || {};
    const n = Math.max(1, st.residents);
    const cover = (slots) => Math.min(1, slots / n);
    let comfort = 10 + 40 * cover(st.shelter) + 15 * cover(st.rest) + st.shade + st.privacy - hab.poop.length * 8;
    if (st.residents > st.physical) comfort -= B.crowdPenalty;
    if (tr.privacy && st.privacy <= 0) comfort -= 15;
    if (tr.rest && st.rest <= 0) comfort -= 10;
    let enrich = 20 + 20 * st.variety + st.terrain;
    if (tr.curious && st.variety > 0) enrich += 10;
    if (tr.enrich && st.variety < 2) enrich -= 10;
    if (!st.prioMet) {
      comfort -= B.priorityPenalty;
      enrich -= B.priorityPenalty;
    } else enrich += 15;
    const kin = residents(s, hab).length;
    const want = sp.group[0] * (tr.social || 1);
    let social = (kin / Math.max(1, want)) * 100;
    if (a.stage !== 'adult' && a.caregiver && animalById(s, a.caregiver) && animalById(s, a.caregiver).hab === a.hab) social = 100;
    const bars = {
      food: st.feed > 0 ? hab.food * cover(st.feed) : 0,
      water: 100 * cover(st.water),
      comfort,
      social,
      enrichment: enrich,
    };
    for (const k in bars) bars[k] = clamp(Math.round(bars[k]), 0, 100);
    const target = (bars.food + bars.water + bars.comfort + bars.social + bars.enrichment) / 5;
    return { ...bars, target: clamp(target + (s.t - a.helloAt < 60 ? B.helloBoost : 0), 0, 100) };
  }
  const mood = (wb) => (wb >= 85 ? 'love' : wb >= 60 ? 'happy' : wb >= 35 ? 'meh' : 'sad');

  // The most pressing problem, in words, with what fixes it (pack: "Mochi needs shade" + the action).
  // fix: {cmd} runs a command, {place: itemId} starts placing that item, {ui: 'path'|'market'|'resize'}.
  function problem(s, a) {
    const hab = habById(s, a.hab);
    const st = habStats(s, hab);
    const n = needs(s, a, st);
    const sp = D.SPECIES[a.sp];
    const cat = (tpl) => D.CATALOGUE[hab.sp].find((k) => D.ITEMS[k].template === tpl);
    const placeFix = (k, label) => ({ place: k, cost: D.ITEMS[k].price, label: label || `Add ${D.ITEMS[k].name.toLowerCase()}` });
    if (!st.access) {
      const gate = hab.items.find((i) => D.ITEMS[i.k].template === 'keeper-gate');
      return gate
        ? { text: `Keepers can't reach ${a.name}`, why: 'Lay a path up to the keeper gate.', fix: { ui: 'path', label: 'Lay a path' } }
        : {
            text: `Keepers can't reach ${a.name}`,
            why: 'Put a keeper gate in the fence beside a path.',
            fix: placeFix(cat('keeper-gate'), 'Add a keeper gate'),
          };
    }
    if (st.feed <= 0) return { text: `${a.name} needs a feeder`, fix: placeFix(cat('feeder')) };
    if (n.food < 35)
      return {
        text: `${a.name} is hungry`,
        why: s.staff.keeper ? 'Your keepers have a lot on.' : 'Hire a keeper to keep feeders full.',
        fix: { cmd: { type: 'feed', hab: hab.id }, cost: 0, label: 'Top up the feeder' },
      };
    if (st.water <= 0 || n.water < 35) return { text: `${a.name} needs water`, fix: placeFix(cat('water')) };
    if (st.shelter < st.residents)
      return {
        text: `${a.name} needs shelter`,
        why: `${st.shelter} shelter places for ${st.residents} animals.`,
        fix: placeFix(cat('shelter')),
      };
    if (!st.prioMet) {
      const k = priorityItem(hab);
      const how = D.NEED_BY[sp.need];
      if (k) return { text: `${a.name} needs ${sp.need}`, fix: placeFix(k, sp.needLabel) };
      if (how === 'space')
        return {
          text: `${a.name} needs more space`,
          why: `${sp.name}s like at least ${sp.footprint[0]}×${sp.footprint[1]} tiles.`,
          fix: { ui: 'resize', label: sp.needLabel },
        };
      return {
        text: `${a.name} wants a bigger group`,
        why: `${sp.name}s are happiest in groups of ${sp.group[0]} or more.`,
        fix: { ui: 'market', label: 'Find a companion' },
      };
    }
    if (st.residents > st.physical)
      return {
        text: `It's crowded in here`,
        why: 'Make the enclosure bigger, or move someone.',
        fix: { ui: 'resize', label: 'Make it bigger' },
      };
    if (hab.poop.length >= 3) return { soft: true, text: `${a.name}'s home is messy`, why: 'Tap the poop to tidy up, or hire a keeper.' };
    if (n.social < 60)
      return {
        soft: true,
        text: `${a.name} is lonely`,
        why: `${sp.name}s like company.`,
        fix: { ui: 'market', label: 'Find a companion' },
      };
    if (n.enrichment < 60) {
      const next = D.CATALOGUE[hab.sp].find((k) => D.ITEMS[k].cat === 'species_enrichment' && !hab.items.some((i) => i.k === k));
      if (next) return { soft: true, text: `${a.name} would love something new to do`, fix: placeFix(next) };
    }
    return null;
  }

  // ---------- placing things ----------
  // Why an item can't go here, or null. Used by the ghost preview, the rules and save loading.
  function placeProblem(s, hab, k, x, y, r = 0, opts = {}) {
    if (!has(D.ITEMS, k)) return 'Unknown item.';
    const def = D.ITEMS[k];
    if (def.sp !== hab.sp) return `That's for ${D.SPECIES[def.sp].name.toLowerCase()}s.`;
    if (![0, 90, 180, 270].includes(r)) return 'Bad rotation.';
    if (!int(x) || !int(y)) return "That doesn't fit there.";
    const [w, h] = footprint(def, r);
    const cells = cellsOf(x, y, w, h);
    const inside = ([cx, cy]) => cx >= hab.x && cx < hab.x + hab.w && cy >= hab.y && cy < hab.y + hab.h;
    if (!opts.loading) {
      const tier = habStats(s, hab).tier;
      if (def.level > tier + 1) return `Needs "${TIER_NAMES[def.level - 1]}" first.`;
      if (s.coins < def.price) return `You need ${def.price} coins.`;
    }
    if (def.place === 'outside') {
      if (cells.some(inside)) return 'This goes outside the fence.';
      for (const [cx, cy] of cells) {
        if (!owned(s, cx, cy)) return "That's not your land yet.";
        if (tileAt(s, cx, cy)) return 'Something is already there.';
      }
      const near = cells.some(([cx, cy]) => cx >= hab.x - 2 && cx < hab.x + hab.w + 2 && cy >= hab.y - 2 && cy < hab.y + hab.h + 2);
      return near ? null : 'Put it right beside the enclosure.';
    }
    if (!cells.every(inside)) return def.place === 'boundary' ? 'This goes in the fence.' : 'Keep it inside the fence.';
    if (def.place === 'boundary') {
      const sides = (cx, cy) =>
        [cx === hab.x && 'w', cx === hab.x + hab.w - 1 && 'e', cy === hab.y && 'n', cy === hab.y + hab.h - 1 && 's'].filter(Boolean);
      const common = cells.map(([cx, cy]) => sides(cx, cy)).reduce((a, b) => a.filter((v) => b.includes(v)));
      if (!common.length) return 'This goes in the fence: put it along the edge.';
    }
    const others = hab.items.filter((i) => i.id !== opts.ignore);
    const taken = new Set(others.flatMap((i) => cellsOf(i.x, i.y, ...footprint(D.ITEMS[i.k], i.r)).map(([cx, cy]) => idx(cx, cy))));
    if (cells.some(([cx, cy]) => taken.has(idx(cx, cy)))) return 'Something is already there.';
    if (!opts.loading && def.solid) {
      const after = habStats(s, hab, hab, [...others, { id: -1, k, x, y, r }]);
      if (after.physical < after.residents + after.reserved) return 'That would leave too little room for everyone.';
    }
    return null;
  }
  // Why an enclosure can't be fenced (or resized to) here, or null. Returns cost in `out.cost`.
  function rectProblem(s, x, y, w, h, hab, out = {}) {
    if (![x, y, w, h].every(int)) return 'Drag out a rectangle.';
    if (w < B.enclosureMin || h < B.enclosureMin) return `At least ${B.enclosureMin}×${B.enclosureMin} tiles.`;
    if (w > B.enclosureMax || h > B.enclosureMax) return `At most ${B.enclosureMax}×${B.enclosureMax} tiles.`;
    let fresh = 0;
    for (const [cx, cy] of cellsOf(x, y, w, h)) {
      if (!owned(s, cx, cy)) return "Part of that isn't your land yet.";
      const t = tileAt(s, cx, cy);
      if (hab && t === 'h:' + hab.id) continue;
      if (t) return t === 'path' ? 'There is a path in the way.' : t === 'gate' ? 'The gate is in the way.' : 'Something is in the way.';
      fresh++;
    }
    const perim = 2 * (w + h);
    const before = hab ? 2 * (hab.w + hab.h) : 0;
    out.cost = B.fencePerEdge * Math.max(0, perim - before) + B.terrainPerTile * fresh;
    out.fresh = fresh;
    return null;
  }
  function resizeProblem(s, hab, x, y, w, h, out = {}) {
    const why = rectProblem(s, x, y, w, h, hab, out);
    if (why) return why;
    const rect = { x, y, w, h };
    for (const it of hab.items) {
      const moved = placeProblem(s, { ...hab, ...rect }, it.k, it.x, it.y, it.r, { loading: true, ignore: it.id });
      if (moved) return `${D.ITEMS[it.k].name} wouldn't fit. Move it first.`;
    }
    for (const b of s.builds)
      if (b.hab === hab.id && cellsOf(b.x, b.y, ...sizeOfBuild(b)).some(([cx, cy]) => cx >= x && cx < x + w && cy >= y && cy < y + h))
        return `${D.ITEMS[b.k].name} is in the way.`;
    const after = habStats(s, hab, rect);
    if (after.physical < after.residents + after.reserved) return 'Too small for everyone who lives here (and any babies on the way).';
    if (s.coins < out.cost) return `You need ${out.cost} coins.`;
    return null;
  }
  const landPrice = (s) => Math.round(B.landCostBase * Math.pow(B.landCostGrowth, s.landBought));
  function landProblem(s, cx, cy) {
    if (!int(cx) || !int(cy) || cx < 0 || cy < 0 || cx >= B.maxChunks || cy >= B.maxChunks) return "That's beyond the park's edge.";
    if (s.land.includes(chunkKey(cx, cy))) return 'You already own that.';
    if (!DIRS.some(([dx, dy]) => s.land.includes(chunkKey(cx + dx, cy + dy)))) return 'Buy land next to land you own.';
    if (s.coins < landPrice(s)) return `You need ${landPrice(s)} coins.`;
    return null;
  }
  // Chunks that can be bought right now (next to owned land, inside the 6×6 grid).
  function landForSale(s) {
    const out = [];
    for (let cy = 0; cy < B.maxChunks; cy++)
      for (let cx = 0; cx < B.maxChunks; cx++)
        if (!s.land.includes(chunkKey(cx, cy)) && DIRS.some(([dx, dy]) => s.land.includes(chunkKey(cx + dx, cy + dy))))
          out.push({ cx, cy, price: landPrice(s) });
    return out;
  }
  function buildProblem(s, k, x, y) {
    if (!has(D.BUILDS, k)) return 'Unknown building.';
    const def = D.BUILDS[k];
    if (!unlocked(s, def.stage)) return `Unlocks at "${stageOf(def.stage).name}".`;
    if (!owned(s, x, y)) return "That's not your land yet.";
    const t = tileAt(s, x, y);
    if (t) return t === 'path' ? 'There is a path there.' : t === 'gate' ? 'The gate is there.' : 'Something is already there.';
    if (s.coins < def.cost) return `You need ${def.cost} coins.`;
    return null;
  }

  // ---------- animals ----------
  function newAnimal(s, sp, hab, { sex, trait, stage = 'adult', parents = [], id, name } = {}) {
    const used = new Set(s.animals.map((a) => a.name));
    const free = D.NAMES.filter((nm) => !used.has(nm));
    const def = D.SPECIES[sp];
    const pickName =
      name || (!used.has(def.example) ? def.example : free.length ? pick(s, free) : pick(s, D.NAMES) + ' ' + (s.nextId % 100));
    const ancestors = [...new Set(parents.flatMap((p) => [p.id, ...p.parents]))];
    const a = {
      id: id || s.nextId++,
      sp,
      name: pickName,
      sex: sex || (rand(s) < 0.5 ? 'f' : 'm'),
      stage,
      stageDays: 0,
      parents: parents.map((p) => p.id),
      ancestors, // parents and grandparents: enough to block pairs related within two generations
      trait: trait || pick(s, Object.keys(D.TRAITS)),
      wb: 60,
      health: 100,
      hab: hab.id,
      caregiver: null,
      cooldownDay: 0,
      goodDays: 0,
      wbSum: 0,
      wbN: 0,
      helloAt: -999,
      act: null,
      x: hab.x + hab.w / 2,
      y: hab.y + hab.h / 2,
      born: s.day,
    };
    s.animals.push(a);
    return a;
  }
  const dependents = (s, a) => s.animals.filter((o) => o.caregiver === a.id && o.stage !== 'adult');
  const inEvent = (s, a) => s.events.some((e) => !e.done && e.parents.includes(a.id));
  function related(a, b) {
    const fa = new Set([a.id, ...a.ancestors]);
    return [b.id, ...b.ancestors].some((id) => fa.has(id));
  }

  // ---------- behaviour (pack: GAME-SYSTEMS "Behaviour selection") ----------
  // Urgent need first, then staying near a parent, then a reachable favourite, then roaming.
  // Each choice commits for a while; the same object isn't picked twice running.
  function chooseAction(s, a, hab, st) {
    const tr = D.TRAITS[a.trait] || {};
    const n = a.needsCache || needs(s, a, st);
    const options = [{ w: 1.5, type: 'roam' }];
    for (const it of hab.items) {
      const def = D.ITEMS[it.k];
      if (def.behaviour === 'none') continue;
      if (def.behaviour === 'baby_rest' && a.stage === 'adult') continue;
      let w = 1;
      if (def.behaviour === 'feed') w = n.food < 60 ? 8 : 0.5;
      else if (def.behaviour === 'drink') w = 1.5;
      else if (def.behaviour === 'rest' || def.behaviour === 'shade_rest') w = tr.rest ? 2.5 : 1.5;
      else if (def.behaviour === 'retreat') w = tr.privacy ? 2.5 : 0.8;
      else if (def.behaviour === 'baby_rest') w = 3;
      else if (def.cat === 'species_enrichment') w = tr.enrich || tr.curious ? 3 : 2;
      if (s.t - it.placedAt < B.newItemSeconds) w *= B.newItemPull;
      if (it.id === (a.act && a.act.item)) w *= 0.15;
      options.push({ w, type: def.behaviour, item: it });
    }
    const carer = a.caregiver && animalById(s, a.caregiver);
    const sp = D.SPECIES[a.sp];
    if (a.stage === 'baby' && carer && carer.hab === hab.id && sp.follow === 'parent_proximity') options.push({ w: 6, type: 'follow' });
    const pickd = weighted(s, options);
    const dur = B.actMin + Math.floor(rand(s) * (B.actMax - B.actMin));
    let x, y;
    if (pickd.type === 'follow') {
      x = clamp(carer.x + (rand(s) - 0.5) * 1.2, hab.x + 0.3, hab.x + hab.w - 0.3);
      y = clamp(carer.y + (rand(s) - 0.5) * 1.2, hab.y + 0.3, hab.y + hab.h - 0.3);
    } else if (pickd.item) {
      const [w, h] = footprint(D.ITEMS[pickd.item.k], pickd.item.r);
      x = pickd.item.x + 0.2 + rand(s) * (w - 0.4);
      y = pickd.item.y + 0.2 + rand(s) * (h - 0.4);
    } else {
      x = hab.x + 0.4 + rand(s) * (hab.w - 0.8);
      y = hab.y + 0.4 + rand(s) * (hab.h - 0.8);
    }
    a.act = { type: pickd.type, item: pickd.item ? pickd.item.id : null, until: s.t + dur };
    a.x = Math.round(x * 100) / 100;
    a.y = Math.round(y * 100) / 100;
    if (pickd.type !== 'roam' && pickd.type !== 'follow') s.seen[pickd.type] = true;
    if (pickd.item && D.ITEMS[pickd.item.k].cat === 'species_enrichment' && !pickd.item.used) {
      pickd.item.used = true;
      news(s, `${sp.emoji} ${a.name} tried the new ${D.ITEMS[pickd.item.k].name.toLowerCase()}!`, 'info', { animal: a.id });
    }
  }

  // ---------- the zoo's pull ----------
  function refresh(s) {
    const stats = new Map();
    for (const h of s.habs) stats.set(h.id, habStats(s, h));
    let appeal = 0,
      comfort = 0;
    const amenities = new Set();
    for (const a of s.animals) {
      const st = stats.get(a.hab);
      if (!st || !st.access) continue;
      appeal += D.SPECIES[a.sp].appeal * (0.3 + (0.7 * a.wb) / 100) * B.tierAppeal[st.tier] * (a.stage === 'baby' ? B.babyAppeal : 1);
    }
    for (const h of s.habs) {
      const st = stats.get(h.id);
      if (st.access) appeal += st.view / 10 + (st.education + st.appearance) / 10;
    }
    for (const b of s.builds) {
      const def = D.BUILDS[b.k];
      if (!def || !besidePath(s, b.x, b.y, 1, 1)) continue;
      appeal += def.appeal || 0;
      comfort += def.comfort || 0;
      if (def.kind === 'shop') amenities.add(b.k);
    }
    s.care = s.animals.length ? Math.round(s.animals.reduce((n, a) => n + a.wb, 0) / s.animals.length) : 0;
    const { reached } = map(s);
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
    s.tiers = {};
    for (const [id, st] of stats) s.tiers[id] = st.tier;
    return stats;
  }
  const priceMult = (s) => clamp(1.5 - (0.5 * s.price) / Math.max(1, s.fair || B.fairPriceBase), 0, 1.5);

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
    const before = stageIndex(s);
    s.rep = Math.max(0, s.rep + n);
    const after = stageIndex(s);
    if (after > before) {
      const st = D.STAGES[after];
      news(s, `🎉 Your zoo is now "${st.name}"! ${st.text}`, 'stage');
    }
  }
  // Running costs for one day: wages, upkeep of buildings and land, and each animal by life stage.
  function dailyCosts(s) {
    const wages = Object.keys(D.STAFF).reduce((n, r) => n + s.staff[r] * D.STAFF[r].wage, 0);
    const buildings = s.builds.reduce((n, b) => n + ((D.BUILDS[b.k] && D.BUILDS[b.k].upkeep) || 0), 0);
    const land = s.land.length * B.landUpkeep;
    const animals = Math.round(s.animals.reduce((n, a) => n + D.SPECIES[a.sp].upkeep * D.SPECIES[a.sp].upkeepMult[a.stage], 0));
    return { wages, buildings, land, animals, total: wages + buildings + land + animals };
  }

  // ---------- the market ----------
  function makeOffer(s, sp, sex) {
    return {
      id: 'o' + s.nextId++,
      sp,
      sex: sex || (rand(s) < 0.5 ? 'f' : 'm'),
      trait: pick(s, Object.keys(D.TRAITS)),
      price: D.SPECIES[sp].buy,
    };
  }
  // Six listings, refreshed each day: mostly species you have a home for, plus a few to tempt you.
  function rollMarket(s) {
    const open = Object.keys(D.SPECIES).filter((k) => unlocked(s, D.SPECIES[k].stage));
    const homes = new Set(s.habs.map((h) => h.sp));
    const options = open.map((k) => ({ w: homes.has(k) ? 4 : 1, k }));
    s.market = { day: s.day, offers: [] };
    for (let i = 0; i < B.offerCount; i++) s.market.offers.push(makeOffer(s, weighted(s, options).k));
  }
  const salePrice = (a) => Math.floor(D.SPECIES[a.sp].buy * B.saleFraction);
  // Why this animal can't be sold, or null.
  function sellProblem(s, a) {
    if (!a) return 'Who?';
    if (a.stage !== 'adult') return `${a.name} is too young to go to a new home.`;
    if (inEvent(s, a)) return `${a.name} is expecting. Wait for the little one to arrive.`;
    if (dependents(s, a).length) return `${a.name} is looking after ${dependents(s, a)[0].name}.`;
    return null;
  }
  function moveProblem(s, a, to) {
    if (!a) return 'Who?';
    if (!to) return 'Pick an enclosure.';
    if (to.id === a.hab) return 'They already live there.';
    if (to.sp !== a.sp) return `That's a ${D.SPECIES[to.sp].name.toLowerCase()} enclosure.`;
    if (a.stage !== 'adult' && a.caregiver && animalById(s, a.caregiver))
      return `Move ${animalById(s, a.caregiver).name}: little ones go with their parent.`;
    if (inEvent(s, a)) return `${a.name} is expecting. Wait until the baby arrives.`;
    const group = 1 + dependents(s, a).length;
    if (habStats(s, to).free < group) return `Not enough room there for ${group === 1 ? a.name : 'the whole family'}.`;
    return null;
  }

  // ---------- breeding (pack: BREEDING-AND-TRADING) ----------
  // disabled → checking → ready → expecting/incubating → newborn → cooldown → ready
  function readiness(s, hab) {
    const sp = D.SPECIES[hab.sp];
    const st = habStats(s, hab);
    const [a, b] = (hab.breeding.pair || []).map((id) => animalById(s, id));
    const checks = [];
    const pairWhy = (() => {
      if (!a || !b || a.hab !== hab.id || b.hab !== hab.id) return 'Choose two adults who live here.';
      if (a.stage !== 'adult' || b.stage !== 'adult') return 'Both need to be grown up.';
      if (a.sex === b.sex) return 'Choose one female and one male.';
      if (related(a, b)) return `${a.name} and ${b.name} are family.`;
      if (inEvent(s, a) || inEvent(s, b)) return 'One of them is already expecting.';
      if (s.day < a.cooldownDay || s.day < b.cooldownDay)
        return `Resting after their last baby until day ${Math.max(a.cooldownDay, b.cooldownDay)}.`;
      return null;
    })();
    checks.push({ id: 'pair', ok: !pairWhy, text: pairWhy || `${a.name} and ${b.name}` });
    const careOk = a && b && [a, b].every((p) => p.goodDays >= B.breedReadyDays && p.health >= B.healthyAt);
    checks.push({
      id: 'care',
      ok: !!careOk,
      text: careOk ? 'Both well cared for' : `Both need wellbeing ${sp.wellbeingMin}+ for ${B.breedReadyDays} days in a row`,
    });
    const nurseryOk = !sp.nursery || (st.nursery > 0 && st.access);
    checks.push({ id: 'nursery', ok: nurseryOk, text: nurseryOk ? 'Nursery ready' : 'Add a nursery nook (and keeper access)' });
    checks.push({
      id: 'room',
      ok: st.free >= 1,
      text: st.free >= 1 ? `Room for one more (${st.free} free)` : 'No room for a baby to grow up: add space, shelter, food or water',
    });
    return { checks, ok: hab.breeding.on && checks.every((c) => c.ok), on: hab.breeding.on };
  }
  function deliver(s, e) {
    const hab = habById(s, e.hab);
    if (animalById(s, e.child)) return (e.done = true); // already arrived (a replay after reload does nothing)
    if (!hab) return; // the enclosure is gone; the arrival waits safely
    const parents = e.parents.map((id) => animalById(s, id) || s.departed.find((d) => d.id === id)).filter(Boolean);
    const mum = parents.find((p) => p.sex === 'f') || parents[0];
    const sp = D.SPECIES[hab.sp];
    const baby = newAnimal(s, hab.sp, hab, {
      id: e.child,
      stage: 'baby',
      parents: parents.map((p) => ({ id: p.id, parents: p.parents || [] })),
    });
    if (mum && animalById(s, mum.id) && sp.follow !== 'independent_hatchling') baby.caregiver = mum.id;
    baby.x = mum && animalById(s, mum.id) ? mum.x : baby.x;
    baby.y = mum && animalById(s, mum.id) ? mum.y : baby.y;
    e.done = true;
    e.doneDay = s.day;
    for (const p of parents) if (animalById(s, p.id)) animalById(s, p.id).cooldownDay = s.day + sp.days.cooldown;
    s.stats.babies++;
    s.today.babies.push(baby.id);
    s.reveal.push(baby.id);
    s.album.push({ id: baby.id, sp: hab.sp, name: baby.name, day: s.day, parents: baby.parents.slice() });
    if (s.album.length > 100) s.album.shift();
    news(
      s,
      `${sp.egg ? '🥚' : '🍼'} ${sp.egg ? 'A chick has hatched' : 'A baby has arrived'}! Say hello to ${baby.name} the ${sp.name.toLowerCase()}.`,
      'baby',
      { animal: baby.id }
    );
  }

  // ---------- one second of zoo time ----------
  function tick(s) {
    s.t++;
    const stats = refresh(s);
    for (const hab of s.habs) {
      const st = stats.get(hab.id);
      const herd = residents(s, hab);
      const eat = herd.reduce(
        (n, a) => n + ((D.TRAITS[a.trait] || {}).eat || 1) * (a.stage === 'baby' ? 0.5 : a.stage === 'juvenile' ? 0.75 : 1),
        0
      );
      if (st.feed > 0) hab.food = Math.max(0, hab.food - eat * B.hungerPerSec);
      for (const a of herd) {
        const n = needs(s, a, st);
        a.needsCache = n;
        a.wb = clamp(a.wb + (n.target - a.wb) * B.wellbeingRate, 0, 100);
        a.health = clamp(a.health + (n.food < 20 || n.water < 20 ? -0.1 : 0.05), 0, 100);
        a.wbSum += a.wb;
        a.wbN++;
        if (!a.act || s.t >= a.act.until || !actionStillValid(s, a, hab)) chooseAction(s, a, hab, st);
        if (hab.poop.length < B.maxPoop && rand(s) < B.poopChance)
          hab.poop.push({ id: s.nextId++, x: hab.x + rand(s) * hab.w, y: hab.y + rand(s) * hab.h });
        if (s.opened && st.access) gainRep(s, (B.repPerResident * (a.wb - 50)) / 50);
        delete a.needsCache;
      }
    }
    for (const e of s.events) if (!e.done && s.t >= e.due) deliver(s, e);

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
      if (!def || def.kind !== 'shop' || !def.spend || !besidePath(s, b.x, b.y, 1, 1)) continue;
      const bonus = b.k === 'gifts' ? 1 + variety * 0.1 : 1;
      earn(s, Math.min(s.guests, def.seats) * B.shopEveryGuest * def.spend * bonus * (0.5 + s.enjoy / 2), 'shops');
    }

    // Keepers do their rounds through keeper gates: the enclosures that need it most first.
    if (s.staff.keeper && s.t % B.keeperEvery === 0) {
      const round = s.habs
        .filter((h) => stats.get(h.id).access && residents(s, h).length)
        .sort((a, b) => a.food - b.food - (a.poop.length - b.poop.length) * 10)
        .slice(0, s.staff.keeper * B.keeperHabitats);
      for (const h of round) {
        if (h.food < B.keeperFeedBelow) h.food = 100;
        h.poop.splice(0, 2);
      }
    }
    if (s.t % B.dayLength === 0) endDay(s);
  }
  function actionStillValid(s, a, hab) {
    if (!a.act) return false;
    if (a.act.item && !hab.items.some((i) => i.id === a.act.item)) return false; // the prop went away
    return a.x >= hab.x && a.x <= hab.x + hab.w && a.y >= hab.y && a.y <= hab.y + hab.h;
  }

  function endDay(s) {
    const costs = dailyCosts(s);
    s.coins -= costs.total;
    if (s.coins < 0) news(s, 'The zoo is in the red! Raise ticket prices, sell an animal or cut back on staff.', 'warn');

    // Care streaks (for breeding readiness) and growing up.
    for (const a of s.animals) {
      const sp = D.SPECIES[a.sp];
      const avg = a.wbN ? a.wbSum / a.wbN : a.wb;
      a.goodDays = avg >= sp.wellbeingMin ? a.goodDays + 1 : 0;
      a.wbSum = 0;
      a.wbN = 0;
      if (a.stage === 'adult') continue;
      a.stageDays++;
      if (a.stage === 'baby' && a.stageDays >= sp.days.baby) {
        a.stage = 'juvenile';
        a.stageDays = 0;
        news(s, `${sp.emoji} ${a.name} is growing up fast: now a juvenile!`, 'info', { animal: a.id });
      } else if (a.stage === 'juvenile' && a.stageDays >= sp.days.juvenile) {
        a.stage = 'adult';
        a.stageDays = 0;
        a.caregiver = null;
        news(s, `${sp.emoji} ${a.name} is all grown up.`, 'info', { animal: a.id });
      }
    }
    s.events = s.events.filter((e) => !e.done || s.day - e.doneDay < 1);

    const t = s.today;
    s.report = {
      day: s.day,
      guests: t.guests,
      tickets: Math.floor(t.tickets),
      shops: Math.floor(t.shops),
      bought: t.bought,
      sold: t.sold,
      ...costs,
      net: Math.floor(t.tickets + t.shops + t.sold - t.bought - costs.total),
      babies: t.babies,
      care: s.care,
    };
    s.day++;
    s.today = blankDay();
    rollMarket(s);
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
    if (n.named !== undefined) return !!s.name;
    if (n.opened !== undefined) return s.opened;
    if (n.stat !== undefined) return s.stats[n.stat] >= n.n;
    if (n.enclosure !== undefined) return s.habs.some((h) => h.sp === n.enclosure);
    if (n.access !== undefined) return s.habs.some((h) => habStats(s, h).access);
    if (n.tier !== undefined) return s.habs.some((h) => habStats(s, h).tier >= n.tier);
    if (n.species !== undefined) return s.animals.filter((a) => a.sp === n.species).length >= n.n;
    if (n.seen !== undefined) return !!s.seen[n.seen];
    if (n.staff !== undefined) return s.staff[n.staff] >= n.n;
    if (n.kind !== undefined) return s.builds.filter((b) => D.BUILDS[b.k] && D.BUILDS[b.k].kind === n.kind).length >= n.n;
    if (n.rep !== undefined) return s.rep >= n.rep;
    if (n.animals !== undefined) return s.animals.length >= n.animals;
    return false;
  }
  const currentGoal = (s) => D.GOALS[s.goal] || null;

  // ---------- player actions ----------
  // Each handler checks everything with need() first, then changes state, so a refused action
  // never leaves anything half done. Money-moving actions take a `tx` id: a repeat is a no-op.
  const habOf = (s, id) => {
    const h = habById(s, id);
    need(h, 'Pick an enclosure.');
    return h;
  };
  const doneTx = (s, tx) => typeof tx === 'string' && s.tx.includes(tx);
  function recordTx(s, tx) {
    if (typeof tx !== 'string') return;
    s.tx.push(tx);
    if (s.tx.length > B.txMemory) s.tx.shift();
  }
  const H = {
    name(s, { name }) {
      const clean = cleanText(name, 28);
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
      if (def.kind === 'path') {
        s.paths.push(idx(x, y));
        s.stats.paths++;
      } else s.builds.push({ id: s.nextId++, k, x, y });
      touch(s);
      s.lastBuild = { kind: 'build', k, x, y, t: s.t, cost: def.cost };
      return {};
    },
    bulldoze(s, { x, y }) {
      const t = tileAt(s, x, y);
      need(t, 'Nothing to clear there.');
      need(t !== 'gate', 'The gate stays. Guests need a way in!');
      need(!t.startsWith('h:'), 'Open the enclosure to change what is inside it.');
      let back;
      if (t === 'path') {
        s.paths = s.paths.filter((p) => p !== idx(x, y));
        back = Math.floor(D.BUILDS.path.cost * B.refund);
      } else {
        const b = buildById(s, +t.slice(2));
        back = Math.floor((D.BUILDS[b.k] ? D.BUILDS[b.k].cost : D.ITEMS[b.k].price) * B.refund);
        s.builds = s.builds.filter((o) => o !== b);
      }
      s.coins += back;
      touch(s);
      s.lastBuild = null;
      return { coins: back };
    },
    // Takes back the last thing placed, for a full refund, if it's recent and nothing depends on it.
    undo(s) {
      const lb = s.lastBuild;
      need(lb && s.t - lb.t <= B.undoSeconds, 'Nothing to undo.');
      if (lb.kind === 'build') {
        const t = tileAt(s, lb.x, lb.y);
        need(t && t !== 'gate' && !t.startsWith('h:'), 'Nothing to undo.');
        if (t === 'path') {
          s.paths = s.paths.filter((p) => p !== idx(lb.x, lb.y));
          s.stats.paths = Math.max(0, s.stats.paths - 1);
        } else s.builds = s.builds.filter((b) => b.id !== +t.slice(2));
      } else if (lb.kind === 'enclosure') {
        const hab = habById(s, lb.id);
        need(hab && !residents(s, hab).length && !hab.items.length, 'Someone has moved in already!');
        s.habs = s.habs.filter((h) => h !== hab);
      } else if (lb.kind === 'item') {
        const hab = habById(s, lb.hab);
        const outside = s.builds.find((b) => b.id === lb.id);
        need((hab && hab.items.some((i) => i.id === lb.id)) || outside, 'Nothing to undo.');
        if (outside) s.builds = s.builds.filter((b) => b !== outside);
        else hab.items = hab.items.filter((i) => i.id !== lb.id);
      }
      s.coins += lb.cost;
      s.lastBuild = null;
      touch(s);
      return { coins: lb.cost };
    },
    enclose(s, { sp, x, y, w, h }) {
      need(has(D.SPECIES, sp), 'Unknown animal.');
      need(unlocked(s, D.SPECIES[sp].stage), `${D.SPECIES[sp].name}s unlock at "${stageOf(D.SPECIES[sp].stage).name}".`);
      const out = {};
      const why = rectProblem(s, x, y, w, h, null, out);
      need(!why, why);
      spend(s, out.cost);
      const hab = { id: s.nextId++, sp, x, y, w, h, items: [], food: 100, poop: [], breeding: { on: false, pair: [] }, cost: out.cost };
      s.habs.push(hab);
      touch(s);
      s.lastBuild = { kind: 'enclosure', id: hab.id, t: s.t, cost: out.cost };
      return { hab: hab.id, cost: out.cost };
    },
    // Keeps the same enclosure (and ID, residents, family and props); charges for new fence and ground.
    resize(s, { hab: id, x, y, w, h }) {
      const hab = habOf(s, id);
      const out = {};
      const why = resizeProblem(s, hab, x, y, w, h, out);
      need(!why, why);
      spend(s, out.cost);
      Object.assign(hab, { x, y, w, h });
      hab.cost += out.cost;
      for (const a of residents(s, hab)) a.act = null; // choose again inside the new fence
      hab.poop = hab.poop.filter((p) => p.x >= x && p.x < x + w && p.y >= y && p.y < y + h);
      touch(s);
      return { cost: out.cost };
    },
    demolish(s, { hab: id }) {
      const hab = habOf(s, id);
      need(!residents(s, hab).length, 'Find the animals a new home first.');
      need(!s.events.some((e) => e.hab === hab.id && !e.done), 'A baby is on the way here.');
      const back = Math.floor((hab.cost + hab.items.reduce((n, i) => n + D.ITEMS[i.k].price, 0)) * B.refund);
      s.habs = s.habs.filter((h) => h !== hab);
      for (const b of s.builds) if (b.hab === hab.id) b.hab = null;
      s.coins += back;
      touch(s);
      return { coins: back };
    },
    place(s, { hab: id, item: k, x, y, r = 0 }) {
      const hab = habOf(s, id);
      const why = placeProblem(s, hab, k, x, y, r);
      need(!why, why);
      const def = D.ITEMS[k];
      spend(s, def.price);
      const it = { id: s.nextId++, k, x, y, r, placedAt: s.t };
      if (def.place === 'outside') s.builds.push({ ...it, hab: hab.id });
      else hab.items.push({ ...it, used: false });
      touch(s);
      s.lastBuild = { kind: 'item', id: it.id, hab: hab.id, t: s.t, cost: def.price };
      return { id: it.id };
    },
    removeItem(s, { hab: id, item }) {
      const hab = habOf(s, id);
      const it = hab.items.find((i) => i.id === item);
      need(it, 'Not there.');
      const def = D.ITEMS[it.k];
      need(
        !(def.template === 'nursery' && s.events.some((e) => e.hab === hab.id && !e.done)),
        'The nursery is in use: a baby is on the way.'
      );
      const after = habStats(
        s,
        hab,
        hab,
        hab.items.filter((i) => i !== it)
      );
      if (['shelter', 'feeder', 'water'].includes(def.template))
        need(
          after.supported >= after.residents + after.reserved || after.residents === 0,
          `Everyone still needs it. Add another ${def.template} first.`
        );
      hab.items = hab.items.filter((i) => i !== it);
      const back = Math.floor(def.price * B.refund);
      s.coins += back;
      touch(s);
      return { coins: back };
    },
    feed(s, { hab: id }) {
      const hab = habOf(s, id);
      const st = habStats(s, hab);
      need(st.access, "Keepers can't get in: add a keeper gate next to a path.");
      need(st.feed > 0, 'There is no feeder to fill.');
      need(hab.food < 95, 'The feeder is already full.');
      hab.food = 100;
      return {};
    },
    clean(s, { hab: id, poop }) {
      const hab = habOf(s, id);
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
      s.stats.hellos++;
      gainRep(s, B.repHello);
      return {};
    },
    buyLand(s, { cx, cy, tx }) {
      if (doneTx(s, tx)) return { duplicate: true };
      const why = landProblem(s, cx, cy);
      need(!why, why);
      const price = landPrice(s);
      spend(s, price);
      s.land.push(chunkKey(cx, cy));
      s.landBought++;
      s.stats.land++;
      recordTx(s, tx);
      touch(s);
      news(s, `🗺️ New land! Daily upkeep is now ${s.land.length * B.landUpkeep} coins for ${s.land.length} plots.`, 'stage');
      return { price };
    },
    buy(s, { offer, hab: id, tx }) {
      if (doneTx(s, tx)) return { duplicate: true };
      const o = s.market.offers.find((x) => x.id === offer);
      need(o, 'That animal has already found a home.');
      const sp = D.SPECIES[o.sp];
      need(unlocked(s, sp.stage), `${sp.name}s unlock at "${stageOf(sp.stage).name}".`);
      const hab = habOf(s, id);
      need(hab.sp === o.sp, `That's a ${D.SPECIES[hab.sp].name.toLowerCase()} enclosure.`);
      need(habStats(s, hab).free >= 1, 'No room: add space, shelter, a feeder or water first.');
      need(s.coins >= o.price, `You need ${o.price} coins.`);
      // checks done: commit everything together
      s.coins -= o.price;
      s.today.bought += o.price;
      s.market.offers = s.market.offers.filter((x) => x !== o);
      const a = newAnimal(s, o.sp, hab, { sex: o.sex, trait: o.trait });
      s.stats.bought++;
      recordTx(s, tx);
      news(s, `${sp.emoji} Welcome, ${a.name}! (${a.sex === 'f' ? 'female' : 'male'}, ${D.TRAITS[a.trait].name.toLowerCase()})`, 'baby', {
        animal: a.id,
      });
      return { animal: a.id, name: a.name };
    },
    sell(s, { animal, tx }) {
      if (doneTx(s, tx)) return { duplicate: true };
      const a = animalById(s, animal);
      const why = sellProblem(s, a);
      need(!why, why);
      const value = salePrice(a);
      s.animals = s.animals.filter((o) => o !== a);
      s.departed.push({ id: a.id, sp: a.sp, name: a.name, sex: a.sex, parents: a.parents, ancestors: a.ancestors, day: s.day });
      if (s.departed.length > 300) s.departed.shift();
      for (const h of s.habs) h.breeding.pair = h.breeding.pair.filter((p) => p !== a.id);
      earn(s, value);
      s.today.sold += value;
      s.stats.sold++;
      recordTx(s, tx);
      news(s, `${a.name} went to a lovely new home.`, 'info');
      return { coins: value };
    },
    move(s, { animal, hab: id }) {
      const a = animalById(s, animal);
      const to = habById(s, id);
      const why = moveProblem(s, a, to);
      need(!why, why);
      for (const m of [a, ...dependents(s, a)]) {
        m.hab = to.id;
        m.act = null;
        m.x = to.x + to.w / 2;
        m.y = to.y + to.h / 2;
      }
      for (const h of s.habs) h.breeding.pair = h.breeding.pair.filter((p) => p !== a.id);
      return {};
    },
    breeding(s, { hab: id, on }) {
      const hab = habOf(s, id);
      hab.breeding.on = !!on; // switching off never cancels a baby already on the way
      return {};
    },
    pair(s, { hab: id, a, b }) {
      const hab = habOf(s, id);
      const pa = animalById(s, a),
        pb = animalById(s, b);
      need(pa && pb && pa.hab === hab.id && pb.hab === hab.id && a !== b, 'Choose two adults who live here.');
      hab.breeding.pair = [a, b];
      return {};
    },
    breed(s, { hab: id, tx }) {
      if (doneTx(s, tx)) return { duplicate: true };
      const hab = habOf(s, id);
      need(hab.breeding.on, 'Switch breeding on first.');
      const r = readiness(s, hab);
      const bad = r.checks.find((c) => !c.ok);
      need(!bad, bad && bad.text);
      const sp = D.SPECIES[hab.sp];
      const e = {
        id: s.nextId++,
        hab: hab.id,
        parents: hab.breeding.pair.slice(),
        child: s.nextId++,
        due: s.t + sp.days.pre * B.dayLength,
        egg: sp.egg,
        done: false,
      };
      s.events.push(e);
      s.stats.breedings++;
      recordTx(s, tx);
      news(s, `${sp.egg ? '🥚 An egg has been laid' : '💕 A baby is on the way'}! Due in ${sp.days.pre} days.`, 'baby');
      return { event: e.id };
    },
    hire(s, { role }) {
      need(has(D.STAFF, role), 'Unknown job.');
      const def = D.STAFF[role];
      need(unlocked(s, def.stage), `Unlocks at "${stageOf(def.stage).name}".`);
      need(s.staff[role] < 8, "That's plenty.");
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
      need(int(price) && price >= 0 && price <= 99, 'Pick a price from 0 to 99.');
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
      const clean = cleanText(name, 16);
      need(clean, 'Give them a name.');
      a.name = clean;
      const page = s.album.find((p) => p.id === a.id);
      if (page) page.name = clean;
      return {};
    },
    seen(s, { animal }) {
      s.reveal = s.reveal.filter((id) => id !== animal);
      return {};
    },
  };

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

  // ---------- saves ----------
  // Fills anything missing, drops anything that can't be trusted and upgrades old versions, so old
  // or hand-edited saves load instead of breaking the game.
  function load(data) {
    if (!data || typeof data !== 'object') return createState(1);
    if (data.v === 1 || Array.isArray(data.habitats)) return fromV1(data);
    const s = createState(num(data.seed, 1));
    for (const k of ['seed', 't', 'day', 'coins', 'rep', 'price', 'guests', 'arrive', 'goal', 'newsId', 'nextId', 'landBought'])
      s[k] = num(data[k], s[k]);
    s.seed = s.seed >>> 0;
    s.t = Math.max(0, Math.floor(s.t));
    s.day = Math.max(1, Math.floor(s.day));
    s.price = clamp(Math.floor(s.price), 0, 99);
    s.goal = clamp(Math.floor(s.goal), 0, D.GOALS.length);
    s.rep = Math.max(0, s.rep);
    s.name = cleanText(data.name, 28);
    s.opened = !!data.opened;
    s.event = D.EVENTS.some((e) => e.id === data.event) ? data.event : 'normal';
    for (const k in s.stats) s.stats[k] = num((data.stats || {})[k], 0);
    for (const r in D.STAFF) s.staff[r] = clamp(Math.floor(num((data.staff || {})[r], 0)), 0, 8);
    s.today = { ...blankDay(), ...(data.today && typeof data.today === 'object' ? data.today : {}) };
    if (!Array.isArray(s.today.babies)) s.today.babies = [];
    s.report = data.report && typeof data.report === 'object' ? data.report : null;
    s.news = Array.isArray(data.news) ? data.news.slice(-40) : [];
    s.seen = {};
    for (const k in data.seen || {}) if (typeof k === 'string' && k.length < 30) s.seen[k] = true;
    s.tx = (Array.isArray(data.tx) ? data.tx : []).filter((t) => typeof t === 'string').slice(-B.txMemory);
    s.departed = (Array.isArray(data.departed) ? data.departed : []).filter((d) => d && int(d.id)).slice(-300);
    s.album = (Array.isArray(data.album) ? data.album : []).filter((p) => p && int(p.id) && has(D.SPECIES, p.sp)).slice(-100);
    const land = new Set(s.land);
    for (const k of Array.isArray(data.land) ? data.land : []) {
      const m = /^(\d+),(\d+)$/.exec(String(k));
      if (m && +m[1] < B.maxChunks && +m[2] < B.maxChunks) land.add(k);
    }
    s.land = [...land];
    s.lastBuild = null;

    // The map is rebuilt from what's on it; anything that would land on something else is dropped.
    s.habs = [];
    s.builds = [];
    s.paths = [];
    touch(s);
    for (const h of Array.isArray(data.habs) ? data.habs : []) {
      if (!h || !int(h.id) || !has(D.SPECIES, h.sp)) continue;
      if (rectProblem({ ...s, coins: Infinity }, h.x, h.y, h.w, h.h, null)) continue;
      const hab = {
        id: h.id,
        sp: h.sp,
        x: h.x,
        y: h.y,
        w: h.w,
        h: h.h,
        items: [],
        food: clamp(num(h.food, 100), 0, 100),
        poop: [],
        breeding: { on: !!(h.breeding && h.breeding.on), pair: [] },
        cost: Math.max(0, num(h.cost, 0)),
      };
      s.habs.push(hab);
      touch(s);
      for (const it of Array.isArray(h.items) ? h.items : []) {
        if (!it || !int(it.id) || !has(D.ITEMS, it.k) || D.ITEMS[it.k].place === 'outside') continue;
        const r = [0, 90, 180, 270].includes(it.r) ? it.r : 0;
        if (placeProblem(s, hab, it.k, it.x, it.y, r, { loading: true })) continue;
        hab.items.push({ id: it.id, k: it.k, x: it.x, y: it.y, r, placedAt: num(it.placedAt, -999), used: !!it.used });
      }
      hab.poop = (Array.isArray(h.poop) ? h.poop : [])
        .filter((p) => p && int(p.id) && Number.isFinite(p.x) && Number.isFinite(p.y))
        .slice(0, B.maxPoop);
      if (h.breeding && Array.isArray(h.breeding.pair)) hab.breeding.pair = h.breeding.pair.filter(int).slice(0, 2);
    }
    for (const b of Array.isArray(data.builds) ? data.builds : []) {
      if (!b || !int(b.id)) continue;
      const item = D.ITEMS[b.k];
      if (!D.BUILDS[b.k] && !(item && item.place === 'outside')) continue;
      if (D.BUILDS[b.k] && D.BUILDS[b.k].kind === 'path') continue;
      const r = [0, 90, 180, 270].includes(b.r) ? b.r : 0;
      const [w, h] = item ? footprint(item, r) : [1, 1];
      if (!cellsOf(b.x, b.y, w, h).every(([cx, cy]) => owned(s, cx, cy) && !tileAt(s, cx, cy))) continue;
      s.builds.push({
        id: b.id,
        k: b.k,
        x: b.x,
        y: b.y,
        r,
        hab: item && s.habs.some((h) => h.id === b.hab) ? b.hab : item ? null : undefined,
        placedAt: num(b.placedAt, -999),
      });
      touch(s);
    }
    for (const p of Array.isArray(data.paths) ? data.paths : []) {
      if (!int(p) || p < 0 || p >= SIZE * SIZE) continue;
      const x = p % SIZE,
        y = Math.floor(p / SIZE);
      if (owned(s, x, y) && !tileAt(s, x, y)) {
        s.paths.push(p);
        touch(s);
      }
    }
    s.animals = [];
    for (const a of Array.isArray(data.animals) ? data.animals : []) {
      if (!a || !int(a.id) || !has(D.SPECIES, a.sp)) continue;
      const hab = s.habs.find((h) => h.id === a.hab && h.sp === a.sp);
      if (!hab || s.animals.some((o) => o.id === a.id)) continue;
      s.animals.push({
        id: a.id,
        sp: a.sp,
        name: cleanText(a.name, 16) || D.SPECIES[a.sp].example,
        sex: a.sex === 'm' ? 'm' : 'f',
        stage: ['baby', 'juvenile', 'adult'].includes(a.stage) ? a.stage : 'adult',
        stageDays: Math.max(0, Math.floor(num(a.stageDays, 0))),
        parents: (Array.isArray(a.parents) ? a.parents : []).filter(int).slice(0, 2),
        ancestors: (Array.isArray(a.ancestors) ? a.ancestors : []).filter(int).slice(0, 6),
        trait: has(D.TRAITS, a.trait) ? a.trait : 'sociable',
        wb: clamp(num(a.wb, 60), 0, 100),
        health: clamp(num(a.health, 100), 0, 100),
        hab: hab.id,
        caregiver: int(a.caregiver) ? a.caregiver : null,
        cooldownDay: Math.max(0, num(a.cooldownDay, 0)),
        goodDays: Math.max(0, Math.floor(num(a.goodDays, 0))),
        wbSum: Math.max(0, num(a.wbSum, 0)),
        wbN: Math.max(0, Math.floor(num(a.wbN, 0))),
        helloAt: num(a.helloAt, -999),
        act:
          a.act && typeof a.act === 'object' && typeof a.act.type === 'string'
            ? { type: a.act.type.slice(0, 24), item: int(a.act.item) ? a.act.item : null, until: num(a.act.until, 0) }
            : null,
        x: clamp(num(a.x, hab.x + hab.w / 2), hab.x, hab.x + hab.w),
        y: clamp(num(a.y, hab.y + hab.h / 2), hab.y, hab.y + hab.h),
        born: num(a.born, s.day),
      });
    }
    for (const a of s.animals) if (a.caregiver && !animalById(s, a.caregiver)) a.caregiver = null;
    s.events = [];
    for (const e of Array.isArray(data.events) ? data.events : []) {
      if (!e || !int(e.id) || !int(e.child) || !s.habs.some((h) => h.id === e.hab) || !Array.isArray(e.parents)) continue;
      const done = !!e.done || !!animalById(s, e.child); // never deliver the same baby twice
      s.events.push({
        id: e.id,
        hab: e.hab,
        parents: e.parents.filter(int).slice(0, 2),
        child: e.child,
        due: num(e.due, s.t),
        egg: !!e.egg,
        done,
        doneDay: num(e.doneDay, s.day),
      });
    }
    s.reveal = (Array.isArray(data.reveal) ? data.reveal : []).filter((id) => animalById(s, id));
    const offers = data.market && Array.isArray(data.market.offers) ? data.market.offers : null;
    if (offers)
      s.market = {
        day: num(data.market.day, s.day),
        offers: offers
          .filter((o) => o && typeof o.id === 'string' && has(D.SPECIES, o.sp))
          .map((o) => ({
            id: o.id,
            sp: o.sp,
            sex: o.sex === 'm' ? 'm' : 'f',
            trait: has(D.TRAITS, o.trait) ? o.trait : 'sociable',
            price: D.SPECIES[o.sp].buy,
          })),
      };
    const ids = [
      ...s.habs.flatMap((h) => [h.id, ...h.items.map((i) => i.id), ...h.poop.map((p) => p.id)]),
      ...s.builds.map((b) => b.id),
      ...s.animals.map((a) => a.id),
      ...s.events.flatMap((e) => [e.id, e.child]),
      ...s.departed.map((d) => d.id),
    ];
    const offerIds = s.market.offers.map((o) => parseInt(o.id.slice(1), 10)).filter(Number.isFinite);
    s.nextId = Math.max(Math.floor(s.nextId), Math.max(0, ...ids, ...offerIds) + 1);
    s.rev = Math.max(0, Math.floor(num(data.rev, 0))) % 1e9; // only a cache key; any value works
    s.v = SCHEMA;
    refresh(s);
    return s;
  }
  // Version 1 zoos lived on a small 16×14 map with different animals. The map and species can't be
  // carried across, so the zoo keeps its name, day, reputation and history, and everything it owned
  // is sold back generously so the player can rebuild in the bigger park. (The front end keeps a
  // backup copy of the old save before upgrading.)
  function fromV1(data) {
    const s = createState(num(data.seed, 1));
    const animals = Array.isArray(data.animals) ? data.animals.length : 0;
    const habitats = Array.isArray(data.habitats) ? data.habitats.length : 0;
    const builds = Array.isArray(data.builds) ? data.builds.length : 0;
    const paths = Array.isArray(data.tiles) ? data.tiles.filter((t) => t === 'path').length : 0;
    s.name = cleanText(data.name, 28);
    s.day = Math.max(1, Math.floor(num(data.day, 1)));
    s.rep = Math.max(0, num(data.rep, 0));
    s.price = clamp(Math.floor(num(data.price, 8)), 0, 99);
    s.stats.guests = Math.max(0, num((data.stats || {}).guests, 0));
    s.stats.earned = Math.max(0, num((data.stats || {}).earned, 0));
    s.compensation = 400 * animals + 300 * habitats + 100 * builds + 5 * paths;
    s.coins = B.startCoins + Math.max(0, num(data.coins, 0)) + s.compensation;
    s.migratedFrom = 1;
    news(
      s,
      `🚚 ${s.name || 'Your zoo'} has moved to a much bigger park! Your old zoo was sold back for ${s.compensation} coins so you can build it bigger and better.`,
      'stage'
    );
    refresh(s);
    return s;
  }

  const Sim = {
    SCHEMA,
    SIZE,
    TIER_NAMES,
    createState,
    tick,
    apply,
    load,
    refresh,
    map,
    tileAt,
    owned,
    idx,
    footprint,
    habStats,
    needs,
    mood,
    problem,
    priorityItem,
    placeProblem,
    rectProblem,
    resizeProblem,
    landProblem,
    landForSale,
    landPrice,
    buildProblem,
    readiness,
    related,
    sellProblem,
    moveProblem,
    salePrice,
    dependents,
    inEvent,
    dailyCosts,
    goalDone,
    currentGoal,
    priceMult,
    stage,
    unlocked,
    stageOf,
    residents,
    habById,
    buildById,
    animalById,
    besidePath,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
  root.ZooSim = Sim;
})(typeof globalThis !== 'undefined' ? globalThis : this);
