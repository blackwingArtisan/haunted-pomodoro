---
inclusion: fileMatch
fileMatchPattern: ["src/audio/**", "src/sound-check/**", "sound-check.html"]
---
# Sound

Loaded whenever the sound engine or the sound check page is in play.

- Every sound is synthesized live with the Web Audio API in `src/audio/sound.ts`. The project ships no audio files and uses no third-party recordings.
- Each one-shot sound must peak between -28 and -1 dBFS at full volume and fade below -50 dBFS before it ends. `src/audio/levels.ts` measures this from an offline render (`src/audio/render.ts`), and both the unit tests and `tests/e2e/sound-check.spec.ts` enforce it. A change to a sound is not done until `/sound-check.html` shows it inside the limits.
- Sounds reward and notice; none of them scolds. The ghost's call when you wander off is soft and only plays when "the ghost calls when you wander off" is on. There is no failure buzzer.
- Mute stops everything, including the ambient wind. Volume and mute are remembered across reloads.
- Audio starts only after a user gesture (`SoundEngine.unlock`), so browsers never block it and nothing plays on load.
- Measuring the levels is not the same as listening: a retuned sound still needs a listening review on speakers and headphones (task 23).
