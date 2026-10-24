# Garden sound design

The game now has original procedural audio: fork/tool clinks, hose sprays and splashes, rotavator growls, catapult launches, earthy impacts and building collapses. Planting, finished production, upgrades, wheelbarrow deliveries and garden captures have distinct cues. Warnings, button clicks, movement orders and victory/defeat also have short sounds.

A quiet filtered breeze sits behind occasional birds in daylight and crickets at night. Optional music uses an original sparse plucked pentatonic motif. Music starts at zero volume so it can be enabled separately from the soundscape.

The Sound button mutes everything; its settings button opens separate master, effects, ambience and music sliders. Preferences are remembered on the device when browser storage is available. Sound unlocks on a real tap or keypress, pauses with gameplay, stops ambient playback on the results/menu screens, and suspends its context in the background. A result fanfare remains audible after the match ends. Unsupported browsers continue playing normally.

`src/audio.js` owns a single Web Audio context. Phaser's unused sound manager is disabled. Sounds are synthesised locally, so there are no recordings to download or license, and the single-file build works without fetching audio assets. Cosmetic audio has its own random stream and does not change the simulation. Positional sounds require visible nearby action, attenuate outside the camera and pan across the screen. Hidden or distant enemies cannot be heard through fog of war. Sound categories have cooldowns, at most 20 effect voices can exist, finished voices disconnect their sources, and a compressor controls combined peaks.

Run `python3 tools/audio_check.py` to check activation, independent levels, saved preferences, privacy, pause, backgrounding, resource limits, results, unsupported audio and portrait/landscape controls. The test also renders all 16 sound designs to `screens/audio/preview.wav` and checks that each is non-silent without clipping. Screenshot captures are in the same directory.

Validation: browser activation, privacy, persistence, pause/background lifecycle, voice limits and unsupported-audio checks passed. All 16 audition effects rendered non-silent without clipping (peak 0.234). Portrait and landscape controls fit the screen; all seven gameplay scenarios and nine seeded balance matches passed with unchanged match outcomes. The single-file game passed desktop/phone sound, mute, settings and menu/result checks. Desktop and phone settings screenshots were visually reviewed.
