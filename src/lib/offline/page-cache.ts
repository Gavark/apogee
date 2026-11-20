// Which pages the service worker keeps for offline reading, and how. Framework-free: the service worker imports it.

/** Independent of the app version: an update must not wipe what the user can read offline. */
export const PAGE_CACHE = 'apogee-pages';

const DATA_SUFFIX = '/__data.json';
/** The reading pages: home, cellar list, one wine. Forms, settings and photos stay network-only. */
const READABLE = /^\/app(?:\/cave|\/wines\/\d+)?(?:\/__data\.json)?$/;
/** SvelteKit's own query parameters (x-sveltekit-invalidated, x-sveltekit-trailing-slash). */
const INTERNAL_PARAM = 'x-sveltekit-';
const INVALIDATED_PARAM = 'x-sveltekit-invalidated';

/** A reading page (HTML or its `__data.json`) of this origin. The caller checks the method is GET. */
export function isOfflineReadable(url: Pick<URL, 'origin' | 'pathname'>, origin: string): boolean {
  return url.origin === origin && READABLE.test(url.pathname);
}

export function isDataRequest(url: URL): boolean {
  return url.pathname.endsWith(DATA_SUFFIX);
}

/** The `x-sveltekit-invalidated` bits of a data request ('101': nodes 0 and 2 asked for), null when absent. */
export function invalidatedBits(url: URL): string | null {
  return url.searchParams.get(INVALIDATED_PARAM);
}

/** Path plus the page's own parameters (cellar filters), sorted, without SvelteKit's internal ones. */
export function cacheKeyFor(url: URL): string {
  const params = new URLSearchParams();
  for (const [k, v] of url.searchParams) if (!k.startsWith(INTERNAL_PARAM)) params.append(k, v);
  params.sort();
  const qs = params.toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}

/** Only a plain 200 is kept: never an error, a redirect (e.g. to /login) or an opaque response. */
export function isStorable(res: { status: number; redirected: boolean; type: ResponseType }): boolean {
  return res.status === 200 && !res.redirected && res.type !== 'opaqueredirect' && res.type !== 'opaque';
}

type DataNode = { type: string } | null;
type DataBody = { type: 'data'; nodes: DataNode[] };

/** A single-line `{ type: 'data' }` body, or null (redirect, error, streamed promises, garbage). */
function parseData(text: string | null): DataBody | null {
  if (!text) return null;
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  if (lines.length !== 1) return null; // streamed chunks would need their promises replayed: not kept
  try {
    const body = JSON.parse(lines[0]) as { type?: unknown; nodes?: unknown };
    if (body?.type !== 'data' || !Array.isArray(body.nodes)) return null;
    const nodes = body.nodes as unknown[];
    if (!nodes.every((n) => n === null || (typeof n === 'object' && typeof (n as { type?: unknown }).type === 'string'))) {
      return null;
    }
    return body as DataBody;
  } catch {
    return null;
  }
}

const isData = (n: DataNode) => n?.type === 'data';

/**
 * The `__data.json` body to keep, or null to keep nothing (a redirect such as an expired session,
 * an error, a streamed body). Nodes the server skipped (not reloaded by this navigation) are filled
 * from the previous cached body of the same page, so the entry gets more complete over time.
 */
export function dataBodyToStore(fresh: string, previous: string | null): string | null {
  const body = parseData(fresh);
  if (!body || body.nodes.some((n) => n?.type === 'error')) return null;
  const old = parseData(previous);
  const nodes =
    old && old.nodes.length === body.nodes.length
      ? body.nodes.map((n, i) => (n?.type === 'skip' && isData(old.nodes[i]) ? old.nodes[i] : n))
      : body.nodes;
  return JSON.stringify({ type: 'data', nodes }) + '\n';
}

/**
 * The cached body answering a data request: the nodes it asks for (its invalidated bits; all of
 * them when absent), `skip` for the others, as the server does, so the page keeps the layout data
 * it already has. Null when a requested node is not in the cache or the node count differs (the
 * app changed since): better a clean offline error than another page's data.
 */
export function dataBodyToServe(cached: string, invalidated: string | null): string | null {
  const body = parseData(cached);
  if (!body) return null;
  const bits = invalidated ?? '1'.repeat(body.nodes.length);
  if (bits.length !== body.nodes.length) return null;
  const nodes: DataNode[] = [];
  for (let i = 0; i < bits.length; i++) {
    const n = body.nodes[i];
    if (bits[i] !== '1') nodes.push(n === null ? null : { type: 'skip' });
    else if (n === null || isData(n)) nodes.push(n);
    else return null;
  }
  return JSON.stringify({ type: 'data', nodes }) + '\n';
}

/**
 * Where to send a navigation the service worker cannot answer (network down), or null. `/` has no
 * page of its own (the server redirects it to /app or /login) and was the installed app's start_url:
 * offline it goes to /app, served from the copy (logged out, /app sends to /login once online).
 */
export function offlineRedirectFor(url: Pick<URL, 'origin' | 'pathname'>, origin: string): string | null {
  return url.origin === origin && url.pathname === '/' ? '/app' : null;
}

/** Drops every cached page (logout, another account). Works from a page and from the service worker. */
export async function clearPageCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(PAGE_CACHE);
}
