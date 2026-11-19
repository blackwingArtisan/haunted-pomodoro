---
inclusion: always
---
# Product: Haunted Pomodoro

A focus timer that lives in a haunted house. It is a real, daily-use Pomodoro timer first and a piece of theatre second; the theatre exists to make focus feel rewarding and distraction feel noticed, never punished.

## Who it is for
- Students and knowledge workers who already use (or abandon) Pomodoro timers and want one that feels worth coming back to.
- People who are easily pulled into other tabs and respond better to a gentle nudge than to blockers.
- Anyone who wants their focus data to stay on their own device.

## The core loop
1. Name a task (optional) and press **Light a candle**. A candle on the mantel ignites and slowly melts while the focus session runs; cobwebs thin out as it burns.
2. Switching tabs during focus wakes the ghost (Page Visibility API). It drifts closer, rattles the room and the tab title calls you back. When you return, it says something kind. Each absence longer than a short grace period counts as one wandering.
3. Finishing the session leaves the candle lit. Four candles restore the room: the portrait stops staring and closes its eyes, the cobwebs fall, the colors come back.
4. Breaks let the house breathe (slow scale, curtains sway, ghost-green UI). Long breaks follow every N sessions.
5. Over days the house is restored room by room (six rooms per house, then a new house).

## Non-negotiable rules
- **Never punish.** Progress only moves forward. A missed day, a reset or a skipped session never un-restores a room or removes a candle that was earned. The streak (the Hearth) forgives one missed day between active days, and a cold hearth says what the person kept, not what they lost.
- **The timer is honest.** Time is computed from absolute end times so it never drifts in background tabs. A reload resumes exactly where the session was.
- **Data stays local.** Everything lives in localStorage by default. Cloud sync is opt-in through an adapter and is never required.
- **Accessible theatre.** Every control works from the keyboard, focus is always visible, text meets WCAG AA contrast on the dark theme, state changes are announced to screen readers, and reduced motion (system or in-app) stills every animation without hiding information.
- **Free to run.** No paid service on the default path. Sound is synthesized with Web Audio; there are no audio files.
- **Demo mode** (`?demo=1`) runs a whole arc in about 30 seconds (20 s focus, 10 s break, parlor one candle from restored) in memory only, for presentations.

## Tone
Gothic, warm and a little funny. The ghost is lonely, not hostile. Copy is short, uses sentence case, and never shames.
