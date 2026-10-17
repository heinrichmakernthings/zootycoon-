# Cutise Zoo: art brief for ChatGPT

Every picture in the game has a **key**. Until its file exists, the game draws an emoji stand-in, so art can arrive one piece at a time and nothing breaks.

**Status (17 Oct 2026):** 124 of 149 delivered by Codex and integrated (all adults, babies, fittings, signature items and park buildings; see `docs/art-production/`). The 103 still missing (portraits, gate, ground tiles, visitors, staff, fences, icons, juveniles, the peahen, species signs) are briefed in **`ART-BRIEF-BATCH-2.md`**.

**To add a picture:** save the original as `art-source/<key>.png`, run `python3 tools/optimise-art.py` (makes the WebP the game loads) and `npm run zoo-art`, then reload. The tool lists what's ready and warns about any file whose name isn't a known key. There are 149 keys; this file lists them all.

**Concept art is not game art.** The pack's concept sheets (`pack/animals/…`, `pack/shared/…`) are flattened scenes with backgrounds: use them as **references** for ChatGPT, never as sprites (pack: ART-DIRECTION-AND-ASSET-STATUS). Each runtime picture below is one object, cut out, on a transparent background.

## The style prompt (paste first, every time)

> Warm storybook illustration for an isometric zoo game called Cutise Zoo. Soft 2.5D isometric form, rounded silhouette, matte painted texture kept simple enough for a small game sprite, light from the upper left. Palette: cream #FBF5E8, sage #A7BA91, apricot #E8B58A, pond blue #9EC7C7, forest ink #244638. No clothing or accessories on animals, no text, no logos, no frame. **One object only, transparent background (PNG), no ground, no cast shadow** (the game draws its own). The subject fills the canvas width with a small even margin and **stands on the bottom edge**: bottom-centre is where it touches the ground.

Then add the line for the asset. Show ChatGPT the matching concept sheet as a reference ("match this animal's design, markings and proportions"). Keep one conversation per group so the style stays consistent.

## The camera

2:1 isometric: a floor tile is a diamond twice as wide as it is tall. Objects are seen from about 30° above with their front facing the bottom-left. **Animals face left**; the game mirrors them to walk right. (The pack asks for four directions eventually; one left-facing view is enough to start.)

## Animals: `animal-<id>` (512×512) and `animal-<id>-baby` (512×512)

Full body, standing, three-quarter view facing left. Same canvas size for every animal; the game scales by species. Babies must use **baby proportions and markings** from the pack, not a shrunken adult (e.g. flamingo chicks are grey, tapir calves are striped).

| Key | Animal | Adult | Baby | Reference |
| --- | --- | --- | --- | --- |
| `animal-capybara` | Capybara | Rounded barrel body, blunt muzzle, tiny ears, warm caramel coat | Smaller rounded muzzle and short legs. Nestle beside parent and make short follow bursts. | `pack/animals/01-capybara/concept-animal-habitat.png` |
| `animal-red-panda` | Red panda | Rust-red fur, cream face markings, black legs, long ringed tail | Fluffy round head, soft ringed tail. Follow a low branch route and curl beside parent. | `pack/animals/02-red-panda/concept-animal-habitat.png` |
| `animal-asian-small-clawed-otter` | Asian small-clawed otter | Long flexible brown body, cream chin, short legs and expressive whiskers | Shorter body and tail, cream chin. Stay near dry den, nuzzle and practise paddling. | `pack/animals/03-asian-small-clawed-otter/concept-animal-habitat.png` |
| `animal-african-penguin` | African penguin | Black back, white belly with dark chest band, short flippers and pink eye patches | Fluffy grey chick with dark bill. No adult banding. Wobble and nest beside parent. | `pack/animals/04-african-penguin/concept-animal-habitat.png` |
| `animal-meerkat` | Meerkat | Small sandy upright body, dark eye patches and a slender tail | Tiny sandy pup with dark eye patches. Peek out of burrow and copy a lookout pose. | `pack/animals/05-meerkat/concept-animal-habitat.png` |
| `animal-fennec-fox` | Fennec fox | Very large pointed ears, tiny cream-sand body and dark nose | Tiny cream kit with oversized ears. Curl near den and make a small playful pounce. | `pack/animals/06-fennec-fox/concept-animal-habitat.png` |
| `animal-rabbit` | Domestic rabbit | Soft round body, long upright ears, cream and caramel patches, small cotton tail | Round fluffy kit, shorter ears. Tiny hops and sibling snuggle. | `pack/animals/07-rabbit/concept-animal-habitat.png` |
| `animal-pygmy-goat` | Pygmy goat | Compact stocky goat, short horns, little beard and cream-brown coat | Small kid with short horns or horn buds. Springy hop and short parent-follow walk. | `pack/animals/08-pygmy-goat/concept-animal-habitat.png` |
| `animal-alpaca` | Alpaca | Long neck, fluffy cream fleece, small pointed ears and rounded muzzle | Fluffy cria with long thin legs and larger head. Gentle follow and curious ear twitch. | `pack/animals/09-alpaca/concept-animal-habitat.png` |
| `animal-aldabra-giant-tortoise` | Aldabra giant tortoise | Large domed charcoal shell, sturdy scaled legs and gentle wrinkled head | Tiny hatchling with a domed shell. Slow independent exploration near a safe retreat. | `pack/animals/10-aldabra-giant-tortoise/concept-animal-habitat.png` |
| `animal-chilean-flamingo` | Chilean flamingo | Pale pink plumage, long slender legs, curved pink neck and black-tipped bill | Grey-white fluffy chick with short bill and legs, not a pink miniature adult. Nest wobble. | `pack/animals/11-chilean-flamingo/concept-animal-habitat.png` |
| `animal-indian-peafowl` | Indian peafowl | Royal-blue neck, small crown crest and emerald eye-spotted male train | Tan-brown peachick, no display train. Short quick follow steps. Adult female requires separate brown-plumage art. | `pack/animals/12-indian-peafowl/concept-animal-habitat.png` |
| `animal-ring-tailed-lemur` | Ring-tailed lemur | Grey body, white face, black eye mask and long black-and-white ringed tail | Small grey infant with large eyes and ringed tail. Cling or stay close to parent. | `pack/animals/13-ring-tailed-lemur/concept-animal-habitat.png` |
| `animal-two-toed-sloth` | Two-toed sloth | Shaggy tan body, rounded dark eye mask and two prominent hooked foreclaws | Small fluffy infant with round face. Cling to parent and practise tiny leaf reaches. | `pack/animals/14-two-toed-sloth/concept-animal-habitat.png` |
| `animal-malayan-tapir` | Malayan tapir | Rounded black body with broad white saddle, short flexible snout and small white-rimmed ears | Brown calf with cream stripes and spots. Do not use the adult white saddle. Follow and sniff. | `pack/animals/15-malayan-tapir/concept-animal-habitat.png` |
| `animal-african-elephant` | African elephant | Large grey rounded body, broad ears, long trunk and clear weight-bearing legs | Round calf with short trunk and no long adult tusks. Trunk wobble and parent follow. | `pack/animals/16-african-elephant/concept-animal-habitat.png` |
| `animal-giraffe` | Giraffe | Tall tan neck, warm brown patches, small ossicones and long elegant legs | Small calf with long thin legs and shorter neck proportions. Careful steps and curious head tilt. | `pack/animals/17-giraffe/concept-animal-habitat.png` |
| `animal-plains-zebra` | Plains zebra | Compact equine body, bold black-and-white stripes and short upright mane | Small foal with large ears and shorter muzzle. Soft juvenile stripe treatment and follow walk. | `pack/animals/18-plains-zebra/concept-animal-habitat.png` |
| `animal-arctic-fox` | Arctic fox | Compact fox with small rounded ears, plush white winter coat and thick fluffy tail | Round fluffy kit with short muzzle and small ears. Tiny pounce and parent-side nap. | `pack/animals/19-arctic-fox/concept-animal-habitat.png` |
| `animal-snow-leopard` | Snow leopard | Pale grey spotted coat, thick long tail, broad paws and rounded ears | Round cub with oversized paws and long soft tail. Low-ledge play and parent-side tail curl. | `pack/animals/20-snow-leopard/concept-animal-habitat.png` |

**Portraits** (`portrait-<id>`, 768×512, **not** transparent): the animal close up and relaxed in its habitat, like the deck's Mochi card. These will fill the animal panel.

## Shared enrichment and fittings: `item-<template>` (384×384)

One picture per template, used by every species for now (the pack wants species-specific versions later). The pack's `shared/modular-habitat-kit.png` shows all 12.

| Key | What | Footprint (tiles) | Sits |
| --- | --- | --- | --- |
| `item-shelter` | a wooden animal shelter with straw | 3×3 | inside |
| `item-feeder` | a log hay feeder | 2×2 | inside |
| `item-water` | a small drinking trough | 2×1 | inside |
| `item-keeper-gate` | a wooden keeper gate with mesh | 1×1 | boundary |
| `item-privacy` | dense leafy planting | 2×2 | inside |
| `item-rest` | a low wooden resting platform with a ramp | 2×2 | inside |
| `item-nursery` | a cosy nest box with soft straw | 3×2 | inside |
| `item-terrain` | a patch of species ground (sand, mud or moss) | 3×3 | inside |
| `item-viewing` | a wooden viewing window with mesh | 2×1 | boundary |
| `item-sign` | a wooden species sign with an animal silhouette | 1×1 | outside |
| `item-border` | a planted flower border | 2×1 | outside |
| `item-shade` | a leafy canopy with a sun sail | 3×3 | inside |

## Signature items: `item-<species>__signature-<n>` (512×384)

Three per species, drawn for that animal. Footprints are 3×3, 4×3 and 5×3 tiles; draw the object to suit.

| Key | Item | Animal does |
| --- | --- | --- |
| `item-capybara__signature-1` | Reed planter | swim |
| `item-capybara__signature-2` | Shaded platform | soak |
| `item-capybara__signature-3` | Floating browse | graze |
| `item-red-panda__signature-1` | Branch bridge | climb |
| `item-red-panda__signature-2` | Leaf pile | curl sleep |
| `item-red-panda__signature-3` | Hanging feeder | paw reach |
| `item-asian-small-clawed-otter__signature-1` | Pebble tray | swim |
| `item-asian-small-clawed-otter__signature-2` | Log tunnel | dive |
| `item-asian-small-clawed-otter__signature-3` | Floating toy | pebble play |
| `item-african-penguin__signature-1` | Nest box | swim |
| `item-african-penguin__signature-2` | Smooth ramp | dive |
| `item-african-penguin__signature-3` | Underwater ring | preen |
| `item-meerkat__signature-1` | Sand mound | stand watch |
| `item-meerkat__signature-2` | Lookout stump | dig |
| `item-meerkat__signature-3` | Buried puzzle | huddle |
| `item-fennec-fox__signature-1` | Dig box | ear twitch |
| `item-fennec-fox__signature-2` | Scent trail | pounce |
| `item-fennec-fox__signature-3` | Forage ball | den sleep |
| `item-rabbit__signature-1` | Willow tunnel | nibble |
| `item-rabbit__signature-2` | Hay rack | groom |
| `item-rabbit__signature-3` | Forage patch | binky |
| `item-pygmy-goat__signature-1` | Broad ramp | step up |
| `item-pygmy-goat__signature-2` | Stump cluster | browse |
| `item-pygmy-goat__signature-3` | Browse rack | head tilt |
| `item-alpaca__signature-1` | Dust patch | graze |
| `item-alpaca__signature-2` | Browse rack | chew |
| `item-alpaca__signature-3` | Shade sail | dust roll |
| `item-aldabra-giant-tortoise__signature-1` | Low browse rack | browse |
| `item-aldabra-giant-tortoise__signature-2` | Shallow soak | soak |
| `item-aldabra-giant-tortoise__signature-3` | Textured trail | neck stretch |
| `item-chilean-flamingo__signature-1` | Wading shelf | wade |
| `item-chilean-flamingo__signature-2` | Mud island | preen |
| `item-chilean-flamingo__signature-3` | Reed screen | one leg rest |
| `item-indian-peafowl__signature-1` | Roost perch | forage |
| `item-indian-peafowl__signature-2` | Leaf litter | roost |
| `item-indian-peafowl__signature-3` | Display clearing | fan display |
| `item-ring-tailed-lemur__signature-1` | Rope bridge | climb |
| `item-ring-tailed-lemur__signature-2` | Sunny terrace | sunbathe |
| `item-ring-tailed-lemur__signature-3` | Forage box | social groom |
| `item-two-toed-sloth__signature-1` | Branch bridge | climb slow |
| `item-two-toed-sloth__signature-2` | Elevated feeder | leaf reach |
| `item-two-toed-sloth__signature-3` | Leafy nook | hang sleep |
| `item-malayan-tapir__signature-1` | Mud wallow | sniff |
| `item-malayan-tapir__signature-2` | Scent trail | wade |
| `item-malayan-tapir__signature-3` | Shaded pool | wallow |
| `item-african-elephant__signature-1` | Heavy browse log | trunk browse |
| `item-african-elephant__signature-2` | Mud wallow | dust bathe |
| `item-african-elephant__signature-3` | Water spray | water spray |
| `item-giraffe__signature-1` | High browse rack | high browse |
| `item-giraffe__signature-2` | Shade canopy | neck turn |
| `item-giraffe__signature-3` | Scent post | rest |
| `item-plains-zebra__signature-1` | Dust patch | trot |
| `item-plains-zebra__signature-2` | Browse pile | graze |
| `item-plains-zebra__signature-3` | Shade grove | dust roll |
| `item-arctic-fox__signature-1` | Dig patch | listen |
| `item-arctic-fox__signature-2` | Scent log | pounce |
| `item-arctic-fox__signature-3` | Puzzle mound | curl sleep |
| `item-snow-leopard__signature-1` | Rock ledge | climb |
| `item-snow-leopard__signature-2` | Scent post | tail wrap |
| `item-snow-leopard__signature-3` | Suspended forage | ledge rest |

## Park buildings: `build-<key>` (384×384)

| Key | What |
| --- | --- |
| `build-path` | Path: Guests and keepers can only reach what a path reaches. |
| `build-icecream` | Ice Cream Cart: Everyone needs a cone. |
| `build-toilet` | Loos: Earns nothing. Guests stay longer and enjoy it more. |
| `build-snacks` | Snack Kiosk: Pretzels, crisps and carrot sticks (for the humans). |
| `build-gifts` | Gift Shop: Plushies of your animals. Sells better with more species. |
| `build-cafe` | Tea Room: Tea and cake. Very British. |
| `build-flowers` | Flower bed: A splash of colour. |
| `build-tree` | Tree: Shade for tired legs. |
| `build-bench` | Bench: Guests stay a bit longer. |
| `build-lamp` | Lamp post: A warm glow at closing time. |
| `build-fountain` | Fountain: Coins in, wishes out. |
| `build-statue` | Golden Paw: For the best zoo in town. |

## Little things

| Key | Size | |
| --- | --- | --- |
| `gate` | 512×512 | the zoo's entrance arch (see the park overview) |
| `tile-grass` | 256×128 | seamless lawn diamond |
| `tile-path` | 256×128 | seamless warm flagstone path diamond |
| `poop` | 128×128 | a small, cute (not gross) poop |
| `logo` | 1024×512 | "Cutise Zoo" wordmark (the one picture with text) |

## Checking a picture before it goes in

- Transparent where it should be; the subject stands on the bottom edge; nothing else in the frame.
- It matches its concept sheet (markings, proportions) and the palette.
- Babies look like babies of that species, not small adults.
- Then `npm run zoo-art`, reload, and look at it at normal zoom and zoomed in. Pack labels: concept → production → integrated → tested.
