// Writes the art briefs for batches 2 and 3 from the game's own data, so every key, size and prompt matches:
//   docs/ART-BRIEF-BATCH-2.md            missing stills, for a person working in ChatGPT
//   docs/ART-BRIEF-BATCH-3-MOTION.md     poses for gentle animation
//   docs/art-production/batch-2.json and batch-3.json   the same lists for Codex or a script
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
// The visitor cast (keys and heights from D.PEOPLE). Real people and families: a mix of ages, sizes,
// skin tones, hair and clothes, the sort you'd queue behind for an ice cream on a Saturday.
const PEOPLE = {
  'guest-mum':
    'a mum in her thirties, light brown skin, dark hair in a loose bun, denim jacket over a striped top, jeans, trainers, a canvas tote bag on one shoulder',
  'guest-dad': 'a dad in his thirties, pale freckled skin, ginger hair, checked shirt with rolled sleeves, chinos, a small rucksack',
  'guest-mum-2': 'a mum in her thirties, warm brown skin, a sage-green hijab, long cream cardigan, holding a folded paper zoo map',
  'guest-dad-2': 'a dad in his forties, dark brown skin, short beard, navy rain jacket, holding a takeaway cup',
  'guest-grandma': 'a grandma, pale skin, short curly white hair, a floral mac, glasses on a chain, a handbag over her arm',
  'guest-grandad': 'a grandad, deep brown skin, grey moustache, tweed flat cap, cardigan and a walking stick',
  'guest-teen': 'a teenager (about 15), East Asian, bob haircut, oversized hoodie, holding up a phone to take a photo',
  'guest-teen-2': 'a teenager (about 16), Black, curly high-top hair, headphones round the neck, bomber jacket, hands in pockets',
  'guest-girl':
    'a girl about 7, light brown skin, two puffs of curly hair, yellow raincoat and red wellies, holding a red balloon on a string',
  'guest-boy': 'a boy about 8, pale skin, messy blond hair, dinosaur jumper, binoculars round his neck, mid-skip',
  'guest-girl-2': 'a girl about 5, South Asian, long plait, pink dungarees, hugging a little plush capybara',
  'guest-boy-2': 'a boy about 6, brown skin, a cap on backwards, shorts, holding an ice lolly',
  'guest-toddler': 'a toddler about 2, chubby cheeks, a woolly bobble hat and wellies, arms out for balance as they waddle',
  'guest-pram':
    'a parent pushing a pram (one picture): a mum with short dark hair and a mustard coat, the pram in sage green with a little blanket peeking out, pram in FRONT of her (on the left)',
  'guest-shoulders':
    'a dad carrying a toddler on his shoulders (one picture): the dad with olive skin and a beanie, the toddler in a dungaree with both hands in his hair, laughing',
  'guest-wheelchair':
    'a young woman using a manual wheelchair, pushing herself along: medium brown skin, braids tied up, an apricot jumper; a sporty everyday chair, not a hospital one',
};
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

// "Domestic rabbit" → "domestic rabbit", but "African penguin" keeps its capital.
const low = (w) => (/^(African|Aldabra|Asian|Chilean|Indian|Malayan|Arctic)$/.test(w) ? w : w.toLowerCase());
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
    `A close-up portrait of an adult ${sp.name.replace(/^\w+/, low)} (${sp.adult.toLowerCase()}), relaxed and content in its home "${sp.habitat}" (${sp.zone.toLowerCase()}), shown doing what it loves: ${sp.signature}. Soft painted background of that habitat, gently out of focus. Landscape 3:2, not transparent, like a framed card in a storybook.`,
    { reference: 'pack/' + sp.concept }
  );
for (const sp of Object.values(D.SPECIES))
  add(
    'Juveniles',
    `animal-${sp.id}-juvenile`,
    [512, 512],
    true,
    `A half-grown ${sp.name.replace(/^\w+/, low)}, full body, standing, three-quarter view facing LEFT. Halfway between the existing baby and adult sprites: longer legs and a less round head than the baby, adult markings and shape starting to come through (adult: ${sp.adult.toLowerCase()}). Match the existing adult and baby sprites (assets/animal-${sp.id}.webp and -baby.webp).`,
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
    `A wooden species sign on two rope-bound posts, like the shared sign (assets/item-sign.webp), but with a carved silhouette of a ${sp.name.replace(/^\w+/, low)} and a small decoration from its home "${sp.habitat}" (${sp.zone.toLowerCase()}). Blank wood where text would go.`,
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
for (const [key, who] of Object.entries(PEOPLE))
  add(
    'People',
    key,
    [256, 256],
    true,
    `A zoo visitor walking, full body, three-quarter view facing LEFT, mid-stride: ${who}. The figure stands ${Math.round(D.PEOPLE[key].h * 100)}% of the canvas height (all visitors share one scale, so families line up), centred, feet on the bottom edge. Friendly rounded shapes that read at small size; a real person, not a cartoon mascot.`
  );
add(
  'People',
  'staff-keeper',
  [256, 256],
  true,
  'A zookeeper walking, full body, facing LEFT, standing 88% of the canvas height: sage-green overalls and bucket hat, carrying a bucket of chopped vegetables.'
);
add(
  'People',
  'staff-guide',
  [256, 256],
  true,
  'A zoo guide walking, full body, facing LEFT, standing 88% of the canvas height: apricot polo shirt and cream trousers, holding a clipboard, smiling.'
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
  '2. The 16 visitors and 2 staff: the paths come alive with families.',
  '3. The 20 portraits: the animal panel.',
  '4. Icons, fences, poop, logo.',
  '5. Juveniles, the peahen and species signs.',
  '',
  '## The visitors: real people and families',
  '',
  'Visitors are one picture per person, and the game puts them together into parties that walk the paths as a group: a family of four, a parent with a pram, a dad with a toddler on his shoulders, grandparents with the grandkids, a couple, two teenage friends, a wheelchair user out with their family. Adults lead and children walk beside or behind them. So:',
  '',
  "- **One shared scale.** Every visitor is drawn on the same 256×256 canvas and stands the stated share of its height (a dad 90%, a seven-year-old 56%, a toddler 40%), feet on the bottom edge. That way a child comes up to a parent's waist when they walk side by side. Do the whole cast in one ChatGPT conversation and keep comparing.",
  '- **Real, everyday people.** A British Saturday at the zoo: different ages, body shapes, skin tones, hair and clothes; coats, rucksacks, prams and ice lollies. Warm and a little storybook, but people rather than mascots, and nobody a stereotype.',
  '- **Same pose family.** All facing left, three-quarter view, mid-stride, arms relaxed (the game mirrors them to walk right). Props stay inside the canvas.',
  '- **Read small.** On a phone a visitor is about 20 pixels tall: clear silhouettes, one or two strong colours each, no fine detail.',
  '',
  'Parties (from `D.PARTIES` in `js/content.js`): ' + D.PARTIES.map((p) => `${p.id.replace(/-/g, ' ')} (${p.who.length})`).join(', ') + '.',
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

// ---------- batch 3: poses for gentle animation ----------
// Light movement, mostly animals. Code already does the in-between motion (breathing, hops, waddles,
// sways, bobbing, squash when greeted); these stills are the few poses code can't fake.
const L = D.LOCOMOTION;
const SLEEPS = {
  'chilean-flamingo': 'asleep standing on one leg, neck curled back and head tucked into its feathers',
  'african-penguin': 'dozing standing up, flippers relaxed, beak tucked down onto its chest, eyes closed',
  'indian-peafowl': 'roosting, sitting down with legs tucked under and the long train folded neatly behind, eyes closed',
  giraffe: 'lying down with legs folded beneath, neck curved back so the head rests on its rump, eyes closed',
  'african-elephant': 'lying on its side asleep, trunk curled loosely in front, ears relaxed',
  'aldabra-giant-tortoise': 'resting with legs and head drawn half into the shell, eyes closed',
  'two-toed-sloth':
    'curled into a tight furry ball, face tucked in, claws hooked together (it sleeps on the ground in this pose; hanging is done in code)',
  meerkat: 'curled up in a ball, tail wrapped round its nose',
  'snow-leopard': 'lying stretched out, chin on its paws, long thick tail wrapped round its body',
  'red-panda': 'curled up asleep with its big ringed tail wrapped over its face',
};
const out3 = [];
const add3 = (group, key, size, line, reference) =>
  out3.push({
    group,
    key,
    size,
    transparent: true,
    prompt:
      `${STYLE} ${CUTOUT} SAME character as the reference image: same design, markings, colours, proportions, line quality and light; only the pose changes. ${line}`
        .replace(/\s+/g, ' ')
        .trim(),
    line,
    reference,
  });
for (const sp of Object.values(D.SPECIES)) {
  const name = sp.name.replace(/^\w+/, low),
    ref = `assets/animal-${sp.id}.webp`;
  add3(
    'Second stride',
    `animal-${sp.id}-walk`,
    [512, 512],
    `The adult ${name} mid-stride, facing LEFT, the OTHER legs forward compared with the reference, so swapping between the two reads as walking. Same size and position in the canvas, feet on the bottom edge.`,
    ref
  );
  add3(
    'Sleep',
    `animal-${sp.id}-sleep`,
    [512, 512],
    `The adult ${name} ${SLEEPS[sp.id] || 'lying down asleep, curled up the way it naturally rests, eyes closed, relaxed and content'}. Facing LEFT, resting on the bottom edge of the canvas, about the same width as the standing reference.`,
    ref
  );
  add3(
    'Eat',
    `animal-${sp.id}-eat`,
    [512, 512],
    `The adult ${name} with its head down, eating happily from a small pile of its favourite food at its front feet (food included in the picture, small). Facing LEFT, standing on the bottom edge.`,
    ref
  );
}
for (const sp of Object.values(D.SPECIES))
  add3(
    'Baby sleep',
    `animal-${sp.id}-baby-sleep`,
    [512, 512],
    `The baby ${sp.name.replace(/^\w+/, low)} (${sp.baby.toLowerCase().replace(/\.$/, '')}) curled up fast asleep, eyes closed, extra round and soft. Facing LEFT, resting on the bottom edge.`,
    `assets/animal-${sp.id}-baby.webp`
  );
for (const id of L.swimmers) {
  const sp = D.SPECIES[id];
  add3(
    'Swim',
    `animal-${id}-swim`,
    [512, 512],
    `The adult ${sp.name.replace(/^\w+/, low)} swimming, facing LEFT: head, back${id === 'african-penguin' ? ' and a flipper' : ''} above the water, the rest hidden. NO water drawn: the picture ends in a soft straight horizontal waterline along the bottom edge (the game adds the pool and ripple).`,
    `assets/animal-${id}.webp`
  );
}
for (const k of [...D.GUESTS, 'staff-keeper', 'staff-guide'])
  add3(
    'People: second stride',
    k + '-walk',
    [256, 256],
    `The same person as the reference, the OTHER foot forward and arms swung the other way, so swapping between the two reads as walking. Same size and position in the canvas.${k === 'guest-pram' ? ' The pram stays put; only she steps.' : k === 'guest-wheelchair' ? ' Her hands further round the wheel rims, mid-push.' : ''}`,
    `assets/${k}.webp (from batch 2)`
  );

const keys3 = D.artKeys().batch3;
const miss3 = keys3.filter((k) => !out3.some((o) => o.key === k));
const extra3 = out3.filter((o) => !keys3.includes(o.key)).map((o) => o.key);
if (miss3.length || extra3.length) throw new Error(`batch 3 brief and game disagree: missing ${miss3} extra ${extra3}`);
const groups3 = [...new Set(out3.map((o) => o.group))];
const md3 = [
  '# Cutise Zoo: art brief, batch 3 (gentle animation)',
  '',
  `Light, cosy movement, mostly for the animals. **${out3.length} pictures**, each a single still in a new pose. Generated by \`node tools/brief.js\` from the game data; the same list with full prompts is in \`docs/art-production/batch-3.json\`.`,
  '',
  '## How the movement works',
  '',
  'Nothing here is a frame-by-frame sprite sheet. The game already moves everything in code, and swaps to a pose picture when one exists:',
  '',
  '| Already done in code (draw nothing for it) | Swaps to a pose picture from this brief |',
  '| --- | --- |',
  '| Gentle breathing while standing or asleep | **Second stride** (`-walk`): alternates with the standing picture as it walks, a two-step walk cycle |',
  `| How each species walks: hops for ${Object.keys(L.gait)
    .filter((k) => L.gait[k] === 'hop')
    .map((k) => D.SPECIES[k].name.replace(/^\w+/, low))
    .join(', ')}; a waddle for ${Object.keys(L.gait)
    .filter((k) => L.gait[k] === 'waddle')
    .map((k) => D.SPECIES[k].name.replace(/^\w+/, low))
    .join(', ')}; a slow sway for ${Object.keys(L.gait)
    .filter((k) => L.gait[k] === 'amble')
    .map((k) => D.SPECIES[k].name.replace(/^\w+/, low))
    .join(', ')}; a trot for the rest | **Sleep** (\`-sleep\`): when it settles on a bed, in a den or in the shade |`,
  '| Climbing up onto platforms, hanging (the sloth, flipped in code), sinking into pools with a ripple | **Eat** (`-eat`): at a feeder or grazing |',
  '| A squish when you tap an animal; hearts and thought bubbles | **Swim** (`-swim`): the four swimmers in pools and wallows |',
  "| Visitors bob as they walk, children a little quicker | **Baby sleep** and the visitors' **second stride** |",
  '',
  'Until a pose arrives the game keeps using the standing picture, so these can come in any order, one at a time.',
  '',
  '## Making them consistent',
  '',
  'Pose swaps only work if the new picture is plainly the same animal. ChatGPT handles "same character, new pose" well when it can see the original:',
  '',
  '1. Upload the reference (the existing sprite named in each row), then paste the style prompt and the row\'s line. Say **"same character, same markings and colours, only the pose changes"**.',
  "2. Keep the canvas, the scale and the facing (LEFT) exactly as the reference. The animal should take up about the same width; for the second stride, the same height and position, so it doesn't jump when it swaps.",
  '3. Save as `art-source/<key>.png`, then `python3 tools/optimise-art.py` and `npm run zoo-art`. Before accepting one, flick between it and the reference: if the colours, markings or size jump, regenerate.',
  '',
  '## Style prompt (paste first, every time)',
  '',
  '> ' + STYLE,
  '',
  '**Every picture in this batch:** ' + CUTOUT,
  '',
  '## Priority',
  '',
  '1. **Sleep** for all 20 adults: animals rest a lot, so this changes the look of a park the most.',
  '2. **Second stride** for the adults: walking comes alive.',
  '3. **Swim** for the four swimmers, then **eat**.',
  '4. **Baby sleep**: the cutest pictures in the game.',
  "5. **Visitors' second stride**, once batch 2's people are in.",
  '',
];
for (const g of groups3) {
  const rows = out3.filter((o) => o.group === g);
  md3.push(`## ${g} (${rows.length})`, '', '| Key | Size | Pose | Reference |', '| --- | --- | --- | --- |');
  for (const o of rows) md3.push(`| \`${o.key}\` | ${o.size[0]}×${o.size[1]} | ${o.line.replace(/\|/g, '/')} | \`${o.reference}\` |`);
  md3.push('');
}
md3.push(
  '## Later, if we want more',
  '',
  "This is deliberately light. If the park wants more life later: a look-around idle pose per adult, a play pose for each signature item, and visitors stopping to point at the animals. Full 8-frame loops in four directions (the pack's original plan) would need a sprite-sheet tool and is not planned.",
  ''
);
fs.writeFileSync(path.join(root, 'docs/ART-BRIEF-BATCH-3-MOTION.md'), md3.join('\n'));
fs.writeFileSync(
  path.join(root, 'docs/art-production/batch-3.json'),
  JSON.stringify(
    out3.map(({ group, key, size, transparent, prompt, reference }) => ({ group, key, size, transparent, prompt, reference })),
    null,
    2
  ) + '\n'
);
console.log(`Batch 3 brief: ${out3.length} poses in ${groups3.length} groups.`);
