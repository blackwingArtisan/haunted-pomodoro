import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The costume off: the same timer, tasks and history as a plain Pomodoro, with a note beside each
 * plain number naming the piece of the haunted house that stands for it. Only the view changes; the
 * model, the timer and the house are the same objects the scene reads.
 */
export interface PlainRow {
  /** What a plain Pomodoro calls it. */
  label: string;
  value: string;
  /** What the haunted house shows for it. */
  costume: string;
  /** 0 to 1 when the row is a progress bar. */
  progress?: number;
}

export function UnmaskedStage({ rows }: { rows: readonly PlainRow[] }) {
  return (
    <div className="plain-stage" data-testid="plain-stage">
      <p className="plain-kicker">Costume off: the same timer as a plain Pomodoro</p>
      <dl className="plain-rows">
        {rows.map((row) => (
          <div
            key={row.label}
            className={row.progress !== undefined ? 'plain-row is-wide' : 'plain-row'}
            data-testid={`plain-${row.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
          >
            <dt>{row.label}</dt>
            <dd>
              {row.progress !== undefined ? (
                <span className="plain-bar" role="progressbar" aria-label={row.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(row.progress * 100)}>
                  <span style={{ width: `${Math.round(row.progress * 100)}%` }} />
                </span>
              ) : null}
              <span className="plain-value">{row.value}</span>
              <span className="plain-costume">In costume: {row.costume}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const UNMASK_KEY = 'haunted-pomodoro/unmasked';

function readUnmasked(): boolean {
  try {
    return localStorage.getItem(UNMASK_KEY) === '1';
  } catch {
    return false;
  }
}

/** The costume switch, remembered per browser. It never touches the house or the timer. */
export function useUnmasked(): [boolean, () => void] {
  const [unmasked, setUnmasked] = useState(readUnmasked);
  const toggle = useCallback(() => {
    setUnmasked((was) => {
      const next = !was;
      try {
        if (next) localStorage.setItem(UNMASK_KEY, '1');
        else localStorage.removeItem(UNMASK_KEY);
      } catch {
        // A per-browser convenience; the toggle still works for this visit.
      }
      return next;
    });
  }, []);
  return [unmasked, toggle];
}

/* ------------------------------------------------------------------ The costume change */

/** The drapes close, the ghost tugs her sheet, and the drapes open on the other view: about 1.1 s. */
export const COSTUME_CLOSE_MS = 550;
export const COSTUME_OPEN_MS = 550;

export interface CostumeChange {
  phase: 'closing' | 'opening';
  /** The view the drapes open on. */
  to: 'plain' | 'costume';
}

/**
 * Runs the costume change. `unmasked` is the switch itself (remembered, and what the button reports
 * at once); `shown` is the view on stage, which swaps only while the drapes are closed. Under
 * reduced motion the swap is instant. `onSwap` runs at the moment the view swaps.
 */
export function useCostumeChange(
  reducedMotion: boolean,
  onSwap?: (to: CostumeChange['to']) => void,
): { unmasked: boolean; shown: boolean; change: CostumeChange | null; toggle: () => void } {
  const [unmasked, toggleUnmasked] = useUnmasked();
  const [shown, setShown] = useState(unmasked);
  const [change, setChange] = useState<CostumeChange | null>(null);
  const timers = useRef<number[]>([]);
  const target = useRef(unmasked);
  const reduced = useRef(reducedMotion);
  reduced.current = reducedMotion;
  const swapped = useRef(onSwap);
  swapped.current = onSwap;

  const clear = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const toggle = useCallback(() => {
    const next = !target.current;
    target.current = next;
    toggleUnmasked();
    clear();
    const to = next ? 'plain' : 'costume';
    if (reduced.current) {
      setShown(next);
      setChange(null);
      swapped.current?.(to);
      return;
    }
    setChange({ phase: 'closing', to });
    timers.current.push(
      window.setTimeout(() => {
        setShown(next);
        setChange({ phase: 'opening', to });
        swapped.current?.(to);
      }, COSTUME_CLOSE_MS),
      window.setTimeout(() => setChange(null), COSTUME_CLOSE_MS + COSTUME_OPEN_MS),
    );
  }, [toggleUnmasked]);

  return { unmasked, shown, change, toggle };
}

/** The drapes and the ghost for the costume change. Purely decorative: the switch announces itself. */
export function CostumeCurtain({ change }: { change: CostumeChange | null }) {
  if (!change) return null;
  return (
    <div className={`costume-curtain is-${change.phase} to-${change.to}`} aria-hidden="true" data-testid="costume-curtain" data-phase={change.phase}>
      <div className="costume-drape costume-drape-left" />
      <div className="costume-drape costume-drape-right" />
      <svg className="costume-ghost" viewBox="-110 -120 220 240">
        {/* The plain figure under the sheet: a simple outline, the timer without its costume. */}
        <rect className="costume-plain" x="-34" y="-46" width="68" height="92" rx="10" />
        <g className="costume-sheet">
          <path
            d="M-58 70 C-62 -10 -40 -70 0 -70 C40 -70 62 -10 58 70 Q44 60 32 74 Q20 88 8 72 Q-4 60 -16 76 Q-30 90 -40 70 Q-50 60 -58 70 Z"
            fill="#dffcf1"
            opacity="0.94"
          />
          <ellipse cx="-18" cy="-18" rx="8" ry="11" fill="#141020" />
          <ellipse cx="18" cy="-18" rx="8" ry="11" fill="#141020" />
          <path d="M-8 14 q8 6 16 0" stroke="#141020" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
        {/* Her hand on the hem, tugging. */}
        <path className="costume-hand" d="M58 64 C82 52 92 30 84 10" stroke="#dffcf1" strokeWidth="12" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}
