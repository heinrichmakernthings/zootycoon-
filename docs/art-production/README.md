# 124 sprite delivery

This set implements the 124 core runtime sprites from `docs/ART-BRIEF.md` on `pack-v2`:

| Group | Count | Canvas |
| --- | ---: | --- |
| Adults and babies, 20 species | 40 | 512 × 512 |
| Shared habitat fittings | 12 | 384 × 384 |
| Species signature items | 60 | 512 × 384 |
| Park buildings | 12 | 384 × 384 |

The originals are individual RGBA PNGs in `art-source/`, with the exact runtime keys. The game loads WebP copies from `assets/` (made by `python3 tools/optimise-art.py`; 28.5 MB of PNG becomes 4.7 MB, visually the same), one at a time as each picture is first needed. Their silhouettes are proportionally fitted and bottom aligned for the renderer's ground anchor. These are static single-view sprites, not animation sheets.

The brief lists 149 keys in total. This 124-image delivery excludes 20 portraits and five additional assets (`gate`, `tile-grass`, `tile-path`, `poop`, `logo`). Those retain the existing fallback rendering.

Artwork was generated with the built-in image generator using the brief and `docs/refs/deck-concept-art.jpg`. The per-species concept PNG paths cited by the brief were absent from this checkout. `prompts.json` records the initial production prompts; the terrain patch and goat stump cluster were simplified in a second generation pass.

Open `gallery.html` to review the complete set. `manifest.json` records dimensions and paths. After replacing a sprite: `python3 tools/optimise-art.py`, then `npm run zoo-art` to refresh `js/art.js`, then `npm run dev` to preview. The preparation helper accepts a local JSON array of `{key, source}` records pointing at generated originals; it requires ImageMagick's `convert` command.

This branch adds artwork and its asset registry; it does not deploy the game.

## Review and integration (Claude Code, 17 October 2026)

All 124 checked: exact sizes, RGBA with clear corners, standing on the bottom edge (no floating), checksums match, left-facing animals, baby proportions and markings per the pack (grey penguin and flamingo chicks, striped tapir calf, brown peachick, tuskless elephant calf). Integrated: items scale to their footprint and stand on its front corner; animals stand in front of solid fittings and on top of platforms and pools; park buildings scale up a little; panels show the pictures. Status in `manifest.json`: integrated. Known gaps: the shared species sign shows a capybara for every species; portraits, the gate, ground tiles, poop and the logo are still to come.
