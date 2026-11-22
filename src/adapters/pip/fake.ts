/** A fake follow window for tests, with a model of transient activation like a browser's. */
import { createViewGate, type PipClosedBy, type PipOpenResult, type PipOptions, type PipView, type PipWindow } from './port';

export type FakeOutcome = 'ok' | 'reject:not-allowed' | 'reject:unsupported' | 'reject:failed' | 'pending';

export interface FakeOpenCall {
  options: PipOptions;
  /** True when the call happened inside `activate(...)`. */
  inGesture: boolean;
}

export class FakePipWindow implements PipWindow {
  supported = true;
  outcome: FakeOutcome = 'ok';
  openCalls: FakeOpenCall[] = [];
  /** Every view that passed the gate. */
  views: PipView[] = [];
  closeCalls = 0;

  private activation = false;
  private open_ = false;
  private source: (() => PipView) | null = null;
  private gate: ((view: PipView) => void) | null = null;
  private pending: { resolve: (r: PipOpenResult) => void; source: () => PipView } | null = null;
  private listeners = new Set<(by: PipClosedBy) => void>();

  /** Runs `fn` with transient activation on, and turns it off when `fn` returns. */
  activate<T>(fn: () => T): T {
    this.activation = true;
    try {
      return fn();
    } finally {
      this.activation = false;
    }
  }

  isSupported(): boolean {
    return this.supported;
  }

  open(options: PipOptions, source: () => PipView): Promise<PipOpenResult> {
    this.openCalls.push({ options, inGesture: this.activation });
    if (!this.supported) return Promise.resolve({ ok: false, reason: 'unsupported' });
    if (!this.activation) return Promise.resolve({ ok: false, reason: 'not-allowed' });
    switch (this.outcome) {
      case 'reject:not-allowed':
        return Promise.resolve({ ok: false, reason: 'not-allowed' });
      case 'reject:unsupported':
        return Promise.resolve({ ok: false, reason: 'unsupported' });
      case 'reject:failed':
        return Promise.resolve({ ok: false, reason: 'failed' });
      case 'pending':
        return new Promise((resolve) => {
          this.pending = { resolve, source };
        });
      case 'ok':
        this.show(source);
        return Promise.resolve({ ok: true });
    }
  }

  /** Answers a pending request later. An `ok` answer opens the window now. */
  settle(result: PipOpenResult): void {
    const p = this.pending;
    if (!p) throw new Error('no pending request');
    this.pending = null;
    if (result.ok) this.show(p.source);
    p.resolve(result);
  }

  hasPending(): boolean {
    return this.pending !== null;
  }

  refresh(): void {
    if (this.open_ && this.source && this.gate) this.gate(this.source());
  }

  close(): void {
    this.closeCalls++;
    if (!this.open_) return;
    this.drop('app');
  }

  /** The person (or the browser) closes the window. */
  closeFromOutside(): void {
    if (this.open_) this.drop('external');
  }

  isOpen(): boolean {
    return this.open_;
  }

  onClosed(listener: (by: PipClosedBy) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private show(source: () => PipView): void {
    this.open_ = true;
    this.source = source;
    this.gate = createViewGate((view) => this.views.push(view));
    this.gate(source());
  }

  private drop(by: PipClosedBy): void {
    this.open_ = false;
    this.source = null;
    this.gate = null;
    for (const l of [...this.listeners]) l(by);
  }
}
