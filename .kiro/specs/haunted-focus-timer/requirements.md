# Requirements: Haunted focus timer

## Introduction
Haunted Pomodoro is a Pomodoro timer whose progress is shown as a haunted house being restored. This spec covers the timer, tasks, distraction detection, the house, the streak, sound, accessibility, offline use, demo mode, phase-end notifications and export and import of the house. Cloud sync is specified separately in `house-sync`.

Every criterion is written in EARS form and states one testable behavior:
- WHEN `<event>`, THE SYSTEM SHALL `<response>`.
- WHILE `<state>`, THE SYSTEM SHALL `<response>`.
- WHERE `<optional feature or setting is present>`, THE SYSTEM SHALL `<response>`.
- IF `<unwanted condition>`, THEN THE SYSTEM SHALL `<response>`.
- THE SYSTEM SHALL `<response>` (always true).

Numbers never change. A criterion that held more than one behavior keeps its first behavior under its old number, and the others are appended at the end of the requirement.

## Requirement 1: Focus and break timer
**User story:** As a person trying to focus, I want a reliable Pomodoro timer, so that I can work in timed sessions with breaks.

1. WHEN the person presses "Light a candle" while the timer is idle in focus, THE SYSTEM SHALL start a focus session of the configured length.
2. WHILE a phase is running, THE SYSTEM SHALL compute the time left from the phase's absolute end time, so that background throttling never makes it drift.
3. WHEN the person pauses a running phase, THE SYSTEM SHALL freeze the time left.
4. WHEN a focus session ends AND fewer than N focus sessions have finished since the last long break, THE SYSTEM SHALL enter a short break.
5. WHEN a long break ends or is skipped, THE SYSTEM SHALL restart the count of focus sessions toward the next long break.
6. WHERE "start breaks by themselves" is on, THE SYSTEM SHALL start each break as soon as the phase before it ends.
7. WHEN the person skips a focus session, THE SYSTEM SHALL enter a short break that waits for the person to start it.
8. WHEN the person resets, THE SYSTEM SHALL stop the current phase and restore its full length.
9. WHEN the page loads, THE SYSTEM SHALL restore the timer's phase, status and time left from the saved copy.
10. THE SYSTEM SHALL let the person set the focus length (1 to 120 min), the short break length (1 to 60 min) and the long break length (1 to 90 min).
11. WHEN a focus session ends AND N focus sessions have finished since the last long break (N configurable, 2 to 8), THE SYSTEM SHALL enter a long break.
12. WHEN the person skips a focus session, THE SYSTEM SHALL NOT light a candle or advance the count toward the next long break.
13. WHEN the person skips a break, THE SYSTEM SHALL return to an idle focus session.
14. WHEN the person resumes a paused phase, THE SYSTEM SHALL continue counting down from the frozen time left.
15. WHERE "start the next focus" is on, THE SYSTEM SHALL start the next focus session as soon as a break ends.
16. IF a configured length is outside its range, THEN THE SYSTEM SHALL use the nearest limit of that range.
17. WHEN the person resets a focus session that is in progress, THE SYSTEM SHALL keep every candle already lit.
18. IF a tick arrives after a phase's end time, THEN THE SYSTEM SHALL complete the phase at its exact end time and time the next phase from that moment.
19. WHILE a phase is running or paused, WHEN the person changes a length, THE SYSTEM SHALL keep the current phase's length and apply the new length from the next phase.

## Requirement 2: Tasks
**User story:** As a person with several things to do, I want a task list tied to the timer, so that I can see where my sessions went.

1. WHEN the person adds a task with a title and a planned number of candles, THE SYSTEM SHALL add it to the ledger.
2. WHEN a focus session finishes AND a task is active, THE SYSTEM SHALL add one candle to that task.
3. WHEN the person marks the active task done, THE SYSTEM SHALL make the next unfinished task active.
4. WHEN the person chooses a task, THE SYSTEM SHALL make it the active task.
5. WHEN the person deletes a task, THE SYSTEM SHALL remove it from the ledger.
6. WHEN the person clears finished tasks, THE SYSTEM SHALL remove every finished task and keep the unfinished ones.
7. WHEN the person adds a task AND no task is active, THE SYSTEM SHALL make the new task active.
8. IF a planned number of candles is outside 1 to 12, THEN THE SYSTEM SHALL use the nearest limit.
9. IF a task title is empty after trimming, THEN THE SYSTEM SHALL NOT add the task.

## Requirement 3: The ghost (distraction detection)
**User story:** As someone who drifts into other tabs, I want a gentle nudge when I wander off, so that I come back without feeling scolded.

1. WHILE a focus session is running, WHEN the page becomes hidden (Page Visibility API), THE SYSTEM SHALL start timing the absence.
2. WHEN an absence passes the grace period (3 s; 2 s in demo mode), THE SYSTEM SHALL wake the ghost once for that absence.
3. WHEN the person returns after the grace period, THE SYSTEM SHALL count one wandering.
4. IF the person returns within the grace period, THEN THE SYSTEM SHALL NOT count a wandering.
5. IF the tab is still hidden when a focus session ends AND the absence has passed the grace period, THEN THE SYSTEM SHALL count that absence with the session.
6. WHILE the timer is paused or in a break, THE SYSTEM SHALL ignore hidden tabs.
7. WHEN a new focus session starts, THE SYSTEM SHALL reset the session's wanderings to zero.
8. WHILE the ghost is awake AND the tab is hidden, THE SYSTEM SHALL change the tab title to a call to come back.
9. WHERE sound and "the ghost calls when you wander off" are on, WHEN the ghost wakes, THE SYSTEM SHALL play a soft call.
10. WHEN a wandering is counted, THE SYSTEM SHALL move the ghost one step closer, up to three steps.
11. WHEN a wandering is counted, THE SYSTEM SHALL rattle the room briefly.
12. WHEN a wandering is counted, THE SYSTEM SHALL show a kind line from the ghost.
13. WHEN a wandering is counted, THE SYSTEM SHALL add it to that day's wanderings.
14. WHEN a new focus session starts, THE SYSTEM SHALL send the ghost back to sleep.
15. WHEN the person returns to the tab, THE SYSTEM SHALL restore the tab title to the timer title.
16. WHEN three or more wanderings have been counted in a focus session, THE SYSTEM SHALL draw the ghost at 1.8 times its base size in front of the mantel.
17. WHILE the ghost is closer than its sleeping spot, THE SYSTEM SHALL tint the edges of the room in the ghost's color, more strongly the closer it is.
18. WHEN the person comes back from a wandering that was counted, THE SYSTEM SHALL leave one will-o'-wisp in the upper room for each wandering counted that day, up to eight, SHALL never remove one as the count grows, and SHALL keep them through the end of the session and a reload.
19. WHILE any will-o'-wisp is shown, THE SYSTEM SHALL describe the wisps in the scene's accessible label as the times the person came back, without counting the leaving.
20. WHEN a wandering is counted, THE SYSTEM SHALL show the session's count on the timer as comebacks ("Came back N times"), call that day's count comebacks in the Hearth, and add the time away to that day's log.

## Requirement 4: The house
**User story:** As a returning user, I want my focus to visibly restore something, so that the work feels like it adds up.

1. WHEN a focus session starts, THE SYSTEM SHALL light the next candle on the mantel.
2. WHEN a focus session finishes, THE SYSTEM SHALL keep that candle lit.
3. WHEN the fourth candle in a room is lit, THE SYSTEM SHALL mark the room restored.
4. WHILE the break after a restoration runs, THE SYSTEM SHALL keep showing the restored room.
5. WHEN all six rooms of a house are restored, THE SYSTEM SHALL announce that the house is restored.
6. THE SYSTEM SHALL keep every lit candle and every restored room unless the person confirms erasing all data.
7. THE SYSTEM SHALL show a house map listing every room with its state.
8. WHILE a focus session runs, THE SYSTEM SHALL melt the burning candle in step with the session's progress.
9. WHILE a focus session runs, THE SYSTEM SHALL bring the room's colors back and thin its cobwebs in step with the candles lit plus the session's progress.
10. WHEN a room is restored, THE SYSTEM SHALL show its cobwebs cleared, its portrait's eyes closed and its colors restored.
11. WHEN a room is restored, THE SYSTEM SHALL show a "Restored" banner.
12. WHEN a room is restored, THE SYSTEM SHALL play the restoration sound.
13. WHEN the restored room's break ends or the next focus session starts, THE SYSTEM SHALL open the next room.
14. WHEN a house is restored, THE SYSTEM SHALL start a new house and keep the count of rooms restored.
15. WHEN the person selects a room in the house map, THE SYSTEM SHALL show a preview of that room.
16. WHEN the main screen opens, THE SYSTEM SHALL part the stage drapes over a title card naming the current room.
17. WHEN a focus session starts, THE SYSTEM SHALL flare the new candle's light once.
18. WHEN a room is restored, THE SYSTEM SHALL sweep a band of warm light across the room and burst the dust off it, in about 2 seconds.
19. THE SYSTEM SHALL show four candlesticks on the mantel whatever the room's size, lighting them in step with the room's progress.
20. WHERE the person prefers reduced motion, THE SYSTEM SHALL show the drapes open and the restored room as a still, with no title card, flare, sweep or dust animation.
21. WHEN a focus session starts, THE SYSTEM SHALL wash the whole stage in one warm bloom lasting about 600 ms, shown as a plain fade without growth where the person prefers reduced motion.
22. WHEN a room is restored, THE SYSTEM SHALL keep the portrait and the fireplace clear of the Restored caption and of the ghost's words.
23. WHEN a room is restored, THE SYSTEM SHALL hold the ghost's words until the restoration sweep has finished (about 2.5 s).
24. WHILE a room is still haunted, THE SYSTEM SHALL keep at least 8% of the room's color, so the haunted room reads as moonlit rather than muddy.

## Requirement 5: The Hearth (streak)
**User story:** As someone building a habit, I want a streak that encourages without punishing, so that one bad day does not erase my progress.

1. THE SYSTEM SHALL count a day as active when it has at least one finished focus session, using the person's local calendar day.
2. WHEN exactly one day between two active days has no finished focus session, THE SYSTEM SHALL continue the streak across that day.
3. IF two or more days pass without a finished focus session, THEN THE SYSTEM SHALL show a cold hearth with the number of rooms already restored.
4. THE SYSTEM SHALL show the focus sessions of the last fourteen days.
5. IF the hearth is cold, THEN THE SYSTEM SHALL keep the best streak.
6. THE SYSTEM SHALL show today's sessions, focus minutes and wanderings.
7. THE SYSTEM SHALL show the best streak and the rooms restored.
8. WHILE the hearth is warm AND no session has finished today, THE SYSTEM SHALL name the day by which a session keeps it warm.

## Requirement 6: Sound
1. THE SYSTEM SHALL synthesize every sound with the Web Audio API and SHALL NOT ship audio files.
2. THE SYSTEM SHALL provide a volume control and a mute toggle on the main screen.
3. WHERE ambient wind is enabled, THE SYSTEM SHALL play a generated, looping wind until it is disabled.
4. WHEN any sound is rendered at full volume, THE SYSTEM SHALL keep its peak between -28 and -1 dBFS.
5. THE SYSTEM SHALL provide a sound check page that plays every sound.
6. WHEN the person changes the volume or the mute toggle, THE SYSTEM SHALL remember the choice across reloads.
7. WHILE sound is muted, THE SYSTEM SHALL NOT play ambient wind.
8. WHEN a one-shot sound is rendered at full volume, THE SYSTEM SHALL fade it to below -50 dBFS before it ends.
9. THE SYSTEM SHALL show each sound's measured levels on the sound check page.

## Requirement 7: Accessibility and keyboard
1. THE SYSTEM SHALL make every control reachable and operable by keyboard.
2. WHEN the person presses a shortcut key, THE SYSTEM SHALL perform its action: Space (start, pause or resume), R (reset), S (skip), N (new task), M (mute), A (ambient), H (house), comma (settings), ? (shortcut list).
3. WHEN a focus session finishes, THE SYSTEM SHALL announce it through a polite live region.
4. WHERE the person prefers reduced motion (system setting or in-app choice), THE SYSTEM SHALL stop all animation and drifting.
5. THE SYSTEM SHALL keep text contrast at WCAG AA or better on the dark theme.
6. WHEN the main screen opens on a 1280x720 or larger desktop viewport, with or without the demo banner, THE SYSTEM SHALL show the room, the timer digits and the primary button without scrolling.
7. WHEN a control has keyboard focus, THE SYSTEM SHALL show a visible focus indicator.
8. WHILE the person is typing in a text field, THE SYSTEM SHALL ignore the shortcut keys.
9. WHEN a break starts or becomes ready, THE SYSTEM SHALL announce it through the polite live region.
10. WHEN a wandering is counted, THE SYSTEM SHALL announce it through the polite live region.
11. WHEN a room is restored, THE SYSTEM SHALL announce it through the polite live region.
12. WHERE the person prefers reduced motion, THE SYSTEM SHALL keep every state visible.
13. WHEN the viewport is 390 px wide, THE SYSTEM SHALL fit the page without sideways scrolling.
14. WHEN a break ends, THE SYSTEM SHALL announce that the next candle can be lit, through the polite live region.
15. WHEN the viewport is 720 px wide or narrower, THE SYSTEM SHALL show the ghost's words as a caption below the scene, never over the Restored banner.
16. WHEN the viewport is 720 px wide or narrower, THE SYSTEM SHALL keep an accessible name on every icon-only toolbar button and keep zero axe A/AA violations at 390 px.
17. WHEN the viewport is 720 px wide or narrower in demo mode, THE SYSTEM SHALL fit the demo banner on one line.
18. WHEN the viewport is 480 px wide or narrower, THE SYSTEM SHALL show the masthead's mark and name on one line without the tagline, and label the demo button "Try the 30 s demo" in words.
19. WHEN a first-time visitor opens the main screen on a viewport 720 px wide or narrower, THE SYSTEM SHALL show a one-line introduction above the room that links to the full guide.
20. THE SYSTEM SHALL give every task checkbox and footer link a target at least 24 px tall, and SHALL keep the house map's decorative windows out of the accessibility tree, with the room list as the keyboard way to choose a room.
21. WHEN the person presses U or the Unmask button beside the room heading, THE SYSTEM SHALL switch between the haunted house and a plain Pomodoro view without changing the timer, the tasks, the house or the day history, and SHALL remember the choice in this browser.
22. WHILE the plain view is shown, THE SYSTEM SHALL show session progress as a named progress bar and the distraction, goal and streak counts as text, each with a note naming the part of the house that stands for it.
23. WHEN the person switches between the house and the plain view AND motion is not reduced, THE SYSTEM SHALL close the drapes over the stage while the ghost tugs her sheet, swap the view only while the drapes are closed, and open them again within about 1.1 s; WHEN the house comes back, THE SYSTEM SHALL end the change with a candle strike; WHILE motion is reduced, THE SYSTEM SHALL swap the view at once.
24. WHILE the plain view is shown, THE SYSTEM SHALL show the timer without its costume (no glow, no brass ornaments) below the plain view rather than over it, with every tile only as tall as its content.

## Requirement 8: Offline and privacy
1. THE SYSTEM SHALL store all data in the browser's localStorage by default.
2. WHEN the app has been loaded once, THE SYSTEM SHALL open and run with no network (service worker precache).
3. IF storage is unavailable or full, THEN THE SYSTEM SHALL keep the timer working in memory.
4. WHEN the person asks to erase all data, THE SYSTEM SHALL ask for confirmation before erasing.
5. WHEN the person confirms the erase, THE SYSTEM SHALL remove every task, day and restored room.
6. WHEN the person declines the erase, THE SYSTEM SHALL keep all data.

## Requirement 9: Demo mode
1. WHEN the page is opened with `?demo=1`, THE SYSTEM SHALL run a 20 second focus and 10 second breaks.
2. WHILE in demo mode, THE SYSTEM SHALL NOT read or write the person's tasks, days or house.
3. WHILE in demo mode, THE SYSTEM SHALL show a demo banner.
4. WHEN the page is opened with `?demo=1`, THE SYSTEM SHALL start in a fully haunted parlor that a single candle restores (the demo house's room size is one candle, kept in memory only).
5. WHILE in demo mode, THE SYSTEM SHALL use the person's saved settings and SHALL NOT save changes to them.
6. WHEN the person chooses "Leave the demo", THE SYSTEM SHALL open the person's own house.
7. WHEN the page is opened with `?demo=finale`, THE SYSTEM SHALL start the demo house with five rooms restored and the Observatory still dark, so one 20 second focus restores the last room and finishes the house.
8. WHEN the last room of a house is restored, THE SYSTEM SHALL open the house map about five seconds later on a card with the journal's last page and a line about the new house down the lane, unless another window is open, and SHALL show the finished house with every window lit beside the new one.

## Requirement 10: Phase-end notification
**User story:** As someone who works in another tab, I want an optional notification when a phase ends, so that I notice without watching the timer.

1. THE SYSTEM SHALL keep the setting "Notify me when a phase ends while this tab is hidden" off until the person turns it on.
2. WHEN the person turns the setting on AND the browser has not yet answered a permission request for this site, THE SYSTEM SHALL request notification permission.
3. THE SYSTEM SHALL NOT request notification permission at any time other than when the person turns the setting on.
4. IF the person turns the setting on AND permission is denied, dismissed or unsupported, THEN THE SYSTEM SHALL leave the setting off and say why.
5. IF the setting is on AND the browser reports that notifications are denied or unsupported, THEN THE SYSTEM SHALL turn the setting off and say why.
6. WHEN a focus or break phase ends AND the document is hidden AND the setting is on AND permission is granted, THE SYSTEM SHALL show one notification.
7. WHEN the system shows a phase-end notification, THE SYSTEM SHALL name the phase that ended and what comes next.
8. WHILE the document is visible, THE SYSTEM SHALL NOT show a phase-end notification.
9. WHEN a phase ends, THE SYSTEM SHALL show at most one notification for that phase end, including when later ticks arrive after the end time.
10. WHEN the person skips or resets a phase, THE SYSTEM SHALL NOT show a phase-end notification.
11. WHILE in demo mode, THE SYSTEM SHALL show a phase-end notification only under the conditions of criterion 6.
12. WHERE the browser has no Notification API, THE SYSTEM SHALL run unchanged with no notifications.
13. IF the setting is on AND permission has never been answered, THEN THE SYSTEM SHALL stay silent and SHALL NOT ask for permission.

## Requirement 11: Export and import the house
**User story:** As someone who changes computers, I want to save my house to a file and load it elsewhere, so that my candles and rooms come with me.

1. WHEN the person activates "Export house", THE SYSTEM SHALL download a JSON file that holds the current snapshot, a format name and a format version.
2. WHEN the person activates "Export house", THE SYSTEM SHALL name the file `haunted-house-YYYY-MM-DD.json` using the local day from the injected clock.
3. WHEN the person chooses a file with "Import house", THE SYSTEM SHALL parse its snapshot with the defensive parser and merge it with the current house through `mergeModels`.
4. WHEN an import is merged, THE SYSTEM SHALL keep the house with the higher `houseScore`, so that no lit candle or restored room is removed.
5. WHEN an import is merged, THE SYSTEM SHALL keep the larger value of each day's sessions, focus time and wanderings.
6. WHEN an import is merged, THE SYSTEM SHALL keep this device's running timer.
7. IF the chosen file is larger than 1 MB, THEN THE SYSTEM SHALL refuse it without reading it, say so, and change nothing.
8. IF the chosen file is not valid JSON, THEN THE SYSTEM SHALL refuse it, say so, and change nothing.
9. IF the chosen file is not a Haunted Pomodoro house file, THEN THE SYSTEM SHALL refuse it, say so, and change nothing.
10. IF the chosen file has a different format version, THEN THE SYSTEM SHALL refuse it, say so, and change nothing.
11. IF the chosen file's snapshot is missing or damaged, THEN THE SYSTEM SHALL refuse it, say so, and change nothing.
12. WHEN an import succeeds, THE SYSTEM SHALL say whether the candles and rooms moved forward or were already as far along.
13. WHILE in demo mode, THE SYSTEM SHALL disable export and import and show the reason.
14. THE SYSTEM SHALL make the export button and the import file input operable by keyboard and give each an accessible name.
15. WHEN an import finishes, THE SYSTEM SHALL show its result in a status region and announce it through the polite live region.

## Requirement 12: The house's story and the ghost's voice
**User story:** As someone coming back every day, I want the house to tell a story as I restore it, so that the progress means something beyond a number.

1. WHEN a room is restored, THE SYSTEM SHALL unlock that room's page of the ghost's journal and say so in the ghost's line and the live region.
2. WHEN the person opens the house map, THE SYSTEM SHALL show the journal with one page per room, unlocked pages in full and locked pages naming the room that holds them.
3. WHEN all six rooms of a house are restored, THE SYSTEM SHALL finish the book, show its last page in the journal from then on, and start the next house's pages afresh.
4. WHEN a wandering is counted, THE SYSTEM SHALL choose the ghost's line from the current room and the session's wander count, from at least fifteen lines.
5. WHERE an earlier day in the last fourteen has a focus session, THE SYSTEM SHALL show one diary line in the Hearth about the most recent such day, in the ghost's voice.
6. WHERE the last seven days have a focus session, THE SYSTEM SHALL show a weekly reflection with candles, focus time and the week's comebacks (its counted wanderings).
7. THE SYSTEM SHALL keep every journal page, ghost line, diary line and reflection free of shaming words, and SHALL NOT mention a rise in wanderings.
8. THE SYSTEM SHALL compute the journal, the ghost's lines, the diary and the reflection with pure functions that take the day as an argument and use no network.
9. WHEN a whole house is restored, THE SYSTEM SHALL keep the journal's last page in the house map, and SHALL keep the room heading on the finished house while its last room is on show.
10. WHERE the seven days before logged time away AND this week's time away is lower in whole minutes, THE SYSTEM SHALL say in the weekly reflection that time away fell, with both totals; otherwise it SHALL say only what was kept.
