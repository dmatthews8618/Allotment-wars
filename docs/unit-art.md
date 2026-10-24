# Painted characters and machinery

The five unit classes now have distinct blue Plot Holder and red Tidy Lawns designs, matching the painted-style buildings. AI image generation supplied the figures, machinery, walking poses and equipment states. A second pass corrected the pumpkin catapult to an overhead view; a separate sheet supplies front/back character poses.

## Designs and states

- Fork Volunteer / Garden Gnome: denim-and-straw volunteer versus red-hatted, white-bearded gnome, with distinct tools and two walking poses.
- Hose Gunner / Sprinkler Gnome: blue water backpack versus red-and-cream apparatus, with two walking poses.
- Wheelbarrow / Clippings Cart: rustic timber barrow versus neat red cart, each with visibly empty and loaded versions.
- Rotavator / Ride-on Mower: exposed blue cultivating machinery versus a red mower with gnome driver, with alternate movement frames.
- Pumpkin Catapult / Bowls Launcher: wooden pumpkin mechanism versus a red mechanical launcher, each with ready and firing art.

Infantry use east/west profile art plus separate north/back and south/front drawings. West-facing profiles are mirrored. Characters stay upright and are anchored by their feet; vehicles use rotatable overhead art. Character height is kept consistent between directions, health bars sit above heads, and hose projectiles visually originate at hand height. The projectile simulation, collision radii, speed, health, damage and costs are unchanged.

## Production pipeline

`assets/units.webp` contains the 20 profile/machine-state drawings. `assets/unit-directions.webp` contains 16 front/back walking drawings. `src/unit-art.js` trims measured source regions and creates textures at 2× resolution under the existing texture keys. `tools/build.py` generates both embedded data scripts and includes them in the standalone HTML, avoiding extra runtime file access requirements. Atlas decoding and trimming are cached across replays.

Image-tool masters: `exec-0776bd7e-0921-467b-9c39-997200d37573.png` and `exec-ad1f625d-9510-4e2a-a58f-004c228a4564.png` in the workspace's `generated_images/` directory. WebP encoding uses ImageMagick at quality 90. Do not format the generated data scripts.

`python3 tools/unit_art_check.py` exercises real scene rendering and movement: four-direction character facing, walking frames, health-bar clearance, load-state changes, firing-state changes and vehicle rotation. The usual gameplay, seeded-balance, phone-control and standalone-build checks also apply.

Local review screenshots are in `screens/units-before.png`, `screens/units-after.png` and `screens/`. These are intentionally excluded from Git.
