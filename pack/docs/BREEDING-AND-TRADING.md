# Babies, breeding, buying and selling

## Simple family flow
Select an enclosure, open Family, enable breeding and select an eligible adult pair. Display readiness as a short checklist: compatible adults, care, nursery, room. Confirm one attempt. Default auto-repeat is off. A birth or hatching gets a gentle reveal, naming input, parent links and a photo-album entry. Let the player dismiss the reveal without losing the newborn.

## Eligibility
Same species, opposite-sex adults with known independent instance IDs; no close relationship within two ancestral generations; both healthy and not in another breeding event or cooldown; wellbeing at least 80 for two consecutive simulation days; reachable nursery; enough supported capacity for the next offspring. Founders from the market have distinct family roots. Unknown imported ancestry blocks breeding until the game explicitly resolves it.

One offspring per event for the initial version. This is a deliberate gameplay simplification. All species' prebirth, growth and cooldown timers are fictional compressed values in species.json. Egg-phase species use an egg/nest visual and hatching event. Mammals use a quiet expecting status. Do not add explicit mating animations.

## Event state machine
`disabled -> checking -> ready -> expecting_or_incubating -> newborn -> cooldown -> ready`.

An active event persists its ID, selected parents, child ID, random seed, nursery anchor, reserved adult slot, due time and completion flag. Breeding-off prevents future attempts but does not cancel an existing pregnancy/egg. If conditions deteriorate, show a care request. If capacity changes through an external/import error, hold arrival safely in the nursery queue without generating duplicate residents or deleting family members.

Reserve the future adult slot at event start. On arrival, replace the reservation with the child resident in one commit. A scheduled event whose completion flag is already true does nothing on retry. Freeze simulation timers when paused. No offline progression in the first version, so returning to the game cannot unexpectedly fill the park with births.

## Growth
Baby -> juvenile -> adult. Stage progression uses saved game time. Display a friendly stage progress bar with remaining game days. Show the change with a small animation and preserve name, ID, traits and parent links. Do not automatically sell grown young.

Babies use different proportions and age-appropriate markings. Tapir calves have stripes/spots; flamingo and penguin chicks do not inherit adult plumage immediately. Juvenile assets are a separate production task. Tortoise hatchlings use an independent explore behaviour rather than forced parent-follow. A parent-carry treatment for sloth and early lemur poses is an art/behaviour option.

Baby activities: short follow movements, nest/den rest, exploration and species-specific play. No baby mortality or animal ageing/death system in this initial scope. Care issues pause new breeding and trigger support requests rather than punishing the player with sudden loss.

## Buying
Market offers show species, portrait, sex, age stage, trait, price and expected daily upkeep. New animals arrive as adults in this first version. Filter by species or by enclosures that can accept them. Offer six persistent listings, refreshed every game day. Buy is disabled with an exact reason if the species is locked, money is insufficient, capacity is full or a destination is invalid.

Buying must atomically debit coins, consume the listing ID and create a resident with a unique ID in the chosen habitat. If any step fails, none commits. Repeated clicks or reloads must not create duplicate animals or double charges. Show projected group and ongoing upkeep before confirmation.

## Selling and rehoming
Sell independent adults only. Block sales of an expecting adult and a caregiver required by dependent young. If moving a family, validate destination space for the entire move before changing anyone's habitat. Warn if selling leaves the initial social target unmet and require a deliberate alternative move plan.

Initial sale value is 60% of species adult buy price. A future healthy/trait bonus may raise it but must stay below 85% of buy price. Never price a sale above the same market's equivalent buy price. Animals born in the zoo can yield a surplus after care costs; immediate buy/sell flipping should always lose money. Keep the calculation visible.

Confirm using name, species, value and remaining population. Store transaction ID, credit once, remove the active resident once, and preserve its family/history record. Do not erase parent references from descendants. A sale cannot run while another transaction locks the same resident.

## Example tuning
Capybara adult: buy 600, base sale 360 coins, adult upkeep 4 coins/day. One breeding event takes 2 prebirth days, 4 baby days and 3 juvenile days, plus a 4-day post-birth cooldown. Baby upkeep is 0.6x and juvenile upkeep 0.8x adult upkeep. This is a starting balance model, not a proven profit forecast. Include parent upkeep, nursery construction and land costs when playtesting breeding profitability.

## Interface
Animal panel: name and stage above Overview / Family. Primary actions stay in the same panel: Follow, Move, Rename, Sell. Family lists parents and offspring with clickable portraits. Habitat Family view shows breeding toggle, selected pair, readiness and projected space. Disable unavailable actions with plain-language reasons; do not hide the reason in a tooltip alone.
