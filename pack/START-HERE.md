# Cutise Zoo: animal project handoff for Claude Code

Version 1.0 — 16 October 2026

## The requested game
A cute, dynamic zoo tycoon with 20 animal species, babies, simple breeding, buying and selling, customisable enclosures and an expanding park. Animals should visibly use what the player builds. This pack covers animals and habitats; it does not replace the rest of the zoo game's design.

## Read first
1. Open `OPEN-ME.html` in a browser to browse all artwork locally. No server or dependencies required.
2. Read `docs/GAME-SYSTEMS.md`, `docs/BREEDING-AND-TRADING.md` and `docs/EXPANSION-AND-DYNAMIC-LIFE.md`.
3. Load `data/species.json`, `data/items.json` and `data/systems.json` as proposed data contracts.
4. Read `docs/ART-DIRECTION-AND-ASSET-STATUS.md` before using any PNG as a runtime asset.
5. Use `docs/IMPLEMENTATION-AND-ACCEPTANCE.md` for milestones and meaningful checks.

## What is actually included
- 20 species folders, each with a full-resolution animal/habitat PNG, animal brief, habitat brief, animation brief, species JSON and 15-item catalogue.
- 24 original concept PNGs in total: 20 species sheets, two nursery boards, one modular-build kit and one park expansion scene.
- Baby visual references for all 20 species: the first eight appear in shared nursery boards, the remaining twelve in their species sheets.
- 300 species-specific catalogue entries: 12 shared templates adapted per species plus 3 signature items each. This means 60 signature items and 240 template instances, not 300 individually illustrated sprites.
- Shared breeding, trading, enclosure resizing, park growth and simulation requirements.
- A presentation outline, a link to the illustrated presentation, and a local visual gallery.

## What is NOT implemented
No playable game, engine integration, runtime animations, transparent character cutouts, collision meshes or individual prop sprites. The PNGs are flattened concept sheets with backgrounds. Do not use them as moving animal sprites or stretch whole habitat images to pretend that modular building works. Prototype with existing project assets or clearly identified placeholders, then commission the missing production assets.

## Instructions for integration
Inspect the existing codebase and its own instructions first. Keep its framework, save system and naming conventions where practical. Map these stable species/item IDs into the project instead of creating a second unrelated simulation. Treat these JSON files as a design contract to adapt, not proof that the existing engine already accepts the shape.

Retain original saves and provide a versioned migration. Do not overwrite unrelated game systems. Keep the art pack in its own asset folder and preserve the source PNGs.

## Recommended build order
1. One expandable habitat, reachable keeper access and two capybaras. Add one item that visibly changes their behaviour.
2. Animal instance IDs, needs, save/load and a reliable capacity calculation.
3. Adult purchases and sales with atomic transactions.
4. Family IDs, nursery readiness, breeding reservations, baby/juvenile/adult lifecycle and notifications.
5. Adjacent land purchases and safe enclosure resize previews.
6. Rabbit, red panda and penguin to prove ground, climbing and water behaviours.
7. Load the other species from data and benchmark a large park before increasing density.

## Design rules that matter most
- One simple contextual animal panel: overview, family, buy/sell or move. Keep important actions visible.
- Babies are independently named residents with parent IDs and distinct art.
- Breeding starts with an explicit toggle and selected pair. Reserve enough eventual adult space first.
- Animals move between feeding, rest and enrichment anchors. Added items create new activity choices.
- Habitat tiers follow completed useful construction. They are not a fixed cap on expansion.
- More animals require more space, shelter and service capacity. Do not cap every species at the initial suggested group size.
- One species per enclosure for the first version. Mixed habitats are deferred.
- No hard dependency on real-world dates. Timers use paused/speed-adjusted simulation time.

All times, prices, population suggestions and tile dimensions are untested game design values, not animal-care standards. Habitat pictures illustrate appearance and are not containment engineering plans. Resolve animal factual details before presenting an educational animal encyclopaedia.

## Verify the delivered files
Run `python3 tools/validate-pack.py` from the extracted project root. The validator checks all 20 species, 300 item IDs, file references and artwork hashes. It does not test a game implementation.
