<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Wine from 'phosphor-svelte/lib/Wine';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import { newOpId, sendStockOps } from '$lib/stock-client';
  import { showToast } from '$lib/toast.svelte';
  import { wineTitle } from '$lib/wine-labels';
  import type { CellarLot, CellarRow } from '$lib/server/wines';

  type Props = {
    row: CellarRow;
    block?: boolean;
    /** +1 when a consumption is sent, -1 once it settled and the data was reloaded (optimistic count). */
    onpending?: (delta: 1 | -1) => void;
  };

  let { row, block = false, onpending }: Props = $props();

  const lots = $derived(row.lots.filter((l) => l.quantity > 0));
  let picking = $state(false);
  let busy = $state(false);

  /** Local calendar date, not UTC: a bottle opened at 00:30 belongs to today. */
  function today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Uses no component state: the toast's undo outlives this button
  // (a finished wine leaves the list, and the button with it).
  async function undo(consumptionId: number) {
    try {
      const [r] = await sendStockOps([{ opId: newOpId(), kind: 'unconsume', consumptionId }]);
      showToast(r.status === 'applied' ? m.wine_toast_undone() : m.wine_err_op());
    } catch {
      showToast(m.wine_err_network());
    } finally {
      await invalidateAll();
    }
  }

  async function drink(lot: CellarLot) {
    // `busy` is set synchronously: a double tap sends one operation.
    if (busy) return;
    busy = true;
    picking = false;
    onpending?.(1);
    try {
      const [r] = await sendStockOps([{ opId: newOpId(), kind: 'consume', lotId: lot.lotId, consumedOn: today() }]);
      if (r.status === 'applied' && r.consumptionId !== undefined) {
        const consumptionId = r.consumptionId;
        showToast(m.drink_toast({ wine: wineTitle(row.wine) }), {
          label: m.wine_toast_undo(),
          run: () => void undo(consumptionId)
        });
      } else if (r.status === 'rejected') {
        showToast(r.reason === 'empty_lot' ? m.drink_empty_lot() : m.wine_err_op());
      }
    } catch {
      showToast(m.wine_err_network());
    } finally {
      await invalidateAll();
      onpending?.(-1);
      busy = false;
    }
  }

  const onclick = () => (lots.length === 1 ? drink(lots[0]) : (picking = true));
</script>

<Button {block} size={block ? 'md' : 'sm'} disabled={busy || lots.length === 0} {onclick}>
  <Wine size={block ? 20 : 18} aria-hidden="true" />{m.wine_drink()}
</Button>

<Sheet open={picking} onclose={() => (picking = false)} title={m.wine_drink_which()}>
  <ul class="pick">
    {#each lots as lot (lot.lotId)}
      <li>
        <Button variant="secondary" block disabled={busy} onclick={() => drink(lot)}>
          {lot.locationName}{lot.position ? ` · ${lot.position}` : ''} ({lot.quantity})
        </Button>
      </li>
    {/each}
  </ul>
</Sheet>

<style>
  .pick { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-2); }
</style>
