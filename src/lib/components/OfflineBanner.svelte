<script lang="ts">
  import { afterNavigate, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import CloudSlash from 'phosphor-svelte/lib/CloudSlash';
  import * as m from '$paraglide/messages';
  import { formatShortDateTime } from '$lib/format';
  import { lastOnlineLoad, network, probeServer, recordOnlineLoad } from '$lib/offline/online.svelte';
  import { isOfflineReadable } from '$lib/offline/page-cache';

  type Props = { userId: number | undefined; locale: string };
  let { userId, locale }: Props = $props();

  /**
   * The page on screen was served by the service worker's copy, not the server. The page cannot
   * see that from its data, so after each navigation to a cached page it asks the server directly
   * (/healthz, never cached): if the page loaded but the server cannot be reached, it came from the
   * copy. Any other page loaded only through the network.
   */
  let fromCache = $state(false);
  /** Last load from the server for this user (ms), shown as the date of the data. */
  let since = $state<number | null>(null);
  let check = 0;

  async function reachedServer(url: { origin: string; pathname: string }): Promise<boolean> {
    if (!navigator.onLine) return false;
    // No controlling service worker, or a page it never caches: the server answered.
    if (!navigator.serviceWorker?.controller || !isOfflineReadable(url, location.origin)) return true;
    return probeServer();
  }

  async function assess(): Promise<void> {
    const id = ++check;
    const uid = userId;
    if (page.error) return; // a failed load tells nothing about where the data came from
    const online = await reachedServer(page.url);
    if (id !== check) return; // a newer navigation decides
    fromCache = !online;
    if (online && uid !== undefined) recordOnlineLoad(uid, Date.now());
    since = uid === undefined ? null : lastOnlineLoad(uid);
  }

  afterNavigate(() => void assess());

  // Back online with cached data on screen: reload it from the server.
  let refreshing = false;
  $effect(() => {
    if (!network.online || !fromCache || refreshing) return;
    refreshing = true;
    void probeServer()
      .then(async (ok) => {
        if (!ok) return;
        await invalidateAll();
        await assess();
      })
      .catch(() => {})
      .finally(() => (refreshing = false));
  });

  const shown = $derived(!network.online || fromCache);
  const label = $derived(
    since === null ? m.offline_banner() : m.offline_banner_since({ date: formatShortDateTime(Math.floor(since / 1000), locale) })
  );
</script>

{#if shown}
  <p class="offline" role="status">
    <CloudSlash size={16} aria-hidden="true" />{label}
  </p>
{/if}

<style>
  .offline {
    display: flex;
    align-items: center;
    gap: var(--s-1);
    max-width: var(--page-max);
    margin: 0 auto var(--s-3);
    padding: var(--s-2) var(--s-3);
    border-radius: var(--r-control);
    background: var(--c-bg-sunken);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
  }
</style>
