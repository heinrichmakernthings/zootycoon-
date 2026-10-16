# Cutise Zoo: design notes

> **A little zoo. A lot of personality.** A cosy, single-player isometric zoo tycoon for the desktop browser, with touch-friendly controls.

The source is the design deck *Cutise Zoo Tycoon — Game design & visual direction, Concept 01, October 2026*. Its key images are in `refs/`: `deck-concept-art.jpg` (cast, habitats, style) and `deck-game-screen.jpg` (screen layout). This page records how each part of the deck maps onto the code, what is built and what comes next. Numbers live in `js/content.js`, rules in `js/sim.js`.

## The pillars (from the deck)

| Deck | In the game |
| --- | --- |
| **Player fantasy:** turn a tiny local park into a thriving, personal zoo | You start with an empty park, a gate, one tile of path and 1,200 coins. |
| **Emotional hook:** name your animals, learn their habits, watch them enjoy what you build | Every animal gets a name, a **trait** (sociable, shy, playful, sleepy, foodie, curious) and a **favourite item**. Animals head for the pool, hop when happy and show a thought bubble when something's wrong. |
| **Format:** isometric management, desktop first, touch friendly | 2:1 isometric canvas with pan, zoom (wheel, pinch, + −), tap to select, drag to lay paths. Phones get a bottom-sheet panel. |
| **Storybook warmth:** rounded silhouettes, soft shadows, quiet ground colours | Palette tokens in `css/zoo.css`: Cream `#FBF5E8`, Sage `#A7BA91`, Apricot `#E8B58A`, Pond blue `#9EC7C7`, Forest ink `#244638`. Fraunces for titles, Nunito for text. |

## The everyday loop

1. **Build a habitat:** a 3×3 fenced plot in one biome, next to a path joined to the gate.
2. **Welcome animals:** adoption offers arrive as your care reputation grows.
3. **Care and observe:** keepers feed and tidy. You fix clear problems.
4. **Earn and expand:** visitors pay at the gate and at amenities. Good care brings new offers.

## Care: three bars, one problem at a time

Happiness is made of the three bars from the deck's Mochi panel:

- **Food:** the habitat's bowl. Keepers top it up; you can too (10 coins).
- **Comfort:** what the animal wants is in the habitat (a shelter, its species' wants, its trait's want), plus a bonus for its favourite item. Poop, crowds (for shy animals) and a signature habitat move it.
- **Social:** enough of its own kind around.

`Sim.problem()` turns the worst need into words and a fix, as the deck asks: *"Mochi needs shade"* with an **Add shade tree · 50** button. Problems come in this order: can't be reached, hungry, missing shelter, missing favourite, missing wants, messy, lonely, would love their favourite, shy of crowds.

## Habitats that visibly improve (the deck's three tiers)

1. **A safe home:** shelter, food and keeper access (a path).
2. **A place to explore:** everything its residents want.
3. **A signature habitat:** all of that, plus 3+ decorations planted round the fence.

Higher tiers draw more visitors (`tierAppeal`), and a signature habitat makes its animals more comfortable.

## A gentle tycoon with real choices

- **One spendable currency (coins).** No energy timers and no paid care boosts.
- **Care reputation** is earned, never spent. It rises while animals are well (and falls while they aren't), and from visitors who enjoyed their day. It unlocks adoption offers, buildings, staff and the zoo's stage: *Opening day* → *A local favourite* (500) → *Your dream zoo* (2,500).
- **Running costs:** wages and upkeep per building, paid at the end of each day. The Zoo panel shows yesterday's net and tonight's costs; the day report shows the full sum.
- **Ticket price** against a fair price that rises with care and amenities. Overcharge and fewer come.
- **Crowding:** more visitors than your paths can hold lowers enjoyment, and shy animals hide.

## The first 15 minutes (the goal card)

| Minutes | Deck | Goals |
| --- | --- | --- |
| 00–03 | Make it yours | Name the zoo · lay 4 path · build a Wetland habitat |
| 03–06 | Meet the residents | Welcome two capybaras |
| 06–10 | Solve a small need | Shelter · a shaded resting spot · hire a keeper · open the gates · 15 visitors |
| 10–15 | Choose what comes next | Build an amenity · a "place to explore" habitat · a red panda |
| later | A zoo that grows with you | Signature habitat · local favourite · 12 animals · a baby · dream zoo |

A bot run of the script reaches "a local favourite" around day 11 (about 22 minutes at normal speed).

## Fewer clicks, clearer decisions (the deck's UX rules)

- **Tap the thing:** one contextual panel for an animal, a habitat or a building. Tapping an animal also says hello (a small cheer).
- **Explain the problem:** see above.
- **Forgiving building:** a ghost preview (green or red), the reason a spot won't work in the tip bar, **Undo** for 15 seconds with a full refund, and clear-for-half-back.
- **Let the player set the pace:** pause while building (on by default), space to pause, ×3 speed, autosave every 10 seconds, half-pace catch-up while away (up to 2 hours), reduced motion (follows the system setting) and readable text.

## Status

**Built (first playable, per the deck's last slide):** one map, two starting species plus 14 more behind reputation, habitat placement and path access, animal needs and keeper routines, visitors, income and running costs, save and load (with old and junk saves loading safely), and tests in `test/zoo.test.js`.

**Also in (kept gentle, since the deck lists them as later):** weather and events, babies, a guide.

**Next, in the order the deck suggests:**

1. Playtest the deck's three questions. Can a new player finish a habitat without help? Do they notice behaviour and choose an upgrade? Does the zoo feel alive at normal zoom?
2. Real art (see `ART-BRIEF.md`), then idle, walk and sleep frames per animal.
3. Rotate for non-square pieces, plus larger and themed habitats (zones).
4. Specialist staff (vet, gardener), school visits as a proper event, habitat challenges.
5. Conservation projects, seasonal decorations, a photo album, and a sandbox mode.

## Design pieces that would help next

Most useful first:

1. **A scale line-up:** every animal next to a keeper and a guest, on one sheet, at the game's angle. It keeps sprites consistent.
2. **One habitat at the exact game angle:** a 3×3 wetland seen at 2:1 isometric, empty, so the ground art matches the grid.
3. **HUD and toolbar icons:** coin, visitors, care leaf, day sun, build hammer, paw, staff, map, as separate transparent PNGs in the deck's style.
4. **Animation notes per animal:** idle, walk, happy, sleep, and what each trait looks like (a shy animal hiding, a sleepy one curled up).
5. **What each habitat tier looks like:** the same habitat at tier 1, 2 and 3, so the improvement reads at a glance.
6. **Guests and staff:** 6 visitor types and a keeper, at the same scale.
7. **Logo or wordmark** for Cutise Zoo.
8. **Sound and music direction:** a short mood list is enough.
9. **The map's growth:** where expansion plots and zones go once the starting park is full.
