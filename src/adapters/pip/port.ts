/**
 * The follow window as a port. The real adapter wraps Document Picture-in-Picture; the default is
 * a no-op, and tests use the fake. Nothing behind this port can reach the app model.
 */
import { sameView, type PipView } from '../../core/follow';

export type { PipView };

export interface PipOptions {
  width: number;
  height: number;
}

export type PipOpenResult = { ok: true } | { ok: false; reason: 'unsupported' | 'not-allowed' | 'failed' };

/** 'app' when close() was called; 'external' when the person or the browser closed the window. */
export type PipClosedBy = 'app' | 'external';

export interface PipWindow {
  /** True when the browser has the Document Picture-in-Picture API. */
  isSupported(): boolean;
  /**
   * Opens the window. Must be called synchronously inside a user gesture: the adapter calls
   * requestWindow before it does anything asynchronous. Never throws and never rejects.
   * `source` is asked for the current view when the window opens and then about once a second
   * while it is open, so the time stays right even when the opener tab's timers are throttled.
   */
  open(options: PipOptions, source: () => PipView): Promise<PipOpenResult>;
  /** Draws the current view now (the follower calls this on visibility or motion changes). */
  refresh(): void;
  close(): void;
  isOpen(): boolean;
  onClosed(listener: (by: PipClosedBy) => void): () => void;
}

/** Returns a writer that skips a view equal to the last one it wrote. */
export function createViewGate(write: (view: PipView) => void): (view: PipView) => void {
  let last: PipView | null = null;
  return (view) => {
    if (last && sameView(last, view)) return;
    last = view;
    write(view);
  };
}

export const noopPip: PipWindow = {
  isSupported: () => false,
  open: () => Promise.resolve({ ok: false, reason: 'unsupported' }),
  refresh: () => undefined,
  close: () => undefined,
  isOpen: () => false,
  onClosed: () => () => undefined,
};
