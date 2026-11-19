/**
 * The words of a phase-end notification. Pure: it reads the cues the reducer produced for one
 * change and the phase that was running before it, and returns the notification or null.
 */
import type { Cue } from './model';
import type { Phase } from './timer';

const NAME: Record<Phase, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' };

export interface PhaseNotice {
  title: string;
  body: string;
}

export function phaseEndNotice(cues: readonly Cue[], endedPhase: Phase): PhaseNotice | null {
  const ended = cues.some((c) => c.kind === 'sessionComplete' || c.kind === 'breakOver');
  if (!ended) return null;
  const next = cues.find((c): c is Extract<Cue, { kind: 'phase' }> => c.kind === 'phase');
  const lead = endedPhase === 'focus' ? 'Your candle stays lit. ' : '';
  const after = next ? `${NAME[next.phase]} ${next.autoStarted ? 'has started' : 'is ready when you are'}.` : '';
  return { title: `${NAME[endedPhase]} finished`, body: `${lead}${after}`.trim() };
}
