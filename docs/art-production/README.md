# 124 sprite delivery

This set implements the 124 core runtime sprites from `docs/ART-BRIEF.md` on `pack-v2`:

| Group | Count | Canvas |
| --- | ---: | --- |
| Adults and babies, 20 species | 40 | 512 × 512 |
| Shared habitat fittings | 12 | 384 × 384 |
| Species signature items | 60 | 512 × 384 |
| Park buildings | 12 | 384 × 384 |

All files are individual RGBA PNGs in `assets/`, with the exact runtime keys. Their silhouettes are proportionally fitted and bottom aligned for the renderer's ground anchor. These are static single-view sprites, not animation sheets.

The brief lists 149 keys in total. This 124-image delivery excludes 20 portraits and five additional assets (`gate`, `tile-grass`, `tile-path`, `poop`, `logo`). Those retain the existing fallback rendering.

Artwork was generated with the built-in image generator using the brief and `docs/refs/deck-concept-art.jpg`. The per-species concept PNG paths cited by the brief were absent from this checkout. `prompts.json` records the initial production prompts; the terrain patch and goat stump cluster were simplified in a second generation pass.

Open `gallery.html` to review the complete set. `manifest.json` records dimensions and paths. Run `npm run zoo-art` after replacing sprites to refresh `js/art.js`, then `npm run dev` to preview the game. The preparation helper accepts a local JSON array of `{key, source}` records pointing at generated originals; it requires ImageMagick's `convert` command.

This branch adds artwork and its asset registry; it does not deploy the game.
