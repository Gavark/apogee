<script lang="ts">
  import { page } from '$app/state';
  import CloudArrowUp from 'phosphor-svelte/lib/CloudArrowUp';
  import * as m from '$paraglide/messages';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import { pendingCount, startSyncLoop } from '$lib/offline/pending.svelte';
  import { becomeActiveUser } from '$lib/offline/session';

  let { children } = $props();

  const userId = $derived(page.data.user?.id);
  // Tells the service worker whose queue to sync; another account's cached pages are dropped first.
  $effect(() => {
    if (typeof userId === 'number') void becomeActiveUser(userId).catch(() => {});
  });
  // Sends the gestures recorded offline as soon as the network allows.
  $effect(() => {
    if (typeof userId === 'number') return startSyncLoop(userId);
  });
  const waiting = $derived(pendingCount());
</script>

{#if waiting > 0}
  <p class="pending" role="status">
    <CloudArrowUp size={16} aria-hidden="true" />{m.offline_pending({ count: waiting })}
  </p>
{/if}

{@render children()}

<BottomNav />

<style>
  .pending {
    display: flex;
    align-items: center;
    gap: var(--s-1);
    margin: 0 0 var(--s-3);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
  }
</style>
