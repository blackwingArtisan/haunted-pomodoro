import { useCallback, useState } from 'react';

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
          <div key={row.label} className="plain-row" data-testid={`plain-${row.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
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
