<script lang="ts">
  import Wine from 'phosphor-svelte/lib/Wine';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import { reload } from '$lib/offline/pending.svelte';
  import { newOpId, sendStockOps, SessionExpiredError, undoGesture } from '$lib/stock-client';
  import { showToast } from '$lib/toast.svelte';
  import { wineTitle } from '$lib/wine-labels';
  import type { CellarLot, CellarRow } from '$lib/server/wines';
  import type { StockOp } from '$lib/server/stock';

  // `row` comes with the pending gestures applied (optimistic overlay): the count drops at once.
  type Props = { row: CellarRow; block?: boolean };

  let { row, block = false }: Props = $props();

  const lots = $derived(row.lots.filter((l) => l.quantity > 0));
  let picking = $state(false);
  let busy = $state(false);

  /** Local calendar date, not UTC: a bottle opened at 00:30 belongs to today. */
  function today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function drink(lot: CellarLot) {
    // `busy` is set synchronously: a double tap while a send is in flight sends one operation.
    if (busy) return;
    busy = true;
    picking = false;
    const op: StockOp = { opId: newOpId(), kind: 'consume', lotId: lot.lotId, consumedOn: today() };
    let queued = false;
    try {
      const [r] = await sendStockOps([op]);
      // The undo uses no component state: the toast outlives this button
      // (a finished wine leaves the list, and the button with it).
      const undo = { label: m.wine_toast_undo(), run: () => void undoGesture(op) };
      if (r.status === 'queued') {
        queued = true;
        showToast(m.offline_saved(), undo);
      } else if (r.status === 'applied' && r.consumptionId !== undefined) {
        showToast(m.drink_toast({ wine: wineTitle(row.wine) }), undo);
      } else if (r.status === 'rejected') {
        showToast(r.reason === 'empty_lot' ? m.drink_empty_lot() : m.wine_err_op());
      }
    } catch (e) {
      if (!(e instanceof SessionExpiredError)) showToast(m.wine_err_network());
    } finally {
      // Queued: nothing changed on the server yet, the overlay already shows it.
      if (!queued) await reload();
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
