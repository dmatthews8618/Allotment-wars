# Allotment Wars

A real-time strategy game that runs in the browser. The Tidy Lawns Society wants the allotments flattened into a bowling green. You lead the Plot Holders: haul compost, plant a base, fence it in and send the volunteers out to flatten the Clubhouse.

**Play it:** https://dmatthews8618.github.io/Allotment-wars/

It works with a mouse and keyboard or on a phone (landscape is best).

## How to play

1. Plant a **Water Butt**. Every building uses water, and everything slows down if you run short.
2. Plant a **Compost Bin**. It comes with a wheelbarrow that starts hauling compost straight away. Compost is the money.
3. Plant a **Potting Shed** and train volunteers.
4. Add a **Polytunnel** for machinery, then defences, fences and upgrades.
5. Destroy every Tidy Lawns building to win. Lose all your buildings and troops and you're paved over.

| Unit | Good against | Notes |
|---|---|---|
| Fork Volunteer | Other infantry | Cheap, best in numbers |
| Hose Gunner | Infantry | Weak against machinery |
| Wheelbarrow | | Hauls compost |
| Rotavator | Machinery | Tough |
| Pumpkin Catapult | Buildings and fences | Long range, splash damage, can't fire up close |

| Defence | Good against |
|---|---|
| Scarecrow | Machinery |
| Beehive | Infantry |
| Sprinkler Tower | Everything, at long range. Soaked units move at half speed |

**Fences** cost 25 a panel. Pick where the run starts, then where it ends. **Gates** let your own troops through; the enemy has to break them down.

### Controls

| | Mouse and keyboard | Phone |
|---|---|---|
| Select | Click | Tap |
| Select a group | Drag a box | **Box** button, then drag |
| Select all of one kind | | Double-tap a unit |
| Move, attack, harvest | Click the ground, an enemy or a compost heap | Tap |
| Attack-move | A, then click | **Attack**, then tap |
| Look around | Arrow keys, screen edge or middle-drag | Drag |
| Zoom | Mouse wheel | Pinch |
| Cancel | Right click or Esc | **Cancel** |
| Repair / sell a building | Select it, use the buttons in the sidebar | Select it, use the buttons that appear |

Other keys: S stop, Q all troops, R repair, H home, P pause, Shift+1–5 save a group, 1–5 recall it.

## How it's made

The game is built on [Phaser 3](https://phaser.io), which handles drawing, the camera and input. Everything else is plain JavaScript in `src/`. Buildings, characters, machinery and garden materials use painted-style sprite atlases in `assets/`. Terrain is composited once per map; connected fences, animated gates and effects are drawn by code. The atlases are embedded into generated scripts so the game still opens directly from disk and bundles into one HTML file.

```
index.html        the page: menus, sidebar, phone controls
css/style.css     the look of the page
css/base.css      page reset for the standalone version
src/
  config.js       settings and game data: units, buildings, upgrades, difficulty
  map.js          seeded maps with seven enemy starting regions
  art.js          texture creation, effects and fallback art
  building-art.js painted building sprite extraction and scaling
  building-atlas-data.js generated embedded building WebP atlas
  garden-art.js   terrain materials, crops, connected fences and gate poses
  garden-atlas-data.js generated embedded garden atlas
  unit-art.js     character directions, walking and machinery-state art
  unit-atlas-data.js / unit-directions-data.js  generated unit atlases
  entities.js     creating buildings and units
  pathfinding.js  route-finding round obstacles, fences and gates
  units.js        unit behaviour and harvesting
  combat.js       shooting, damage and effects
  economy.js      building, training, repairs, upgrades
  ai.js           the Tidy Lawns Society
  vision.js       fog of war
  endgame.js      win and lose
  ui.js           sidebar, phone HUD and minimap
  input.js        mouse and touch orders
  ambience.js     clouds, butterflies, ripples
  scene.js        the main game loop
  presentation.js illustrated title, result emblems and menu presentation
  main.js         start-up, menus and layout
tools/
  build.py        bundles everything into one file for the claude.ai version
  checks.py       set-piece tests of the game's rules
  playtest.py     plays fixed-seed matches in a hidden browser to check balance
  screens.py      screenshots on desktop and emulated phones, plus touch-control tests
  presentation_check.py  title-to-results screen flow and responsive-layout checks
  harness.py      shared set-up for the test tools
```

The scripts load in the order listed in `index.html` and share their top-level names, so that order matters.

### Running it yourself

Download the repo and open `index.html` in a browser. You need an internet connection because Phaser and the fonts load from the web.

### Checking changes

```
npm install
pip install playwright
node tools/map_check.js
python3 tools/spawn_check.py
python3 tools/daylight_check.py
python3 tools/objectives_check.py
python3 tools/checks.py
python3 tools/playtest.py
```

`checks.py` runs set-piece scenarios that test the game's rules: units route round new buildings, fences and gates block the right side, catapults keep their minimum range, wheelbarrows only pay into a bin that still exists.

`playtest.py` plays fixed-seed matches on each difficulty with a simple scripted player. It must win every Gentle match and lose every Ruthless one; Standard is reported but not enforced. The same seed always plays out the same way, so a failure can be replayed.

`screens.py` saves desktop, phone-upright and phone-sideways screenshots of the same battle to `screens/`, and tests the touch controls on a high-density phone screen.

All of them fail if the game throws any errors.

To refresh the single-file version used on claude.ai, run `python3 tools/build.py` and publish `dist/allotment-wars.html`.

The visual review and polish notes are in [docs/visual-review.md](docs/visual-review.md). Run `python3 tools/presentation_check.py` to capture the title, pause, victory and defeat screens and check replay, difficulty changes and rotation.

The battlefield is 120×80 tiles (3,840×2,560 world pixels), over twice the previous area. Enemy bases choose from seven regions with position variation each match. Both sides receive equal starter supplies and nearby expansion compost; additional fields are spread across the map. Fog of war keeps the enemy location hidden until scouted.

The character and machinery art pipeline is documented in [docs/unit-art.md](docs/unit-art.md). Run `python3 tools/unit_art_check.py` to check facing, walking and equipment states.

Terrain and boundary artwork is documented in [docs/garden-art.md](docs/garden-art.md). Run `python3 tools/garden_art_check.py` to verify material seams, fence joins, gate animation and unchanged terrain/collision grids.

Matches now follow an eight-minute visual day/night cycle: warm afternoon, sunset, moonlight and dawn. Windows and entrance lanterns glow at night, fireflies gather near crops, and ponds catch the changing light. Pause holds the cycle; reduced-motion preferences quiet the new effects. Lighting does not change gameplay or fog of war.

Three capturable community gardens add territorial objectives. Scout their gold map diamonds, hold a flag with fighting units, and earn 75 compost every 30 seconds while secure. Opposing troops pause capture and income. The Gardens control cycles between discovered plots, and the enemy sends squads to contest them. See [community garden rules](docs/community-gardens.md).
