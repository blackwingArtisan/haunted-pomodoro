/**
 * Optional sync Worker for Cloudflare (free tier): stores one JSON house per random id in Workers
 * KV. Deploy with `wrangler deploy` using worker/wrangler.toml.example. Never deployed from this
 * repository; unit tested against an in-memory KV.
 */

/** The subset of the Workers KV binding this Worker uses. */
export interface KvNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  HOUSES: KvNamespace;
  /** Comma-separated origins allowed to sync, e.g. the Pages URL. */
  ALLOWED_ORIGINS?: string;
}

const MAX_BYTES = 256 * 1024;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUTE = /^\/v1\/houses\/([^/]+)$/;

function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  return {
    'access-control-allow-origin': allowed.includes(origin) ? origin : (allowed[0] ?? 'null'),
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json' } });
}

function updatedAtOf(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null;
  const t = (value as { updatedAt?: unknown }).updatedAt;
  return typeof t === 'number' && Number.isFinite(t) ? t : null;
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const headers = cors(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  const match = ROUTE.exec(new URL(request.url).pathname);
  const id = match ? decodeURIComponent(match[1]!) : '';
  if (!match || !ID.test(id)) return json({ error: 'not_found' }, 404, headers);
  const key = `house:${id.toLowerCase()}`;

  if (request.method === 'GET') {
    const stored = await env.HOUSES.get(key);
    return stored === null ? json({ error: 'not_found' }, 404, headers) : new Response(stored, { status: 200, headers: { ...headers, 'content-type': 'application/json' } });
  }

  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_BYTES) return json({ error: 'too_large' }, 413, headers);
    let incoming: unknown;
    try {
      incoming = JSON.parse(text);
    } catch {
      return json({ error: 'invalid_json' }, 400, headers);
    }
    const incomingAt = updatedAtOf(incoming);
    if (incomingAt === null) return json({ error: 'missing_updatedAt' }, 400, headers);
    const stored = await env.HOUSES.get(key);
    if (stored !== null) {
      const storedAt = updatedAtOf(JSON.parse(stored));
      // Last writer wins, but an older copy never overwrites a newer one; the client merges instead.
      if (storedAt !== null && storedAt > incomingAt) return new Response(stored, { status: 409, headers: { ...headers, 'content-type': 'application/json' } });
    }
    await env.HOUSES.put(key, text);
    return json({ ok: true, updatedAt: incomingAt }, 200, headers);
  }

  return json({ error: 'method_not_allowed' }, 405, headers);
}

export default { fetch: handle };
