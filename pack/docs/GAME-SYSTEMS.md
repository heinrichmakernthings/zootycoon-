# Animal and habitat systems

## Player loop
Buy an animal or a compatible adult pair. Build a suitable enclosure. Watch animals explore and use enrichment. Solve specific needs. Enable breeding when ready. Name and raise the baby. Keep the grown animal, move it to another habitat or sell it. Expand the enclosure or buy adjoining park land to support a larger family.

## Data ownership
`data/species.json` is the aggregate species-definition source. `data/items.json` is the aggregate build catalogue. The matching per-species files are identical excerpts for convenient review; regenerate or update both if definitions change. Runtime animal instances must not mutate species definitions.

Species IDs and item IDs are stable strings. Resident IDs, enclosure IDs, pregnancy/event IDs, purchase IDs and save IDs are unique instance identifiers. Names are editable display strings, never keys.

## Minimal resident model
Persist: id, speciesId, name, sex, lifeStage, ageInStageGameDays, parentIds, ancestorIds, traitId, wellbeing, health, habitatId, worldPosition, currentAction, caregiverId, breedingEnabled, breedingEventId and transactionLock. Store pregnancy and egg records separately with parent IDs, due simulation time and reserved child ID.

Do not infer sex from the example character name or one hero illustration. Use proper adult appearance variants where required; the peafowl board includes a male hero, and a peahen production asset is still needed.

## Needs
Compute food, water, comfort, social and enrichment on a 0–100 scale. Initial wellbeing is their equal-weight mean, with health displayed separately. Clamp all metrics to 0–100. Food/water/health emergencies appear before an enrichment suggestion. A species has one signature priority to make its needs feel different without adding a new tab for every species.

Functional objects supply reachable interaction anchors. A feeder behind a blocked gate does not supply food. Repeated identical enrichment adds more simultaneous access but not unlimited variety. A decorative sign never counts as shelter or feeding capacity.

## Behaviour selection
Prioritise urgent need, caregiver connection where applicable, a reachable favourite activity, then idle roaming. Reassess on a staggered schedule rather than every render frame. Avoid repeated back-and-forth by adding action commitment duration and short per-object cooldowns. Use seeded randomness saved with the world for reproducible behaviour and breeding events.

An action needs a valid anchor, path, capacity reservation and animation. If a prop disappears, safely cancel that action and choose a new reachable rest or roam target. Never teleport silently to a locked or inaccessible area.

## Action feedback
Examples: capybara starts resting in shade; red panda uses a new branch circuit; meerkat takes a lookout turn; goat steps onto a ramp; elephant visits a wallow. A small one-time message can explain a newly unlocked action. Ambient animation continues without constant notifications.

## Item interpretation
`effect.type` and `effect.value` describe proposed effects, not implemented engine functions. Slots are integer capacities. Privacy, shade, terrain_match, appearance, education and view_quality are points subject to category caps. `enrichment_variety` counts unique reachable signature item types, capped at three for the first release. `behaviour` is an animation/interaction hook.

The 12 shared template objects get species-appropriate art and anchor treatment. A tortoise feeder differs from a giraffe feeder even when both use the feeder template. Never copy the same collision profile to every species. Habitat scene text and the three signature items specify those differences.

## Population capacity
`physicalCapacity = floor(reachableUsableTiles / tilesPerResidentSlot)`.
`supportedCapacity = min(physicalCapacity, shelterSlots, feedSlots, waterSlots)`.
`freeSlots = supportedCapacity - liveResidents - reservedOffspring`.

Every age stage consumes one eventual adult slot so growth never silently creates overcrowding. Count each tile once, even if both land and water routes touch it. Exclude solid footprints, unreachable islands and guest-only paths. A supported swim surface can count as usable area for that species; decorative water cannot. Elevated paths do not add area in the first version.

For the first implementation, evaluate service anchors and habitat membership rather than real animal husbandry. Initial group ranges guide scenarios; they are not hard population limits. Additional objects and land can support a larger group.

## Save contract
Save version, simulation time, seed/state, unlocked chunks, enclosure polygons, placed-item instance IDs, residents, ancestry, active breeding events, reserved capacity, market offers and completed transaction IDs. Load atomically. Never create a second baby when replaying a due event after reload. Keep an automatic pre-migration backup.
