<script lang="ts">
  import * as m from '$paraglide/messages';
  import DrinkButton from '$lib/components/DrinkButton.svelte';
  import { colorLabel, wineTitle } from '$lib/wine-labels';
  import type { CellarRow } from '$lib/server/wines';

  /** `onestimate` adds the "estimate with AI" button to wines without a window. */
  let { row, onestimate }: { row: CellarRow; onestimate?: (row: CellarRow) => void } = $props();

  // `row` comes with the pending gestures applied (optimistic overlay).
  const wine = $derived(row.wine);

  const where = $derived(
    row.lots
      .filter((l) => l.quantity > 0)
      .map((l) => (l.position ? `${l.locationName} · ${l.position}` : l.locationName))
      .join(', ')
  );
  const meta = $derived(
    [wine.vintage ?? m.wine_nv(), colorLabel(wine.color), m.wine_bottle_count({ count: row.bottles })]
      .filter((x) => x !== null && x !== '')
      .join(' · ')
  );
  const windowText = $derived(
    row.phase === 'too_young' && wine.drinkFrom !== null
      ? m.home_opens({ year: wine.drinkFrom })
      : wine.drinkUntil !== null
        ? m.home_until({ year: wine.drinkUntil })
        : null
  );
</script>

<li class="row">
  <a class="main" href="/app/wines/{wine.id}">
    <strong class="name">{wineTitle(wine)}</strong>
    {#if wine.appellation}<span class="appellation">{wine.appellation}</span>{/if}
    <span class="meta">{meta}</span>
    {#if where}<span class="meta">{where}</span>{/if}
    {#if windowText}<span class="window">{windowText}</span>{/if}
  </a>
  {#if row.phase === 'unknown'}
    <div class="set-window">
      <a href="/app/wines/{wine.id}/edit">{m.home_set_window()}</a>
      {#if onestimate}<button type="button" onclick={() => onestimate(row)}>{m.wine_ai_estimate()}</button>{/if}
    </div>
  {/if}
  {#if row.bottles > 0}
    <div class="drink"><DrinkButton {row} /></div>
  {/if}
</li>

<style>
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: var(--s-1) var(--s-3);
    padding: var(--s-3) var(--s-4);
    border: 1px solid var(--c-border);
    border-radius: var(--r-card);
    background: var(--c-bg-card);
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    color: inherit;
    text-decoration: none;
    /* The whole text block is the tap target to the detail page. */
    min-height: var(--tap);
  }
  .name { overflow-wrap: anywhere; font-weight: var(--fw-semibold); }
  .appellation { font-size: var(--fs-sm); overflow-wrap: anywhere; }
  .meta { color: var(--c-text-muted); font-size: var(--fs-sm); overflow-wrap: anywhere; }
  .window { font-size: var(--fs-sm); font-weight: var(--fw-medium); }
  .drink { grid-column: 2; grid-row: 1; }
  .set-window {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--s-4);
  }
  .set-window a,
  .set-window button {
    min-height: var(--tap);
    display: inline-flex;
    align-items: center;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    cursor: pointer;
    color: var(--c-accent);
    font-size: var(--fs-sm);
    font-weight: var(--fw-semibold);
  }
</style>
