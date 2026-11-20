<script lang="ts">
  import Wine from 'phosphor-svelte/lib/Wine';
  import CaretDown from 'phosphor-svelte/lib/CaretDown';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import PhaseBadge from '$lib/components/PhaseBadge.svelte';
  import WineRow from '$lib/components/WineRow.svelte';
  import AiEstimateSheet from '$lib/components/AiEstimateSheet.svelte';
  import type { CellarRow } from '$lib/server/wines';

  let { data } = $props();

  // The wine being estimated; read from the live data so a refresh after applying moves the row.
  let estimating = $state<CellarRow | null>(null);
  const estimate = $derived(data.aiEnabled ? (row: CellarRow) => (estimating = row) : undefined);
</script>

<svelte:head><title>{m.home_title()}</title></svelte:head>

<header class="head">
  <h1>{m.home_title()}</h1>
  <p class="muted">{m.home_total({ count: data.total })}</p>
</header>

{#if data.sections.length === 0}
  <EmptyState title={m.home_empty_title()} description={m.home_empty_desc()} icon={Wine}>
    <Button href="/app/add">{m.home_empty_action()}</Button>
  </EmptyState>
{:else}
  <div class="sections">
    {#each data.sections as section (section.phase)}
      {#if section.phase === 'too_young'}
        <!-- Not urgent: collapsed by default, the rows show their opening year. -->
        <details class="section">
          <summary>
            <PhaseBadge phase={section.phase} />
            <span class="count">{section.rows.length}</span>
            <CaretDown class="caret" size={18} aria-hidden="true" />
          </summary>
          <ul class="rows">
            {#each section.rows as row (row.wine.id)}<WineRow {row} onestimate={estimate} />{/each}
          </ul>
        </details>
      {:else}
        <section class="section">
          <h2 class="section-head">
            <PhaseBadge phase={section.phase} />
            <span class="count">{section.rows.length}</span>
          </h2>
          <ul class="rows">
            {#each section.rows as row (row.wine.id)}<WineRow {row} onestimate={estimate} />{/each}
          </ul>
        </section>
      {/if}
    {/each}
  </div>
{/if}

{#if estimating}
  <AiEstimateSheet
    open
    onclose={() => (estimating = null)}
    wineId={estimating.wine.id}
    current={{
      drinkFrom: estimating.wine.drinkFrom,
      peakFrom: estimating.wine.peakFrom,
      peakTo: estimating.wine.peakTo,
      drinkUntil: estimating.wine.drinkUntil
    }}
    currentYear={data.year}
  />
{/if}

<style>
  .head { margin-bottom: var(--s-4); }
  h1 { margin: 0; }
  .muted { margin: 0; color: var(--c-text-muted); }
  .sections { display: grid; gap: var(--s-5); }
  .section-head, summary {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    margin: 0 0 var(--s-2);
    font-size: var(--fs-base);
  }
  summary { cursor: pointer; list-style: none; min-height: var(--tap); }
  summary::-webkit-details-marker { display: none; }
  summary :global(.caret) { margin-left: auto; color: var(--c-text-muted); transition: transform var(--dur-base); }
  details[open] summary :global(.caret) { transform: rotate(180deg); }
  .count { color: var(--c-text-muted); font-weight: var(--fw-semibold); }
  .rows { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-2); }
</style>
