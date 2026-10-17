# Cutise Zoo: design notes

> **A little zoo. A lot of personality.** A cosy, single-player isometric zoo tycoon for the desktop browser, with touch-friendly controls.

There are two sources:

- **The design deck** (*Cutise Zoo Tycoon — Game design & visual direction, Concept 01*). It sets the look, the screen layout, the first 15 minutes and the UX rules. Key images are in `refs/`.
- **The animal design pack** (`pack/`, version 1.0). It sets the 20 species, the 300-entry build catalogue, and how breeding, trading, enclosure resizing and park land work. Its JSON drives the game: `npm run pack` turns it into `js/pack-data.js`.

Numbers the game adds live in `js/content.js`; the rules are in `js/sim.js`.

## The loop (pack: GAME-SYSTEMS)

1. **Fence an enclosure** for one species: drag out a rectangle on land you own.
2. **Fill it** from that species' 15-item catalogue. A keeper gate goes in the fence beside a path. Then come a shelter, a feeder, water, shade and their signature items.
3. **Buy animals** at the market: six adult listings a day.
4. **Watch and fix:** animals walk between feeding, resting and play spots. When something's wrong, the panel says what and offers the fix.
5. **Raise a family:** switch breeding on, pick a pair, meet the checklist, then confirm.
6. **Grow:** resize enclosures, buy neighbouring land, unlock new species with care reputation.

## How the pack maps onto the game

| Pack | In the game |
| --- | --- |
| 20 species, stable ids (`capybara`, `red-panda`…) | `D.SPECIES`, built from `pack/data/species.json`. The first animal of each species gets the pack's example name (Mochi, Maple…). |
| 300 catalogue entries (12 templates + 3 signature items per species) | `D.ITEMS` and `D.CATALOGUE`. Each enclosure only offers its species' 15. |
| Placement: inside / boundary / outside, footprints, rotations | `Sim.placeProblem` explains any refusal. Gates and viewing windows go in the fence. Signs and borders go just outside. Shelters, feeders, water, nursery and privacy planting are solid; the rest can be walked on. |
| Upgrade levels 1–3 | An item's level needs the tier below it: level 2 needs "A safe home", level 3 needs "A place to explore". |
| Capacity: `physical = floor(usable / tilesPerSlot)`, `supported = min(physical, shelter, feed, water)` | `Sim.habStats`. The panel shows all four numbers and which one is the bottleneck. **A feeder only counts if keepers can reach it** (keeper gate next to a path). Every life stage takes an adult slot, and so does a baby on the way. |
| Needs: food, water, comfort, social, enrichment (0–100); wellbeing is the plain mean; health is separate | `Sim.needs`. The species' **priority need** (shade, climbing, nesting…) gets its own fix button, using the pack's `action_label`. |
| Behaviour: urgent need, then parent, then favourite, then roam; commitment; per-object cooldown; seeded | `chooseAction` in `sim.js`. A newly placed item is tempting, so you see it used; the first use is announced. If a prop disappears, its users choose again. |
| Breeding: off by default, explicit pair, checklist, one offspring, reserve the slot first, state machine | `Sim.readiness` and the `breed` action. A due birth replayed after a reload never makes a second baby: the child's id is reserved when the event starts. |
| Baby → juvenile → adult, parent links, no death | Growth keeps the id, name, trait and parents. Babies follow their carer, except tortoise hatchlings. Egg-laying species hatch. |
| Trading: adults only, 60% back, atomic, once per click | `buy` / `sell` take a transaction id; a repeat is ignored. Expecting parents and carers of young can't be sold. Family history is kept in `departed`. |
| Resizing: same enclosure, preview, reject anything that strands an animal or prop | `resize` / `Sim.resizeProblem`. You pay for new fence and new ground only. |
| Land: 32×32 chunks, start 2×2, up to 6×6, adjacent only, `750 × 1.35^n`, 5 coins/plot/day | `buyLand` / `Sim.landForSale`. |
| Clock: 300 s game day at 1×, pause freezes, no offline progress | As specified. The old catch-up while away was removed, so returning never fills the park with surprise births. |
| Scale targets 20 / 75 / 150 residents | `node tools/bench.js`: 0.07 / 0.19 / 0.42 ms of rules per game second, saves 15 / 43 / 79 KB. Drawing speed still needs measuring on real devices. |

## What the game adds

- **Visitors and money.** Tickets (against a fair price that rises with care), amenities, crowding on paths, daily running costs (animals by life stage, wages, land, buildings) and a day report.
- **Care reputation.** Never spent. It rises while animals are well, and unlocks the pack's stages: starter (0), early (150), mid (700), late (2,000).
- **Traits.** Sociable, shy, playful, sleepy, foodie and curious each nudge one need.
- **Goals.** The deck's first 15 minutes, then the pack's build order (see `GOALS` in `content.js`).

## Status against the pack's acceptance list

| # | Milestone | Status |
| --- | --- | --- |
| 1 | A living enclosure | ✅ tested: anchors, staying inside, a new item producing a new action |
| 2 | Reliable data and saves | ✅ tested: round trip, junk saves, version 1 → 2 upgrade with a backup of the old save |
| 3 | Trade | ✅ tested: double click, refusals change nothing, buy-then-sell loses |
| 4 | Families | ✅ tested: off means nothing happens, reserved slot, save/reload at the due moment, relatives, carers |
| 5 | Modular building and expansion | ✅ tested: feeder vs border, unreachable feeder, resize, land charged once |
| 6 | Different locomotion | ⏳ not yet: everyone walks. Climbing routes, swim navigation, ramps and overhead routes need runtime sprites and path networks. |
| 7 | Scale and usability | 🟡 rules benchmarked. Browser frame timing and the new-player test are still to do. |

## Next

1. A new-player playtest of the pack's script: create a habitat, spot a care issue, place the fix, start breeding, find the newborn, expand.
2. The last 25 pictures (portraits, gate, ground tiles, logo), then idle, walk and sleep loops for the animals.
3. Locomotion (milestone 6): connected climbing anchors, separate land and swim routes.
4. Move and rotate placed items; free-form fence outlines.
5. Seasonal scenery, conservation projects, a fuller photo album.
