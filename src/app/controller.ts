import type { Clock } from '../core/clock';
import { reduceApp, timerConfig, type AppAction, type AppModel, type ConfigFor, type Cue } from '../core/model';

export interface ControllerOptions {
  initial: AppModel;
  clock: Clock;
  configFor?: ConfigFor;
  /** Called after every real change; not called for ticks that change nothing. */
  persist?: (model: AppModel) => void;
}

/** Holds the model, runs the pure reducer and tells React and the cue player what changed. */
export class HouseController {
  private model: AppModel;
  private readonly listeners = new Set<() => void>();
  private readonly cueListeners = new Set<(cues: Cue[]) => void>();
  private readonly clock: Clock;
  private readonly configFor: ConfigFor;
  private readonly persist?: (model: AppModel) => void;

  constructor(options: ControllerOptions) {
    this.model = options.initial;
    this.clock = options.clock;
    this.configFor = options.configFor ?? timerConfig;
    this.persist = options.persist;
  }

  getModel = (): AppModel => this.model;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  onCues(listener: (cues: Cue[]) => void): () => void {
    this.cueListeners.add(listener);
    return () => this.cueListeners.delete(listener);
  }

  dispatch = (action: AppAction): void => {
    const { model, cues } = reduceApp(this.model, action, this.clock.now(), this.configFor);
    if (model !== this.model) {
      this.model = model;
      this.persist?.(model);
      this.listeners.forEach((l) => l());
    }
    if (cues.length) this.cueListeners.forEach((l) => l(cues));
  };

  /** Replaces the whole model, e.g. after a sync pull. */
  replace(model: AppModel): void {
    this.model = model;
    this.persist?.(model);
    this.listeners.forEach((l) => l());
  }
}
