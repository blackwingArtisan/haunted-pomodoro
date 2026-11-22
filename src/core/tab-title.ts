/** The tab's title. Pure: the time left comes from the timer's absolute end time and `now`. */
import { remainingAt, type Phase, type TimerState } from './timer';

export const APP_NAME = 'Haunted Pomodoro';

const PHASE_NAME: Record<Phase, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' };

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface TabTitleInput {
  timer: TimerState;
  now: number;
  hidden: boolean;
}

export function tabTitle({ timer, now, hidden }: TabTitleInput): string {
  if (timer.status === 'idle') return APP_NAME;
  const left = formatClock(remainingAt(timer, now));
  if (timer.status === 'running' && timer.phase === 'focus' && hidden && timer.ghostWoke) {
    return `Come back… ${left} left · ${APP_NAME}`;
  }
  return `${left} · ${PHASE_NAME[timer.phase]} · ${APP_NAME}`;
}
