<script lang="ts">
  import * as m from '$paraglide/messages';
  import { getLocale } from '$paraglide/runtime';
  import Button from '$lib/components/Button.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import { abandonQuarantined, quarantinedItems, retryQuarantined } from '$lib/offline/pending.svelte';
  import { showToast } from '$lib/toast.svelte';

  let { userId }: { userId: number } = $props();

  const items = $derived(quarantinedItems());
  // opId of the row an action is running on, and of the row awaiting abandon confirmation.
  let busy = $state<string | null>(null);
  let confirming = $state<string | null>(null);

  const kinds = {
    consume: () => m.quarantine_kind_consume(),
    adjust: () => m.quarantine_kind_adjust(),
    move: () => m.quarantine_kind_move(),
    unconsume: () => m.quarantine_kind_unconsume(),
    review: () => m.quarantine_kind_review()
  };

  function when(ms: number): string {
    return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ms));
  }

  // The state module toasts the expected outcomes; anything unexpected (IndexedDB, reload) lands here.
  async function run(opId: string, action: (userId: number, opId: string) => Promise<void>) {
    if (busy) return;
    busy = opId;
    try {
      await action(userId, opId);
    } catch {
      showToast(m.wine_err_network());
    } finally {
      busy = null;
    }
  }

  async function abandon() {
    const opId = confirming;
    confirming = null;
    if (opId) await run(opId, abandonQuarantined);
  }
</script>

{#if items.length > 0}
  <section class="quarantine" role="status">
    <h2>{m.quarantine_title({ count: items.length })}</h2>
    <ul>
      {#each items as item (item.row.op.opId)}
        {@const opId = item.row.op.opId}
        <li>
          <p class="what">
            <span class="kind">{kinds[item.row.op.kind]()}</span>
            <span class="when">{when(item.row.queuedAt)}</span>
            {#if item.held.length > 0}<span class="when">{m.quarantine_with_review()}</span>{/if}
          </p>
          <div class="actions">
            <Button size="sm" variant="secondary" disabled={busy === opId} onclick={() => run(opId, retryQuarantined)}>
              {m.quarantine_retry()}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy === opId} onclick={() => (confirming = opId)}>
              {m.quarantine_abandon()}
            </Button>
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<Sheet open={confirming !== null} onclose={() => (confirming = null)} title={m.quarantine_abandon_title()}>
  <p class="body">{m.quarantine_abandon_body()}</p>
  <div class="confirm">
    <Button variant="danger" block onclick={abandon}>{m.quarantine_abandon()}</Button>
    <Button variant="secondary" block onclick={() => (confirming = null)}>{m.quarantine_keep()}</Button>
  </div>
</Sheet>

<style>
  .quarantine {
    margin: 0 0 var(--s-3);
    padding: var(--s-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-card);
    background: var(--c-bg-sunken);
  }
  h2 {
    margin: 0 0 var(--s-2);
    font-size: var(--fs-sm);
    color: var(--c-danger);
  }
  ul {
    display: grid;
    gap: var(--s-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-2);
  }
  .what {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--s-2);
    margin: 0;
    min-width: 0;
    font-size: var(--fs-xs);
  }
  .kind {
    font-weight: var(--fw-medium);
  }
  .when {
    color: var(--c-text-muted);
  }
  .actions {
    display: flex;
    gap: var(--s-1);
  }
  .body {
    margin: 0 0 var(--s-4);
    color: var(--c-text-muted);
  }
  .confirm {
    display: grid;
    gap: var(--s-2);
  }
</style>
