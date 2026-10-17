// Lists every picture in assets/ in js/art.js, so the game draws it instead of the emoji.
// Usage: drop `animal-bunny.png` (named by its key from docs/ART-BRIEF.md) into assets/,
// then run `node tools/art.js`. Files whose name isn't a known key are reported, not listed.
const fs = require('fs');
const path = require('path');
const zoo = path.join(__dirname, '..');
require(path.join(zoo, 'js/pack-data.js'));
require(path.join(zoo, 'js/content.js'));
const D = globalThis.ZooData;
const keys = new Set(D.artKeys().all);

const dir = path.join(zoo, 'assets');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|webp)$/.test(f)) : [];
const ready = {};
for (const f of files.sort()) {
  const key = f.replace(/\.(png|webp)$/, '');
  if (keys.has(key)) ready[key] = 'assets/' + f;
  else console.log(`! ${f} isn't a known art key (see docs/ART-BRIEF.md)`);
}
const artFile = path.join(zoo, 'js/art.js');
const src = fs.readFileSync(artFile, 'utf8');
const body = Object.entries(ready)
  .map(([k, v]) => `  '${k}': '${v}',\n`)
  .join('');
fs.writeFileSync(
  artFile,
  src.replace(
    /const ZOO_ART_READY = \{[\s\S]*?\n\};/,
    `const ZOO_ART_READY = {\n${body || "  // 'animal-bunny': 'assets/animal-bunny.png',\n"}};`
  )
);
const missing = [...keys].filter((k) => !ready[k]);
console.log(`${Object.keys(ready).length} pictures ready, ${missing.length} still drawn as emoji.`);
