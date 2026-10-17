// Times the rules with a big park (pack: benchmark 20, 75 and 150 residents before raising limits).
// `node tools/bench.js`. Rendering speed has to be measured in a browser on the target device.
const path = require('path');
require(path.join(__dirname, '../js/pack-data.js'));
require(path.join(__dirname, '../js/content.js'));
const Sim = require(path.join(__dirname, '../js/sim.js'));

for (const want of [20, 75, 150]) {
  const s = Sim.createState(1);
  s.coins = 1e9;
  s.rep = 1e6;
  s.land = [];
  for (let cy = 0; cy < 6; cy++) for (let cx = 0; cx < 6; cx++) s.land.push(cx + ',' + cy);
  for (let x = 2; x < 190; x++) Sim.apply(s, { type: 'build', k: 'path', x, y: 62 });
  for (let y = 61; y >= 2; y--) Sim.apply(s, { type: 'build', k: 'path', x: 2, y });
  let n = 0;
  const spots = [];
  for (const y of [48, 63]) for (let x = 4; x + 14 < 190; x += 15) spots.push([x, y]);
  for (const [hx, hy] of spots) {
    if (n >= want) break;
    const sp = 'capybara';
    const r = Sim.apply(s, { type: 'enclose', sp, x: hx, y: hy, w: 14, h: 14 });
    if (!r.ok) continue; // the gate is in the way
    const hab = r.hab;
    const put = (k, x, y) => Sim.apply(s, { type: 'place', hab, item: 'capybara__' + k, x, y });
    put('keeper-gate', hx + 5, hy === 48 ? 61 : 63);
    for (let i = 0; i < 2; i++)
      put('shelter', hx + 1 + i * 4, hy + 2), put('feeder', hx + 1 + i * 4, hy + 6), put('water', hx + 1 + i * 4, hy + 9);
    while (Sim.habStats(s, Sim.habById(s, hab)).free > 0 && n < want) {
      const o = { id: 'b' + n, sp, sex: n % 2 ? 'm' : 'f', trait: 'sociable', price: 0 };
      s.market.offers.push(o);
      Sim.apply(s, { type: 'buy', offer: o.id, hab, tx: 'b' + n });
      n++;
    }
  }
  Sim.apply(s, { type: 'open' });
  const t0 = process.hrtime.bigint();
  const N = 600;
  for (let i = 0; i < N; i++) Sim.tick(s);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  console.log(
    `${s.animals.length} residents in ${s.habs.length} enclosures: ${ms.toFixed(2)} ms per simulated second, save ${(JSON.stringify(s).length / 1024).toFixed(0)} KB`
  );
}
