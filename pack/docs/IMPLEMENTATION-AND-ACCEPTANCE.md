# Implementation milestones and acceptance checks

## 1. A living enclosure
Use capybara. Place a complete boundary, reachable keeper gate, shelter, food, water and shade. Add two individually named residents. One added item must produce a visible new action. Animals must remain inside and avoid solid props.

## 2. Reliable data and saves
Use definition IDs separately from instance IDs. Save, reload and verify names, needs, items and positions. Reject malformed data with a useful error. Back up and migrate older saves rather than resetting the zoo.

## 3. Trade
Buy once despite double click. Insufficient funds or full enclosure must leave all state unchanged. Sell once despite retry. Retain ancestry and history. Check that buy/sell flipping loses coins. Confirm the chosen destination and upkeep before purchase.

## 4. Families
Disabled breeding never creates an event. An eligible confirmed pair reserves one slot. A full enclosure blocks the attempt. Save/reload at the due moment creates one baby with the expected ID and parents. Turning breeding off preserves an existing event. Growth keeps the same resident ID. Buying and selling must not consume a reserved birth slot.

Close relatives cannot pair. Expecting parents and required caregivers cannot be sold. Tortoise hatchlings do not use mammal parent-follow. Egg-phase species use the appropriate visual flow. Baby, juvenile and adult counts display correctly.

## 5. Modular building and expansion
A new feeder can raise service capacity; a flower border cannot. An unreachable feeder contributes zero. Adding land cannot bypass the shelter bottleneck. Resizing cannot strand an animal, remove an active nest or corrupt parent links. Adjacent chunk purchases charge exactly once. Cancelled previews charge nothing.

## 6. Different locomotion
Red panda uses connected climbing anchors. Penguin uses separate land and swim navigation with valid transitions. Goat uses broad low ramps. Sloth follows a continuous overhead route. Giant animals fit their paths and interaction clearances. Never derive collision size directly from the concept image's screen dimensions.

## 7. Scale and usability
Benchmark 20, 75 and 150 residents on the target browser/device. Record frame time, simulation time and save size. Test with a large zoo, several births due and a fence edit. Do not advertise a resident limit until measured. Reduced-motion mode stops decorative motion without breaking simulation.

Ask a new player to create a habitat, identify a care issue, place the correct item, enable breeding, find the newborn and expand the habitat. Record where they get lost. Keep contextual fixes visible and explain blocked actions.

## Completion definition
The art/design pack is delivered. Game implementation is complete only when the existing project passes these behavioural checks with production or explicitly labelled prototype assets. The pack validator verifies files, not gameplay.
