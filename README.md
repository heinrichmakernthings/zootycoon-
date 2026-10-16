# Cutise Zoo

*A little zoo. A lot of personality.* A cosy isometric zoo tycoon that runs in the browser: build habitats, welcome animals with names, traits and favourite things, fix their needs, and grow a tiny park into your dream zoo.

Plain browser JavaScript, no build step.

| | |
| --- | --- |
| `index.html`, `css/zoo.css` | the page |
| `js/content.js` | every number and name (balance goes here) |
| `js/sim.js` | the rules: pure and seeded, the same in the browser and in tests |
| `js/game/*.js` | the front end: `core` (state, save, clock), `render` (isometric canvas), `ui` (HUD and panels), `input`, `boot` (last) |
| `js/art.js` | which pictures are ready (written by `npm run zoo-art`) |
| `assets/` | art, named by key |
| `docs/DESIGN.md` | the design deck mapped to the game, status and next steps |
| `docs/ART-BRIEF.md` | every picture's key, size and ChatGPT prompt |

## Play it

- Locally: `npm run dev`, then open <http://localhost:8000>.
- Tests: `npm install && npm test`.

## Put it on Cloudflare

It's a static site, so either:

1. **From GitHub (easiest):** push this folder to a new GitHub repo. In the Cloudflare dashboard go to **Workers & Pages → Create → Import a repository**, pick the repo, leave the build command empty and the deploy command as `npx wrangler deploy`. Every push redeploys.
2. **From your computer:** `npx wrangler login`, then `npx wrangler deploy` in this folder.

`wrangler.jsonc` names the Worker `cutise-zoo` and serves this folder; `.assetsignore` keeps docs, tools and tests off the internet. Saves live in each player's browser (localStorage), so no server is needed.

## Rules of the road

Every change to the zoo goes through `act()` → `ZooSim.apply()`. The rules use no DOM, no clock and no `Math.random`. New state needs a default in `createState()`, a check in `load()` and a test in `test/zoo.test.js`. Text from state is escaped with `esc()`.
