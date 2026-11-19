import { noopNotifier, type Notifier, type NotifyPermission } from '../adapters/notify';
import type { Clock } from '../core/clock';
import { reduceApp, timerConfig, type AppAction, type AppModel, type ConfigFor, type Cue } from '../core/model';
import { phaseEndNotice } from '../core/notice';

export interface ControllerOptions {
  initial: AppModel;
  clock: Clock;
  configFor?: ConfigFor;
  /** Called after every real change; not called for ticks that change nothing. */
  persist?: (model: AppModel) => void;
  /** Browser notifications; the no-op default never shows anything. */
  notifier?: Notifier;
  /** True while the tab is hidden. Defaults to never hidden, so nothing is notified. */
  isHidden?: () => boolean;
}

export interface NotifySettingResult {
  enabled: boolean;
  /** Why the setting is on or off, in words for the person. */
  message: string;
}

/** Why phase-end notifications cannot be on, or null when the browser allows them. */
export function notifyBlockedReason(permission: NotifyPermission): string | null {
  switch (permission) {
    case 'granted':
      return null;
    case 'denied':
      return 'Notifications are blocked for this site, so phase-end notifications are off. Allow them in your browser’s site settings to turn them on.';
    case 'unsupported':
      return 'This browser cannot show notifications, so phase-end notifications are off.';
    case 'default':
      return 'Permission was not given, so phase-end notifications stay off.';
  }
}

/** Holds the model, runs the pure reducer and tells React and the cue player what changed. */
export class HouseController {
  private model: AppModel;
  private readonly listeners = new Set<() => void>();
  private readonly cueListeners = new Set<(cues: Cue[]) => void>();
  private readonly notifyOffListeners = new Set<(message: string) => void>();
  private readonly clock: Clock;
  private readonly configFor: ConfigFor;
  private readonly persist?: (model: AppModel) => void;
  private readonly notifier: Notifier;
  private readonly isHidden: () => boolean;

  constructor(options: ControllerOptions) {
    this.model = options.initial;
    this.clock = options.clock;
    this.configFor = options.configFor ?? timerConfig;
    this.persist = options.persist;
    this.notifier = options.notifier ?? noopNotifier;
    this.isHidden = options.isHidden ?? (() => false);
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

  /** Called with the reason when the setting turns itself off because the browser will not allow notifications. */
  onNotifyOff(listener: (message: string) => void): () => void {
    this.notifyOffListeners.add(listener);
    return () => this.notifyOffListeners.delete(listener);
  }

  dispatch = (action: AppAction): void => {
    const before = this.model;
    const { model, cues } = reduceApp(this.model, action, this.clock.now(), this.configFor);
    if (model !== this.model) {
      this.model = model;
      this.persist?.(model);
      this.listeners.forEach((l) => l());
    }
    if (cues.length) {
      this.cueListeners.forEach((l) => l(cues));
      this.notifyPhaseEnd(cues, before);
    }
  };

  /** Replaces the whole model, e.g. after a sync pull or an import. */
  replace(model: AppModel): void {
    this.model = model;
    this.persist?.(model);
    this.listeners.forEach((l) => l());
  }

  /**
   * Turns phase-end notifications on or off. Turning them on is the only place the browser's
   * permission prompt is ever shown; if the answer is not "granted" the setting stays off.
   */
  async setNotifyPhaseEnd(on: boolean): Promise<NotifySettingResult> {
    if (!on) {
      this.dispatch({ type: 'updateSettings', patch: { notifyPhaseEnd: false } });
      return { enabled: false, message: 'Phase-end notifications are off.' };
    }
    let permission = this.notifier.permission();
    if (permission === 'default') permission = await this.notifier.requestPermission();
    const reason = notifyBlockedReason(permission);
    this.dispatch({ type: 'updateSettings', patch: { notifyPhaseEnd: reason === null } });
    return reason === null ? { enabled: true, message: 'Phase-end notifications are on while this tab is hidden.' } : { enabled: false, message: reason };
  }

  /** Turns the setting off, with the reason, if it is on but the browser no longer allows notifications. Never prompts. */
  reconcileNotifications(): void {
    if (!this.model.settings.notifyPhaseEnd) return;
    const permission = this.notifier.permission();
    // "default" means the person was never asked, so there is nothing to undo; it simply stays silent.
    if (permission !== 'denied' && permission !== 'unsupported') return;
    this.dispatch({ type: 'updateSettings', patch: { notifyPhaseEnd: false } });
    const reason = notifyBlockedReason(permission);
    if (reason) this.notifyOffListeners.forEach((l) => l(reason));
  }

  private notifyPhaseEnd(cues: Cue[], before: AppModel): void {
    if (!before.settings.notifyPhaseEnd || !this.isHidden()) return;
    const notice = phaseEndNotice(cues, before.timer.phase);
    if (!notice) return;
    if (this.notifier.permission() !== 'granted') {
      this.reconcileNotifications();
      return;
    }
    this.notifier.show(notice.title, notice.body);
  }
}
