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

The game is built on [Phaser 3](https://phaser.io), which handles drawing, the camera and input. Everything else is plain JavaScript in `src/`. There are no image files: every sprite and the whole map are drawn by code when the game loads.

```
index.html        the page: menus, sidebar, phone controls
css/style.css     the look of the page
css/base.css      page reset for the standalone version
src/
  config.js       settings and game data: units, buildings, upgrades, difficulty
  map.js          random, mirrored map generator
  art.js          all the artwork, drawn in code
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
  main.js         start-up, menus and layout
tools/
  build.py        bundles everything into one file for the claude.ai version
  checks.py       set-piece tests of the game's rules
  playtest.py     plays fixed-seed matches in a hidden browser to check balance
  harness.py      shared set-up for those two
```

The scripts load in the order listed in `index.html` and share their top-level names, so that order matters.

### Running it yourself

Download the repo and open `index.html` in a browser. You need an internet connection because Phaser and the fonts load from the web.

### Checking changes

```
npm install
pip install playwright
python3 tools/checks.py
python3 tools/playtest.py
```

`checks.py` runs set-piece scenarios that test the game's rules: units route round new buildings, fences and gates block the right side, catapults keep their minimum range, wheelbarrows only pay into a bin that still exists.

`playtest.py` plays fixed-seed matches on each difficulty with a simple scripted player. It must win every Gentle match and lose every Ruthless one; Standard is reported but not enforced. The same seed always plays out the same way, so a failure can be replayed.

Both fail if the game throws any errors.

To refresh the single-file version used on claude.ai, run `python3 tools/build.py` and publish `dist/allotment-wars.html`.
