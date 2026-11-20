<script lang="ts">
  import Minus from 'phosphor-svelte/lib/Minus';
  import Plus from 'phosphor-svelte/lib/Plus';
  import ArrowsLeftRight from 'phosphor-svelte/lib/ArrowsLeftRight';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import type { CellarLot } from '$lib/server/wines';

  type Props = {
    lots: CellarLot[];
    busy?: boolean;
    onadjust: (lot: CellarLot, delta: 1 | -1) => void;
    onmove: (lot: CellarLot) => void;
  };

  let { lots, busy = false, onadjust, onmove }: Props = $props();
</script>

<ul class="lots">
  {#each lots as lot (lot.lotId)}
    <li class="lot">
      <div class="where">
        <strong>{lot.locationName}</strong>
        {#if lot.position}<span class="muted">{lot.position}</span>{/if}
      </div>
      <div class="controls">
        <Button variant="secondary" size="sm" disabled={busy} aria-label={m.wine_lot_dec()} onclick={() => onadjust(lot, -1)}>
          <Minus size={18} weight="bold" aria-hidden="true" />
        </Button>
        <span class="qty" aria-live="polite">{lot.quantity}</span>
        <Button variant="secondary" size="sm" disabled={busy} aria-label={m.wine_lot_inc()} onclick={() => onadjust(lot, 1)}>
          <Plus size={18} weight="bold" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} aria-label={m.wine_lot_move()} onclick={() => onmove(lot)}>
          <ArrowsLeftRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </li>
  {/each}
</ul>

<style>
  .lots { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-2); }
  .lot { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); }
  .where { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
  .muted { color: var(--c-text-muted); font-size: var(--fs-sm); }
  .controls { display: flex; align-items: center; gap: var(--s-1); flex: none; }
  .qty { min-width: 2ch; text-align: center; font-weight: var(--fw-semibold); font-variant-numeric: tabular-nums; }
</style>
