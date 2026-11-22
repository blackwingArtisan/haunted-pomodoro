# Requirements: The ghost follows you

## Introduction
Haunted Pomodoro already notices when the person leaves the tab during a focus session: the ghost wakes, the tab title calls them back, and the comeback is counted gently (`haunted-focus-timer` Requirement 3). This spec lets the ghost go with them. While a focus candle burns, the tab's icon is a small candle that melts with the session, and while the person is away the icon becomes the ghost's face. Optionally, and only when the person turns it on, the ghost also appears in a small always-on-top window (the Document Picture-in-Picture API) that floats over whatever app they switched to, showing the time left, and fades when they return.

The feature is a companion, not a leash. It reads the timer and the Page Visibility state and never writes to either. Opening, fading, closing or failing to open the window never changes a candle, a wandering, the streak or the timer, and never counts against the person. Where the browser has no Document Picture-in-Picture (Firefox, Safari), the icon and the title are the whole feature.

This spec covers the favicon frames, the tab title, the "Let her follow me" setting, the follow window and its fade, closing, failure and fallback, reduced motion, accessibility, the never-punish rule, persistence of the setting, and determinism. The timer, the ghost's wake and return, the house and sync are specified in `haunted-focus-timer` and `house-sync` and are not changed here.

Every criterion is written in EARS form and states one testable behavior:
- WHEN `<event>`, THE SYSTEM SHALL `<response>`.
- WHILE `<state>`, THE SYSTEM SHALL `<response>`.
- WHERE `<optional feature or setting is present>`, THE SYSTEM SHALL `<response>`.
- IF `<unwanted condition>`, THEN THE SYSTEM SHALL `<response>`.
- THE SYSTEM SHALL `<response>` (always true).

Numbers never change. A criterion that held more than one behavior keeps its first behavior under its old number, and the others are appended at the end of the requirement.

Tests name the criteria of this spec with the spec's folder name in front, so they cannot be confused with the criteria of `haunted-focus-timer`, whose tags stay as they are: `// Req ghost-follows-you:2.1, 2.3`.

## Glossary
- **Follow window**: the small always-on-top window opened with `documentPictureInPicture.requestWindow`. It holds the ghost's picture, the time left and one line from the ghost. At most one is open per tab.
- **Follow setting**: the setting "Let her follow me" (`settings.ghostFollows`). Off by default.
- **Follower**: the app-level object (`src/app/follow.ts`) that reads the model and the page's visibility and drives the favicon, the tab title and the follow window. It never dispatches an action that changes the model.
- **Favicon frame**: one drawing of the tab's icon, chosen by a pure function of the timer, the time, the page's visibility and the motion preference. Kinds: `idle`, `candle` (with a wax step), `ghost` (with a face number) and `break`.
- **Wax step**: the progress of a focus session cut into 24 equal steps. Step 0 is a full candle; step 23 is the last drawing before the session ends.
- **Ghost's face**: the favicon frame shown while the page is hidden during a running focus session. It has two drawings (face 0 and face 1), which alternate once per second unless motion is reduced.
- **Follow state**: the runtime state of the follow window (`off`, `ready`, `opening`, `resting`, `floating`, `dismissed`, `unavailable`). It is never saved.
- **Resting**: the window is open and the page is visible; the ghost in the window is faded.
- **Floating**: the window is open and the page is hidden; the ghost in the window is at full strength.
- **Dismissed**: the window was closed during this focus session by the person or by the browser; no new window is requested until the person starts the next focus session.
- **User gesture**: a click or key press that gives the page transient user activation, which `requestWindow` needs.
- **Fallback**: the favicon and the tab title, which work in every browser and need no permission.
- **Reduced motion**: the system preference or the in-app choice, as already resolved by `App.tsx` (`haunted-focus-timer` Requirement 7.4).

## Requirement 1: The favicon candle
**User story:** As someone with many tabs open, I want the tab's icon to be a candle that burns down with my session, so that I can see my progress at a glance.

1. WHILE a focus session is running or paused AND the page is visible, THE SYSTEM SHALL draw the favicon as a lit candle whose wax height is (24 minus the wax step) divided by 24.
2. WHEN the session's progress enters the next wax step, THE SYSTEM SHALL draw the favicon again with one step less wax.
3. WHILE a focus session is paused, THE SYSTEM SHALL keep the candle at the wax step it had when the session was paused.
4. WHILE the timer is idle in a focus phase, THE SYSTEM SHALL show the app's static icon.
5. WHILE a short or long break is running or paused, THE SYSTEM SHALL show the break frame, a still candle with a ghost-green flame.
6. WHEN a phase completes, is skipped or is reset, THE SYSTEM SHALL show the frame for the new state on the same update.
7. THE SYSTEM SHALL compute each favicon frame from the timer's absolute end time, so that a throttled tab shows the correct wax step on its next update.
8. IF the browser cannot create a canvas or a 2D context, THEN THE SYSTEM SHALL keep the static icon and run unchanged.
9. THE SYSTEM SHALL draw every favicon frame from code on a 32 by 32 canvas and SHALL NOT fetch any image.

## Requirement 2: The ghost's face while the person is away
**User story:** As someone who has switched to another tab, I want to see the ghost in the tab's icon, so that I feel kept company and remember my candle is still burning.

1. WHILE a focus session is running AND the page is hidden, THE SYSTEM SHALL show the ghost's face as the favicon.
2. WHEN the page becomes hidden during a running focus session, THE SYSTEM SHALL show the ghost's face on the same update, without waiting for the grace period.
3. WHEN the page becomes visible, THE SYSTEM SHALL show the candle frame for the session's current wax step on the same update.
4. WHILE the timer is paused or in a break AND the page is hidden, THE SYSTEM SHALL NOT show the ghost's face.
5. WHILE the ghost's face is shown AND motion is not reduced, THE SYSTEM SHALL alternate between face 0 and face 1 once per second.
6. WHEN the page becomes hidden or visible, THE SYSTEM SHALL leave the count of wanderings to the rules of `haunted-focus-timer` Requirement 3 and SHALL NOT change it.
7. WHEN a focus session ends while the page is hidden, THE SYSTEM SHALL replace the ghost's face with the frame for the next phase.

## Requirement 3: The tab title
**User story:** As someone in another tab, I want the tab's title to show how long my candle has left, so that I can read the time without switching back.

1. WHILE a phase is running or paused, THE SYSTEM SHALL show the time left as mm:ss, the phase name and the app name in the tab title.
2. WHILE the timer is idle, THE SYSTEM SHALL show only the app name in the tab title.
3. WHILE a focus session is running AND the page is hidden AND the ghost has woken for the current absence, THE SYSTEM SHALL show "Come back… mm:ss left · Haunted Pomodoro" as the tab title.
4. WHEN the person returns to the tab, THE SYSTEM SHALL show the timer title on the same update.
5. THE SYSTEM SHALL compute the time in the tab title from the timer's absolute end time.
6. THE SYSTEM SHALL NOT put a count of wanderings, a streak or any word of blame in the tab title.
7. WHEN the title text is the same as at the last update, THE SYSTEM SHALL NOT assign it again.
8. WHILE a focus session is running AND the page is hidden AND the ghost has not yet woken for the current absence, THE SYSTEM SHALL show "Ottilie is here · mm:ss · Focus · Haunted Pomodoro" as the tab title, so that the title says something from the same update at which the ghost's face appears in the icon (Requirement 2.2).

## Requirement 4: The "Let her follow me" setting
**User story:** As someone who wants the ghost's company in other apps, I want to turn the floating window on myself, so that nothing opens on my screen unless I chose it.

1. THE SYSTEM SHALL offer a setting labelled "Let her follow me" in Settings, off by default.
2. WHEN the person turns the setting on, THE SYSTEM SHALL NOT open a window at that moment.
3. WHEN the person turns the setting off while the window is open, THE SYSTEM SHALL close the window and keep the session running.
4. WHERE the browser has no Document Picture-in-Picture API, THE SYSTEM SHALL disable the setting and say beside it, in text, that the ghost follows in the tab's icon and title instead.
5. WHERE the browser has the Document Picture-in-Picture API, THE SYSTEM SHALL say beside the setting that a small window floats over other apps and that it can be closed whenever the person likes while the candle burns on.
6. WHILE the setting is off, THE SYSTEM SHALL NOT request a window.
7. WHILE in demo mode, THE SYSTEM SHALL apply the setting under the same conditions as in the person's own house.
8. THE SYSTEM SHALL NOT turn the setting on by itself and SHALL NOT ask the person to turn it on in a prompt, a banner or a notification.

## Requirement 5: Opening the window
**User story:** As someone who lit a candle and then switched apps, I want the ghost's window to be there when I need it, so that I can see the time left without going back to the tab.

1. WHEN the person starts a focus session by pressing "Light a candle" or the start shortcut AND the setting is on AND the browser has the API, THE SYSTEM SHALL request the window in the same event handler, before any asynchronous work.
2. WHEN the request succeeds, THE SYSTEM SHALL show the ghost, the time left and the ghost's line in the window.
3. WHEN the window opens while the page is visible, THE SYSTEM SHALL show the ghost in the window faded.
4. THE SYSTEM SHALL NOT request a window from a timer tick, a phase change, a visibility change, a page load or a change of settings.
5. WHEN the page loads with a focus session already running, THE SYSTEM SHALL NOT open a window and SHALL show the favicon and the title as usual.
6. WHEN "start the next focus" starts a focus session by itself, THE SYSTEM SHALL NOT request a window.
7. WHEN the person resumes a paused session, THE SYSTEM SHALL NOT request a window.
8. WHEN the person starts a focus session while a window is already open, THE SYSTEM SHALL keep that window and SHALL NOT request a second one.
9. THE SYSTEM SHALL request a window with the size hint 280 by 200 CSS pixels and SHALL work at whatever size the browser gives.
10. WHEN the person starts a focus session, THE SYSTEM SHALL start the timer at once and SHALL NOT wait for the window's request to settle.

## Requirement 6: What the window shows and how it fades
**User story:** As someone working in another app, I want the ghost to be clear while I am away and to fade when I come back, so that she keeps me company without getting in my way.

1. WHILE the window is open, THE SYSTEM SHALL show the ghost, the time left as mm:ss and the phase name in it.
2. WHILE the window is open, THE SYSTEM SHALL show the same time left as the tab title, to the second, computed from the timer's absolute end time.
3. WHEN the page becomes hidden while the window is open, THE SYSTEM SHALL show the ghost in the window at full strength.
4. WHEN the page becomes visible while the window is open, THE SYSTEM SHALL fade the ghost in the window to 25% opacity over 600 ms.
5. WHILE the window is open, THE SYSTEM SHALL keep the time left and the ghost's line at full strength, whatever the ghost's opacity.
6. WHEN the page becomes visible, THE SYSTEM SHALL NOT close the window.
7. WHILE the window is open, THE SYSTEM SHALL show one line from the ghost, chosen from the follow lines in `src/core/story.ts` by the minute of time left, so the same minute always shows the same line.
8. WHILE the timer is paused, THE SYSTEM SHALL show the word "Paused" in the window and freeze the time left.
9. THE SYSTEM SHALL give the window's document the language "en", the title "Ottilie, keeping time" and the app's dark colors, because the window starts without the app's styles.

## Requirement 7: Closing the window
**User story:** As someone who finds the floating window in the way, I want to close it with no consequence, so that I never feel watched or judged.

1. WHEN the person closes the window, THE SYSTEM SHALL keep the session running with the same time left.
2. WHEN the person closes the window, THE SYSTEM SHALL NOT change the candles, the wanderings, the streak, the tasks or the house.
3. WHEN the window closes, THE SYSTEM SHALL NOT announce or write any note about it, in the live region or in Settings (Requirement 11.5 decides).
4. WHEN the person closes the window, THE SYSTEM SHALL NOT request another window during the same focus session.
5. WHEN the person starts the next focus session with "Light a candle" AND the setting is on, THE SYSTEM SHALL request a window again.
6. WHEN the person closes the window, THE SYSTEM SHALL leave the setting on.
7. WHEN a focus session finishes, is skipped or is reset, THE SYSTEM SHALL close the window.
8. WHEN the window closes for any reason, THE SYSTEM SHALL stop writing to it and drop its reference.
9. WHEN the browser closes the window (a navigation, a reload or another Picture-in-Picture window), THE SYSTEM SHALL handle it as if the person had closed it.
10. WHILE the window is closed AND the page is hidden AND a focus session is running, THE SYSTEM SHALL keep showing the ghost's face and the title.

## Requirement 8: When the window cannot open
**User story:** As someone whose browser or settings do not allow the window, I want the app to carry on quietly, so that the timer is never affected.

1. IF the request for the window is rejected, THEN THE SYSTEM SHALL keep the session running with the timer unchanged.
2. IF the request for the window is rejected, THEN THE SYSTEM SHALL say, in the polite live region and in the settings note, that the window could not open and that the ghost follows in the icon and the title.
3. IF the request for the window is rejected, THEN THE SYSTEM SHALL NOT retry until the person starts the next focus session.
4. WHERE the browser has no Document Picture-in-Picture API, THE SYSTEM SHALL run unchanged with the favicon and the title, and SHALL NOT throw.
5. IF writing to the window throws, THEN THE SYSTEM SHALL treat the window as closed under Requirement 7.
6. IF the request settles after the focus session has ended or been reset, THEN THE SYSTEM SHALL close the window at once.
7. IF the request settles after the setting was turned off, THEN THE SYSTEM SHALL close the window at once.
8. THE SYSTEM SHALL NOT show an error dialog, an alert or error styling when the window cannot open.

## Requirement 9: Reduced motion
**User story:** As someone who is sensitive to motion, I want the ghost to stay still, so that her company is calm.

1. WHILE motion is reduced, THE SYSTEM SHALL draw the ghost's face as one still frame, face 0.
2. WHILE motion is reduced, THE SYSTEM SHALL still draw a new candle frame at each wax step.
3. WHILE motion is reduced, THE SYSTEM SHALL change the ghost's opacity in the window at once, with no transition.
4. WHILE motion is reduced, THE SYSTEM SHALL keep the ghost in the window still, with no bobbing or drifting.
5. WHEN the motion preference changes while the window is open, THE SYSTEM SHALL apply it in the window within one update, without reopening the window.
6. WHILE motion is reduced, THE SYSTEM SHALL keep every state visible in the window: the faded ghost, the time left and the word "Paused".

## Requirement 10: Accessibility
**User story:** As someone who uses a keyboard or a screen reader, I want the setting and the window to be usable and clear, so that the feature is not only for sighted mouse users.

1. THE SYSTEM SHALL present the setting as a native checkbox with the switch role, with the accessible name "Let her follow me", reachable by Tab and operable with Space.
2. THE SYSTEM SHALL associate the setting's explanation with the control through `aria-describedby`.
3. THE SYSTEM SHALL report zero axe WCAG 2.1 A and AA violations in Settings with the setting present, both where the browser has the API and where it has not.
4. THE SYSTEM SHALL NOT make the favicon the only carrier of any state: every favicon frame has its state in the tab title, on the page or in the live region.
5. WHEN the window opens, closes or fails to open, THE SYSTEM SHALL announce it through the polite live region of the main page.
6. WHILE the window is open, THE SYSTEM SHALL put the time left in an element with the role "timer" and the accessible name "Time left", and SHALL hide the ghost's picture from assistive technology.
7. THE SYSTEM SHALL keep text in the window at a contrast ratio of at least 4.5 to 1 against its background, at every ghost opacity.

## Requirement 11: Never punish
**User story:** As someone who sometimes wanders and sometimes closes things, I want the ghost to stay kind, so that using this feature never costs me anything.

1. THE SYSTEM SHALL NOT dispatch any timer, house, streak or task action from the follower, so that opening, fading, closing or failing to open the window leaves the model unchanged.
2. THE SYSTEM SHALL NOT mention a count of wanderings, time away or any loss in the favicon, the title or the window.
3. WHILE the setting is off, THE SYSTEM SHALL behave as before for the timer, the tasks, the house and the streak.
4. THE SYSTEM SHALL keep every line the ghost says in the window as data in `src/core/story.ts`, where the never-shame test checks it.
5. WHEN the window is closed, THE SYSTEM SHALL NOT have the ghost comment on the closing.

## Requirement 12: Persistence of the setting
**User story:** As a daily user, I want my choice remembered, so that I set it once.

1. THE SYSTEM SHALL save the setting as `ghostFollows` with the other settings in the saved copy.
2. WHEN a saved copy has no `ghostFollows` field, THE SYSTEM SHALL read it as off.
3. WHEN the `ghostFollows` field of a saved copy is anything other than the boolean true, THE SYSTEM SHALL read it as off.
4. WHILE the setting is on AND the browser has no Document Picture-in-Picture API, THE SYSTEM SHALL keep the saved value unchanged.
5. WHEN the person erases all data, THE SYSTEM SHALL keep the setting as it was, as it does for every other setting.
6. THE SYSTEM SHALL NOT save whether a window is open, and SHALL start every page load with no window.

## Requirement 13: Determinism and cost
**User story:** As a maintainer, I want the feature to be predictable and cheap, so that tests are exact and a background tab stays quiet.

1. THE SYSTEM SHALL compute the favicon frame as a pure function of the timer state, the time, the page's visibility and the motion preference.
2. THE SYSTEM SHALL compute every transition of the follow state as a pure function of the state, an event and the time.
3. THE SYSTEM SHALL NOT read the system clock or a random number in the new modules of `src/core`.
4. WHEN the frame is the same as at the last update, THE SYSTEM SHALL NOT draw the canvas or assign the icon again.
5. THE SYSTEM SHALL draw each distinct frame at most once per page load and reuse its image afterwards, so that a page load never holds more than 28 favicon images.
6. WHEN a tick changes none of the favicon frame, the tab title and the window's content, THE SYSTEM SHALL NOT write to any of them.
7. THE SYSTEM SHALL make no network request for this feature.
