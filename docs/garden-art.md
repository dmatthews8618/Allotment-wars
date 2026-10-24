# Terrain, crops and boundaries

The garden now uses a painted material atlas for meadow grass, clipped lawn, planting soil and gravel. Individual sprites provide cabbages, carrots, pumpkins, climbing beans, stones, puddles, flowers, hedge foliage, leaves, ivy and small pots/labels. The original image-tool master is `exec-f2d8dee6-3ce4-4798-837a-66bac1b33725.png` in the workspace's `generated_images/` directory.

## Visual treatment

- Grass uses a fine, low-contrast texture over broad seeded colour variation. Foreground units and buildings remain the main focus. The lawn retains restrained mowing stripes.
- Ground swatches are composited into reflected repeats whose opposing edges match. Gravel is scaled down, softened with packed-earth colour and given subtle wear lines and occasional shallow puddles.
- Connected planting tiles form one bed with one crop variety, consistent rows and timber only at the perimeter. The four crop types cycle between beds; small pots and labels add character.
- Ponds have continuous rounded banks, softly blended deeper water, reflections, reeds, stones and lily pads. Natural hedges use connected foliage with layered ivy.
- Resource piles use irregular shaded soil mounds with vegetable/leaf scraps instead of the previous circular texture.
- Picket fences are constructed from rails, shaped slats, capped posts, grain, hardware and small ivy accents. All 16 connection masks remain supported. Enemy boundaries use clipped painted foliage.
- Gates have five visual poses and open/close over 0.22 simulation seconds when friendly units approach/leave. Reduced-motion mode snaps between states. Movement permissions remain governed by the existing friendly/enemy gate rules.
- The minimap palette matches the new ground, lawn and water colours.

## Implementation and checks

`assets/garden.webp` is the production atlas. `tools/build.py` creates `src/garden-atlas-data.js` and embeds it into the standalone HTML. `src/garden-art.js` trims sprite regions, prepares material repeats and bakes the entire terrain once per map. Fence variants and gate poses are generated once and cached. A private seeded generator supplies decoration; painted terrain does not change the terrain, visibility, resource or collision grids.

`python3 tools/garden_art_check.py` checks grid invariants, material-edge continuity, all fence joins, gate opening/closing and reduced motion. The normal seven gameplay scenarios, nine balance matches and desktop/phone control checks also apply. The standalone build is checked with the embedded artwork.

Local review captures are `screens/garden-before.png` and `screens/garden-after.png`, showing the same arranged garden scene before and after the change. Standard battlefield captures remain in `screens/`. Review images are intentionally excluded from Git.
