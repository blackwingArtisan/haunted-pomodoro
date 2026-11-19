# Requirements: Haunted focus timer

## Introduction
Haunted Pomodoro is a Pomodoro timer whose progress is shown as a haunted house being restored. This spec covers the timer, tasks, distraction detection, the house, the streak, sound, accessibility, offline use and demo mode. Cloud sync is specified separately in `house-sync`.

## Requirement 1: Focus and break timer
**User story:** As a person trying to focus, I want a reliable Pomodoro timer, so that I can work in timed sessions with breaks.

1. WHEN the person presses "Light a candle" while the timer is idle in focus THEN the system SHALL start a focus session of the configured length.
2. WHILE a phase is running THE system SHALL compute the time left from an absolute end time, so that background throttling never makes it drift.
3. WHEN the person pauses THEN the system SHALL freeze the time left; WHEN they resume THEN the system SHALL continue from that time.
4. WHEN a focus session ends THEN the system SHALL start a short break, or a long break after every N finished focus sessions (N configurable, 2 to 8).
5. WHEN a long break ends or is skipped THEN the system SHALL restart the long-break cycle.
6. IF "start breaks by themselves" is on THEN the system SHALL start each break automatically; IF "start the next focus" is on THEN the system SHALL start focus after a break automatically.
7. WHEN the person skips a focus session THEN the system SHALL move to a short break without lighting a candle or advancing the cycle.
8. WHEN the person resets THEN the system SHALL restore the full length of the current phase.
9. WHEN the page reloads THEN the system SHALL restore the timer exactly, including a paused or running session.
10. THE system SHALL let the person set focus (1 to 120 min), short break (1 to 60 min) and long break (1 to 90 min) lengths, and SHALL clamp values outside those ranges.

## Requirement 2: Tasks
**User story:** As a person with several things to do, I want a task list tied to the timer, so that I can see where my sessions went.

1. WHEN the person adds a task with a title and a planned number of candles (1 to 12) THEN the system SHALL add it to the ledger and make it the active task if none is active.
2. WHEN a focus session finishes while a task is active THEN the system SHALL add one candle to that task.
3. WHEN the person marks the active task done THEN the system SHALL make the next unfinished task active.
4. THE system SHALL let the person choose the active task, delete a task, and clear finished tasks.

## Requirement 3: The ghost (distraction detection)
**User story:** As someone who drifts into other tabs, I want a gentle nudge when I wander off, so that I come back without feeling scolded.

1. WHILE a focus session is running, WHEN the page becomes hidden (Page Visibility API) THEN the system SHALL start timing the absence.
2. WHEN the absence passes the grace period (3 s; 2 s in demo mode) THEN the system SHALL wake the ghost once, change the tab title to a call to come back, and play a soft call if sound and ghost calls are on.
3. WHEN the person returns after the grace period THEN the system SHALL count one wandering, move the ghost one step closer (at most three), rattle the room briefly and show a kind line from the ghost.
4. IF the person returns within the grace period THEN the system SHALL NOT count a wandering.
5. IF the tab is still hidden when the focus session ends THEN the system SHALL count that absence with the session.
6. WHILE paused or on a break THE system SHALL ignore hidden tabs.
7. WHEN a new focus session starts THEN the system SHALL reset the session's wanderings and send the ghost back to sleep.

## Requirement 4: The house
**User story:** As a returning user, I want my focus to visibly restore something, so that the work feels like it adds up.

1. WHEN a focus session starts THEN the system SHALL light the next candle on the mantel and melt it as the session progresses, while the room's colors return and the cobwebs thin.
2. WHEN a focus session finishes THEN the system SHALL keep that candle lit.
3. WHEN the fourth candle in a room is lit THEN the system SHALL mark the room restored: cobwebs cleared, portrait eyes closed, room colors restored, a "Restored" banner and a chime.
4. WHILE the break after a restoration runs THE system SHALL keep showing the restored room; WHEN the next focus starts THEN the system SHALL open the next room.
5. WHEN all six rooms are restored THEN the system SHALL announce the house restored and start a new house, keeping the count.
6. THE system SHALL NOT remove a lit candle or a restored room for any reason other than the person erasing their data.
7. THE system SHALL show a house map listing every room with its state and a preview of each room.

## Requirement 5: The Hearth (streak)
**User story:** As someone building a habit, I want a streak that encourages without punishing, so that one bad day does not erase my progress.

1. THE system SHALL count a day as active when it has at least one finished focus session, using the person's local calendar day.
2. THE system SHALL keep the streak alive across one missed day between active days.
3. WHEN two or more days pass without a session THEN the system SHALL show a cold hearth with the number of rooms already restored and keep the best streak.
4. THE system SHALL show the last fourteen days, today's sessions, focus minutes and wanderings, the best streak and rooms restored.

## Requirement 6: Sound
1. THE system SHALL synthesize every sound with the Web Audio API and SHALL NOT ship audio files.
2. THE system SHALL provide a volume control and a mute toggle, both reachable from the main screen and remembered.
3. WHERE ambient wind is enabled THE system SHALL play a generated, looping wind until it is disabled or muted.

## Requirement 7: Accessibility and keyboard
1. THE system SHALL make every control reachable and operable by keyboard with a visible focus indicator.
2. THE system SHALL provide shortcuts: Space (start/pause/resume), R (reset), S (skip), N (new task), M (mute), A (ambient), H (house), comma (settings), ? (shortcut list), and SHALL ignore them while typing in a field.
3. THE system SHALL announce phase changes, finished sessions, wanderings and restorations through a polite live region.
4. WHERE the person prefers reduced motion (system setting or in-app choice) THE system SHALL stop all animation and drifting while keeping every state visible.
5. THE system SHALL keep text contrast at WCAG AA or better and SHALL fit a 390 px wide screen without sideways scrolling.

## Requirement 8: Offline and privacy
1. THE system SHALL store all data in the browser's localStorage by default.
2. WHEN the app has been loaded once THEN the system SHALL open and run with no network (service worker precache).
3. IF storage is unavailable or full THEN the system SHALL keep the timer working in memory.
4. THE system SHALL let the person erase all of their data after a confirmation step.

## Requirement 9: Demo mode
1. WHEN the page is opened with `?demo=1` THEN the system SHALL run a 20 second focus and 10 second breaks in a house whose parlor is one candle from restored.
2. WHILE in demo mode THE system SHALL NOT read or write the person's tasks, days or house.
3. THE system SHALL show a demo banner with a way back to the person's own house.
