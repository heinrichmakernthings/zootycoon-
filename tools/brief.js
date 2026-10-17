// Writes the batch 2 art brief from the game's own data, so every key, size and prompt matches:
//   docs/ART-BRIEF-BATCH-2.md            for a person working in ChatGPT
//   docs/art-production/batch-2.json     the same list for Codex or a script ({key, size, transparent, prompt})
// Usage: node tools/brief.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
require(path.join(root, 'js/pack-data.js'));
require(path.join(root, 'js/content.js'));
const D = globalThis.ZooData;

const STYLE =
  'Warm storybook illustration for an isometric zoo game called Cutise Zoo. Soft 2.5D isometric form, rounded silhouettes, matte painted texture kept simple enough for a small game sprite, light from the upper left. Palette: cream #FBF5E8, sage #A7BA91, apricot #E8B58A, pond blue #9EC7C7, forest ink #244638. No text, no logos, no frame.';
const CUTOUT =
  'One object only, transparent background (PNG), no ground, no cast shadow. The subject fills the canvas width with a small even margin and stands on the bottom edge (bottom-centre is where it touches the ground).';
const TILE =
  'A seamless floor tile: an isometric 2:1 diamond that touches all four edges of the canvas exactly, transparent outside the diamond, flat ground seen from about 30° above, no objects taller than a few pixels, edges that tile seamlessly with copies of itself.';
const ZONE_GROUND = {
  Wetlands: 'damp lush grass with moss and the odd tiny puddle',
  Woodland: 'mossy forest floor with a scatter of fallen leaves and twigs',
  Meadow: 'soft clover-rich grass with a few tiny daisies',
  Drylands: 'warm sand with small pebbles and faint ripples',
  Tropical: 'rich dark soil with leaf litter and tiny ferns',
  Savanna: 'golden dry grass tufts over dusty earth',
  Coastal: 'pale shingle and smooth grey pebbles',
  Coollands: 'thin snow over rocky ground with a few frosty tufts',
};
const GUESTS = [
  'a little girl in a yellow raincoat holding a red balloon',
  'a boy with binoculars round his neck, mid-step',
  'a mum pushing a pram',
  'a grandad in a flat cap with a walking stick',
  'a teenager taking a photo with a phone',
  'a dad carrying a toddler on his shoulders',
];
const ICONS = {
  'icon-coins': 'a small stack of golden coins with a paw-print stamp',
  'icon-visitors': 'two little visitor figures side by side',
  'icon-care': 'a fresh sage-green leaf with a small heart in its veins',
  'icon-day': 'a soft round sun with short rays',
  'icon-build': 'a wooden mallet and a fence post',
  'icon-animals': 'a round paw print',
  'icon-staff': "a keeper's sage-green bucket hat",
  'icon-zoo': 'a folded park map with a path drawn on it',
};

const out = [];
const add = (group, key, size, transparent, line, extra = {}) =>
  out.push({
    group,
    key,
    size,
    transparent,
    prompt:
      `${key === 'logo' ? STYLE.replace('No text, no logos, no frame.', 'No frame.') : STYLE} ${transparent ? (size[0] === 2 * size[1] && group === 'Ground tiles' ? TILE : CUTOUT) : ''} ${line}`
        .replace(/\s+/g, ' ')
        .trim(),
    line,
    ...extra,
  });

for (const sp of Object.values(D.SPECIES))
  add(
    'Portraits',
    'portrait-' + sp.id,
    [768, 512],
    false,
    `A close-up portrait of an adult ${sp.name.toLowerCase()} (${sp.adult.toLowerCase()}), relaxed and content in its home "${sp.habitat}" (${sp.zone.toLowerCase()}), shown doing what it loves: ${sp.signature}. Soft painted background of that habitat, gently out of focus. Landscape 3:2, not transparent, like a framed card in a storybook.`,
    { reference: 'pack/' + sp.concept }
  );
for (const sp of Object.values(D.SPECIES))
  add(
    'Juveniles',
    `animal-${sp.id}-juvenile`,
    [512, 512],
    true,
    `A half-grown ${sp.name.toLowerCase()}, full body, standing, three-quarter view facing LEFT. Halfway between the existing baby and adult sprites: longer legs and a less round head than the baby, adult markings and shape starting to come through (adult: ${sp.adult.toLowerCase()}). Match the existing adult and baby sprites (assets/animal-${sp.id}.webp and -baby.webp).`,
    { reference: `assets/animal-${sp.id}.webp` }
  );
add(
  'Animals',
  'animal-indian-peafowl-female',
  [512, 512],
  true,
  'An adult peahen (female Indian peafowl), full body, standing, three-quarter view facing LEFT: soft brown-grey body, shimmering green lower neck, small fan-shaped crest, short tail with no display train. Match the existing peacock sprite (assets/animal-indian-peafowl.webp).',
  { reference: 'assets/animal-indian-peafowl.webp' }
);
for (const sp of Object.values(D.SPECIES))
  add(
    'Species signs',
    'item-sign-' + sp.id,
    [384, 384],
    true,
    `A wooden species sign on two rope-bound posts, like the shared sign (assets/item-sign.webp), but with a carved silhouette of a ${sp.name.toLowerCase()} and a small decoration from its home "${sp.habitat}" (${sp.zone.toLowerCase()}). Blank wood where text would go.`,
    { reference: 'assets/item-sign.webp' }
  );
add(
  'Park',
  'gate',
  [512, 512],
  true,
  "The zoo's entrance: two stone-and-timber pillars with little green tiled roofs, a curved wooden arch between them with a blank sign board, bunting, two warm lanterns and pots of flowers. Seen at the game's isometric angle with the opening facing the viewer."
);
add('Park', 'poop', [128, 128], true, 'A small, cute (not gross) animal poop: three soft brown blobs with a tiny shine.');
add(
  'Park',
  'logo',
  [1024, 512],
  true,
  'The words "Cutise Zoo" as a warm hand-lettered wordmark in forest ink with an apricot outline, a little capybara peeking over the C and a paw print dotting the i. This is the one picture with text.'
);
add('Ground tiles', 'tile-grass', [256, 128], true, 'Soft sage lawn with the odd blade and clover.');
add('Ground tiles', 'tile-path', [256, 128], true, 'A warm cream flagstone path, rounded stones with soft moss in the joints.');
for (const [zone, ground] of Object.entries(ZONE_GROUND))
  add('Ground tiles', 'ground-' + zone.toLowerCase(), [256, 128], true, `Enclosure ground for the ${zone} zone: ${ground}.`);
GUESTS.forEach((who, i) =>
  add(
    'People',
    'guest-' + (i + 1),
    [256, 256],
    true,
    `A zoo visitor walking, full body, facing LEFT: ${who}. Friendly, simple shapes that read at small size. Varied skin tones across the six visitors.`
  )
);
add(
  'People',
  'staff-keeper',
  [256, 256],
  true,
  'A zookeeper walking, full body, facing LEFT: sage-green overalls and bucket hat, carrying a bucket of chopped vegetables.'
);
add(
  'People',
  'staff-guide',
  [256, 256],
  true,
  'A zoo guide walking, full body, facing LEFT: apricot polo shirt and cream trousers, holding a clipboard, smiling.'
);
add(
  'Fences',
  'fence-post',
  [64, 128],
  true,
  'A single round wooden fence post with a rope wrap near the top, like the posts on the keeper gate sprite (assets/item-keeper-gate.webp).'
);
add(
  'Fences',
  'fence-rail-a',
  [256, 160],
  true,
  'One fence section between two posts (posts NOT included), two horizontal wooden rails running from the top-LEFT of the canvas down to the bottom-RIGHT at the isometric angle: the rails drop one pixel for every two across. Ends cut clean at the canvas edges so sections join.'
);
add(
  'Fences',
  'fence-rail-b',
  [256, 160],
  true,
  'The same fence section mirrored: two wooden rails running from the bottom-LEFT of the canvas up to the top-RIGHT at the isometric angle (one pixel up for every two across). Ends cut clean at the canvas edges so sections join.'
);
for (const [k, what] of Object.entries(ICONS))
  add('Icons', k, [128, 128], true, `A small flat-ish UI icon, chunky and readable at 24 pixels: ${what}. Centred, no ground.`);

const keys = D.artKeys().batch2;
const missing = keys.filter((k) => !out.some((o) => o.key === k));
const extra = out.filter((o) => !keys.includes(o.key)).map((o) => o.key);
if (missing.length || extra.length) throw new Error(`brief and game disagree: missing ${missing} extra ${extra}`);

const groups = [...new Set(out.map((o) => o.group))];
const md = [
  '# Cutise Zoo: art brief, batch 2',
  '',
  `Batch 1 (124 sprites) is in the game. This brief covers the **${out.length} pictures still missing**. Generated by \`node tools/brief.js\` from the game data, so every key and size matches what the game looks for. The same list with full prompts is in \`docs/art-production/batch-2.json\` (for Codex or a script).`,
  '',
  '## How to make and deliver them',
  '',
  '1. In ChatGPT, paste the **style prompt** below, then the line for the picture. Where a row names a reference, upload that image too and say "match this design and its markings".',
  '2. Save the result as `art-source/<key>.png` (exact key, PNG, at the size given).',
  '3. Run `python3 tools/optimise-art.py` then `npm run zoo-art`, and reload. The game picks it up straight away; until then it keeps its emoji or flat colour.',
  '',
  'Keep one ChatGPT conversation per group so the style stays consistent. Generate at a larger size if you like; the prep tool (`tools/prepare-art.cjs`) crops, fits and bottom-aligns to the exact canvas.',
  '',
  '## Style prompt (paste first, every time)',
  '',
  '> ' + STYLE,
  '',
  '**For every cut-out (people, animals, signs, gate, icons, fences):** ' + CUTOUT,
  '',
  '**For ground tiles:** ' + TILE,
  '',
  '**Portraits are the exception:** full painted background, not transparent.',
  '',
  '## Priority',
  '',
  '1. `gate`, `tile-grass`, `tile-path` and the 8 `ground-*` tiles: the biggest visual change, since every screen shows them.',
  '2. The 6 visitors and 2 staff: the paths come alive.',
  '3. The 20 portraits: the animal panel.',
  '4. Icons, fences, poop, logo.',
  '5. Juveniles, the peahen and species signs.',
  '',
];
for (const g of groups) {
  const rows = out.filter((o) => o.group === g);
  md.push(`## ${g} (${rows.length})`, '', '| Key | Size | Picture | Reference |', '| --- | --- | --- | --- |');
  for (const o of rows)
    md.push(
      `| \`${o.key}\` | ${o.size[0]}×${o.size[1]}${o.transparent ? '' : ' (opaque)'} | ${o.line.replace(/\|/g, '/')} | ${o.reference ? '`' + o.reference + '`' : ''} |`
    );
  md.push('');
}
md.push(
  '## Checking a picture before it goes in',
  '',
  '- Exact key and size; transparent where it should be; the subject stands on the bottom edge; nothing else in the frame.',
  '- People and animals face left (the game mirrors them to walk right).',
  '- Ground tiles: the diamond touches all four canvas edges, and four copies side by side show no seams.',
  '- Fence rails: the slope is exactly one down for two across, so sections line up with the grid.',
  '',
  '## Batch 3, later: animation',
  '',
  'Once these are in: walk, idle and sleep loops (8 frames each, 4 directions) for each adult and baby, per `pack/docs/ART-DIRECTION-AND-ASSET-STATUS.md`. That needs a sprite-sheet format first, which is a code task.',
  ''
);
fs.writeFileSync(path.join(root, 'docs/ART-BRIEF-BATCH-2.md'), md.join('\n'));
fs.mkdirSync(path.join(root, 'docs/art-production'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs/art-production/batch-2.json'),
  JSON.stringify(
    out.map(({ group, key, size, transparent, prompt, reference }) => ({
      group,
      key,
      size,
      transparent,
      prompt,
      reference: reference || null,
    })),
    null,
    2
  ) + '\n'
);
console.log(`Batch 2 brief: ${out.length} pictures in ${groups.length} groups.`);
