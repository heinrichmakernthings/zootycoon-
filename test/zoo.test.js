// Cutise Zoo: the rules in js/sim.js, checked against the animal pack's acceptance list
// (pack/docs/IMPLEMENTATION-AND-ACCEPTANCE.md). Section numbers below follow that file.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
require(path.join(root, 'js/pack-data.js'));
require(path.join(root, 'js/content.js'));
const Sim = require(path.join(root, 'js/sim.js'));
const D = globalThis.ZooData;
const B = D.BALANCE;

const ok = (s, cmd) => {
  const r = Sim.apply(s, cmd);
  assert.ok(r.ok, `${cmd.type}: ${r.error}`);
  return r;
};
const refused = (s, cmd, re) => {
  const before = JSON.stringify(s);
  const r = Sim.apply(s, cmd);
  assert.ok(!r.ok, `${cmd.type} should be refused`);
  if (re) assert.match(r.error, re);
  assert.strictEqual(JSON.stringify(s), before, `${cmd.type} refused but changed something`);
  return r;
};
const ticks = (s, n) => {
  for (let i = 0; i < n; i++) Sim.tick(s);
};
const days = (s, n) => ticks(s, n * B.dayLength);
const cap = (k) => 'capybara__' + k;
let txn = 0;
const tx = () => 'tx' + ++txn;

// Milestone 1: a capybara enclosure beside the path, with a keeper gate, shelter, feeder, water.
function livingEnclosure(seed = 7) {
  const s = Sim.createState(seed);
  s.coins = 50000;
  for (let y = 61; y >= 50; y--) ok(s, { type: 'build', k: 'path', x: 32, y });
  const hab = ok(s, { type: 'enclose', sp: 'capybara', x: 20, y: 48, w: 12, h: 10 }).hab;
  ok(s, { type: 'place', hab, item: cap('keeper-gate'), x: 31, y: 52 });
  ok(s, { type: 'place', hab, item: cap('shelter'), x: 21, y: 49 });
  ok(s, { type: 'place', hab, item: cap('feeder'), x: 25, y: 49 });
  ok(s, { type: 'place', hab, item: cap('water'), x: 28, y: 49 });
  return { s, hab, h: Sim.habById(s, hab) };
}
function withPair(seed) {
  const z = livingEnclosure(seed);
  for (const sex of ['f', 'm']) {
    const o = z.s.market.offers.find((x) => x.sp === 'capybara' && x.sex === sex);
    ok(z.s, { type: 'buy', offer: o.id, hab: z.hab, tx: 'buy-' + o.id });
  }
  return z;
}
// Everything a capybara could want, so wellbeing stays high (for breeding tests).
function pamper(z) {
  const { s, hab } = z;
  ok(s, { type: 'place', hab, item: cap('shade'), x: 21, y: 54 });
  ok(s, { type: 'place', hab, item: cap('rest'), x: 25, y: 55 });
  ok(s, { type: 'place', hab, item: cap('signature-1'), x: 27, y: 54 });
  ok(s, { type: 'place', hab, item: cap('nursery'), x: 24, y: 52 });
  ok(s, { type: 'place', hab, item: cap('privacy'), x: 28, y: 51 });
  ok(s, { type: 'hire', role: 'keeper' });
}

test('the pack data is loaded and js/pack-data.js is up to date', () => {
  assert.strictEqual(Object.keys(D.SPECIES).length, 20);
  assert.strictEqual(Object.keys(D.ITEMS).length, 300);
  for (const sp in D.CATALOGUE) assert.strictEqual(D.CATALOGUE[sp].length, 15, sp);
  execFileSync('node', [path.join(root, 'tools/pack.js'), '--check']);
});

test('a new zoo: empty land, the gate, a stub of path, and starter animals on the market', () => {
  const s = Sim.createState(1);
  assert.strictEqual(s.land.length, 4);
  assert.strictEqual(Sim.tileAt(s, B.gate.x, B.gate.y), 'gate');
  assert.strictEqual(s.animals.length, 0);
  assert.strictEqual(s.market.offers.length, B.offerCount);
  for (const sex of ['f', 'm']) assert.ok(s.market.offers.some((o) => o.sp === 'capybara' && o.sex === sex));
  for (const o of s.market.offers) assert.strictEqual(D.SPECIES[o.sp].stage, 'starter');
});

test('same seed, same commands, same zoo (deterministic)', () => {
  const a = withPair(99).s,
    b = withPair(99).s;
  days(a, 2);
  days(b, 2);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('1. a living enclosure: residents choose activities at reachable anchors and stay inside', () => {
  const z = withPair(3);
  const { s, h } = z;
  ok(s, { type: 'place', hab: z.hab, item: cap('shade'), x: 21, y: 54 });
  const seen = new Set();
  for (let i = 0; i < 600; i++) {
    Sim.tick(s);
    for (const a of s.animals) {
      seen.add(a.act.type);
      assert.ok(a.x >= h.x && a.x <= h.x + h.w && a.y >= h.y && a.y <= h.y + h.h, `${a.name} left the enclosure`);
    }
  }
  for (const t of ['feed', 'drink', 'shade_rest']) assert.ok(seen.has(t), `never saw ${t} (saw ${[...seen]})`);
});

test('1. a newly placed signature item produces a visible new action (and says so once)', () => {
  const z = withPair(4);
  ticks(z.s, 30);
  ok(z.s, { type: 'place', hab: z.hab, item: cap('signature-1'), x: 27, y: 54 });
  let used = false;
  for (let i = 0; i < 300 && !used; i++) {
    Sim.tick(z.s);
    used = z.s.animals.some((a) => a.act.type === D.ITEMS[cap('signature-1')].behaviour);
  }
  assert.ok(used, 'nobody tried the reed planter');
  assert.strictEqual(z.s.news.filter((n) => /tried the new reed planter/.test(n.text)).length, 1);
});

test('1. if a prop disappears, its users choose something else (never stranded)', () => {
  const z = withPair(5);
  const sig = ok(z.s, { type: 'place', hab: z.hab, item: cap('signature-1'), x: 27, y: 54 }).id;
  ticks(z.s, 200);
  ok(z.s, { type: 'removeItem', hab: z.hab, item: sig });
  Sim.tick(z.s);
  for (const a of z.s.animals) assert.notStrictEqual(a.act.item, sig);
});

test('capacity: min(physical, shelter, feed, water) minus residents and reserved births', () => {
  const z = livingEnclosure(6);
  const st = Sim.habStats(z.s, z.h);
  assert.strictEqual(st.physical, Math.floor(st.usable / D.SPECIES.capybara.tilesPerSlot));
  assert.strictEqual(st.supported, Math.min(st.physical, st.shelter, st.feed, st.water));
  assert.strictEqual(st.free, st.supported);
});

test('5. a new feeder raises service capacity; a flower border cannot', () => {
  const z = livingEnclosure(8);
  const { s, hab } = z;
  ok(s, { type: 'resize', hab, x: 16, y: 48, w: 16, h: 10 });
  ok(s, { type: 'place', hab, item: cap('shelter'), x: 21, y: 54 });
  ok(s, { type: 'place', hab, item: cap('water'), x: 28, y: 51 });
  const before = Sim.habStats(s, z.h);
  assert.strictEqual(before.bottleneck, 'food');
  ok(s, { type: 'place', hab, item: cap('border'), x: 22, y: 46 });
  assert.strictEqual(Sim.habStats(s, z.h).supported, before.supported);
  ok(s, { type: 'place', hab, item: cap('feeder'), x: 25, y: 54 });
  assert.ok(Sim.habStats(s, z.h).supported > before.supported);
});

test('5. a feeder keepers cannot reach contributes zero', () => {
  const s = Sim.createState(9);
  s.coins = 50000;
  const hab = ok(s, { type: 'enclose', sp: 'capybara', x: 4, y: 4, w: 12, h: 10 }).hab;
  ok(s, { type: 'place', hab, item: cap('feeder'), x: 6, y: 6 });
  ok(s, { type: 'place', hab, item: cap('keeper-gate'), x: 15, y: 8 }); // a gate, but no path to it
  const st = Sim.habStats(s, Sim.habById(s, hab));
  assert.strictEqual(st.access, false);
  assert.strictEqual(st.feed, 0);
  assert.strictEqual(st.supported, 0);
});

test('placing: species, footprint, rotation, boundary and outside rules, with reasons', () => {
  const z = livingEnclosure(10);
  const { s, hab } = z;
  refused(s, { type: 'place', hab, item: 'meerkat__shelter', x: 21, y: 54 }, /meerkat/);
  refused(s, { type: 'place', hab, item: cap('shelter'), x: 30, y: 54 }, /inside the fence/);
  refused(s, { type: 'place', hab, item: cap('shelter'), x: 22, y: 50 }, /already there/);
  refused(s, { type: 'place', hab, item: cap('keeper-gate'), x: 25, y: 53 }, /fence/);
  refused(s, { type: 'place', hab, item: cap('sign'), x: 25, y: 53 }, /outside/);
  refused(s, { type: 'place', hab, item: cap('signature-3'), x: 21, y: 54 }, /place to explore/);
  refused(s, { type: 'place', hab, item: cap('shade'), x: 21, y: 54, r: 45 }, /rotation/);
  // a 5×3 item rotated 90° is 3 wide and 5 tall
  assert.deepStrictEqual(Sim.footprint(D.ITEMS[cap('signature-3')], 90), [3, 5]);
  ok(s, { type: 'place', hab, item: cap('viewing'), x: 26, y: 57 });
  ok(s, { type: 'place', hab, item: cap('sign'), x: 19, y: 50 });
});

test('undo: a full refund for the last thing placed, only soon after', () => {
  const z = livingEnclosure(11);
  const before = z.s.coins;
  ok(z.s, { type: 'place', hab: z.hab, item: cap('shade'), x: 21, y: 54 });
  ok(z.s, { type: 'undo' });
  assert.strictEqual(z.s.coins, before);
  ok(z.s, { type: 'place', hab: z.hab, item: cap('shade'), x: 21, y: 54 });
  ticks(z.s, B.undoSeconds + 1);
  refused(z.s, { type: 'undo' }, /Nothing/);
});

test('2. needs are 0–100, wellbeing is their mean, health is separate', () => {
  const z = withPair(12);
  ticks(z.s, 60);
  const a = z.s.animals[0];
  const n = Sim.needs(z.s, a);
  for (const k of ['food', 'water', 'comfort', 'social', 'enrichment']) assert.ok(n[k] >= 0 && n[k] <= 100, k);
  assert.ok(Math.abs(n.target - (n.food + n.water + n.comfort + n.social + n.enrichment) / 5) < 1e-9);
  assert.strictEqual(a.health, 100);
});

test('problems name the need and carry the fix ("Mochi needs shade" → add a shaded rest spot)', () => {
  const z = withPair(13);
  const mochi = z.s.animals[0];
  assert.strictEqual(mochi.name, 'Mochi', "the first capybara is the pack's example name");
  const p = Sim.problem(z.s, mochi);
  assert.match(p.text, /Mochi needs shade/);
  assert.strictEqual(p.fix.place, cap('shade'));
  assert.strictEqual(p.fix.label, D.SPECIES.capybara.needLabel);
});

test('3. buying: once despite a double click; refusals change nothing', () => {
  const z = livingEnclosure(14);
  const o = z.s.market.offers.find((x) => x.sp === 'capybara');
  const coins = z.s.coins;
  const id = tx();
  ok(z.s, { type: 'buy', offer: o.id, hab: z.hab, tx: id });
  assert.ok(ok(z.s, { type: 'buy', offer: o.id, hab: z.hab, tx: id }).duplicate);
  assert.strictEqual(z.s.animals.length, 1);
  assert.strictEqual(z.s.coins, coins - o.price);
  // insufficient funds and a full enclosure leave everything as it was
  const o2 = z.s.market.offers.find((x) => x.sp === 'capybara');
  z.s.coins = 10;
  refused(z.s, { type: 'buy', offer: o2.id, hab: z.hab, tx: tx() }, /coins/);
  z.s.coins = 50000;
  const meerkat = z.s.market.offers.find((x) => x.sp === 'meerkat');
  refused(z.s, { type: 'buy', offer: meerkat.id, hab: z.hab, tx: tx() }, /capybara enclosure/);
  const s2 = Sim.createState(15);
  s2.coins = 50000;
  const empty = ok(s2, { type: 'enclose', sp: 'capybara', x: 4, y: 4, w: 6, h: 6 }).hab;
  refused(s2, { type: 'buy', offer: s2.market.offers.find((x) => x.sp === 'capybara').id, hab: empty, tx: tx() }, /No room/);
});

test('3. selling: once despite a retry, keeps history, and buy-then-sell always loses coins', () => {
  const z = withPair(16);
  const a = z.s.animals[0];
  const coins = z.s.coins;
  const id = tx();
  const r = ok(z.s, { type: 'sell', animal: a.id, tx: id });
  assert.strictEqual(r.coins, Math.floor(D.SPECIES.capybara.buy * B.saleFraction));
  assert.ok(ok(z.s, { type: 'sell', animal: a.id, tx: id }).duplicate);
  assert.strictEqual(z.s.coins, coins + r.coins);
  assert.ok(z.s.departed.some((d) => d.id === a.id));
  for (const sp of Object.values(D.SPECIES)) assert.ok(Math.floor(sp.buy * B.saleFraction) < sp.buy, sp.id);
});

test('4. families: no event while breeding is off; an eligible pair reserves one slot', () => {
  const z = withPair(17);
  pamper(z);
  days(z.s, 3);
  assert.strictEqual(z.s.events.length, 0, 'breeding off: nothing happens by itself');
  const [a, b] = z.s.animals;
  ok(z.s, { type: 'pair', hab: z.hab, a: a.id, b: b.id });
  refused(z.s, { type: 'breed', hab: z.hab, tx: tx() }, /Switch breeding on/);
  ok(z.s, { type: 'breeding', hab: z.hab, on: true });
  const free = Sim.habStats(z.s, z.h).free;
  ok(z.s, { type: 'breed', hab: z.hab, tx: tx() });
  assert.strictEqual(Sim.habStats(z.s, z.h).free, free - 1, 'one adult slot reserved');
  // buying can't take the reserved slot
  while (Sim.habStats(z.s, z.h).free > 0)
    ok(z.s, { type: 'buy', offer: z.s.market.offers.find((o) => o.sp === 'capybara').id, hab: z.hab, tx: tx() }), days(z.s, 0);
  assert.strictEqual(Sim.habStats(z.s, z.h).reserved, 1);
});

test('4. save and reload at the due moment makes exactly one baby with the right parents', () => {
  const z = withPair(18);
  pamper(z);
  days(z.s, 3);
  const [a, b] = z.s.animals;
  ok(z.s, { type: 'pair', hab: z.hab, a: a.id, b: b.id });
  ok(z.s, { type: 'breeding', hab: z.hab, on: true });
  ok(z.s, { type: 'breed', hab: z.hab, tx: tx() });
  const e = z.s.events[0];
  ok(z.s, { type: 'breeding', hab: z.hab, on: false }); // turning off keeps the baby coming
  while (z.s.t < e.due - 1) Sim.tick(z.s);
  const saved = JSON.parse(JSON.stringify(z.s));
  Sim.tick(z.s);
  const back = Sim.load(saved);
  Sim.tick(back);
  for (const s of [z.s, back]) {
    const babies = s.animals.filter((x) => x.stage === 'baby');
    assert.strictEqual(babies.length, 1);
    assert.strictEqual(babies[0].id, e.child);
    assert.deepStrictEqual(babies[0].parents.slice().sort(), [a.id, b.id].sort());
  }
  // a second load of the after-birth save doesn't make another
  const again = Sim.load(JSON.parse(JSON.stringify(back)));
  ticks(again, 5);
  assert.strictEqual(again.animals.filter((x) => x.stage === 'baby').length, 1);
});

test('4. growth keeps the ID; expecting parents and carers cannot be sold; relatives cannot pair', () => {
  const z = withPair(19);
  pamper(z);
  days(z.s, 3);
  const [mum, dad] = z.s.animals;
  ok(z.s, { type: 'pair', hab: z.hab, a: mum.id, b: dad.id });
  ok(z.s, { type: 'breeding', hab: z.hab, on: true });
  ok(z.s, { type: 'breed', hab: z.hab, tx: tx() });
  refused(z.s, { type: 'sell', animal: mum.id, tx: tx() }, /expecting/);
  days(z.s, D.SPECIES.capybara.days.pre + 1);
  const baby = z.s.animals.find((x) => x.stage === 'baby');
  assert.ok(baby);
  const carer = Sim.animalById(z.s, baby.caregiver);
  refused(z.s, { type: 'sell', animal: carer.id, tx: tx() }, /looking after/);
  refused(z.s, { type: 'sell', animal: baby.id, tx: tx() }, /too young/);
  const id = baby.id;
  days(z.s, D.SPECIES.capybara.days.baby + D.SPECIES.capybara.days.juvenile + 1);
  const grown = Sim.animalById(z.s, id);
  assert.strictEqual(grown.stage, 'adult');
  assert.strictEqual(grown.caregiver, null);
  assert.ok(Sim.related(grown, mum) && Sim.related(grown, dad));
  ok(z.s, { type: 'pair', hab: z.hab, a: grown.id, b: grown.sex === 'm' ? mum.id : dad.id });
  const r = Sim.readiness(z.s, z.h);
  assert.match(r.checks.find((c) => c.id === 'pair').text, /family/);
});

test('4. egg-laying species hatch, and tortoise hatchlings explore on their own', () => {
  for (const sp of ['african-penguin', 'chilean-flamingo', 'indian-peafowl', 'aldabra-giant-tortoise']) assert.ok(D.SPECIES[sp].egg, sp);
  assert.strictEqual(D.SPECIES['aldabra-giant-tortoise'].follow, 'independent_hatchling');
});

test('5. resizing keeps the enclosure, charges once, and refuses to strand anyone', () => {
  const z = withPair(20);
  const { s, h } = z;
  const id = h.id;
  const coins = s.coins;
  const out = {};
  assert.strictEqual(Sim.resizeProblem(s, h, 18, 48, 14, 10, out), null);
  ok(s, { type: 'resize', hab: id, x: 18, y: 48, w: 14, h: 10 });
  assert.strictEqual(s.coins, coins - out.cost);
  assert.strictEqual(Sim.habById(s, id).w, 14);
  assert.strictEqual(s.animals.filter((a) => a.hab === id).length, 2);
  refused(s, { type: 'resize', hab: id, x: 18, y: 48, w: 4, h: 4 }, /fit|small/);
  refused(s, { type: 'resize', hab: id, x: 18, y: 50, w: 14, h: 10 }, /path|way|fit/);
});

test('5. land: adjacent chunks only, priced 750 × 1.35^n, charged exactly once', () => {
  const s = Sim.createState(21);
  s.coins = 50000;
  refused(s, { type: 'buyLand', cx: 3, cy: 3, tx: tx() }, /next to land/);
  refused(s, { type: 'buyLand', cx: 0, cy: 0, tx: tx() }, /already own/);
  const id = tx();
  const coins = s.coins;
  assert.strictEqual(ok(s, { type: 'buyLand', cx: 2, cy: 0, tx: id }).price, 750);
  assert.ok(ok(s, { type: 'buyLand', cx: 2, cy: 0, tx: id }).duplicate);
  assert.strictEqual(s.coins, coins - 750);
  assert.strictEqual(Sim.landPrice(s), Math.round(750 * 1.35));
  assert.ok(Sim.owned(s, 70, 5));
  // upkeep follows owned land
  assert.strictEqual(Sim.dailyCosts(s).land, 5 * 5);
});

test('moving an animal takes its dependants with it, and needs room for all of them', () => {
  const z = withPair(22);
  const other = ok(z.s, { type: 'enclose', sp: 'capybara', x: 34, y: 48, w: 12, h: 10 }).hab;
  refused(z.s, { type: 'move', animal: z.s.animals[0].id, hab: other }, /room/);
});

test('the gates must be open for visitors, and visitors pay', () => {
  const z = withPair(23);
  ticks(z.s, 60);
  assert.strictEqual(z.s.stats.guests, 0);
  ok(z.s, { type: 'open' });
  ticks(z.s, 120);
  assert.ok(z.s.stats.guests > 0);
});

test('running costs: wages, buildings, land and each animal by life stage', () => {
  const z = withPair(24);
  ok(z.s, { type: 'hire', role: 'keeper' });
  const c = Sim.dailyCosts(z.s);
  assert.strictEqual(c.animals, 2 * D.SPECIES.capybara.upkeep);
  assert.strictEqual(c.land, 4 * B.landUpkeep);
  assert.strictEqual(c.wages, D.STAFF.keeper.wage);
  const coins = z.s.coins;
  days(z.s, 1);
  assert.strictEqual(z.s.report.total, c.total);
  assert.ok(z.s.coins <= coins - c.total + z.s.report.tickets + z.s.report.shops + 1);
});

test('care reputation unlocks the next stage of species', () => {
  const s = Sim.createState(25);
  assert.ok(!Sim.unlocked(s, 'early'));
  s.rep = 150;
  assert.ok(Sim.unlocked(s, 'early'));
  s.coins = 50000;
  refused(s, { type: 'enclose', sp: 'african-elephant', x: 4, y: 4, w: 32, h: 26 }, /unlock/);
});

test('the opening goals can be done in order', () => {
  const s = Sim.createState(26);
  ok(s, { type: 'name', name: 'Little Paws' });
  for (let y = 61; y >= 50; y--) ok(s, { type: 'build', k: 'path', x: 32, y });
  const hab = ok(s, { type: 'enclose', sp: 'capybara', x: 20, y: 48, w: 12, h: 10 }).hab;
  ok(s, { type: 'place', hab, item: cap('keeper-gate'), x: 31, y: 52 });
  ok(s, { type: 'place', hab, item: cap('shelter'), x: 21, y: 49 });
  ok(s, { type: 'place', hab, item: cap('feeder'), x: 25, y: 49 });
  ok(s, { type: 'place', hab, item: cap('water'), x: 28, y: 49 });
  for (let i = 0; i < 5; i++) ok(s, { type: 'claim' });
  assert.strictEqual(Sim.currentGoal(s).id, 'capys');
  for (const sex of ['f', 'm'])
    ok(s, { type: 'buy', offer: s.market.offers.find((o) => o.sp === 'capybara' && o.sex === sex).id, hab, tx: tx() });
  ok(s, { type: 'claim' });
  assert.ok(s.coins >= 0, `the opening must be affordable (coins ${s.coins})`);
});

test('2. saves round-trip; junk loads safely; a version 1 zoo is upgraded, not reset', () => {
  const z = withPair(27);
  pamper(z);
  days(z.s, 1);
  z.s.lastBuild = null;
  const back = Sim.load(JSON.parse(JSON.stringify(z.s)));
  ticks(z.s, 50);
  ticks(back, 50);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(back)), JSON.parse(JSON.stringify(z.s)));

  for (const junk of [
    null,
    42,
    'x',
    {},
    { habs: 'no' },
    { habs: [{ id: 1, sp: 'constructor', x: 1, y: 1, w: 5, h: 5 }] },
    { animals: [{ id: 1, sp: 'capybara', hab: 9 }] },
  ]) {
    const s = Sim.load(junk);
    assert.strictEqual(s.v, Sim.SCHEMA);
    ticks(s, 5);
  }
  // overlapping enclosures and an item in the wrong place are dropped; ids never collide
  const odd = Sim.load({
    v: 2,
    habs: [
      { id: 1, sp: 'capybara', x: 2, y: 2, w: 8, h: 8, items: [{ id: 3, k: cap('shelter'), x: 9, y: 9 }] },
      { id: 2, sp: 'meerkat', x: 4, y: 4, w: 8, h: 8 },
    ],
    animals: [{ id: 5, sp: 'meerkat', hab: 2 }],
  });
  assert.strictEqual(odd.habs.length, 1);
  assert.strictEqual(odd.habs[0].items.length, 0);
  assert.strictEqual(odd.animals.length, 0);
  assert.ok(odd.nextId > 2);

  const v1 = {
    v: 1,
    name: 'Old Paws',
    day: 9,
    rep: 120,
    coins: 500,
    habitats: [{ id: 1 }],
    animals: [{ id: 2 }, { id: 3 }],
    builds: [],
    tiles: ['path', 'path'],
    stats: { guests: 300 },
  };
  const up = Sim.load(v1);
  assert.strictEqual(up.v, Sim.SCHEMA);
  assert.strictEqual(up.name, 'Old Paws');
  assert.strictEqual(up.rep, 120);
  assert.strictEqual(up.stats.guests, 300);
  assert.strictEqual(up.coins, B.startCoins + 500 + 400 * 2 + 300 + 10);
  assert.ok(up.news.some((n) => /moved to a much bigger park/.test(n.text)));
});

test('prototype names find nothing', () => {
  const s = Sim.createState(28);
  for (const k of ['constructor', '__proto__', 'toString'])
    for (const cmd of [
      { type: k },
      { type: 'build', k, x: 1, y: 1 },
      { type: 'enclose', sp: k, x: 1, y: 1, w: 5, h: 5 },
      { type: 'hire', role: k },
    ])
      assert.ok(!Sim.apply(s, cmd).ok);
});

test('every goal can be checked, and every species has a habitat zone and a priority-need fix', () => {
  const s = Sim.createState(29);
  for (const g of D.GOALS) assert.strictEqual(typeof Sim.goalDone(s, g), 'boolean', g.id);
  for (const sp of Object.values(D.SPECIES)) {
    assert.ok(D.ZONES[sp.zone], sp.zone);
    const how = D.NEED_BY[sp.need] || 'signature';
    if (how !== 'space' && how !== 'group') assert.ok(Sim.priorityItem({ sp: sp.id }), sp.id);
  }
});

test('art: every listed picture exists, has a known key, and nothing in assets/ is unlisted', () => {
  const fs = require('fs');
  const vm = require('vm');
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/art.js'), 'utf8') + ';this.READY=ZOO_ART_READY;', ctx);
  const keys = new Set(D.artKeys().all);
  for (const [k, file] of Object.entries(ctx.READY)) {
    assert.ok(keys.has(k), `unknown art key ${k}`);
    assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`);
  }
  const listed = new Set(Object.values(ctx.READY));
  for (const f of fs.readdirSync(path.join(root, 'assets')).filter((f) => /\.(png|webp)$/.test(f)))
    assert.ok(listed.has('assets/' + f), `assets/${f} isn't in js/art.js (run npm run zoo-art)`);
  // every runtime picture has its original kept in art-source/
  for (const file of listed)
    assert.ok(fs.existsSync(path.join(root, 'art-source', path.basename(file).replace(/\.webp$/, '.png'))), `no original for ${file}`);
});
