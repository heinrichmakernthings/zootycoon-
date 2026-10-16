# Expandable enclosures and a living park

## Build categories
Care, comfort, family, terrain, viewing, decoration and species enrichment. Each enclosure exposes 15 proposed catalogue entries. Filter to compatible pieces automatically, then let players browse by category. Allow rotation, move, preview, undo and a clear cost total. Appearance variations can share behaviour and collision data when appropriate.

## Enclosure resizing
1. Select enclosure and choose Expand. Pause simulation during edit.
2. Drag a closed boundary or paint additional tiles on owned land.
3. Preview new area, supported population, fence cost, affected objects and keeper access.
4. Reject self-intersections, overlap, inaccessible islands, unowned land and lost critical interaction routes.
5. Commit geometry, coins, fence segments and navigation changes as a single transaction.

Keep the same enclosure ID. Preserve names, family state, props and camera focus. Queue new navigation routes safely. A shrink is invalid when it excludes a resident, required object, nest or reserved offspring capacity. Ask for relocation before accepting it. Undo before commit is free; post-commit edits use a deliberate undo transaction and must not duplicate refunds.

Adding space alone raises physical capacity only. Show when shelter, food or water remains the bottleneck and link to the relevant build category. Do not let a dense pile of identical props produce unlimited welfare. Calculate functional reachability before benefits apply.

## Park land
Start with four 32 x 32 chunks in a 2 x 2 block. Purchase an adjacent orthogonal chunk, show its price and recurring land upkeep, then confirm. Initial extent target is a 6 x 6 chunk grid, not a performance guarantee. Each chunk purchase has a persistent transaction ID.

Suggested price: round(750 x 1.35^numberOfPreviouslyPurchasedExpansions). Upkeep: 5 coins per owned chunk per game day. Adjacent chunks are empty buildable land; future variants may add ponds or terrain. Preview terrain before payment. New land does not automatically connect paths or create an enclosure.

## A busy zoo without visual noise
- Animals have different schedules, route choices and favourite objects.
- New enrichment causes a visible behaviour change; baby arrivals alter family movement.
- Enclosures can support several simultaneous activities at separate anchors.
- Use staggered animation phases so a herd does not walk or idle in perfect sync.
- Visitor movement and keeper rounds connect the habitats, but their full systems remain outside this animal-only pack.
- Seasonal foliage and small ambient effects are cosmetic extensions. They must not silently change care requirements.
- One notification queue combines repeated issues. Births are special events; ordinary feeding is ambient.

## Scale plan for Claude Code
Proposed test scenes: 20 residents for the first slice, then 75 and 150 residents across all unlocked habitats. These are benchmark targets, not verified limits. Profile the actual engine and device before raising the cap.

Keep rendering and simulation separate. Cull offscreen sprites, share sprite atlases and cached paths, stagger need checks and avoid expensive per-frame scans of every object. Update offscreen needs at a lower frequency while preserving the same simulated outcome. Recalculate navigation only in affected chunks after edits.

Save/load must preserve a large park with animals mid-action, an active birth reservation and a pending land transaction. A low-performance mode can reduce decorative particles and animation rate without deleting residents or slowing care timers.

## Extra content after the foundation
Biome-specific plant variants, alternate shelters, nest boxes, different climbing bridges, water jets, rock sets, hideouts and seasonal scenery. Add new entries to the same catalogue. Mixed-species enclosures, complex genetics, disease simulation, animal death and ride systems are deferred to keep the first release manageable.
