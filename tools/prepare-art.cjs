// Prepare generated originals for the runtime. Requires ImageMagick 6 (convert).
// Usage: node tools/prepare-art.cjs /absolute/path/to/source-map.json
// source-map.json is [{key, source}], with one immutable original per art key.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const manifestPath = path.join(root, 'docs/art-production/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath));
const sources = JSON.parse(fs.readFileSync(process.argv[2]));
for (const entry of sources) {
  const asset = manifest.find(a => a.key === entry.key);
  if (!asset) throw new Error('Unknown asset: ' + entry.key);
  const [w, h] = asset.size;
  // Ignore near-invisible alpha noise when locating the meaningful silhouette.
  // The original alpha is retained in the crop; this mask only measures bounds.
  const bounds = execFileSync('convert', [entry.source, '-alpha', 'extract',
    '-threshold', '0.6%', '-format', '%@', 'info:'], {encoding:'utf8'}).trim();
  if (!/^\d+x\d+\+\d+\+\d+$/.test(bounds)) throw new Error('Bad bounds: ' + bounds);
  const dest = path.join(root, 'assets', asset.key + '.png');
  execFileSync('convert', [entry.source, '-crop', bounds, '+repage',
    '-resize', `${w - 16}x${h - 8}`, '-background', 'none', '-gravity', 'south',
    '-extent', `${w}x${h}`, '-strip', 'PNG32:' + dest]);
  asset.status = 'prepared';
  asset.path = 'assets/' + asset.key + '.png';
  asset.generator = 'built-in image_gen';
  asset.sourceReference = 'docs/refs/deck-concept-art.jpg';
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${sources.length} PNG files with exact dimensions and bottom alignment.`);
