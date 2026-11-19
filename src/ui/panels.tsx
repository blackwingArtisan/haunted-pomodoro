import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { addDays, dayKey, lastDays, weekdayName, type DayKey } from '../core/dates';
import { ROOMS, viewHouse, type HouseState } from '../core/house';
import { SETTING_LIMITS, type AppAction, type AppModel, type DayLog, type Settings } from '../core/model';
import type { Streak } from '../core/streak';
import { BOOK_TITLE, JOURNAL_FINALE, diaryLine, journalFor, weeklyReflection } from '../core/story';
import { remainingAt, type TimerState } from '../core/timer';
import { CandleIcon, CloseIcon, ResetIcon, SkipIcon, TrashIcon } from './icons';
import { MANTEL_CANDLES, mantelCandles } from './candles';
import { Scene } from './Scene';

type Dispatch = (action: AppAction) => void;

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function spokenTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} minute${m === 1 ? '' : 's'} ${s} second${s === 1 ? '' : 's'} left`;
}

export function formatMinutes(ms: number): string {
  if (ms > 0 && ms < 60_000) return 'under 1 min';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export const PHASE_LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' } as const;

/* ------------------------------------------------------------------ Timer plaque */

export function TimerPlaque(props: {
  timer: TimerState;
  now: number;
  house: HouseState;
  model: AppModel;
  dispatch: Dispatch;
  onGesture: () => void;
  showcaseName: string | null;
}) {
  const { timer, now, house, model, dispatch, onGesture } = props;
  const remaining = remainingAt(timer, now);
  const progress = timer.durationMs ? 1 - remaining / timer.durationMs : 0;
  const view = viewHouse(house);
  const isFocus = timer.phase === 'focus';
  const primary =
    timer.status === 'running' ? 'Pause' : timer.status === 'paused' ? 'Resume' : isFocus ? 'Light a candle' : timer.phase === 'long' ? 'Begin the long rest' : 'Begin break';
  const sub = isFocus
    ? `Candle ${view.candlesLit + 1} of ${view.candlesPerRoom} in ${view.room.name}`
    : props.showcaseName
      ? `${props.showcaseName} is restored. The house breathes.`
      : timer.phase === 'long'
        ? 'The house sleeps a while. So should you.'
        : 'The house breathes. Stand, stretch, look far away.';
  const active = model.tasks.find((t) => t.id === model.activeTaskId) ?? null;
  const open = model.tasks.filter((t) => !t.done);
  const act = (type: 'toggle' | 'reset' | 'skip') => {
    onGesture();
    dispatch({ type: 'timer', action: { type } });
  };

  return (
    <div className={`plaque phase-${timer.phase} status-${timer.status}`} id="timer">
      <div className="plaque-head">
        <p className="phase-label" data-testid="phase">
          {PHASE_LABEL[timer.phase]}
          {timer.status === 'paused' && <span className="paused-tag"> · paused</span>}
        </p>
        {isFocus && timer.distractions > 0 && (
          <p className="wanderings" data-testid="wanderings">
            Wandered off {timer.distractions} {timer.distractions === 1 ? 'time' : 'times'}
          </p>
        )}
      </div>
      <div className="digits" role="timer" aria-label={spokenTime(remaining)} data-testid="digits">
        {formatClock(remaining)}
      </div>
      <p className="plaque-sub">{sub}</p>
      <div className="wick" role="progressbar" aria-label={`${PHASE_LABEL[timer.phase]} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      <div className="controls">
        <button type="button" className="btn btn-quiet" onClick={() => act('reset')} aria-keyshortcuts="R" title="Reset (R)">
          <ResetIcon />
          <span>Reset</span>
        </button>
        <button type="button" className="btn btn-primary" onClick={() => act('toggle')} aria-keyshortcuts="Space" data-testid="primary">
          <CandleIcon />
          <span>{primary}</span>
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => act('skip')} aria-keyshortcuts="S" title="Skip (S)">
          <SkipIcon />
          <span>{isFocus ? 'Skip to break' : 'Skip break'}</span>
        </button>
      </div>
      <div className="working-on">
        <label htmlFor="active-task">Working on</label>
        <select id="active-task" value={active?.id ?? ''} onChange={(e) => dispatch({ type: 'setActiveTask', id: e.target.value || null })}>
          <option value="">Nothing in particular</option>
          {open.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.spent}/{t.estimate})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Task ledger */

export function TaskLedger({ model, dispatch, inputRef }: { model: AppModel; dispatch: Dispatch; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [title, setTitle] = useState('');
  const [estimate, setEstimate] = useState(1);
  const done = model.tasks.filter((t) => t.done).length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    dispatch({ type: 'addTask', id: crypto.randomUUID(), title, estimate });
    setTitle('');
    setEstimate(1);
  };

  return (
    <section className="card ledger" aria-labelledby="ledger-title">
      <h2 id="ledger-title">The Ledger</h2>
      <form className="task-form" onSubmit={submit}>
        <label htmlFor="new-task" className="sr-only">
          New task
        </label>
        <input
          id="new-task"
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name a task"
          maxLength={140}
          autoComplete="off"
          aria-keyshortcuts="N"
        />
        <label className="estimate">
          <span className="sr-only">Candles planned</span>
          <input type="number" min={1} max={12} value={estimate} onChange={(e) => setEstimate(Number(e.target.value) || 1)} aria-label="Candles planned" />
        </label>
        <button type="submit" className="btn btn-small">
          Add
        </button>
      </form>
      {model.tasks.length === 0 ? (
        <p className="empty">No tasks yet. Name one, then light a candle for it.</p>
      ) : (
        <ul className="tasks" data-testid="tasks">
          {model.tasks.map((t) => {
            const active = t.id === model.activeTaskId;
            return (
              <li key={t.id} className={['task', t.done ? 'is-done' : '', active ? 'is-active' : ''].join(' ')}>
                <input type="checkbox" checked={t.done} onChange={() => dispatch({ type: 'toggleTaskDone', id: t.id })} aria-label={`Mark "${t.title}" ${t.done ? 'not done' : 'done'}`} />
                <button type="button" className="task-title" aria-pressed={active} disabled={t.done} onClick={() => dispatch({ type: 'setActiveTask', id: active ? null : t.id })}>
                  {t.title}
                </button>
                <span className="pips" role="img" aria-label={`${t.spent} of ${t.estimate} ${t.estimate === 1 ? 'candle' : 'candles'} burned`}>
                  {Array.from({ length: Math.max(t.estimate, t.spent) }, (_, i) => (
                    <span key={i} className={i < t.spent ? 'pip lit' : 'pip'} />
                  ))}
                </span>
                <button type="button" className="icon-btn" onClick={() => dispatch({ type: 'removeTask', id: t.id })} aria-label={`Delete "${t.title}"`}>
                  <TrashIcon width={16} height={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {done > 0 && (
        <button type="button" className="link-btn" onClick={() => dispatch({ type: 'clearDoneTasks' })}>
          Clear {done} finished
        </button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Hearth (streak) */

function friendlyDay(key: DayKey, today: DayKey): string {
  if (key === today) return 'today';
  if (key === addDays(today, 1)) return 'tomorrow';
  return weekdayName(key);
}

export function Hearth({ streak, days, today, house, roomId }: { streak: Streak; days: Record<DayKey, DayLog>; today: DayKey; house: HouseState; roomId: string }) {
  const diary = diaryLine(days, today, roomId);
  const weekly = weeklyReflection(days, today);
  const fortnight = lastDays(today, 14);
  const max = Math.max(4, ...fortnight.map((d) => days[d]?.sessions ?? 0));
  const emptyFortnight = fortnight.every((d) => (days[d]?.sessions ?? 0) === 0);
  const todayLog = days[today] ?? { sessions: 0, focusMs: 0, distractions: 0 };
  let message: string;
  if (streak.current > 0 && streak.warmUntil) {
    message = streak.litToday
      ? `Lit today. The hearth stays warm until ${friendlyDay(streak.warmUntil, today)} even if tomorrow gets away from you.`
      : `Light a candle by ${friendlyDay(streak.warmUntil, today)} to keep it warm. One missed day is always forgiven.`;
  } else if (streak.best > 0) {
    message = `The hearth went cold, but the house remembers: ${house.roomsRestored} ${house.roomsRestored === 1 ? 'room' : 'rooms'} restored. One candle warms it again.`;
  } else {
    message = 'Finish a focus session to light the hearth.';
  }

  return (
    <section className="card hearth" aria-labelledby="hearth-title">
      <h2 id="hearth-title">The Hearth</h2>
      <p className="streak" data-testid="streak">
        <strong>{streak.current}</strong>
        <span>{streak.current === 1 ? 'day warm' : 'days warm'}</span>
      </p>
      <p className="hearth-note">{message}</p>
      {diary && (
        <blockquote className="diary" data-testid="diary">
          <p>{diary}</p>
          <footer>The ghost’s diary</footer>
        </blockquote>
      )}
      <ol className="fortnight" aria-label="Focus sessions, last 14 days">
        {fortnight.map((d) => {
          const n = days[d]?.sessions ?? 0;
          return (
            <li key={d} aria-label={`${weekdayName(d)} ${d}: ${n} ${n === 1 ? 'session' : 'sessions'}`} className={d === today ? 'is-today' : ''}>
              <span className="mini-candle" style={n ? { height: `${22 + (n / max) * 58}%` } : undefined} data-lit={n > 0} />
              <span className="mini-day" aria-hidden="true">
                {weekdayName(d).slice(0, 1)}
              </span>
            </li>
          );
        })}
      </ol>
      {emptyFortnight && (
        <p className="fortnight-empty" data-testid="fortnight-empty">
          Fourteen candles are waiting for you. Light the first one and it will burn here.
        </p>
      )}
      <dl className="stats">
        <div>
          <dt>Today</dt>
          <dd>
            {todayLog.sessions} {todayLog.sessions === 1 ? 'candle' : 'candles'} · {formatMinutes(todayLog.focusMs)}
          </dd>
        </div>
        <div>
          <dt>Wanderings today</dt>
          <dd>{todayLog.distractions}</dd>
        </div>
        <div>
          <dt>Best streak</dt>
          <dd>{streak.best} days</dd>
        </div>
        <div>
          <dt>Rooms restored</dt>
          <dd>{house.roomsRestored}</dd>
        </div>
      </dl>
      {weekly && (
        <p className="weekly" data-testid="weekly">
          {weekly.text}
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Dialog shell */

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={wide ? 'dialog dialog-wide' : 'dialog'}
      // Escape fires "cancel" at once but "close" only in a later task. Closing on "cancel" lets a shortcut
      // pressed straight after Escape open a window again, and a late "close" is ignored when the dialog
      // has been reopened in the meantime, so it cannot shut the new one.
      onCancel={onClose}
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
      aria-labelledby={`${title}-title`.replace(/\s+/g, '-')}
    >
      <div className="dialog-head">
        <h2 id={`${title}-title`.replace(/\s+/g, '-')}>{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      {open && children}
    </dialog>
  );
}

/* ------------------------------------------------------------------ Settings */

export interface SettingsActions {
  onErase: () => void;
  /** Downloads the house as a JSON file. */
  onExport: () => void;
  /** Reads a chosen file; resolves with the message to show the person. */
  onImport: (file: File) => Promise<string>;
  /** Turns phase-end notifications on or off; resolves with the message to show. */
  onNotifyChange: (on: boolean) => Promise<string>;
}

export function SettingsForm({ settings, dispatch, demo, actions, notifyNote }: { settings: Settings; dispatch: Dispatch; demo: boolean; actions: SettingsActions; notifyNote: string }) {
  const [confirmErase, setConfirmErase] = useState(false);
  const [importNote, setImportNote] = useState('');
  const [notifyResult, setNotifyResult] = useState('');
  const { onErase } = actions;
  const set = (patch: Partial<Settings>) => dispatch({ type: 'updateSettings', patch });
  const num = (key: 'focusMin' | 'shortMin' | 'longMin' | 'longEvery', label: string, unit: string) => (
    <label className="field">
      <span>{label}</span>
      <span className="field-input">
        <input
          type="number"
          min={SETTING_LIMITS[key][0]}
          max={SETTING_LIMITS[key][1]}
          value={settings[key]}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && e.target.value !== '') set({ [key]: v });
          }}
        />
        <span className="unit">{unit}</span>
      </span>
    </label>
  );
  const toggle = (key: 'autoStartBreaks' | 'autoStartFocus' | 'muted' | 'ambient' | 'ghostCalls', label: string, hint?: string) => (
    <label className="switch">
      <input type="checkbox" role="switch" checked={settings[key]} onChange={(e) => set({ [key]: e.target.checked })} />
      <span className="switch-track" aria-hidden="true" />
      <span className="switch-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
  return (
    <div className="settings">
      {demo && <p className="note">Demo mode uses a 20 second focus and 10 second breaks. Lengths below apply to your own house.</p>}
      <fieldset>
        <legend>Lengths</legend>
        <div className="field-grid">
          {num('focusMin', 'Focus', 'min')}
          {num('shortMin', 'Short break', 'min')}
          {num('longMin', 'Long break', 'min')}
          {num('longEvery', 'Long break after', 'sessions')}
        </div>
        {toggle('autoStartBreaks', 'Start breaks by themselves')}
        {toggle('autoStartFocus', 'Start the next focus after a break')}
      </fieldset>
      <fieldset>
        <legend>Sound</legend>
        <label className="field field-range">
          <span>Volume</span>
          <input type="range" min={0} max={100} value={Math.round(settings.volume * 100)} onChange={(e) => set({ volume: Number(e.target.value) / 100 })} aria-valuetext={`${Math.round(settings.volume * 100)} percent`} />
          <output>{Math.round(settings.volume * 100)}%</output>
        </label>
        {toggle('muted', 'Mute everything', 'Shortcut: M')}
        {toggle('ambient', 'Ambient wind', 'Generated live in your browser. Shortcut: A')}
        {toggle('ghostCalls', 'The ghost calls when you wander off')}
      </fieldset>
      <fieldset>
        <legend>Notifications</legend>
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={settings.notifyPhaseEnd}
            aria-describedby="notify-note"
            onChange={(e) => void actions.onNotifyChange(e.target.checked).then(setNotifyResult)}
          />
          <span className="switch-track" aria-hidden="true" />
          <span className="switch-label">
            Notify me when a phase ends while this tab is hidden
            <small>Off by default. Your browser asks for permission only when you turn this on.</small>
          </span>
        </label>
        <p className="note" id="notify-note" role="status">
          {notifyNote || notifyResult}
        </p>
      </fieldset>
      <fieldset>
        <legend>Motion</legend>
        <div className="radios" role="radiogroup" aria-label="Motion">
          {(
            [
              ['system', 'Follow my system'],
              ['reduced', 'Reduced: no drifting or flicker'],
              ['full', 'Full theatre'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="radio">
              <input type="radio" name="motion" value={value} checked={settings.motion === value} onChange={() => set({ motion: value })} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Your data</legend>
        <p className="note">Everything stays in this browser. Nothing is sent anywhere.</p>
        <div className="data-actions">
          <button type="button" className="btn btn-small" disabled={demo} aria-describedby={demo ? 'data-demo-note' : undefined} onClick={actions.onExport}>
            Export house
          </button>
          <label className="file-field">
            <span>Import house</span>
            <input
              type="file"
              accept="application/json,.json"
              disabled={demo}
              aria-describedby={demo ? 'data-demo-note' : 'import-note'}
              onChange={(e) => {
                const input = e.currentTarget;
                const file = input.files?.[0];
                if (!file) return;
                void actions.onImport(file).then((message) => {
                  setImportNote(message);
                  input.value = '';
                });
              }}
            />
          </label>
        </div>
        {demo ? (
          <p className="note" id="data-demo-note">
            Export and import are off in the demo house, which is never saved. Leave the demo to use them.
          </p>
        ) : (
          <p className="note" id="import-note" role="status">
            {importNote || 'Importing merges a saved house into this one. It never removes a candle or a room.'}
          </p>
        )}
        {!demo &&
          (confirmErase ? (
            <div className="erase-confirm">
              <span>Erase every task, day and restored room?</span>
              <button type="button" className="btn btn-danger btn-small" onClick={onErase}>
                Erase the house
              </button>
              <button type="button" className="btn btn-small" onClick={() => setConfirmErase(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-small" onClick={() => setConfirmErase(true)}>
              Erase all data…
            </button>
          ))}
      </fieldset>
    </div>
  );
}

/* ------------------------------------------------------------------ Shortcuts */

export const SHORTCUTS: ReadonlyArray<[string, string]> = [
  ['Space', 'Light a candle, pause or resume'],
  ['R', 'Reset this session'],
  ['S', 'Skip to the next phase'],
  ['N', 'Write a new task'],
  ['M', 'Mute or unmute'],
  ['A', 'Ambient wind on or off'],
  ['H', 'Open the house'],
  [',', 'Settings'],
  ['U', 'Unmask: the same timer as a plain Pomodoro'],
  ['?', 'This list'],
  ['Esc', 'Close a window'],
];

export function ShortcutList() {
  return (
    <dl className="shortcuts">
      {SHORTCUTS.map(([key, what]) => (
        <div key={key}>
          <dt>
            <kbd>{key}</kbd>
          </dt>
          <dd>{what}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ House map */

export function HouseMap({ house, reducedMotion, finale = false }: { house: HouseState; reducedMotion: boolean; finale?: boolean }) {
  const view = viewHouse(house);
  const finaleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (finale) finaleRef.current?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [finale, reducedMotion]);
  const [selected, setSelected] = useState(view.roomIndex);
  const room = ROOMS[selected]!;
  const isRestored = selected < view.roomsInThisHouse;
  const isCurrent = selected === view.roomIndex;
  const status = (i: number) => (i < view.roomsInThisHouse ? 'restored' : i === view.roomIndex ? 'current' : 'haunted');

  return (
    <div className="house-map">
      {finale && (
        <div className="finale" ref={finaleRef} data-testid="finale">
          <p className="finale-kicker">The book is finished</p>
          <h3>{JOURNAL_FINALE.title}</h3>
          <p className="finale-text">{JOURNAL_FINALE.text}</p>
          <p className="finale-next">A new house waits down the lane, every window dark. The house you finished keeps its lamps lit up the hill.</p>
        </div>
      )}
      <div className="facade-wrap" style={{ '--lit-rooms': view.roomsInThisHouse } as CSSProperties}>
        <svg
          className="facade"
          viewBox="0 0 360 320"
          role="img"
          aria-label={`The house: ${view.roomsInThisHouse} of ${ROOMS.length} rooms restored${view.housesRestored > 0 ? `. Up the hill, ${view.housesRestored === 1 ? 'the house you finished keeps every window lit' : `${view.housesRestored} finished houses keep every window lit`}` : ''}`}
        >
          {/* The sky comes from the surrounding band, so the house sits in one continuous night. */}
          <circle cx="300" cy="52" r="24" fill="#f3efd8" opacity="0.9" />
          <circle cx="290" cy="46" r="24" fill="#0b1124" opacity="0.25" />
          {[
            [40, 40],
            [90, 70],
            [200, 24],
            [250, 90],
            [330, 120],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.4" fill="#fff" opacity="0.8" />
          ))}
          {view.housesRestored > 0 && (
            // Up the hill: the house already finished, small with distance, every window lit.
            <g className="finished-house" data-testid="finished-house" aria-hidden="true">
              <path d="M0 100 Q36 84 92 96 L60 120 H0 Z" fill="#0b0d1a" />
              <circle cx="34" cy="74" r="30" fill="#ffbf5a" opacity="0.1" />
              <g transform="translate(-6 30) scale(0.22)">
              <path d="M44 128 L180 52 L316 128 Z" fill="#241a2c" stroke="#c9a25a" strokeOpacity="0.6" strokeWidth="8" strokeLinejoin="round" />
              <rect x="56" y="126" width="248" height="170" fill="#1d1626" stroke="#c9a25a" strokeOpacity="0.6" strokeWidth="8" />
              {ROOMS.map((r, i) => (
                <rect key={r.id} x={78 + (i % 3) * 76} y={144 + Math.floor(i / 3) * 66} width="48" height="50" rx="20" fill="#ffbf5a" />
              ))}
              <circle cx="180" cy="100" r="12" fill="#ffbf5a" />
              </g>
            </g>
          )}
          <path d="M0 300 Q90 270 180 292 T360 286 V320 H0 Z" fill="#070912" />
          <path d="M22 300 v-70 m0 26 l-16 -18 m16 6 l14 -22 m-14 44 l20 -10" stroke="#070912" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M44 128 L180 52 L316 128 Z" fill="#1d1626" stroke="#c9a25a" strokeOpacity="0.55" strokeWidth="2" strokeLinejoin="round" />
          <rect x="250" y="62" width="20" height="44" fill="#1d1626" stroke="#c9a25a" strokeOpacity="0.4" />
          <circle cx="180" cy="100" r="12" fill={view.roomsInThisHouse === ROOMS.length - 1 ? '#ffbf5a' : '#0a0810'} stroke="#c9a25a" strokeOpacity="0.5" strokeWidth="2" />
          <rect x="56" y="126" width="248" height="170" fill="#16111d" stroke="#c9a25a" strokeOpacity="0.5" strokeWidth="2" />
          {ROOMS.map((r, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const s = status(i);
            const x = 78 + col * 76;
            const y = 144 + row * 66;
            return (
              // The room list below is the keyboard and screen-reader way to pick a room; the windows are a pointer shortcut.
              <g key={r.id} className={`facade-window ${s}`} onClick={() => setSelected(i)} aria-hidden="true">
                {s === 'restored' && <circle cx={x + 24} cy={y + 24} r="34" fill="#ffbf5a" opacity="0.16" />}
                <path d={`M${x} ${y + 50} V${y + 22} A24 22 0 0 1 ${x + 48} ${y + 22} V${y + 50} Z`} className="pane" />
                <path d={`M${x + 24} ${y} V${y + 50} M${x} ${y + 28} H${x + 48}`} stroke="#0b0910" strokeWidth="3" />
                {s === 'haunted' && <path d={`M${x + 2} ${y + 6} l14 14 M${x + 46} ${y + 6} l-12 12`} stroke="#e8e4f0" strokeOpacity="0.35" strokeWidth="1" />}
                {s === 'haunted' && (
                  // Ivy creeping over the sill of a room nobody has warmed yet.
                  <path d={`M${x - 4} ${y + 52} q6 -10 12 -4 q4 -12 12 -6 M${x + 52} ${y + 52} q-6 -12 -12 -5`} stroke="#3f6b45" strokeWidth="3" fill="none" strokeLinecap="round" className="ivy" />
                )}
                {s === 'current' && (
                  // The ghost waits in the room being restored now.
                  <g className="window-ghost" data-testid="window-ghost">
                    <path d={`M${x + 24} ${y + 16} c-9 0 -12 8 -12 15 v16 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 v-16 c0 -7 -3 -15 -12 -15 z`} fill="#c9fbe8" />
                    <circle cx={x + 20} cy={y + 29} r="1.8" fill="#16111d" />
                    <circle cx={x + 28} cy={y + 29} r="1.8" fill="#16111d" />
                  </g>
                )}
              </g>
            );
          })}
          {/* Each restored room spills a little more warm light onto the ground. */}
          <ellipse cx="180" cy="300" rx="160" ry="12" fill="#ffbf5a" opacity={Math.min(0.3, view.roomsInThisHouse * 0.05)} />
          <path d="M164 296 V262 A16 16 0 0 1 196 262 V296 Z" fill="#2a1a10" stroke="#c9a25a" strokeOpacity="0.5" />
          <circle cx="189" cy="280" r="2" fill="#c9a25a" />
          <path d="M150 296 H210" stroke="#c9a25a" strokeOpacity="0.4" strokeWidth="3" />
          {/* Porch steps down to the lane and a crooked picket fence either side of the path. */}
          <rect x="144" y="298" width="72" height="6" fill="#1d1626" stroke="#c9a25a" strokeOpacity="0.35" />
          <rect x="138" y="304" width="84" height="6" fill="#1d1626" stroke="#c9a25a" strokeOpacity="0.3" />
          <g className="fence" fill="#2a2233" stroke="#070912" strokeWidth="1">
            {[16, 32, 48, 64, 80, 96, 112, 128, 232, 248, 264, 280, 296, 312, 328, 344].map((fx, i) => (
              <path key={fx} d={`M${fx - 4} 312 V${296 + (i % 3)} L${fx} ${290 + (i % 3)} L${fx + 4} ${296 + (i % 3)} V312 Z`} transform={`rotate(${(i % 4) - 1.5} ${fx} 312)`} />
            ))}
            <rect x="8" y="300" width="128" height="3" />
            <rect x="224" y="300" width="128" height="3" />
          </g>
        </svg>
        {view.housesRestored > 0 && (
          <p className="note">
            {view.housesRestored} {view.housesRestored === 1 ? 'house' : 'houses'} fully restored. This is house number {view.housesRestored + 1}.
          </p>
        )}
      </div>
      <div className="rooms">
        <ul className="room-list">
          {ROOMS.map((r, i) => (
            <li key={r.id}>
              <button type="button" className={`room-btn ${status(i)}`} aria-pressed={selected === i} onClick={() => setSelected(i)}>
                <span className="room-name">{r.name}</span>
                <span className="room-status">{status(i) === 'restored' ? 'Restored' : status(i) === 'current' ? `${view.candlesLit} of ${view.candlesPerRoom} ${view.candlesPerRoom === 1 ? 'candle' : 'candles'}` : 'Still haunted'}</span>
              </button>
            </li>
          ))}
        </ul>
        <figure className="room-preview">
          <Scene
            room={room}
            restore={isRestored ? 1 : isCurrent ? view.candlesLit / view.candlesPerRoom : 0}
            candlesLit={isRestored ? MANTEL_CANDLES : isCurrent ? mantelCandles(view.candlesLit, view.candlesPerRoom, 0, false).lit : 0}
            burning={null}
            restored={isRestored}
            ghost={{ closeness: 0, mood: 'asleep' }}
            rattling={false}
            breathing={false}
            hearth={0.5}
            trackPointer={!reducedMotion}
            label={`${room.name}, ${isRestored ? 'restored' : 'still haunted'}`}
            className="scene-preview"
          />
          <figcaption>
            <strong>{room.name}</strong> {isRestored ? room.restored : room.haunted}
          </figcaption>
        </figure>
      </div>
      <Journal house={house} />
    </div>
  );
}

/** The ghost's journal: each restored room gives back one page of the book it never finished. */
export function Journal({ house }: { house: HouseState }) {
  const journal = journalFor(house);
  const unlocked = journal.pages.filter((p) => p.unlocked).length;
  return (
    <section className="journal" aria-labelledby="journal-title" data-testid="journal">
      <h3 id="journal-title">
        The ghost’s journal <span className="journal-book">{BOOK_TITLE}</span>
      </h3>
      <p className="note">
        {unlocked} of {journal.pages.length} pages back. Restore a room to return its page.
        {journal.finished && ` Finished ${journal.booksFinished === 1 ? 'once' : `${journal.booksFinished} times`}; this house's pages start again.`}
      </p>
      <ol className="journal-pages">
        {journal.pages.map(({ page, unlocked: open, roomName }) => (
          <li key={page.roomId} className={open ? 'journal-page is-open' : 'journal-page'} data-unlocked={open}>
            <h4>{page.title}</h4>
            {open ? <p>{page.text}</p> : <p className="journal-locked">Still lost somewhere in {roomName}.</p>}
          </li>
        ))}
        {journal.finished && (
          <li className="journal-page is-open journal-finale" data-testid="journal-finale">
            <h4>{JOURNAL_FINALE.title}</h4>
            <p>{JOURNAL_FINALE.text}</p>
          </li>
        )}
      </ol>
    </section>
  );
}

export function todayKey(now: number): DayKey {
  return dayKey(now);
}

/* ------------------------------------------------------------------ First visit */

const INTRO_KEY = 'haunted-pomodoro/intro-dismissed';

function readIntroDismissed(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

/** Whether this browser has dismissed the first-visit guide, and a way to dismiss it. */
export function useIntroDismissed(): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(readIntroDismissed);
  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(INTRO_KEY, '1');
    } catch {
      // Per-browser convenience only; showing it again is harmless.
    }
  }, []);
  return [dismissed, dismiss];
}

/** On phones the guide sits below the timer, so a one-line strip above the room says what the house is. */
export function IntroStrip({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="intro-strip" data-testid="intro-strip">
      <span>This ghost keeps your candle lit.</span> <a href="#intro-title">How it works</a>
    </p>
  );
}

export function IntroCard({ show, onDemo, onDismiss }: { show: boolean; onDemo: () => void; onDismiss: () => void }) {
  if (!show) return null;
  const dismiss = onDismiss;
  return (
    <section className="card intro" aria-labelledby="intro-title" data-testid="intro">
      <h2 id="intro-title">How the house works</h2>
      <p className="intro-lead" data-testid="intro-lead">
        Some focus apps kill your tree when you look away. This ghost keeps your candle lit.
      </p>
      <ol className="intro-steps">
        <li>
          <strong>Light a candle</strong> to start a focus session. Finish it and the candle stays lit.
        </li>
        <li>
          <strong>Four candles</strong> restore a room. Six rooms restore the house.
        </li>
        <li>
          <strong>Wander to another tab</strong> and the ghost wakes. It is lonely, not angry.
        </li>
        <li>
          <strong>Miss a day?</strong> The hearth forgives one, and nothing you restore is ever lost.
        </li>
      </ol>
      <div className="intro-actions">
        <button type="button" className="btn btn-small" onClick={dismiss}>
          Enter the house
        </button>
        <button type="button" className="link-btn" onClick={onDemo}>
          Or watch the 30 second demo
        </button>
      </div>
    </section>
  );
}
