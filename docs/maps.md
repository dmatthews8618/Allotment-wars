# Larger battlefields and varied enemy bases

Maps contain 120×80 tiles, or 3,840×2,560 world pixels: 2.08 times the previous 96×48 area. The player starts in the south-west. Enemy bases choose between north-west, north, north-east, east, south-east, south and central regions, with up to three tiles of variation on each axis. A map seed reproduces its terrain and starting positions. Terrain retries preserve the selected enemy region.

The entire enemy layout moves with its headquarters. Buildings face toward the player, starting troops use the selected base exit, and the AI rebuilds at its new location. Fog of war hides the enemy base until explored. Camera and minimap use the expanded world bounds.

Each side receives 7,500 raw starter compost and a nearby 3,600-compost expansion at equal nominal distances from headquarters. Further neutral fields encourage exploration. Generation reserves building footprints, clears base yards and checks every compost pile and both base exits for connectivity with planned buildings present. Pathfinding can search the whole map.

Validation: `node tools/map_check.js` checks 250 seeds, including every region, deterministic generation, starting separation, supplies, footprint clearance and connectivity. `python3 tools/spawn_check.py` checks all seven regions in the running game, including AI rebuilding and attack routes. The normal gameplay, balance and screen tools cover the enlarged map too.
