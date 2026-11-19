/**
 * The notification port. The app asks for a `Notifier`; the browser one wraps the Notification API,
 * and the no-op default is used where that API is missing (and in tests that do not care).
 * Nothing here asks for permission on its own: only `requestPermission` does, and the app calls it
 * only when the person turns the setting on.
 */
export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export interface Notifier {
  permission(): NotifyPermission;
  /** Shows the browser's permission prompt when it has not been answered yet. */
  requestPermission(): Promise<NotifyPermission>;
  show(title: string, body: string): void;
}

export const noopNotifier: Notifier = {
  permission: () => 'unsupported',
  requestPermission: async () => 'unsupported',
  show: () => {},
};

/** The part of the browser's `Notification` constructor the adapter uses. */
export interface NotificationConstructor {
  new (title: string, options?: { body?: string; tag?: string; icon?: string }): unknown;
  readonly permission: string;
  requestPermission(): Promise<string>;
}

const TAG = 'haunted-pomodoro-phase';

function asPermission(value: unknown): NotifyPermission {
  return value === 'granted' || value === 'denied' || value === 'default' ? value : 'unsupported';
}

export function createBrowserNotifier(Ctor: NotificationConstructor | undefined = (globalThis as { Notification?: NotificationConstructor }).Notification): Notifier {
  if (!Ctor) return noopNotifier;
  return {
    permission: () => asPermission(Ctor.permission),
    async requestPermission() {
      try {
        return asPermission(await Ctor.requestPermission());
      } catch {
        return asPermission(Ctor.permission);
      }
    },
    show(title, body) {
      try {
        // One tag, so a second notification replaces the first instead of stacking.
        new Ctor(title, { body, tag: TAG, icon: '/icon-192.png' });
      } catch {
        // Some platforms only allow notifications from a service worker; staying silent is fine.
      }
    },
  };
}
