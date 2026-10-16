// Cutise Zoo: the rules in js/sim.js.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const root = path.join(__dirname, '..');
require(path.join(root, 'js/content.js'));
const Sim = require(path.join(root, 'js/sim.js'));
const D = globalThis.ZooData;

const ok = (s, cmd) => {
  const r = Sim.apply(s, cmd);
  assert.ok(r.ok, `${cmd.type}: ${r.error}`);
  return r;
};
const ticks = (s, n) => {
  for (let i = 0; i < n; i++) Sim.tick(s);
};
// The deck's first 15 minutes: path, wetland habitat, two capybaras, shelter and shade, a keeper, open.
function openingDay(seed = 7) {
  const s = Sim.createState(seed);
  ok(s, { type: 'name', name: 'Little Paws' });
  for (let y = 11; y >= 8; y--) ok(s, { type: 'build', k: 'path', x: 7, y });
  const hab = ok(s, { type: 'build', k: 'habitat_wetland', x: 4, y: 9 }).id;
  ok(s, { type: 'adopt', sp: 'capybara', hab });
  ok(s, { type: 'adopt', sp: 'capybara', hab });
  ok(s, { type: 'item', hab, item: 'shelter' });
  ok(s, { type: 'item', hab, item: 'shade' });
  ok(s, { type: 'hire', role: 'keeper' });
  ok(s, { type: 'open' });
  return { s, hab };
}

test('a new zoo is an empty park with a gate and a full purse', () => {
  const s = Sim.createState(1);
  assert.strictEqual(s.coins, D.BALANCE.startCoins);
  assert.strictEqual(s.animals.length, 0);
  assert.strictEqual(Sim.tileAt(s, D.BALANCE.gate.x, D.BALANCE.gate.y), 'gate');
  assert.strictEqual(s.opened, false);
  assert.deepStrictEqual(s.offered, ['capybara', 'redpanda']);
});

test('the opening-day goals can all be done in order', () => {
  const { s } = openingDay();
  for (let i = 0; i < 8; i++) ok(s, { type: 'claim' });
  assert.strictEqual(Sim.currentGoal(s).id, 'visitors');
});

test('same seed, same commands, same zoo (the rules are deterministic)', () => {
  const a = openingDay(99).s,
    b = openingDay(99).s;
  ticks(a, 600);
  ticks(b, 600);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('building: reasons for refusing, paths, and only reachable things count', () => {
  const s = Sim.createState(3);
  assert.match(Sim.apply(s, { type: 'build', k: 'path', x: D.BALANCE.gate.x, y: D.BALANCE.gate.y }).error, /gate/);
  assert.match(Sim.apply(s, { type: 'build', k: 'habitat_wetland', x: 14, y: 2 }).error, /fit/);
  assert.match(Sim.apply(s, { type: 'build', k: 'habitat_ice', x: 1, y: 1 }).error, /reputation/);
  assert.match(Sim.apply(s, { type: 'build', k: 'nope', x: 1, y: 1 }).error, /Unknown/);
  const far = ok(s, { type: 'build', k: 'habitat_wetland', x: 1, y: 1 }).id;
  assert.ok(!s.open.includes(far), 'a habitat far from any path is not reachable');
  const near = ok(s, { type: 'build', k: 'habitat_wetland', x: 3, y: 10 }).id;
  assert.ok(!s.open.includes(near));
  ok(s, { type: 'build', k: 'path', x: 6, y: 12 });
  assert.ok(s.open.includes(near), 'touching a path joined to the gate opens it');
  assert.match(Sim.apply(s, { type: 'build', k: 'flowers', x: 5, y: 11 }).error, /already there/);
});

test('undo gives a full refund, but only soon after and only while empty', () => {
  const s = Sim.createState(4);
  const before = s.coins;
  ok(s, { type: 'build', k: 'habitat_wetland', x: 4, y: 10 });
  ok(s, { type: 'undo' });
  assert.strictEqual(s.coins, before);
  assert.strictEqual(s.habitats.length, 0);
  const hab = ok(s, { type: 'build', k: 'habitat_wetland', x: 4, y: 10 }).id;
  ok(s, { type: 'adopt', sp: 'capybara', hab });
  assert.match(Sim.apply(s, { type: 'undo' }).error, /moved in/);
  ok(s, { type: 'build', k: 'path', x: 1, y: 1 });
  ticks(s, D.BALANCE.undoSeconds + 1);
  assert.ok(!Sim.apply(s, { type: 'undo' }).ok);
});

test('adopting checks offers, biome and room', () => {
  const s = Sim.createState(5);
  const hab = ok(s, { type: 'build', k: 'habitat_wetland', x: 4, y: 10 }).id;
  assert.match(Sim.apply(s, { type: 'adopt', sp: 'otter', hab }).error, /No otters/);
  assert.match(Sim.apply(s, { type: 'adopt', sp: 'redpanda', hab }).error, /Woodland/);
  ok(s, { type: 'adopt', sp: 'capybara', hab });
  ok(s, { type: 'adopt', sp: 'capybara', hab });
  ok(s, { type: 'adopt', sp: 'capybara', hab });
  assert.match(Sim.apply(s, { type: 'adopt', sp: 'capybara', hab }).error, /full/);
  for (const a of s.animals) {
    assert.ok(D.TRAITS[a.trait], 'every animal gets a trait');
    assert.ok(D.SPECIES.capybara.wants.includes(a.fav), 'and a favourite item its species wants');
  }
});

test('problems come with their fix: a missing shade tree asks for a shade tree', () => {
  const s = Sim.createState(6);
  for (let y = 11; y >= 9; y--) ok(s, { type: 'build', k: 'path', x: 7, y });
  const hab = ok(s, { type: 'build', k: 'habitat_wetland', x: 4, y: 10 }).id;
  ok(s, { type: 'adopt', sp: 'capybara', hab });
  const a = s.animals[0];
  let p = Sim.problem(s, a);
  assert.match(p.text, /somewhere to hide/);
  assert.deepStrictEqual(p.fix.cmd, { type: 'item', hab, item: 'shelter' });
  ok(s, p.fix.cmd);
  p = Sim.problem(s, a);
  assert.strictEqual(p.fix.cmd.type, 'item');
  assert.strictEqual(p.fix.cmd.item, a.fav, 'after the shelter, their favourite comes first');
  assert.strictEqual(p.fix.cost, D.ITEMS[a.fav].cost);
  s.habitats[0].food = 10;
  assert.match(Sim.problem(s, a).text, /hungry/);
});

test('well-kept animals are happier, and habitats climb the three tiers', () => {
  const { s, hab } = openingDay(8);
  const h = Sim.habitatById(s, hab);
  assert.strictEqual(s.tiers[hab], 1, 'shelter, food and keeper access: a safe home');
  const wants = new Set(Sim.residents(s, h).flatMap(Sim.wantsOf));
  for (const w of wants) if (!h.items.includes(w)) ok(s, { type: 'item', hab, item: w });
  assert.strictEqual(s.tiers[hab], 2, 'everything its residents want: a place to explore');
  for (const [x, y] of [
    [3, 9],
    [3, 10],
    [4, 8],
  ])
    ok(s, { type: 'build', k: 'flowers', x, y });
  assert.strictEqual(s.tiers[hab], 3, 'planting round it: a signature habitat');
  ticks(s, 120);
  assert.ok(s.care >= 80, `care ${s.care}`);
});

test('hungry, messy, lonely animals are unhappy', () => {
  const s = Sim.createState(9);
  for (let y = 11; y >= 9; y--) ok(s, { type: 'build', k: 'path', x: 7, y });
  const hab = ok(s, { type: 'build', k: 'habitat_wetland', x: 4, y: 10 }).id;
  ok(s, { type: 'adopt', sp: 'capybara', hab });
  const h = Sim.habitatById(s, hab);
  for (let i = 0; i < 400; i++) {
    h.poop.length = Math.max(h.poop.length, 4);
    Sim.tick(s);
  }
  assert.ok(s.animals[0].happy < 35, `happy ${s.animals[0].happy}`);
});

test('the gates must be open for visitors, and visitors pay', () => {
  const s = Sim.createState(10);
  assert.match(Sim.apply(s, { type: 'open' }).error, /animals/);
  const { s: z } = openingDay(10);
  const coins = z.coins;
  ticks(z, 60);
  assert.ok(z.stats.guests > 0);
  assert.ok(z.coins > coins - 10, 'tickets come in');
  const closed = openingDay(10).s;
  closed.opened = false;
  ticks(closed, 60);
  assert.strictEqual(closed.stats.guests, 0);
});

test('a fair price draws the full crowd; a steep one scares people off', () => {
  const { s } = openingDay(11);
  ok(s, { type: 'price', price: s.fair });
  Sim.refresh(s);
  assert.ok(Math.abs(Sim.priceMult(s) - 1) < 0.15);
  ok(s, { type: 'price', price: 99 });
  assert.strictEqual(Sim.priceMult(s), 0);
  assert.ok(!Sim.apply(s, { type: 'price', price: -1 }).ok);
});

test('keepers feed and tidy; the day ends with wages and upkeep', () => {
  const { s, hab } = openingDay(12);
  const h = Sim.habitatById(s, hab);
  h.food = 5;
  h.poop.push({ id: 900, x: 0.5, y: 0.5 }, { id: 901, x: 0.2, y: 0.2 });
  ticks(s, D.BALANCE.keeperEvery);
  assert.strictEqual(h.food, 100 - 0); // topped up this second, before anyone ate
  assert.ok(h.poop.length < 2);
  ticks(s, D.BALANCE.dayLength);
  assert.ok(s.report, 'a day report');
  assert.strictEqual(s.report.wages, D.STAFF.keeper.wage);
  assert.strictEqual(s.report.upkeep, D.BUILDS.habitat_wetland.upkeep);
  assert.strictEqual(s.day, 2);
});

test('care reputation brings new adoption offers and the next stage', () => {
  const { s } = openingDay(13);
  assert.ok(!s.offered.includes('otter'));
  s.rep = D.SPECIES.otter.rep - 0.01;
  ticks(s, 30);
  assert.ok(s.offered.includes('otter'));
  assert.ok(s.news.some((n) => n.kind === 'offer'));
  s.rep = 499.9;
  ticks(s, 30);
  assert.strictEqual(Sim.stage(s).name, 'A local favourite');
});

test('very happy pairs can have babies, who grow up', () => {
  const { s, hab } = openingDay(14);
  const h = Sim.habitatById(s, hab);
  h.items = ['shelter', 'shade', 'pool', 'toy', 'bed'];
  let born = 0;
  for (let i = 0; i < 20 * D.BALANCE.dayLength && !born; i++) {
    h.food = 100;
    h.poop.length = 0;
    Sim.tick(s);
    born = s.stats.babies;
  }
  assert.ok(born, 'a baby within 20 days');
  const baby = s.animals.find((a) => a.baby);
  ticks(s, D.BALANCE.growDays * D.BALANCE.dayLength);
  assert.ok(!Sim.animalById(s, baby.id).baby);
});

test('hello cheers an animal up, with a cooldown', () => {
  const { s } = openingDay(15);
  const a = s.animals[0];
  ok(s, { type: 'hello', animal: a.id });
  assert.match(Sim.apply(s, { type: 'hello', animal: a.id }).error, /rest/);
  ticks(s, D.BALANCE.helloCooldown);
  ok(s, { type: 'hello', animal: a.id });
});

test('time away runs at half pace and is capped', () => {
  const { s } = openingDay(16);
  const r = Sim.catchUp(s, 10 * 60 * 60);
  assert.strictEqual(r.seconds, D.BALANCE.offlineCap * D.BALANCE.offlineRate);
  assert.ok(r.guests > 0);
  assert.strictEqual(Sim.catchUp(s, -5).seconds, 0);
  assert.strictEqual(Sim.catchUp(s, NaN).seconds, 0);
});

test('saves round-trip, and junk or old saves still load', () => {
  const { s } = openingDay(17);
  ticks(s, 300);
  s.lastBuild = null; // undo doesn't survive a reload
  const back = Sim.load(JSON.parse(JSON.stringify(s)));
  ticks(s, 50);
  ticks(back, 50);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(back)), JSON.parse(JSON.stringify(s)));

  for (const junk of [null, 42, 'x', {}, { animals: 'no' }, { habitats: [{ k: 'constructor', x: 1, y: 1, id: 1 }] }]) {
    const z = Sim.load(junk);
    assert.strictEqual(z.v, Sim.SCHEMA);
    ticks(z, 5);
  }
  // overlapping habitats, an animal in the wrong biome, an unknown trait
  const odd = Sim.load({
    habitats: [
      { id: 1, k: 'habitat_wetland', x: 2, y: 2, items: ['shelter', 'shelter', 'laser'] },
      { id: 2, k: 'habitat_woodland', x: 3, y: 3 },
    ],
    animals: [
      { id: 3, sp: 'capybara', hab: 1, trait: 'grumpy' },
      { id: 4, sp: 'redpanda', hab: 1 },
    ],
    builds: [{ id: 5, k: 'icecream', x: 2, y: 2 }],
  });
  assert.strictEqual(odd.habitats.length, 1);
  assert.deepStrictEqual(odd.habitats[0].items, ['shelter']);
  assert.strictEqual(odd.animals.length, 1);
  assert.strictEqual(odd.animals[0].trait, 'sociable');
  assert.strictEqual(odd.builds.length, 0);
  assert.ok(odd.nextId > 3, 'ids never collide with what loaded');
});

test('prototype names find nothing', () => {
  const s = Sim.createState(18);
  for (const k of ['constructor', '__proto__', 'toString'])
    for (const cmd of [{ type: k }, { type: 'build', k, x: 1, y: 1 }, { type: 'adopt', sp: k, hab: 1 }, { type: 'hire', role: k }])
      assert.ok(!Sim.apply(s, cmd).ok);
});

test('every goal, item, species and build is wired up', () => {
  for (const sp of Object.values(D.SPECIES)) {
    assert.ok(D.BIOMES[sp.biome]);
    for (const w of sp.wants) assert.ok(D.ITEMS[w], w);
    assert.ok(
      Object.values(D.BUILDS).some((b) => b.biome === sp.biome),
      `${sp.name} has a habitat`
    );
  }
  for (const t of Object.values(D.TRAITS)) if (t.want) assert.ok(D.ITEMS[t.want]);
  const s = Sim.createState(19);
  for (const g of D.GOALS) assert.strictEqual(typeof Sim.goalDone(s, g), 'boolean', g.id);
  assert.ok(Sim.goalDone(s, { need: { rep: 0 } }));
});
