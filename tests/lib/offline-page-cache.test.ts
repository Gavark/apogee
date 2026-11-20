import { describe, expect, it } from 'vitest';
import {
  cacheKeyFor,
  dataBodyToServe,
  dataBodyToStore,
  isOfflineReadable,
  isStorable,
  offlineRedirectFor
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
