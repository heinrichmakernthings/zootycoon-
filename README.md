# Cutise Zoo

*A little zoo. A lot of personality.* A cosy isometric zoo tycoon that runs in the browser. Fence homes for 20 species, fill them with what each animal needs, buy and sell at the market, raise babies, and grow a patch of empty land into your dream zoo.

Plain browser JavaScript, no build step.

| | |
| --- | --- |
| `index.html`, `css/zoo.css` | the page |
| `pack/` | the animal design pack: species, the 300-item catalogue, systems docs and (once uploaded) concept art. The source of truth for animals. |
| `js/pack-data.js` | generated from `pack/data/*.json` by `npm run pack` (don't edit it) |
| `js/content.js` | numbers and names the game adds: park, visitors, staff, goals, tuning |
| `js/sim.js` | the rules: pure and seeded, the same in the browser and in tests |
| `js/game/*.js` | the front end: `core` (state, save, clock), `render` (isometric canvas), `ui` (HUD, modes, pop-ups), `panels` (side panel), `input`, `boot` (last) |
| `art-source/` | the original PNG sprites (kept off the public site) |
| `assets/` | the WebP pictures the game loads, made by `python3 tools/optimise-art.py` |
| `js/art.js` | which pictures are ready (written by `npm run zoo-art`) |
| `docs/DESIGN.md` | how the deck and the pack map onto the game, and what's next |
| `docs/ART-BRIEF.md` | every picture's key, size and ChatGPT prompt |

## Play it

- Locally: `npm run dev`, then open <http://localhost:8000>.
- Tests: `npm install && npm test` (they follow the pack's acceptance checks).
- `npm run pack` after editing `pack/data/*.json`. `npm run validate-pack` checks the pack's own files (needs its PNGs). `node tools/bench.js` times the rules with 20, 75 and 150 animals.

## Put it on Cloudflare

It's a static site:

1. **From GitHub (easiest):** in the Cloudflare dashboard go to **Workers & Pages → Create → Import a repository**, pick this repo, leave the build command empty and the deploy command as `npx wrangler deploy`. Every push to `main` redeploys.
2. **From your computer:** `npx wrangler login`, then `npx wrangler deploy`.

`.assetsignore` keeps the pack, docs, tools and tests off the public site. Saves live in each player's browser, so no server is needed.

## Rules of the road

Every change to the zoo goes through `act()` → `ZooSim.apply()`. The rules use no DOM, no clock and no `Math.random`. Anything that moves money takes a transaction id, so a double click can't charge twice. New state needs a default in `createState()`, a check in `load()` and a test. Old saves are upgraded, never reset; the front end keeps a backup copy first. Text from state is escaped with `esc()`.
