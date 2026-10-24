# A living day and night

Every match starts in warm afternoon light. Over eight minutes the garden moves through golden hour, sunset, blue twilight, moonlight and dawn, then repeats. The clock follows match time and holds while paused or on the results screen.

Terrain receives the strongest colour change. Buildings stay brighter and unit colours, team markings, health bars, placement previews and controls remain clear. The cycle does not change sight range, movement, combat, production or difficulty.

Headquarters, potting sheds/workshops and polytunnels/garages have warm windows and small entrance lanterns. Light pools sit below units and selection marks. Low water power dims building lights. Butterflies fade at night; fireflies drift near vegetable beds; ponds catch golden and cool reflections. Healthy headquarters release gentle chimney smoke, distinct from the existing dark damage smoke.

All effects sit beneath fog of war. Enemy lamps require current visibility, and particles/reflections check their positions against visibility. Cosmetic randomness uses its own seeded stream. Fireflies and reflections use fixed arrays; chimney smoke reuses a pool of 16 sprites. Reduced-motion preferences hold fireflies/reflections still and suppress chimney smoke.

Implementation lives in `src/ambience.js`, with terrain and building tint integration in `src/scene.js`. `tools/daylight_check.py` checks smooth transitions, cycle continuity, pause, gameplay-state independence, random-roll independence, fog, reduced motion and phone rendering. It writes review captures to `screens/daylight/`.

Validation completed: daylight checks passed (including reduced motion and phone moonlight), all seven gameplay scenarios passed, all nine seeded balance matches met expectations with unchanged results, and desktop/portrait/landscape rendering and touch controls passed. Afternoon, sunset, moonlight and dawn screenshots were visually reviewed.
