# Art direction and asset status

## Look
Warm storybook zoo, soft 2.5D isometric forms, rounded silhouettes and matte painted textures. Palette: cream #FBF5E8, sage #A7BA91, apricot #E8B58A, pond blue #9EC7C7, forest ink #244638. Light from upper left, quiet playable ground, richer border foliage. Avoid clothing, branded accessories and emoji UI.

Animals need distinct shapes and markings at normal zoom. Baby proportions and coat patterns matter more than simply reducing scale. Simplify fine fur details when producing runtime sprites so tiny movement remains clear.

## Included artwork
20 full animal/habitat concept sheets and four shared concept boards. The nursery boards map their four regions in each species.json. All PNGs are full-resolution originals and retain their original metadata. They are flattened opaque images, not layered files or transparent sprites.

The sheets give art direction and scene composition. They do not supply exact footprints, buildable component boundaries, species stocking requirements or engineering-safe barriers. The park overview is aspirational and must not override species data. In particular, its penguin corner should use the temperate rocky treatment from the African penguin sheet in final production.

## Production assets still required
- Four-direction adults, babies and juveniles with consistent foot pivots.
- Adult appearance variants where relevant, especially the peahen.
- Species-specific movement and interaction loops.
- Separate modular shelters, feeders, water features, enrichment, nursery pieces and decorations.
- Fence segments, corner joins, gates, terrain and construction/upgrade states.
- Native UI icons and clear selection/placement feedback.

The modular-build PNG illustrates 12 object concepts, not a usable atlas. The 300 catalogue entries share templates; they do not imply 300 completed drawings. Runtime asset paths remain absent until real files exist.

## Handoff discipline
Keep source concepts untouched in this pack. Put derived production art elsewhere with a manifest linking back to species/item IDs. Mark each deliverable concept / production / integrated / tested. Do not label concept art as game-ready. Review each animal's anatomy, markings, scale and all required views before marking production complete.
