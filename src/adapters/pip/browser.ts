/**
 * The follow window on Document Picture-in-Picture. The API is declared here because the project's
 * DOM library may not include it, and it is read from `env` at call time, never at import, so a
 * test or an init script can define it later. Nothing here throws or rejects to the caller.
 */
import { createViewGate, type PipClosedBy, type PipOpenResult, type PipOptions, type PipView, type PipWindow } from './port';

export interface PipHostWindow {
  readonly document: Document;
  addEventListener(type: 'pagehide', listener: () => void, options?: { once?: boolean }): void;
  setInterval(handler: () => void, ms: number): number;
  clearInterval(id: number): void;
  close(): void;
}

export interface DocumentPipApi {
  requestWindow(options?: { width?: number; height?: number }): Promise<PipHostWindow>;
  readonly window?: PipHostWindow | null;
}

export interface PipEnv {
  documentPictureInPicture?: DocumentPipApi;
  addEventListener?(type: 'pagehide', listener: () => void): void;
}

/** Writes a view into the window's document. Session B supplies `renderPipDocument`. */
export type PipRender = (doc: Document, view: PipView) => void;

const REFRESH_MS = 1000;

function reasonFor(error: unknown): 'unsupported' | 'not-allowed' | 'failed' {
  const name = typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined;
  if (name === 'NotAllowedError') return 'not-allowed';
  if (name === 'NotSupportedError') return 'unsupported';
  return 'failed';
}

export function createBrowserPip(env: PipEnv = globalThis as unknown as PipEnv, render: PipRender = () => undefined): PipWindow {
  let current: PipHostWindow | null = null;
  let intervalId: number | null = null;
  let source: (() => PipView) | null = null;
  let gate: ((view: PipView) => void) | null = null;
  let appClosing = false;
  const listeners = new Set<(by: PipClosedBy) => void>();

  /** Forgets the window and tells the listeners. Ignores a window that is no longer the current one. */
  function end(win: PipHostWindow, by: PipClosedBy): void {
    if (current !== win) return;
    const id = intervalId;
    current = null;
    intervalId = null;
    source = null;
    gate = null;
    if (id !== null) {
      try {
        win.clearInterval(id);
      } catch {
        // the window is gone
      }
    }
    for (const l of [...listeners]) l(by);
  }

  function refresh(): void {
    const win = current;
    if (!win || !source || !gate) return;
    try {
      gate(source());
    } catch {
      end(win, 'external');
    }
  }

  function close(): void {
    const win = current;
    if (!win) return;
    appClosing = true;
    try {
      win.close();
    } catch {
      // already gone
    }
    end(win, 'app');
    appClosing = false;
  }

  env.addEventListener?.('pagehide', () => close());

  return {
    isSupported: () => Boolean(env.documentPictureInPicture),

    open(options: PipOptions, viewSource: () => PipView): Promise<PipOpenResult> {
      const api = env.documentPictureInPicture;
      if (!api) return Promise.resolve({ ok: false, reason: 'unsupported' });
      let request: Promise<PipHostWindow>;
      try {
        // The first statement that touches the browser, before anything asynchronous.
        request = api.requestWindow({ width: options.width, height: options.height });
      } catch {
        return Promise.resolve({ ok: false, reason: 'failed' });
      }
      return Promise.resolve(request).then(
        (win): PipOpenResult => {
          try {
            const nextGate = createViewGate((view) => render(win.document, view));
            current = win;
            source = viewSource;
            gate = nextGate;
            nextGate(viewSource());
            win.addEventListener('pagehide', () => end(win, appClosing ? 'app' : 'external'), { once: true });
            intervalId = win.setInterval(refresh, REFRESH_MS);
            return { ok: true };
          } catch {
            // The window could not be drawn into: drop it and report a failure.
            if (current === win) current = null;
            source = null;
            gate = null;
            try {
              win.close();
            } catch {
              // already gone
            }
            return { ok: false, reason: 'failed' };
          }
        },
        (error): PipOpenResult => ({ ok: false, reason: reasonFor(error) }),
      );
    },

    refresh,
    close,
    isOpen: () => current !== null,
    onClosed(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
