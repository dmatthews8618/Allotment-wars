# Community gardens

Three neutral community gardens now give the larger maps places to contest: Marigold Green, Orchard Corner and Sunflower Square. They are side objectives; victory still comes from destroying the enemy's buildings.

## How to play

Scout to discover a garden, then click or tap it with fighting units selected. They attack-move to the flag and claim it automatically while inside the marked circle. A single troop needs 12 seconds; two need 9.6 seconds; three or more need eight seconds. Wheelbarrows cannot capture. Opposing troops inside the circle freeze capture. Abandoned partial captures decay, and defenders can clear an incomplete enemy claim.

A secure garden pays its owner 75 compost every 30 seconds, even without a permanent garrison. Income pauses during combat or a partial hostile claim. Capturing resets the payout clock, preventing immediate rewards from repeatedly changing ownership. Player-owned gardens provide sight within five tiles so approaching enemies can be spotted. They do not add construction range or prevent defeat after the player's army and buildings are destroyed.

The Gardens button under the minimap shows owned gardens and current income per minute; clicking it cycles between discovered gardens. Inspecting a garden explains its rules, flags show ownership, a progress ring shows capture, and gold/blue/red diamonds appear on the minimap after discovery. Fog of war retains last-known ownership and hides live capture progress. The results screen reports claims and bonus compost separately from wheelbarrow harvesting.

## Enemy behaviour and fairness

The AI sends two fighting units to an unowned garden while retaining defenders. Its normal base attacks continue separately. Capture squads return to the main army after securing their garden, and can be dispatched again to retake territory. Gentle delays these expeditions until after its first-wave grace period.

Map generation chooses three separated, reachable sites between the starting regions, including a lateral contest point. Every site has a clear seven-by-seven area, stays at least 20 tiles from either headquarters, and cannot overlap resources or planned building footprints. Construction cannot cover a garden's capture area. The painted crop atlas supplies the vegetables; new timber beds, a meeting courtyard, potting bench, noticeboard and ownership flags make each location recognisable. Their ground responds to the day/night cycle.

`COMMUNITY` in `src/config.js` holds the capture radius, time, income, payout interval and sight radius. `src/objectives.js` owns the rules, AI expeditions and rendering. `tools/objectives_check.py` checks capture timing, contests, both teams' payouts, decay, fog privacy, construction, AI and desktop/phone interaction. `tools/map_check.js` also validates all three gardens across 250 seeds. Review images are saved in `screens/community-gardens/`.

Validation completed: 250 generated maps passed, 22 garden rule/integration/phone checks passed, all seven existing gameplay scenarios passed, all nine seeded matches met balance expectations, and desktop/portrait/landscape touch checks passed. The single-file build completed title, match, pause, results and menu flows on desktop and phone. Contested and moonlit gardens were visually reviewed. Label textures are refreshed only when their text or colour changes.
