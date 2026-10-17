// A careful bot plays Cutise Zoo for a while and reports the economy: money, care, reputation and
// how long each stage takes in real minutes at normal speed. Run it after changing balance numbers.
//   node tools/balance.js [days=60] [seed=1]
// It follows the goal chain's path: a capybara home first, then a new species whenever one unlocks,
// filling each home with what its animals need, breeding pairs when they're ready and selling extras.
const path = require('path');
require(path.join(__dirname, '../js/pack-data.js'));
require(path.join(__dirname, '../js/content.js'));
const Sim = require(path.join(__dirname, '../js/sim.js'));
const D = globalThis.ZooData;
const B = D.BALANCE;

const DAYS = +process.argv[2] || 60;
const s = Sim.createState(+process.argv[3] || 1);
const log = [];
let tx = 0;
const act = (cmd) => Sim.apply(s, { ...cmd, tx: 'b' + tx++ });
const minutes = () => Math.round((s.t / 60) * 10) / 10;

// Layout: a path spine up the middle of the starting land, homes stacked either side of it.
act({ type: 'name', name: 'Bot Zoo' });
for (let y = B.gate.y - 2; y >= 1; y--) act({ type: 'build', k: 'path', x: B.gate.x, y });
const slots = { left: B.gate.y - 1, right: B.gate.y - 1 }; // next free y (bottom edge) on each side
function newHome(sp) {
  const def = D.SPECIES[sp];
  const w = Math.min(def.footprint[0], 30),
    h = Math.min(def.footprint[1], 30);
  for (const side of ['left', 'right']) {
    const y = slots[side] - h;
    if (y < 0) continue;
    const x = side === 'left' ? B.gate.x - w : B.gate.x + 1;
    const r = act({ type: 'enclose', sp, x, y, w, h });
    if (!r.ok) continue;
    slots[side] = y - 1;
    const gx = side === 'left' ? x + w - 1 : x;
    act({ type: 'place', hab: r.hab, item: sp + '__keeper-gate', x: gx, y: y + Math.floor(h / 2) });
    return r.hab;
  }
  return null;
}
// Try to put an item somewhere inside the enclosure (scans for the first spot that fits).
function place(hab, k) {
  const h = Sim.habById(s, hab);
  for (let y = h.y; y < h.y + h.h; y++)
    for (let x = h.x; x < h.x + h.w; x++)
      if (!Sim.placeProblem(s, h, k, x, y, 0)) return act({ type: 'place', hab, item: k, x, y, r: 0 }).ok;
  return false;
}
const has = (h, tpl) => h.items.some((i) => D.ITEMS[i.k].template === tpl || i.k === tpl);
const RESERVE = 250;

function tend() {
  if (s.price !== s.fair) act({ type: 'price', price: Math.max(1, s.fair) });
  for (const h of s.habs) {
    const sp = h.sp,
      st = Sim.habStats(s, h);
    // essentials, then comfort and fun, in order of need, keeping a little money in hand
    const wish = ['shelter', 'feeder', 'water'];
    const prio = Sim.priorityItem(h);
    if (prio) wish.push(prio);
    wish.push('rest', 'shade', sp + '__signature-1');
    if (Sim.residents(s, h).length >= 2) wish.push('nursery');
    wish.push('privacy', 'terrain', sp + '__signature-2', sp + '__signature-3');
    for (const w of wish) {
      if (has(h, w)) continue;
      const k = D.ITEMS[w] ? w : sp + '__' + w;
      if (s.coins - D.ITEMS[k].price < RESERVE) break;
      place(h.id, k);
    }
    // more shelter, food and water when they hold the group back
    const st2 = Sim.habStats(s, h);
    if (st2.free <= 0 && st2.physical > st2.residents + st2.reserved)
      for (const tpl of ['shelter', 'feeder', 'water']) if (s.coins > 600) place(h.id, sp + '__' + tpl);
    // a pair (one of each), then up to the group the species likes
    const who = Sim.residents(s, h);
    const want = Math.max(2, D.SPECIES[sp].group[0]);
    if (Sim.habStats(s, h).free > 0 && who.length < want) {
      const sexes = new Set(who.map((a) => a.sex));
      const offer =
        s.market.offers.find((o) => o.sp === sp && (!sexes.has(o.sex) || sexes.size === 2)) || s.market.offers.find((o) => o.sp === sp);
      if (offer && s.coins - offer.price > RESERVE) act({ type: 'buy', offer: offer.id, hab: h.id });
    }
    // breed a ready pair; sell grown-up extras when the home is full
    const adults = Sim.residents(s, h).filter((a) => a.stage === 'adult');
    const f = adults.find((a) => a.sex === 'f'),
      m = adults.find((a) => a.sex === 'm' && (!f || !Sim.related(a, f)));
    if (f && m) {
      act({ type: 'breeding', hab: h.id, on: true });
      act({ type: 'pair', hab: h.id, a: f.id, b: m.id });
      if (Sim.readiness(s, h).ok) act({ type: 'breed', hab: h.id });
    }
    if (Sim.habStats(s, h).free <= 0 && adults.length > want + 1) {
      const spare = adults.find((a) => !Sim.sellProblem(s, a) && a !== f && a !== m);
      if (spare) act({ type: 'sell', animal: spare.id });
    }
  }
  // a new species when one has unlocked and there's money for a home
  const homes = new Set(s.habs.map((h) => h.sp));
  const next = Object.values(D.SPECIES).find((sp) => Sim.unlocked(s, sp.stage) && !homes.has(sp.id) && sp.buy * 2 + 900 < s.coins);
  if (next) newHome(next.id);
  const keepers = Math.ceil(s.habs.length / B.keeperHabitats);
  while (s.staff.keeper < keepers && s.coins > 400 && act({ type: 'hire', role: 'keeper' }).ok);
  if (!s.opened && s.animals.length) act({ type: 'open' });
  let g;
  while ((g = Sim.currentGoal(s)) && Sim.goalDone(s, g)) act({ type: 'claim' });
}

newHome('capybara');
const stageAt = {};
let lowest = s.coins,
  lowestDay = 1;
for (let d = 1; d <= DAYS; d++) {
  for (let i = 0; i < B.dayLength; i++) {
    if (i % 30 === 0) tend();
    Sim.tick(s);
    const st = Sim.stage(s).name;
    if (!stageAt[st]) stageAt[st] = minutes();
    if (s.coins < lowest) {
      lowest = s.coins;
      lowestDay = s.day;
    }
  }
  const r = s.report;
  if (d <= 10 || d % 5 === 0)
    log.push(
      `day ${String(r.day).padStart(3)} | ${String(minutes()).padStart(5)} min | coins ${String(Math.round(s.coins)).padStart(7)} | net ${String(r.net).padStart(6)} | costs ${String(r.total).padStart(4)} | guests ${String(r.guests).padStart(4)} | care ${r.care}% | rep ${String(Math.floor(s.rep)).padStart(5)} | ${s.habs.length} homes, ${s.animals.length} animals, ${s.stats.babies} babies | goal ${s.goal}/${D.GOALS.length}`
    );
}
console.log(log.join('\n'));
console.log('\nStage reached (minutes at normal speed):', JSON.stringify(stageAt));
console.log(`Lowest coins: ${Math.round(lowest)} on day ${lowestDay}. Species: ${[...new Set(s.animals.map((a) => a.sp))].join(', ')}`);
