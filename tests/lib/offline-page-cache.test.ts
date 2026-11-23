import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PAGE_ENTRIES,
  PAGE_CACHE,
  STORED_AT_HEADER,
  cacheKeyFor,
  dataBodyToServe,
  dataBodyToStore,
  dataUrlFor,
  entriesToEvict,
  hasFullDataCopy,
  isOfflineReadable,
  reloadAfterColdStart,
  isStorable,
  networkDeadlineFor,
  networkOrCopy,
  offlineRedirectFor,
  parseStoredAt,
  stampedHeaders,
  trimPageCache
} from '$lib/offline/page-cache';

const ORIGIN = 'https://cave.example';
const u = (path: string, origin = ORIGIN) => new URL(path, origin);
const readable = (path: string, origin = ORIGIN) => isOfflineReadable(u(path, origin), ORIGIN);

const data = (nodes: unknown[]) => JSON.stringify({ type: 'data', nodes }) + '\n';
const node = (v: string) => ({ type: 'data', data: [{ v: 1 }, v], uses: {} });
const SKIP = { type: 'skip' };
const parse = (body: string | null) => (body === null ? null : JSON.parse(body.trim()));

describe('isOfflineReadable', () => {
  it.each(['/app', '/app/cave', '/app/wines/12', '/app/wines/7'])('page de lecture %s', (p) => {
    expect(readable(p)).toBe(true);
  });

  it.each(['/app/__data.json', '/app/cave/__data.json', '/app/wines/12/__data.json'])('données %s', (p) => {
    expect(readable(p)).toBe(true);
    expect(readable(`${p}?x-sveltekit-invalidated=001`)).toBe(true);
  });

  it('garde les filtres de la cave', () => {
    expect(readable('/app/cave?phase=ready&q=margaux')).toBe(true);
    expect(readable('/app/cave/__data.json?phase=ready&x-sveltekit-invalidated=01')).toBe(true);
  });

  it.each([
    '/',
    '/api/stock/ops',
    '/api/wines',
    '/account',
    '/account/household',
    '/admin',
    '/admin/users',
    '/login',
    '/logout',
    '/setup',
    '/signup',
    '/app/add',
    '/app/add/__data.json',
    '/app/locations',
    '/app/locations/__data.json',
    '/app/wines/12/edit',
    '/app/wines/12/edit/__data.json',
    '/app/wines/12/photo',
    '/app/wines/abc',
    '/app/wines',
    '/app/cave/',
    '/app/caves',
    '/application',
    '/healthz',
    '/_app/immutable/entry/start.js'
  ])('exclu : %s', (p) => {
    expect(readable(p)).toBe(false);
  });

  it('exclut une origine étrangère', () => {
    expect(readable('/app', 'https://evil.example')).toBe(false);
    expect(readable('/app/cave/__data.json', 'http://cave.example')).toBe(false);
  });
});

describe('cacheKeyFor', () => {
  it('chemin seul sans paramètre', () => {
    expect(cacheKeyFor(u('/app/wines/12'))).toBe('/app/wines/12');
  });

  it('retire x-sveltekit-invalidated (et les autres paramètres internes de SvelteKit)', () => {
    expect(cacheKeyFor(u('/app/__data.json?x-sveltekit-invalidated=011'))).toBe('/app/__data.json');
    expect(cacheKeyFor(u('/app/cave/__data.json?x-sveltekit-invalidated=1&x-sveltekit-trailing-slash=1'))).toBe(
      '/app/cave/__data.json'
    );
  });

  it('garde les paramètres de filtre de la cave', () => {
    expect(cacheKeyFor(u('/app/cave/__data.json?phase=ready&x-sveltekit-invalidated=001&q=margaux'))).toBe(
      '/app/cave/__data.json?phase=ready&q=margaux'
    );
    expect(cacheKeyFor(u('/app/cave?phase=ready&q=margaux'))).toBe('/app/cave?phase=ready&q=margaux');
  });

  it('même clé quel que soit l’ordre des filtres', () => {
    expect(cacheKeyFor(u('/app/cave?q=a&phase=ready'))).toBe(cacheKeyFor(u('/app/cave?phase=ready&q=a')));
  });

  it('page et données ont des clés distinctes', () => {
    expect(cacheKeyFor(u('/app/cave'))).not.toBe(cacheKeyFor(u('/app/cave/__data.json')));
  });
});

describe('isStorable', () => {
  it('200 direct seulement', () => {
    expect(isStorable({ status: 200, redirected: false, type: 'basic' })).toBe(true);
  });

  it.each([
    { status: 200, redirected: true, type: 'basic' as const },
    { status: 0, redirected: false, type: 'opaqueredirect' as const },
    { status: 0, redirected: false, type: 'opaque' as const },
    { status: 204, redirected: false, type: 'basic' as const },
    { status: 304, redirected: false, type: 'basic' as const },
    { status: 401, redirected: false, type: 'basic' as const },
    { status: 404, redirected: false, type: 'basic' as const },
    { status: 500, redirected: false, type: 'basic' as const }
  ])('jamais : %o', (res) => {
    expect(isStorable(res)).toBe(false);
  });
});

describe('dataBodyToStore', () => {
  it('garde une réponse de données complète', () => {
    const body = data([node('root'), node('app'), node('page')]);
    expect(parse(dataBodyToStore(body, null))).toEqual(parse(body));
  });

  it('refuse une redirection (session expirée), une erreur ou un corps illisible', () => {
    expect(dataBodyToStore(JSON.stringify({ type: 'redirect', location: '/login' }), null)).toBeNull();
    expect(dataBodyToStore(data([node('root'), { type: 'error', error: { message: 'x' } }]), null)).toBeNull();
    expect(dataBodyToStore('<!doctype html>', null)).toBeNull();
    expect(dataBodyToStore('', null)).toBeNull();
  });

  it('refuse une réponse en flux (promesses différées)', () => {
    const body = data([node('root'), node('page')]) + JSON.stringify({ type: 'chunk', id: 1, data: [1] }) + '\n';
    expect(dataBodyToStore(body, null)).toBeNull();
  });

  it('complète les nœuds non rechargés avec la version déjà en cache', () => {
    const previous = data([node('root-old'), node('app-old'), node('page-old')]);
    const fresh = data([SKIP, SKIP, node('page-new')]);
    expect(parse(dataBodyToStore(fresh, previous)).nodes).toEqual([node('root-old'), node('app-old'), node('page-new')]);
  });

  it('ne complète pas avec une version de structure différente', () => {
    const previous = data([node('root-old'), node('page-old')]);
    const fresh = data([SKIP, SKIP, node('page-new')]);
    expect(parse(dataBodyToStore(fresh, previous)).nodes).toEqual([SKIP, SKIP, node('page-new')]);
  });

  it('ignore une version en cache illisible', () => {
    const fresh = data([SKIP, node('page')]);
    expect(parse(dataBodyToStore(fresh, 'garbage')).nodes).toEqual([SKIP, node('page')]);
  });
});

describe('dataBodyToServe', () => {
  const cached = data([node('root'), null, node('page')]);

  it('sert les nœuds demandés et rend « skip » pour les autres', () => {
    expect(parse(dataBodyToServe(cached, '101'))).toEqual({ type: 'data', nodes: [node('root'), null, node('page')] });
    expect(parse(dataBodyToServe(cached, '001'))).toEqual({ type: 'data', nodes: [SKIP, null, node('page')] });
  });

  it('sans paramètre d’invalidation, tout est demandé', () => {
    expect(parse(dataBodyToServe(cached, null)).nodes).toEqual([node('root'), null, node('page')]);
  });

  it('refuse quand un nœud demandé manque dans le cache', () => {
    expect(dataBodyToServe(data([SKIP, SKIP, node('page')]), '101')).toBeNull();
    expect(dataBodyToServe(data([SKIP, SKIP, node('page')]), null)).toBeNull();
  });

  it('refuse un nombre de nœuds différent (nouvelle version de l’app) ou un corps illisible', () => {
    expect(dataBodyToServe(cached, '01')).toBeNull();
    expect(dataBodyToServe('nope', '1')).toBeNull();
  });
});

describe('offlineRedirectFor', () => {
  it('« / » (start_url des installations existantes) → /app, servie depuis la copie', () => {
    expect(offlineRedirectFor(u('/'), ORIGIN)).toBe('/app');
  });

  it.each(['/app', '/login', '/app/cave', '/account'])('%s → aucune redirection', (p) => {
    expect(offlineRedirectFor(u(p), ORIGIN)).toBeNull();
  });

  it('autre origine → aucune redirection', () => {
    expect(offlineRedirectFor(u('/', 'https://evil.example'), ORIGIN)).toBeNull();
  });
});

describe('dataUrlFor', () => {
  it('ajoute /__data.json au chemin et garde les paramètres de la page', () => {
    expect(dataUrlFor(u('/app')).href).toBe(`${ORIGIN}/app/__data.json`);
    expect(dataUrlFor(u('/app/cave?phase=ready')).href).toBe(`${ORIGIN}/app/cave/__data.json?phase=ready`);
    expect(dataUrlFor(u('/app/wines/12/')).href).toBe(`${ORIGIN}/app/wines/12/__data.json`);
  });

  it('même clé de cache que la requête de données de SvelteKit', () => {
    const fromSvelteKit = u('/app/cave/__data.json?q=x&x-sveltekit-invalidated=11');
    expect(cacheKeyFor(dataUrlFor(u('/app/cave?q=x')))).toBe(cacheKeyFor(fromSvelteKit));
  });
});

/** A fake CacheStorage holding PAGE_CACHE with `entries` (cache key → body). */
function stubCaches(entries: Record<string, string>) {
  const open = vi.fn(async (name: string) => ({
    match: async (key: string) => {
      if (name !== PAGE_CACHE) return undefined;
      const path = new URL(key).pathname + new URL(key).search;
      return path in entries ? new Response(entries[path]) : undefined;
    }
  }));
  vi.stubGlobal('caches', { open });
}

describe('hasFullDataCopy', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('copie complète des données de la page → true', async () => {
    stubCaches({ '/app/cave/__data.json?q=x': data([node('layout'), null, node('page')]) });
    await expect(hasFullDataCopy(u('/app/cave?q=x'), ORIGIN)).resolves.toBe(true);
  });

  it('pas de copie → false (rien à recharger : la page affichée est la plus récente)', async () => {
    stubCaches({});
    await expect(hasFullDataCopy(u('/app'), ORIGIN)).resolves.toBe(false);
  });

  it('copie partielle (layout sauté par une navigation) → false : hors ligne, le rechargement complet échouerait', async () => {
    stubCaches({ '/app/__data.json': data([SKIP, node('page')]) });
    await expect(hasFullDataCopy(u('/app'), ORIGIN)).resolves.toBe(false);
  });

  it('pas une page de lecture ou pas de Cache Storage → false', async () => {
    stubCaches({ '/account/__data.json': data([node('x')]) });
    await expect(hasFullDataCopy(u('/account'), ORIGIN)).resolves.toBe(false);
    vi.stubGlobal('caches', undefined);
    await expect(hasFullDataCopy(u('/app'), ORIGIN)).resolves.toBe(false);
  });
});

describe('reloadAfterColdStart', () => {
  afterEach(() => vi.unstubAllGlobals());
  const deps = (fetchImpl: () => Promise<Response>) => ({
    invalidate: vi.fn(async () => {}),
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch
  });

  it('copie complète → recharge les données (en ligne : fraîches ; hors ligne : la copie), sans requête de plus', async () => {
    stubCaches({ '/app/__data.json': data([node('layout'), node('page')]) });
    const d = deps(async () => new Response('{}'));
    await reloadAfterColdStart(u('/app'), ORIGIN, d);
    expect(d.invalidate).toHaveBeenCalledTimes(1);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('pas de copie complète, réseau là → lit les données une fois (le service worker les garde) puis recharge', async () => {
    stubCaches({ '/app/cave/__data.json': data([SKIP, node('page')]) });
    const d = deps(async () => new Response('{}'));
    await reloadAfterColdStart(u('/app/cave?q=x'), ORIGIN, d);
    expect(String((d.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toBe(`${ORIGIN}/app/cave/__data.json?q=x`);
    expect(d.invalidate).toHaveBeenCalledTimes(1);
  });

  it('pas de copie complète et pas de réseau (ou erreur) → ne recharge pas : la page affichée reste, pas de page d’erreur', async () => {
    stubCaches({});
    const offline = deps(async () => Promise.reject(new TypeError('Failed to fetch')));
    await reloadAfterColdStart(u('/app'), ORIGIN, offline);
    expect(offline.invalidate).not.toHaveBeenCalled();
    const failing = deps(async () => new Response('{}', { status: 503 }));
    await reloadAfterColdStart(u('/app'), ORIGIN, failing);
    expect(failing.invalidate).not.toHaveBeenCalled();
  });

  it('page qui n’est pas de lecture → rien', async () => {
    stubCaches({});
    const d = deps(async () => new Response('{}'));
    await reloadAfterColdStart(u('/app/locations'), ORIGIN, d);
    expect(d.fetch).not.toHaveBeenCalled();
    expect(d.invalidate).not.toHaveBeenCalled();
  });
});

describe('networkOrCopy (délai réseau)', () => {
  afterEach(() => vi.useRealTimers());
  const copy = () => new Response('copie');
  const later = <T>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));

  it('réseau rapide → la réponse du réseau, même une erreur (jamais remplacée par la copie)', async () => {
    await expect(networkOrCopy(Promise.resolve(new Response('frais')), copy(), 4000).then((r) => r.text())).resolves.toBe('frais');
    await expect(networkOrCopy(Promise.resolve(new Response('', { status: 500 })), copy(), 4000).then((r) => r.status)).resolves.toBe(500);
  });

  it('réseau en échec → la copie', async () => {
    const res = await networkOrCopy(Promise.reject(new TypeError('Failed to fetch')), copy(), 4000);
    await expect(res.text()).resolves.toBe('copie');
  });

  it('réseau trop lent avec une copie → la copie au bout du délai, sans attendre le navigateur', async () => {
    vi.useFakeTimers();
    const p = networkOrCopy(later(60_000, new Response('trop tard')), copy(), 4000);
    await vi.advanceTimersByTimeAsync(4000);
    await expect(p.then((r) => r.text())).resolves.toBe('copie');
  });

  it('sans copie → attend le réseau, quel que soit le délai ; son échec passe', async () => {
    vi.useFakeTimers();
    const p = networkOrCopy(later(10_000, new Response('lent')), null, 4000);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(p.then((r) => r.text())).resolves.toBe('lent');
    vi.useRealTimers();
    await expect(networkOrCopy(Promise.reject(new TypeError('Failed to fetch')), null, 4000)).rejects.toThrow('Failed to fetch');
  });
});

describe('networkDeadlineFor (délai réseau limité aux ouvertures de page)', () => {
  it('navigation (ouverture d’une page, HTML) → délai de 4 s avant la copie', () => {
    expect(networkDeadlineFor({ mode: 'navigate' })).toBe(4000);
  });

  it.each(['cors', 'same-origin', 'no-cors'] as const)(
    'requête de données (%s, __data.json : rechargement après un geste) → aucun délai : réseau strict, copie seulement en échec',
    (mode) => {
      expect(networkDeadlineFor({ mode })).toBeNull();
    }
  );

  it('sans délai, un réseau lent n’est jamais remplacé par la copie ; seul l’échec la sert', async () => {
    vi.useFakeTimers();
    const slow = networkOrCopy(new Promise<Response>((r) => setTimeout(() => r(new Response('frais')), 30_000)), new Response('copie'), null);
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(slow.then((r) => r.text())).resolves.toBe('frais');
    vi.useRealTimers();
    const failed = await networkOrCopy(Promise.reject(new TypeError('Failed to fetch')), new Response('copie'), null);
    await expect(failed.text()).resolves.toBe('copie');
  });
});

describe('entriesToEvict', () => {
  const at = (path: string, storedAt: number | null) => ({ url: `${ORIGIN}${path}`, storedAt });
  const five = [1, 2, 3, 4, 5].map((n) => at(`/app/wines/${n}`, n));

  it('rien à supprimer sous le plafond', () => {
    expect(entriesToEvict(five, 5)).toEqual([]);
    expect(entriesToEvict(five, 10)).toEqual([]);
  });

  it('supprime les plus anciennes jusqu’au plafond', () => {
    expect(entriesToEvict([...five].reverse(), 3)).toEqual([`${ORIGIN}/app/wines/1`, `${ORIGIN}/app/wines/2`]);
  });

  it('garde l’ordre d’entrée à horodatage égal', () => {
    const same = [at('/app/wines/1', 7), at('/app/wines/2', 7), at('/app/wines/3', 7)];
    expect(entriesToEvict(same, 1)).toEqual([`${ORIGIN}/app/wines/1`, `${ORIGIN}/app/wines/2`]);
  });

  it('une entrée sans horodatage passe avant les autres', () => {
    expect(entriesToEvict([at('/app/wines/1', 1), at('/app/wines/2', null), at('/app/wines/3', 3)], 2)).toEqual([
      `${ORIGIN}/app/wines/2`
    ]);
  });

  it('ne supprime jamais /app ni /app/__data.json', () => {
    const entries = [at('/app', 1), at('/app/__data.json', 2), at('/app/wines/3', 3), at('/app/wines/4', 4), at('/app/wines/5', 5)];
    expect(entriesToEvict(entries, 3)).toEqual([`${ORIGIN}/app/wines/3`, `${ORIGIN}/app/wines/4`]);
  });

  it('s’arrête quand il ne reste que des entrées protégées', () => {
    expect(entriesToEvict([at('/app', null), at('/app/__data.json', null), at('/app/wines/1', 1)], 1)).toEqual([
      `${ORIGIN}/app/wines/1`
    ]);
  });

  it('/app?filtre est évinçable comme les autres', () => {
    const entries = [at('/app?color=red', 1), at('/app', 2), at('/app/cave', 3)];
    expect(entriesToEvict(entries, 2)).toEqual([`${ORIGIN}/app?color=red`]);
    const withData = [at('/app?color=red', 1), at('/app/__data.json?color=red', 1), at('/app', 2), at('/app/__data.json', 2)];
    expect(entriesToEvict(withData, 2)).toEqual([`${ORIGIN}/app?color=red`, `${ORIGIN}/app/__data.json?color=red`]);
  });

  it('le HTML et les données d’une fiche partent ensemble', () => {
    const entries = [at('/app/wines/1', 1), at('/app/wines/1/__data.json', 1), at('/app/wines/2', 2), at('/app/wines/2/__data.json', 2)];
    expect(entriesToEvict(entries, 2)).toEqual([`${ORIGIN}/app/wines/1`, `${ORIGIN}/app/wines/1/__data.json`]);
  });

  it('une fiche aux données récentes mais au HTML ancien est gardée entière', () => {
    const entries = [at('/app/wines/1', 1), at('/app/wines/2', 5), at('/app/wines/2/__data.json', 6), at('/app/wines/1/__data.json', 9)];
    expect(entriesToEvict(entries, 2)).toEqual([`${ORIGIN}/app/wines/2`, `${ORIGIN}/app/wines/2/__data.json`]);
  });
});

describe('parseStoredAt', () => {
  it('lit un nombre, sinon null', () => {
    expect(parseStoredAt('1234')).toBe(1234);
    expect(parseStoredAt(null)).toBeNull();
    expect(parseStoredAt(undefined)).toBeNull();
    expect(parseStoredAt('')).toBeNull();
    expect(parseStoredAt('abc')).toBeNull();
    expect(parseStoredAt('Infinity')).toBeNull();
  });
});

describe('stampedHeaders', () => {
  it('garde les en-têtes et ajoute x-apogee-stored-at', () => {
    const h = stampedHeaders({ 'content-type': 'application/json' }, 1234);
    expect(h.get('content-type')).toBe('application/json');
    expect(h.get(STORED_AT_HEADER)).toBe('1234');
    expect(STORED_AT_HEADER).toBe('x-apogee-stored-at');
  });
});

describe('trimPageCache', () => {
  class FakeCache {
    entries = new Map<string, Response>();
    put(key: string, res: Response) {
      this.entries.set(key, res);
    }
    async keys() {
      return [...this.entries.keys()].map((url) => new Request(url));
    }
    async match(req: Request, options?: CacheQueryOptions) {
      expect(options).toEqual({ ignoreVary: true });
      return this.entries.get(req.url);
    }
    async delete(req: Request) {
      return this.entries.delete(req.url);
    }
  }
  const stamp = (cache: FakeCache, path: string, now: number) =>
    cache.put(`${ORIGIN}${path}`, new Response('x', { headers: stampedHeaders({}, now) }));

  it('lit x-apogee-stored-at et supprime les plus anciennes', async () => {
    const cache = new FakeCache();
    stamp(cache, '/app/wines/3', 30);
    stamp(cache, '/app/wines/1', 10);
    stamp(cache, '/app/wines/2', 20);
    await trimPageCache(cache, 2);
    expect([...cache.entries.keys()]).toEqual([`${ORIGIN}/app/wines/3`, `${ORIGIN}/app/wines/2`]);
  });

  it('ne lit rien sous le plafond', async () => {
    const cache = new FakeCache();
    stamp(cache, '/app/wines/1', 10);
    const match = vi.spyOn(cache, 'match');
    await trimPageCache(cache, 2);
    expect(match).not.toHaveBeenCalled();
  });

  it('ne lève jamais', async () => {
    const broken = {
      keys: async () => {
        throw new Error('quota');
      },
      match: async () => undefined,
      delete: async () => false
    };
    await expect(trimPageCache(broken)).resolves.toBeUndefined();
  });

  it('Review Focus : après 200 fiches consultées, /app et /app/__data.json sont toujours là, 120 entrées au plus', async () => {
    const cache = new FakeCache();
    stamp(cache, '/app', 1);
    stamp(cache, '/app/__data.json', 2);
    for (let i = 1; i <= 200; i++) {
      stamp(cache, `/app/wines/${i}`, 100 + i);
      await trimPageCache(cache);
    }
    const urls = [...cache.entries.keys()];
    expect(urls.length).toBe(MAX_PAGE_ENTRIES);
    expect(urls).toContain(`${ORIGIN}/app`);
    expect(urls).toContain(`${ORIGIN}/app/__data.json`);
    expect(urls).toContain(`${ORIGIN}/app/wines/200`);
    expect(urls).not.toContain(`${ORIGIN}/app/wines/1`);
  });
});
