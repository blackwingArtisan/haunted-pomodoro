/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "local" (default) or "cloudflare". */
  readonly VITE_HOUSE_STORE?: string;
  /** Base URL of the sync Worker, used only when VITE_HOUSE_STORE=cloudflare. */
  readonly VITE_SYNC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
