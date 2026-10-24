# Notes for Claude

Dave owns this project. He has no programming background, so explain changes in plain English and give step-by-step instructions for anything he has to do himself.

## Architecture
- Phaser 3.80.1 from cdnjs. No bundler and no ES modules: `src/*.js` are classic scripts that share one global scope, loaded in the order in `index.html`. Top-level `let`/`const` and function names must stay unique across files. Opening `index.html` straight from disk must keep working.
- `config.js` holds all tunable data (UNITS, BLDS, UPGRADES, MULT damage table, DIFF). Change balance there first.
- `G` is the match state, `S` the Phaser scene. Team 0 is the player, team 1 the AI.
- Map: 64×48 tiles of 32px. Grids on `G` indexed with `idx(x,y)`: `blocked`, `bldAt`, `wallAt`, `wallTeam`, `gateTeam`, `vis` (0 unseen, 1 seen, 2 visible), `heapAt`.
- Pathfinding is A* in `pathfinding.js`. Set `PF.team` before calling it, because gates are passable for their own team. Fighting units path *through* enemy fences at extra cost and stop to break them (`e.breach`).
- All art is canvas drawing in `art.js`, keyed `kind_team` for buildings and `kind_team_frame` for units. Fence textures are made on demand per neighbour mask.
- Phone layout: `body.compact` (width ≤760 or height ≤540). `layout()` in `main.js` moves the same DOM nodes between the sidebar and the HUD.
- `G.headless` skips visuals. `window.__AW` exposes internals for `tools/playtest.py`.

## Workflow
- After changes run `python3 tools/playtest.py` (needs `npm install` and Playwright). Gentle should be a win for the scripted player, Ruthless a loss.
- Then `python3 tools/build.py` and republish `dist/allotment-wars.html` to the existing artifact: https://claude.ai/artifact/U4ZEAiVUW67ehDRjALzxyy
- The live site is GitHub Pages from `main`: https://dmatthews8618.github.io/Allotment-wars/

## Known gaps / ideas
- No sound. No campaign. The AI doesn't build fences and only rebuilds its starting layout.
- Cancelling a queued packet on phones relies on long-press (unreliable on iPhone).
