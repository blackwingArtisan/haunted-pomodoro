import { measureLevels, type Levels } from './levels';
import { SoundEngine, type SoundName } from './sound';

export type CheckedSound = SoundName | 'ambient';

export interface SoundSpec {
  name: CheckedSound;
  label: string;
  when: string;
  /** Seconds to render: long enough for the sound to finish and leave a silent tail. */
  seconds: number;
  /** Ambient wind never ends on its own, so its tail is not expected to be silent. */
  loops?: boolean;
}

export const SOUND_SPECS: SoundSpec[] = [
  { name: 'candle', label: 'Candle strike', when: 'A focus session starts', seconds: 1.5 },
  { name: 'snuff', label: 'Snuff', when: 'A running candle is reset before it finishes', seconds: 1.5 },
  { name: 'chime', label: 'Bell chime', when: 'A focus session ends, and again when a break is over', seconds: 3.5 },
  { name: 'restored', label: 'Restoration', when: 'The fourth candle restores a room', seconds: 4.5 },
  { name: 'breath', label: 'House breath', when: 'A break begins', seconds: 4.5 },
  { name: 'moan', label: 'Ghost moan', when: 'The ghost wakes while you are in another tab', seconds: 3.5 },
  { name: 'rattle', label: 'Rattle', when: 'With the moan, and again when you come back', seconds: 1.5 },
  { name: 'ambient', label: 'Ambient wind', when: 'Optional, under every session', seconds: 8, loops: true },
];

export interface RenderedSound {
  spec: SoundSpec;
  samples: Float32Array;
  sampleRate: number;
  levels: Levels;
}

/**
 * Renders one sound through the real SoundEngine into an OfflineAudioContext at full volume
 * (the loudest a listener can set), then measures it. Nothing reaches the speakers.
 */
export async function renderSound(spec: SoundSpec, sampleRate = 44_100): Promise<RenderedSound> {
  const ctx = new OfflineAudioContext(1, Math.ceil(spec.seconds * sampleRate), sampleRate);
  const engine = new SoundEngine();
  engine.setVolume(1);
  if (spec.name === 'ambient') engine.setAmbient(true);
  engine.attach(ctx);
  if (spec.name !== 'ambient') engine.play(spec.name);
  const buffer = await ctx.startRendering();
  const samples = buffer.getChannelData(0);
  return { spec, samples, sampleRate, levels: measureLevels(samples, sampleRate) };
}

export interface Verdict {
  ok: boolean;
  notes: string[];
}

/** Limits every sound must meet at full volume. */
export const LIMITS = {
  /** Headroom below full scale, so nothing distorts at the top of the slider. */
  maxPeakDb: -1,
  /**
   * Quieter than this at full volume and the cue is lost under room noise or laptop speakers.
   * The first rattle peaked at -31 dBFS (brown noise through a 2.4 kHz band-pass); this limit caught it.
   */
  minPeakDb: -28,
  /** A finished one-shot must fade to near silence (no hanging tone, no click at the end). */
  maxTailDb: -50,
};

export function judge(rendered: RenderedSound): Verdict {
  const { levels, spec } = rendered;
  const notes: string[] = [];
  if (levels.invalid) notes.push('contains invalid samples');
  if (levels.clippedSamples > 0) notes.push(`${levels.clippedSamples} clipped samples`);
  if (levels.peakDb > LIMITS.maxPeakDb) notes.push(`peak ${levels.peakDb.toFixed(1)} dBFS is above ${LIMITS.maxPeakDb}`);
  if (levels.peakDb < LIMITS.minPeakDb) notes.push(`peak ${levels.peakDb.toFixed(1)} dBFS is below ${LIMITS.minPeakDb}`);
  if (!spec.loops && levels.tailDb > LIMITS.maxTailDb) notes.push(`tail ${levels.tailDb.toFixed(1)} dBFS does not fade out`);
  return { ok: notes.length === 0, notes };
}
