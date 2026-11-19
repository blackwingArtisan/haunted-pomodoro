import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createBrowserNotifier } from './adapters/notify';
import { createStores } from './adapters/store';
import { HouseController } from './app/controller';
import { createDemoModel } from './app/demo';
import { SoundEngine } from './audio/sound';
import { systemClock } from './core/clock';
import { dayKey } from './core/dates';
import { decideImport, exportHouse, importSizeProblem } from './core/house-file';
import { ROOMS, viewHouse, type RoomDef } from './core/house';
import { createModel, demoConfigFor, timerConfig, type Cue } from './core/model';
import { pageForRoom, returnLine } from './core/story';
import { computeStreak } from './core/streak';
import { focusInProgress, progressAt, remainingAt } from './core/timer';
import { CloseIcon, GearIcon, HouseIcon, KeysIcon, MoonIcon, SoundIcon } from './ui/icons';
import { Dialog, formatClock, Hearth, IntroCard, HouseMap, PHASE_LABEL, SettingsForm, ShortcutList, TaskLedger, TimerPlaque } from './ui/panels';
import { MANTEL_CANDLES, mantelCandles } from './ui/candles';
import { GHOST_SPOTS, Scene, type GhostView } from './ui/Scene';

const stores = createStores(import.meta.env);
const notifier = createBrowserNotifier();
const isTabHidden = () => document.visibilityState === 'hidden';

/** Hands a text file to the browser as a download. */
function downloadTextFile(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Places the ghost's speech above wherever the ghost is floating, kept inside the stage. */
function ghostLineStyle(closeness: number): CSSProperties {
  const [x, y, scale] = GHOST_SPOTS[Math.min(3, Math.max(0, Math.round(closeness)))]!;
  const left = Math.min(72, Math.max(28, (x / 1200) * 100));
  const top = Math.max(9, ((y - 110 * scale) / 700) * 100 - 9);
  return { left: `${left}%`, top: `${top}%` };
}

function isDemoUrl(): boolean {
  return new URLSearchParams(window.location.search).has('demo');
}

function setDemoUrl(on: boolean): void {
  const url = new URL(window.location.href);
  if (on) url.searchParams.set('demo', '1');
  else url.searchParams.delete('demo');
  window.location.assign(url.toString());
}

function buildController(demo: boolean): HouseController {
  const now = systemClock.now();
  if (demo) {
    const settings = stores.local.loadSync()?.settings;
    const initial = createDemoModel(now, settings ?? createModel(now).settings);
    return new HouseController({ initial, clock: systemClock, configFor: demoConfigFor, notifier, isHidden: isTabHidden });
  }
  const initial = stores.local.loadSync() ?? createModel(now);
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  return new HouseController({
    initial,
    clock: systemClock,
    configFor: timerConfig,
    notifier,
    isHidden: isTabHidden,
    persist: (model) => {
      stores.local.saveSync(model);
      if (stores.primary.kind === 'local') return;
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => void stores.primary.save(model), 4_000);
    },
  });
}

function useSystemReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
  );
}

type DialogName = 'house' | 'settings' | 'shortcuts' | null;

export function App() {
  const demo = useMemo(isDemoUrl, []);
  const controller = useMemo(() => buildController(demo), [demo]);
  const model = useSyncExternalStore(controller.subscribe, controller.getModel);
  const sound = useMemo(() => new SoundEngine(), []);
  const [now, setNow] = useState(() => systemClock.now());
  const [dialog, setDialog] = useState<DialogName>(null);
  const [announcement, setAnnouncement] = useState('');
  const [ghostLine, setGhostLine] = useState<string | null>(null);
  const [ghostAwakeUntil, setGhostAwakeUntil] = useState(0);
  const [rattleUntil, setRattleUntil] = useState(0);
  const [showcase, setShowcase] = useState<RoomDef | null>(null);
  const [notifyNote, setNotifyNote] = useState('');
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden');
  const taskInput = useRef<HTMLInputElement>(null);
  const settingsRef = useRef(model.settings);
  settingsRef.current = model.settings;
  const systemReduced = useSystemReducedMotion();
  const { settings, timer, house } = model;
  const reducedMotion = settings.motion === 'reduced' || (settings.motion === 'system' && systemReduced);

  // Pull a synced copy once at start when cloud sync is configured.
  useEffect(() => {
    if (demo || stores.primary.kind === 'local') return;
    void stores.primary.load().then((m) => m && controller.replace(m));
  }, [controller, demo]);

  // If the browser has since blocked notifications, the setting turns itself off and says why. This never prompts.
  useEffect(() => {
    const off = controller.onNotifyOff((message) => {
      setNotifyNote(message);
      setAnnouncement(message);
    });
    controller.reconcileNotifications();
    return off;
  }, [controller]);

  // The heartbeat: advances the state machine and redraws the clock.
  useEffect(() => {
    const id = window.setInterval(() => {
      controller.dispatch({ type: 'timer', action: { type: 'tick' } });
      setNow(systemClock.now());
    }, 250);
    return () => window.clearInterval(id);
  }, [controller]);

  // Wandering off: the Page Visibility API tells us when the tab is hidden.
  useEffect(() => {
    const onVisibility = () => {
      const isHidden = document.visibilityState === 'hidden';
      setHidden(isHidden);
      controller.dispatch({ type: 'timer', action: { type: isHidden ? 'hidden' : 'visible' } });
      setNow(systemClock.now());
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [controller]);

  // Sound settings follow the model.
  useEffect(() => {
    sound.setVolume(settings.volume);
    sound.setMuted(settings.muted);
    sound.setAmbient(settings.ambient && !settings.muted);
  }, [sound, settings.volume, settings.muted, settings.ambient]);

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
  }, [reducedMotion]);

  // Cues: the theatre that follows each state change.
  useEffect(
    () =>
      controller.onCues((cues: Cue[]) => {
        const t = systemClock.now();
        for (const cue of cues) {
          switch (cue.kind) {
            case 'candleLit':
              sound.play('candle');
              setShowcase(null);
              setGhostLine(null);
              break;
            case 'candleSnuffed':
              sound.play('snuff');
              setAnnouncement('The candle was snuffed. The room keeps the candles you already lit.');
              break;
            case 'sessionComplete': {
              sound.play('chime');
              const v = viewHouse(controller.getModel().house);
              setAnnouncement(cue.distractions === 0 ? 'Session complete without a single wander. A candle stays lit.' : `Session complete. A candle stays lit. ${v.candlesLit} of ${v.candlesPerRoom} in ${v.room.name}.`);
              if (cue.distractions === 0) setGhostLine('Not a single wander. Even I am impressed.');
              else setGhostLine(null);
              break;
            }
            case 'roomRestored':
              sound.play('restored');
              setShowcase(cue.room);
              setAnnouncement(
                `${cue.room.name} is restored. ${cue.room.restored} A page of the ghost's journal came back: ${pageForRoom(cue.room.id)?.title ?? cue.room.name}.${cue.houseRestored ? ' The whole house is restored and the book is finished.' : ''}`,
              );
              setGhostLine(
                cue.houseRestored ? 'Every room is warm and my book is finished. Thank you for staying. I can rest now.' : `${cue.room.name} is mine to rest in now. A page of my book came back. It is in the house map.`,
              );
              break;
            case 'breakStarted':
              sound.play('breath');
              break;
            case 'breakOver':
              sound.play('chime');
              setShowcase(null);
              setAnnouncement('Break over. Light the next candle when you are ready.');
              break;
            case 'ghostWoke':
              setGhostAwakeUntil(Number.POSITIVE_INFINITY);
              setRattleUntil(t + 1_400);
              if (settingsRef.current.ghostCalls) {
                sound.play('moan');
                sound.play('rattle');
              }
              break;
            case 'ghostReturned':
              setGhostAwakeUntil(t + 6_000);
              setRattleUntil(t + 1_400);
              setGhostLine(returnLine(viewHouse(controller.getModel().house).room.id, cue.count));
              setAnnouncement(`The ghost noticed you left. Wandered off ${cue.count} ${cue.count === 1 ? 'time' : 'times'} this session.`);
              sound.play('rattle');
              break;
            case 'phase':
              setAnnouncement((a) => (cue.phase === 'focus' ? a : `${PHASE_LABEL[cue.phase]}${cue.autoStarted ? ' started' : ' is ready'}. ${a}`));
              break;
          }
        }
      }),
    [controller, sound],
  );

  // When the person comes back to a ghost that woke while they were away.
  useEffect(() => {
    if (!hidden && ghostAwakeUntil === Number.POSITIVE_INFINITY) setGhostAwakeUntil(systemClock.now() + 6_000);
  }, [hidden, ghostAwakeUntil]);

  // Clear the ghost's line after a while.
  useEffect(() => {
    if (!ghostLine) return;
    const id = window.setTimeout(() => setGhostLine(null), 9_000);
    return () => window.clearTimeout(id);
  }, [ghostLine]);

  const remaining = remainingAt(timer, now);
  const inFocus = timer.phase === 'focus';
  const running = timer.status === 'running';

  // Tab title: the time, or the ghost's plea while you are away.
  useEffect(() => {
    if (hidden && timer.ghostWoke) document.title = `Come back… ${formatClock(remaining)} left · Haunted Pomodoro`;
    else if (running || timer.status === 'paused') document.title = `${formatClock(remaining)} · ${PHASE_LABEL[timer.phase]} · Haunted Pomodoro`;
    else document.title = 'Haunted Pomodoro';
  }, [hidden, timer.ghostWoke, running, timer.status, timer.phase, remaining]);

  const unlock = useCallback(() => sound.unlock(), [sound]);
  // A dialog's close event can arrive after another dialog was opened; only close the one that fired.
  const closeDialog = useCallback((name: Exclude<DialogName, null>) => setDialog((d) => (d === name ? null : d)), []);

  const ghostAwake = (hidden && timer.ghostWoke) || now < ghostAwakeUntil;
  const closeness = inFocus ? Math.min(3, timer.distractions + (timer.ghostWoke ? 1 : 0)) : 0;
  const ghost: GhostView = {
    closeness,
    mood: hidden && timer.ghostWoke ? 'calling' : ghostAwake ? 'awake' : closeness > 0 ? 'watching' : 'asleep',
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (document.querySelector('dialog[open]') && e.key !== '?') return;
      const timerAction = (type: 'toggle' | 'reset' | 'skip') => {
        e.preventDefault();
        unlock();
        controller.dispatch({ type: 'timer', action: { type } });
      };
      switch (e.key) {
        case ' ':
          if (tag === 'BUTTON' || tag === 'A') return;
          timerAction('toggle');
          break;
        case 'k':
        case 'K':
          timerAction('toggle');
          break;
        case 'r':
        case 'R':
          timerAction('reset');
          break;
        case 's':
        case 'S':
          timerAction('skip');
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          taskInput.current?.focus();
          break;
        case 'm':
        case 'M':
          unlock();
          controller.dispatch({ type: 'updateSettings', patch: { muted: !settingsRef.current.muted } });
          setAnnouncement(settingsRef.current.muted ? 'Sound muted.' : 'Sound on.');
          break;
        case 'a':
        case 'A':
          unlock();
          controller.dispatch({ type: 'updateSettings', patch: { ambient: !settingsRef.current.ambient } });
          break;
        case 'h':
        case 'H':
          setDialog('house');
          break;
        case ',':
          setDialog('settings');
          break;
        case '?':
          e.preventDefault();
          setDialog((d) => (d === 'shortcuts' ? null : 'shortcuts'));
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller, unlock]);

  const view = viewHouse(house);
  const today = dayKey(now);
  const streak = computeStreak(
    Object.entries(model.days)
      .filter(([, d]) => d.sessions > 0)
      .map(([k]) => k),
    today,
  );
  const inSession = inFocus && focusInProgress(timer);
  const sessionProgress = inSession ? progressAt(timer, now) : 0;
  const shownRoom = showcase ?? view.room;
  const restoredNow = showcase !== null;
  // The room's color moves continuously through each session, not only when a candle is earned.
  const restore = restoredNow ? 1 : (view.candlesLit + sessionProgress) / view.candlesPerRoom;
  const mantel = restoredNow ? { lit: MANTEL_CANDLES, burning: null } : mantelCandles(view.candlesLit, view.candlesPerRoom, sessionProgress, inSession);
  const breathing = !inFocus && running;
  const rattling = now < rattleUntil;
  const roomNumber = (restoredNow ? ROOMS.indexOf(shownRoom) : view.roomIndex) + 1;
  const sceneLabel = `${shownRoom.name}, ${restoredNow ? 'restored' : `${view.candlesLit} of ${view.candlesPerRoom} ${view.candlesPerRoom === 1 ? 'candle' : 'candles'} lit`}. The ghost is ${ghost.mood === 'asleep' ? 'asleep' : ghost.mood === 'watching' ? 'watching you' : 'awake'}.`;

  return (
    <div className={`app phase-${timer.phase} ${breathing ? 'is-breathing' : ''} ${demo ? 'is-demo' : ''}`} data-phase={timer.phase} data-status={timer.status}>
      <a className="skip-link" href="#timer">
        Skip to the timer
      </a>
      {demo && (
        <div className="demo-banner" role="status">
          <MoonIcon />
          <span className="demo-text">
            <strong>Demo house.</strong>
            <span className="demo-long"> A 20 second focus, then a 10 second break. Your own house is untouched.</span>
            <span className="demo-short"> Yours is untouched.</span>
          </span>
          <button type="button" className="btn btn-small demo-leave" onClick={() => setDemoUrl(false)}>
            <CloseIcon width={14} height={14} />
            <span>
              Leave<span className="phone-sr-only"> the demo</span>
            </span>
          </button>
        </div>
      )}
      <header className="masthead">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M6 18 20 6l14 12v16H6z" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M20 16c2 2.4 2 4.4 0 6-2-1.6-2-3.6 0-6z" fill="#ffbf5a" />
            <rect x="17.5" y="23" width="5" height="9" rx="1" fill="#efe6d2" />
          </svg>
          <div>
            <h1>Haunted Pomodoro</h1>
            <p className="tagline">Focus by candlelight. Restore the house, room by room.</p>
          </div>
        </div>
        <nav className="toolbar" aria-label="House tools">
          <button type="button" className="tool" onClick={() => setDialog('house')} aria-keyshortcuts="H">
            <HouseIcon />
            <span>House</span>
          </button>
          <button
            type="button"
            className="tool"
            aria-pressed={!settings.muted}
            onClick={() => {
              unlock();
              controller.dispatch({ type: 'updateSettings', patch: { muted: !settings.muted } });
            }}
            aria-keyshortcuts="M"
            aria-label={settings.muted ? 'Sound is off. Turn sound on' : 'Sound is on. Mute'}
          >
            <SoundIcon muted={settings.muted} />
            <span aria-hidden="true">{settings.muted ? 'Muted' : 'Sound'}</span>
          </button>
          <label className="tool tool-volume">
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.volume * 100)}
              onChange={(e) => {
                unlock();
                controller.dispatch({ type: 'updateSettings', patch: { volume: Number(e.target.value) / 100, muted: false } });
              }}
              aria-valuetext={`${Math.round(settings.volume * 100)} percent`}
            />
          </label>
          <button type="button" className="tool" onClick={() => setDialog('settings')} aria-keyshortcuts=",">
            <GearIcon />
            <span>Settings</span>
          </button>
          <button type="button" className="tool" onClick={() => setDialog('shortcuts')} aria-keyshortcuts="?">
            <KeysIcon />
            <span>Keys</span>
          </button>
          {!demo && (
            <button type="button" className="tool tool-demo" onClick={() => setDemoUrl(true)}>
              <MoonIcon />
              <span>30 s demo</span>
            </button>
          )}
        </nav>
      </header>

      <main className="stage-grid">
        <section className="stage" aria-labelledby="room-title">
          <div className="room-heading">
            <p className="room-number">
              Room {roomNumber} of {ROOMS.length}
              {view.housesRestored > 0 && ` · House ${view.housesRestored + 1}`}
            </p>
            <h2 id="room-title" data-testid="room-title">
              {shownRoom.name}
            </h2>
            <p className="room-blurb" data-testid="room-blurb">
              {restoredNow ? shownRoom.restored : shownRoom.haunted}
            </p>
          </div>
          <div className="stage-frame">
          <div className="proscenium">
            <div className="drape drape-left" aria-hidden="true" />
            <div className="drape drape-right" aria-hidden="true" />
            <div className="title-card" aria-hidden="true">
              <span>Haunted Pomodoro</span>
              <strong>{view.room.name}</strong>
            </div>
            <Scene
              room={shownRoom}
              restore={restore}
              candlesLit={mantel.lit}
              burning={mantel.burning}
              restored={restoredNow}
              ghost={ghost}
              rattling={rattling}
              breathing={breathing}
              hearth={Math.min(1, 0.2 + streak.current * 0.16)}
              trackPointer={!reducedMotion}
              label={sceneLabel}
            />
            {restoredNow && (
              <div className="restored-banner" data-testid="restored-banner">
                <span className="restored-kicker">Restored</span>
                <span className="restored-name">{shownRoom.name}</span>
              </div>
            )}
          </div>
            {ghostLine && (
              <p className="ghost-line" data-testid="ghost-line" style={ghostLineStyle(restoredNow ? 0 : ghost.closeness)}>
                {ghostLine}
              </p>
            )}
          </div>
          <TimerPlaque timer={timer} now={now} house={house} model={model} dispatch={controller.dispatch} onGesture={unlock} showcaseName={showcase?.name ?? null} />
        </section>

        <aside className="side">
          <IntroCard show={!demo && streak.activeDays === 0} onDemo={() => setDemoUrl(true)} />
          <TaskLedger model={model} dispatch={controller.dispatch} inputRef={taskInput} />
          <Hearth streak={streak} days={model.days} today={today} house={house} roomId={view.room.id} />
        </aside>
      </main>

      <footer className="footer">
        <p>
          Stubborn Otter Software · Your tasks and your house stay in this browser · Works offline · Press <kbd>?</kbd> for keys
        </p>
        <p className="footer-links">
          <a href="/sound-check.html">Sound check</a> · <a href="/licenses/fonts.txt">Font licenses</a>
        </p>
      </footer>

      <Dialog open={dialog === 'house'} onClose={() => closeDialog('house')} title="The House" wide>
        <HouseMap house={house} reducedMotion={reducedMotion} />
      </Dialog>
      <Dialog open={dialog === 'settings'} onClose={() => closeDialog('settings')} title="Settings">
        <SettingsForm
          settings={settings}
          dispatch={controller.dispatch}
          demo={demo}
          notifyNote={notifyNote}
          actions={{
            onErase: () => {
              stores.local.clear();
              controller.replace(createModel(systemClock.now(), settings));
              setDialog(null);
              setAnnouncement('The house was erased. A fresh, very haunted house awaits.');
            },
            onExport: () => {
              const file = exportHouse(controller.getModel(), systemClock.now());
              downloadTextFile(file.fileName, file.text);
              setAnnouncement(`Exported ${file.fileName}.`);
            },
            onImport: async (file) => {
              const tooLarge = importSizeProblem(file.size);
              let decision = tooLarge;
              if (!decision) {
                let text = '';
                try {
                  text = await file.text();
                } catch {
                  return 'That file could not be read, so it was not imported. Your house is unchanged.';
                }
                decision = decideImport(text, controller.getModel(), systemClock.now());
              }
              if (decision.ok) controller.replace(decision.model);
              setAnnouncement(decision.message);
              return decision.message;
            },
            onNotifyChange: async (on) => {
              const result = await controller.setNotifyPhaseEnd(on);
              setNotifyNote('');
              setAnnouncement(result.message);
              return result.message;
            },
          }}
        />
      </Dialog>
      <Dialog open={dialog === 'shortcuts'} onClose={() => closeDialog('shortcuts')} title="Keyboard shortcuts">
        <ShortcutList />
      </Dialog>

      <div className="sr-only" aria-live="polite" data-testid="announcer">
        {announcement}
      </div>
    </div>
  );
}
