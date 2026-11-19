import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { addDays, dayKey, lastDays, weekdayName, type DayKey } from '../core/dates';
import { CANDLES_PER_ROOM, ROOMS, viewHouse, type HouseState } from '../core/house';
import { SETTING_LIMITS, type AppAction, type AppModel, type DayLog, type Settings } from '../core/model';
import type { Streak } from '../core/streak';
import { remainingAt, type TimerState } from '../core/timer';
import { CandleIcon, CloseIcon, ResetIcon, SkipIcon, TrashIcon } from './icons';
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
    ? `Candle ${view.candlesLit + 1} of ${CANDLES_PER_ROOM} in ${view.room.name}`
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
                <span className="pips" aria-label={`${t.spent} of ${t.estimate} candles`}>
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

export function Hearth({ streak, days, today, house }: { streak: Streak; days: Record<DayKey, DayLog>; today: DayKey; house: HouseState }) {
  const fortnight = lastDays(today, 14);
  const max = Math.max(4, ...fortnight.map((d) => days[d]?.sessions ?? 0));
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
      <ol className="fortnight" aria-label="Focus sessions, last 14 days">
        {fortnight.map((d) => {
          const n = days[d]?.sessions ?? 0;
          return (
            <li key={d} aria-label={`${weekdayName(d)} ${d}: ${n} ${n === 1 ? 'session' : 'sessions'}`} className={d === today ? 'is-today' : ''}>
              <span className="mini-candle" style={{ height: `${n ? 22 + (n / max) * 58 : 8}%` }} data-lit={n > 0} />
              <span className="mini-day" aria-hidden="true">
                {weekdayName(d).slice(0, 1)}
              </span>
            </li>
          );
        })}
      </ol>
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
    <dialog ref={ref} className={wide ? 'dialog dialog-wide' : 'dialog'} onClose={onClose} aria-labelledby={`${title}-title`.replace(/\s+/g, '-')}>
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

export function SettingsForm({ settings, dispatch, onErase, demo }: { settings: Settings; dispatch: Dispatch; onErase: () => void; demo: boolean }) {
  const [confirmErase, setConfirmErase] = useState(false);
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
      {!demo && (
        <fieldset>
          <legend>Your data</legend>
          <p className="note">Everything stays in this browser. Nothing is sent anywhere.</p>
          {confirmErase ? (
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
          )}
        </fieldset>
      )}
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

export function HouseMap({ house, reducedMotion }: { house: HouseState; reducedMotion: boolean }) {
  const view = viewHouse(house);
  const [selected, setSelected] = useState(view.roomIndex);
  const room = ROOMS[selected]!;
  const isRestored = selected < view.roomsInThisHouse;
  const isCurrent = selected === view.roomIndex;
  const status = (i: number) => (i < view.roomsInThisHouse ? 'restored' : i === view.roomIndex ? 'current' : 'haunted');

  return (
    <div className="house-map">
      <div className="facade-wrap">
        <svg className="facade" viewBox="0 0 360 300" role="img" aria-label={`The house: ${view.roomsInThisHouse} of ${ROOMS.length} rooms restored`}>
          <path d="M30 120 L180 30 L330 120 Z" fill="#1d1626" stroke="#c9a25a" strokeOpacity="0.5" strokeWidth="2" />
          <rect x="250" y="40" width="22" height="50" fill="#1d1626" />
          <rect x="44" y="118" width="272" height="170" fill="#16111d" stroke="#c9a25a" strokeOpacity="0.5" strokeWidth="2" />
          {ROOMS.map((r, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const s = status(i);
            return (
              <g key={r.id} className={`facade-window ${s}`} onClick={() => setSelected(i)}>
                <rect x={70 + col * 80} y={136 + row * 66} width="50" height="48" rx="24" ry="24" className="pane" />
                <path d={`M${95 + col * 80} ${136 + row * 66} V${184 + row * 66} M${70 + col * 80} ${162 + row * 66} H${120 + col * 80}`} stroke="#0b0910" strokeWidth="3" />
              </g>
            );
          })}
          <rect x="164" y="236" width="32" height="52" rx="16" fill="#2a1a10" />
          <circle cx="188" cy="264" r="2" fill="#c9a25a" />
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
                <span className="room-status">{status(i) === 'restored' ? 'Restored' : status(i) === 'current' ? `${view.candlesLit} of ${CANDLES_PER_ROOM} candles` : 'Still haunted'}</span>
              </button>
            </li>
          ))}
        </ul>
        <figure className="room-preview">
          <Scene
            room={room}
            restore={isRestored ? 1 : isCurrent ? view.candlesLit / CANDLES_PER_ROOM : 0}
            candlesLit={isRestored ? CANDLES_PER_ROOM : isCurrent ? view.candlesLit : 0}
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
    </div>
  );
}

export function todayKey(now: number): DayKey {
  return dayKey(now);
}
