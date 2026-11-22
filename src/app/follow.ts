/**
 * The ghost's companion. It reads the model and the page's visibility and drives the tab's icon,
 * the tab's title and the follow window. It never changes the model: it receives only the read side
 * of the controller, and its state machine has no way to name an action.
 */
import type { FaviconPainter } from '../adapters/favicon';
import type { PipClosedBy, PipWindow } from '../adapters/pip';
import type { Clock } from '../core/clock';
import { faviconFrame, frameKey } from '../core/favicon';
import { initialFollow, PIP_SIZE, pipView, stepFollow, type FollowEffect, type FollowEvent, type FollowNote, type FollowState, type PipView } from '../core/follow';
import type { AppModel } from '../core/model';
import { tabTitle } from '../core/tab-title';

/** What the follower may use of the controller. */
export interface FollowerModelSource {
  getModel(): AppModel;
  subscribe(listener: () => void): () => void;
}

export interface FollowerDeps {
  controller: FollowerModelSource;
  clock: Clock;
  pip: PipWindow;
  favicon: FaviconPainter;
  /** Writes `document.title`. */
  setTitle(title: string): void;
  isHidden(): boolean;
  isReducedMotion(): boolean;
  /** The polite live region of the main page. */
  announce(text: string): void;
  /** The note in Settings. */
  note(text: string): void;
}

export const FOLLOW_NOTES: Record<FollowNote, string> = {
  opened: 'The ghost is following you in a small window.',
  failed: 'The window could not open here. The ghost follows you in the tab’s icon and title instead.',
};

export class GhostFollower {
  private state: FollowState;
  private lastFrameKey: string | null = null;
  private lastTitle: string | null = null;
  private offClosed: (() => void) | null = null;

  constructor(private readonly deps: FollowerDeps) {
    this.state = initialFollow(deps.isHidden());
    this.listen();
  }

  /** Listens for the window closing. Safe to call again after `dispose`, as React's strict mode remounts effects. */
  private listen(): void {
    if (this.offClosed) return;
    this.offClosed = this.deps.pip.onClosed((by: PipClosedBy) => {
      if (by === 'external') this.apply({ type: 'closed' });
    });
  }

  getState(): FollowState {
    return this.state;
  }

  /** Call inside the click or key handler that is about to start a focus session. */
  startGesture(): void {
    const { timer } = this.deps.controller.getModel();
    if (timer.status !== 'idle' || timer.phase !== 'focus') return;
    this.syncConfig();
    this.apply({ type: 'start' });
  }

  /** Call on every tick and whenever the model, the visibility or the motion preference changes. */
  sync(): void {
    this.listen();
    const model = this.deps.controller.getModel();
    const timer = model.timer;
    this.syncConfig();
    this.apply({ type: this.deps.isHidden() ? 'hidden' : 'visible' });
    const sessionOn = timer.phase === 'focus' && (timer.status === 'running' || timer.status === 'paused');
    if (!sessionOn) this.apply({ type: 'sessionEnded' });

    const now = this.deps.clock.now();
    const hidden = this.deps.isHidden();
    const frame = faviconFrame({ timer, now, hidden, reducedMotion: this.deps.isReducedMotion() });
    const key = frameKey(frame);
    if (key !== this.lastFrameKey) {
      this.lastFrameKey = key;
      this.deps.favicon.show(frame);
    }
    const title = tabTitle({ timer, now, hidden });
    if (title !== this.lastTitle) {
      this.lastTitle = title;
      this.deps.setTitle(title);
    }
    if (this.deps.pip.isOpen()) this.deps.pip.refresh();
  }

  dispose(): void {
    this.offClosed?.();
    this.offClosed = null;
    this.deps.pip.close();
  }

  private syncConfig(): void {
    this.apply({ type: 'config', on: this.deps.controller.getModel().settings.ghostFollows, supported: this.deps.pip.isSupported() });
  }

  private view(): PipView {
    return pipView({
      timer: this.deps.controller.getModel().timer,
      now: this.deps.clock.now(),
      follow: this.state,
      reducedMotion: this.deps.isReducedMotion(),
    });
  }

  private apply(event: FollowEvent): void {
    const step = stepFollow(this.state, event, this.deps.clock.now());
    this.state = step.state;
    for (const effect of step.effects) this.run(effect);
  }

  private run(effect: FollowEffect): void {
    switch (effect.type) {
      case 'request': {
        const requestedAt = effect.requestedAt;
        // Called here, inside the handler's call stack, and never awaited before the timer starts.
        void this.deps.pip.open(PIP_SIZE, () => this.view()).then((result) => {
          this.apply(result.ok ? { type: 'opened', requestedAt } : { type: 'rejected', requestedAt });
        });
        break;
      }
      case 'close':
        this.deps.pip.close();
        break;
      case 'announce':
        this.deps.announce(FOLLOW_NOTES[effect.note]);
        this.deps.note(FOLLOW_NOTES[effect.note]);
        break;
    }
  }
}
