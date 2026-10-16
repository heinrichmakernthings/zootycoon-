# Cutise Zoo: art brief for ChatGPT

Every picture in the game has a **key**. Until its file exists, the game draws an emoji stand-in, so art can arrive one piece at a time and nothing breaks.

**To add a picture:** save it as `assets/<key>.png` (or `.webp`), run `npm run zoo-art`, and reload. The tool lists what's ready and warns about any file that isn't a known key.

## The style prompt (paste first, every time)

> Cosy storybook illustration for an isometric zoo management game called Cutise Zoo. Rounded, chubby silhouettes; soft painted texture kept simple for a game sprite; gentle soft shading, light from the top-left; warm, quiet colours from this palette: cream #FBF5E8, sage #A7BA91, apricot #E8B58A, pond blue #9EC7C7, forest ink #244638 for darkest lines. Friendly, kind expressions with small dot eyes and a hint of blush. No text, no logos, no frame, no border. **Transparent background (PNG).** No cast shadow on the ground (the game draws its own). The subject fills the canvas width with a small even margin and **stands on the bottom edge** (bottom-centre is where it touches the ground).

Then add the line for the asset (below). Keep one ChatGPT conversation per group (all animals, all items) so the style stays consistent, and start each group by showing it `docs/refs/deck-concept-art.jpg` (the character line-up and style).

## The camera

The game is **2:1 isometric** (dimetric): a floor tile is a diamond twice as wide as it is tall. Objects are seen from about 30° above, turned so their front faces the bottom-left. Animals face **left**; the game mirrors them to walk right.

## Animals (`animal-<id>`, 512×512, transparent)

Full body, standing, three-quarter view facing left, at the game's angle. The same size canvas for every animal; the game scales by species, so fill the width.

| Key | Animal | Personality note |
| --- | --- | --- |
| `animal-capybara` | Capybara | sociable lounger, eyes half-closed and content |
| `animal-redpanda` | Red panda | curious climber, big fluffy striped tail |
| `animal-otter` | Otter | energetic explorer, mid-wiggle |
| `animal-penguin` | Penguin | playful swimmer, flippers out |
| `animal-bunny` | Rabbit | soft and round, one ear flopped |
| `animal-duck` | Duck | puddle enthusiast |
| `animal-hedgehog` | Hedgehog | snuffly, tiny nose up |
| `animal-seal` | Seal | professional napper |
| `animal-koala` | Koala | sleepy, clutching a leaf |
| `animal-sloth` | Sloth | slow smile |
| `animal-monkey` | Monkey | cheeky grin |
| `animal-giraffe` | Giraffe | gentle lookout (tall: still 512 wide, can be 512×768) |
| `animal-panda` | Giant panda | bamboo in paw |
| `animal-lion` | Lion | big softie, fluffy mane |
| `animal-elephant` | Elephant | wise old soul, trunk curled |
| `animal-tiger` | Tiger | loves a swim, damp fur |

**Babies** (optional, same names plus `-baby`, e.g. `animal-capybara-baby`): the same animal, rounder, bigger head, smaller body.

**Portraits** (`portrait-<id>`, 768×512, **not** transparent): the animal close up, relaxed in its habitat, like the deck's "Mochi" card (a capybara in warm water). These fill the animal panel.

## Habitats (`habitat-<biome>`, 768×384, transparent outside the diamond)

The **ground only** of a 3×3 habitat, seen from above at 2:1: a diamond that touches all four edges of the canvas. No fence, no animals, no buildings (the game draws those). Soft painted ground with tiny details at the edges.

| Key | Ground |
| --- | --- |
| `habitat-wetland` | grass with a kidney-shaped pond in the middle, lily pads, reeds at the rim |
| `habitat-woodland` | mossy forest floor, fallen leaves, a few ferns |
| `habitat-meadow` | soft meadow grass with daisies |
| `habitat-ice` | snow and pale blue ice with a small pool |
| `habitat-jungle` | dark rich earth, big leaves, a small stream |
| `habitat-savanna` | golden dry grass, sandy patches, a few rocks |

## Floor tiles (256×128, transparent outside the diamond)

| Key | |
| --- | --- |
| `tile-grass` | soft sage lawn with a few blades, seamless at the edges |
| `tile-path` | warm cream flagstone or packed-earth path, seamless at the edges |

## Enrichment items (`item-<id>`, 384×384, transparent)

| Key | Item |
| --- | --- |
| `item-shelter` | a small thatched wooden animal hut with a round doorway |
| `item-shade` | a leafy round tree (a resting spot underneath) |
| `item-pool` | a small rocky splash pool |
| `item-climb` | logs and a rope bridge between two posts |
| `item-toy` | a wooden toy crate with a ball and a puzzle feeder |
| `item-bed` | a round straw nest |
| `item-rocks` | flat warm sun rocks |
| `item-slide` | a little ice slide into water |

## Amenities and decorations (transparent)

| Key | Size | |
| --- | --- | --- |
| `gate` | 512×512 | the zoo's entrance arch, wooden, with a blank sign and bunting |
| `shop-icecream` | 384×384 | a pastel ice cream cart with a striped awning |
| `shop-toilet` | 384×384 | a tidy little loo block with a green roof |
| `shop-snacks` | 384×384 | a pretzel and crisps kiosk |
| `shop-cafe` | 384×384 | a tea room with a green roof and outdoor tables |
| `shop-gifts` | 384×384 | a gift shop with plushies in the window |
| `decor-flowers` | 256×256 | a round flower bed |
| `decor-hedge` | 256×256 | a neat clipped hedge |
| `decor-bench` | 256×256 | a wooden park bench |
| `decor-lamp` | 256×384 | a black iron lamp post with a warm glow |
| `decor-sign` | 256×256 | a wooden info board with an animal silhouette |
| `decor-fountain` | 384×384 | a small stone fountain |
| `decor-statue` | 384×384 | a golden paw-print statue on a plinth |

## Little things

| Key | Size | |
| --- | --- | --- |
| `bowl` | 128×128 | a food bowl with greens |
| `poop` | 128×128 | a small, cute (not gross) poop |
| `staff-keeper`, `staff-guide` | 384×384 | a keeper in green with a bucket; a guide with a clipboard (for the Staff panel and, later, walking sprites) |
| `logo` | 1024×512 | "Cutise Zoo" wordmark (the one picture that has text) |

## Checking a picture before it goes in

- Transparent where it should be, and the subject stands on the bottom edge.
- It matches the palette and the line-up (put it next to the capybara).
- Habitats and tiles: the diamond touches the canvas edges, with nothing outside it.
- Then `npm run zoo-art`, reload, and look at it at normal zoom and zoomed in.
