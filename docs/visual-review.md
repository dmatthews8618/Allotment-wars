# Allotment Wars — visual review and polish

The visual direction is a British garden journal: deep botanical greens, warm paper, brass accents, blue Plot Holders and red Tidy Lawns troops. The existing overhead sprites remain the game's visual vocabulary. The opening illustration introduces the same shed, water butt, greenhouse, vegetable beds and garden tools from a scenic perspective.

## Screen-by-screen review

| Area | Finding | Implemented finish |
| --- | --- | --- |
| Opening | A text block on a dark background did little to establish the setting. | Original, resolution-aware canvas illustration: evening sky, village, blue shed, greenhouse, winding path, planted beds, fence and foreground flowers. |
| Title hierarchy | Heading, premise and choices competed for attention. | Large cream-and-gold serif title, faction line, restrained introductory text, numbered difficulty cards and a quieter expandable introduction. |
| First-time guidance | The title implied destroying the Clubhouse alone was sufficient. | Briefing and battlefield objective accurately say to destroy all enemy buildings. The Water Butt → Compost Bin → Potting Shed sequence is retained. |
| Menu framing | The unused command sidebar distracted from the opening. | Full-width title and result screens; normal battlefield layout returns when starting/replaying. |
| Typography | Display text depended on a downloaded font and could change substantially offline. | Deliberate Georgia/system-serif display typography. Existing condensed interface type retains system fallbacks. |
| Command panel | Flat brown panels and tightly packed cards lacked hierarchy. | Botanical panels, brass/cool-blue resource accents, section rules, clearer map heading, improved paper cards, illustrated-icon shadows and consistent corners. |
| Minimap | A large dark rectangle dominated the command panel. | Framed, compact desktop map; green unexplored territory matches battlefield fog. Phone positioning is preserved. |
| Card states | Locked cards were difficult to read; hover and production feedback were slight. | More legible locked states, lift/press feedback, differentiated progress fill, retained ready/placement/queue/upgrade states and visible keyboard focus. |
| Grass and light | Repeated bright blades gave the ground a noisy appearance. | Softer grass contrast and a subtle baked warm daylight wash. |
| Vegetable beds | Repeating identical sprouts flattened the sense of an allotment. | Three crop treatments, leaf highlights, planting shadows and timber edges only around bed perimeters. |
| Hedges and ponds | Foliage and water had a narrow range of colour and detail. | Layered leaf shapes and highlights, warmer foliage and teal shallow/deeper pond colours. |
| Unexplored land | Near-black fog made much of the play area feel empty. | Opaque deep-green fog with very slight coordinate-based variation and explicit smooth texture filtering to avoid blocky phone edges. Unexplored interiors remain opaque; enemy visibility rules are unchanged. |
| Troop readability | Small figures could blend into planting and crowds. | Small blue/red team pips for unselected troops and stronger, dark-backed selected-unit rings. Existing outlined, high-resolution sprites are retained. |
| Health and orders | Thin bars and a single shrinking circle had little visual presence. | Dark-backed highlighted health bars and a longer-lived elliptical order marker with directional ticks. |
| Combat | Impacts mostly shared soft radial puffs. | Short-lived water droplets, bee sparks and earthy/pumpkin fragments around impact rings. Effects respect visibility and use fixed angles rather than match randomness. |
| Pause | A single “Paused” label gave little context or affordance. | “Tea break” card, resume button, keyboard focus and a softly blurred battlefield. |
| Victory | The ending reused the opening's generic layout. | Full-width victory panel with crossed-garden-tool laurel emblem, gold heading, readable statistics and replay/difficulty actions. |
| Defeat | Victory and defeat had little visual separation. | Warm clay/brown treatment with a broken-stem emblem and the existing defeat copy. |
| High-density rendering | Phaser silently enabled pixel-art mode whenever the DPR scale differed from 1, making phone sprites and fog jagged. | Explicitly disable pixel-art mode, preserve antialiasing and allow smooth subpixel movement; retain the existing high-density canvas and sprites. |
| Phone portrait | The desktop opening and cards needed a smaller composition. | Stacked difficulty cards, compact typography and readable touch guidance. Very small phones can scroll the briefing. |
| Phone landscape | Initial visual inspection found choices below the fold. | Two-column briefing; compact result layout keeps the emblem and actions together. Gameplay retains its separate command strip. |
| Motion | Decorative transitions need to remain optional. | New interface entrances/hover transitions honour reduced-motion preferences. Existing game simulation and battlefield animations are preserved. |
| Distribution | The bundler only recognised a bare body tag and missed multiline font links. | Body attributes, multiline remote font links and the mobile viewport meta tag are preserved/handled. The single-file version is rebuilt. |

## Validation

- Seven gameplay scenarios: routing around buildings, enemy fences, minimum catapult range, friendly/enemy gates and wheelbarrow unloading.
- Nine seeded balance matches: all three Gentle matches won; all three Ruthless matches lost as expected; Standard results reported without an enforced outcome.
- Desktop, portrait-phone and landscape-phone battlefield screenshots and touch tests: tap selection, double-tap, orders, pan, pinch zoom, box selection and two-tap planting.
- Title, pause/resume, both results, replay, difficulty changes and rotation at 1440×960, 390×844, 844×390 and 320×568. Checks explicitly cover difficulty buttons and result actions fitting at the principal sizes.
- Single-file bundle smoke checks on desktop and phone.
- Browser errors are collected by the checks. Web fonts are deliberately unavailable during these runs, exercising the fallback presentation.

The managed environment uses installed Chromium through a local HTTP test adapter because its browser policy does not allow file URLs. Phone checks emulate touch and pixel density; they are not tests on physical iOS/Android devices.

Run `python3 tools/screens.py` for battlefield captures and `python3 tools/presentation_check.py` for the complete screen flow. Images are generated in `screens/` and `screens/review/` and are intentionally not tracked by Git.

## Implementation notes

The title is drawn only when visible and resized, rather than running an extra animation loop. Terrain details are baked once per map. Added impact drawings are destroyed when their short tween ends. New presentation code uses its own seeded random generator; unit statistics and AI are unchanged. The expanded map is now 96×48 tiles, with mirrored starting areas, proportional obstacle coverage and extra contested compost. Its generation is checked across 100 seeds with `node tools/map_check.js`.

The source remains `index.html`, `css/style.css` and `src/*.js`; `dist/allotment-wars.html` is generated by `python3 tools/build.py`. The existing external Phaser runtime dependency remains. These are workspace changes; publication is separate.
