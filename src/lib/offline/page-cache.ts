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

/** The `__data.json` request of a page, with the page's own parameters. */
export function dataUrlFor(url: URL): URL {
  const data = new URL(url.href);
  data.pathname = url.pathname.replace(/\/$/, '') + DATA_SUFFIX;
  return data;
}

/**
 * Whether PAGE_CACHE holds a copy of the page's data able to answer a full reload (every node).
 * A partial copy (nodes skipped by a client-side navigation) or none: a reload could fail offline.
 */
export async function hasFullDataCopy(url: URL, origin: string): Promise<boolean> {
  if (typeof caches === 'undefined' || !caches || !isOfflineReadable(url, origin)) return false;
  try {
    const cache = await caches.open(PAGE_CACHE);
    const hit = await cache.match(new URL(cacheKeyFor(dataUrlFor(url)), origin).href, { ignoreVary: true });
    return hit !== undefined && dataBodyToServe(await hit.text(), null) !== null;
  } catch {
    return false;
  }
}

/**
 * After a cold start on a reading page: the page hydrated from the data built into its HTML, which
 * the service worker may have served from a copy kept at the last full load, older than the copy of
 * its __data.json (refreshed by every reload and navigation). Reloads the data once: online it comes
 * fresh and refreshes that copy, so it is never older than the HTML; offline the copy answers.
 * Without a full copy, the data is fetched first (the service worker keeps it): offline that fails
 * and nothing is reloaded, as the reload would end on an error page; the HTML is the newest there is.
 */
export async function reloadAfterColdStart(
  url: URL,
  origin: string,
  deps: { invalidate: () => Promise<void>; fetch: typeof fetch }
): Promise<void> {
  if (!isOfflineReadable(url, origin)) return;
  if (!(await hasFullDataCopy(url, origin))) {
    const doFetch = deps.fetch; // a local: `deps.fetch(...)` would call window.fetch with the wrong `this`
    const res = await doFetch(dataUrlFor(url), { credentials: 'same-origin' }).catch(() => null);
    if (!res?.ok) return;
  }
  await deps.invalidate();
}

/** On a weak signal, how long opening a page waits for the network before its copy is shown instead. */
export const NETWORK_TIMEOUT_MS = 4_000;

/**
 * The deadline before the copy answers instead of the network, or null for none. Only for opening
 * a page (a navigation): a data request (`__data.json`) follows a gesture or a reload, and answering
 * it with the copy while the network is merely slow would show pre-gesture data as current (the
 * overlay drops the gesture once the reload returns, so the count would silently revert).
 */
export function networkDeadlineFor(request: Pick<Request, 'mode'>): number | null {
  return request.mode === 'navigate' ? NETWORK_TIMEOUT_MS : null;
}

/**
 * Network first: the network's response (errors and redirects included), or `copy` when the network
 * fails or, with a deadline `ms`, takes longer (weak signal: no waiting for the browser's own
 * timeout). Without a copy, the network whatever it takes, its failure included.
 */
export async function networkOrCopy(network: Promise<Response>, copy: Response | null, ms: number | null): Promise<Response> {
  if (!copy) return network;
  if (ms === null) return network.catch(() => copy);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), ms)));
  try {
    return (await Promise.race([network.catch(() => null), deadline])) ?? copy;
  } finally {
    clearTimeout(timer);
  }
}

/** Drops every cached page (logout, another account). Works from a page and from the service worker. */
export async function clearPageCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(PAGE_CACHE);
}

/** The most pages kept; past it the oldest go first (the cache would otherwise grow with every wine opened). */
export const MAX_PAGE_ENTRIES = 120;
/** When a copy was stored (Unix milliseconds): the Cache API keeps no date of its own. */
export const STORED_AT_HEADER = 'x-apogee-stored-at';

/** The given headers plus the time the copy is stored. */
export function stampedHeaders(headers: HeadersInit, now: number): Headers {
  const stamped = new Headers(headers);
  stamped.set(STORED_AT_HEADER, String(now));
  return stamped;
}

/** The stored-at header's value as a number, or null when absent or not a finite number. */
export function parseStoredAt(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** A page is its HTML and its `__data.json`: one URL once the data suffix is dropped (query kept). */
function pageOf(url: string): string {
  const u = new URL(url);
  if (u.pathname.endsWith(DATA_SUFFIX)) u.pathname = u.pathname.slice(0, -DATA_SUFFIX.length) || '/';
  return u.href;
}

/** The installed app's start page (`/` redirects to it offline): `/app` without parameters, HTML and data. Never evicted. */
function isProtectedPage(page: string): boolean {
  const { pathname, search } = new URL(page);
  return search === '' && pathname === '/app';
}

/**
 * The URLs to delete to get back down to `max` entries. Whole pages go (HTML and data together),
 * the one stored longest ago first: a page is as recent as its newest entry, no time (null) counts
 * as older than any, equal times keep the input order. The protected page is never returned: if
 * only it remains above `max`, it stops there.
 */
export function entriesToEvict(entries: { url: string; storedAt: number | null }[], max: number): string[] {
  if (entries.length <= max) return [];
  const pages = new Map<string, { urls: string[]; storedAt: number | null; i: number }>();
  for (const e of entries) {
    const key = pageOf(e.url);
    const page = pages.get(key);
    if (!page) pages.set(key, { urls: [e.url], storedAt: e.storedAt, i: pages.size });
    else {
      page.urls.push(e.url);
      if (e.storedAt !== null && (page.storedAt === null || e.storedAt > page.storedAt)) page.storedAt = e.storedAt;
    }
  }
  const oldestFirst = [...pages.entries()]
    .filter(([key]) => !isProtectedPage(key))
    .map(([, page]) => page)
    .sort((a, b) => (a.storedAt ?? -Infinity) - (b.storedAt ?? -Infinity) || a.i - b.i);
  const doomed: string[] = [];
  let remaining = entries.length;
  for (const page of oldestFirst) {
    if (remaining <= max) break;
    doomed.push(...page.urls);
    remaining -= page.urls.length;
  }
  return doomed;
}

/** Reads a cache's storage times and deletes what entriesToEvict names. Best effort: never throws. */
export async function trimPageCache(
  cache: Pick<Cache, 'keys' | 'match' | 'delete'>,
  max: number = MAX_PAGE_ENTRIES
): Promise<void> {
  try {
    const requests = await cache.keys();
    if (requests.length <= max) return;
    const entries = await Promise.all(
      requests.map(async (request) => {
        const hit = await cache.match(request, { ignoreVary: true });
        const storedAt = parseStoredAt(hit?.headers.get(STORED_AT_HEADER));
        return { url: request.url, storedAt };
      })
    );
    const doomed = new Set(entriesToEvict(entries, max));
    for (const request of requests) if (doomed.has(request.url)) await cache.delete(request);
  } catch {
    // keeping a few pages too many is harmless; failing to store the page is not
  }
}
