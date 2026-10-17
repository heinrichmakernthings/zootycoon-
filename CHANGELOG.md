# Changelog

## 0.2.0 — the animal pack

- **Real art.** 124 sprites from Codex: all 20 animals as adults and babies, the 12 shared fittings, 60 signature items and 12 park buildings, replacing the emoji. Each was checked (size, transparency, standing on the ground, facing left, baby proportions). Items now scale to their footprint; animals stand in front of feeders and shelters and on top of platforms and pools; shops are drawn a little larger; the market, catalogue, faces and birth reveal show the pictures. The game ships WebP copies (4.7 MB instead of 28.5 MB) and loads each picture only when it's first needed. Originals are kept in `art-source/`.

- **20 species from the animal design pack**: capybara, red panda, otter, penguin, meerkat, fennec fox, rabbit, pygmy goat, alpaca, giant tortoise, flamingo, peafowl, lemur, sloth, tapir, elephant, giraffe, zebra, arctic fox and snow leopard. They unlock in four stages as your care reputation grows. The first of each gets the pack's example name (Mochi, Maple, Pebble…).
- **Enclosures you size yourself.** Drag out a fence for one species, then fill it from that species' 15-item catalogue (300 items in all): shelters, feeders, water, keeper gates, shade, privacy planting, nursery nooks, viewing windows, signs, borders and three signature items each. Items have real footprints and rotate. Gates and windows go in the fence; signs and borders just outside.
- **Capacity that makes sense.** An enclosure supports as many animals as its space, shelter, food and water allow, and the panel shows which is the bottleneck. A feeder only counts if keepers can reach it through a keeper gate next to a path.
- **Five needs and health.** Food, water, comfort, social and enrichment, plus each species' priority need (shade, climbing, nesting…). The fix for each problem is one tap away.
- **Animals that use what you build.** They walk between feeding, drinking, resting and play spots and try new items soon after you place them ("Mochi tried the new reed planter!").
- **Families.** Switch breeding on, choose a pair and meet the checklist (unrelated, well cared for, a nursery, room). Then a baby arrives, or a chick hatches, with a reveal where you name it. Babies grow into juveniles and adults, keep their parents, and follow their mum about. Close relatives can't pair.
- **The market.** Six adult animals for sale each day. Buying and selling ask first and can't charge twice. Selling returns 60%. Expecting parents and parents of young can't be sold. Family history is kept.
- **A bigger park.** Start on four 32×32 plots and buy neighbouring ones (750 coins, then 35% more each). Resize enclosures without losing anyone.
- **The pack's clock.** A day is 5 minutes. Pausing stops everything, and there's no progress while you're away, so no surprise births.
- **Old zoos** move to the new park: name, days, reputation and visitors carry over, and the old zoo is sold back so you can rebuild. A copy of the old save is kept on the device.
- **Fixes found while testing:** quick drags with the path tool no longer skip tiles; the pair picker no longer leaves Start disabled after you choose.
- **For developers:** `npm run pack` builds `js/pack-data.js` from `pack/data`, and the tests fail if it's stale. 29 tests follow the pack's acceptance list. `tools/bench.js` measures the rules at 20, 75 and 150 animals.

## 0.1.0 — first playable groundwork

- Isometric park, the deck's palette, 16 species, 3×3 habitats, visitors, goals and the first-15-minutes script.
