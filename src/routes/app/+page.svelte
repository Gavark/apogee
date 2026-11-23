<script lang="ts">
  import Wine from 'phosphor-svelte/lib/Wine';
  import CaretDown from 'phosphor-svelte/lib/CaretDown';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import PhaseBadge from '$lib/components/PhaseBadge.svelte';
  import WineRow from '$lib/components/WineRow.svelte';
  import AiEstimateSheet from '$lib/components/AiEstimateSheet.svelte';
  import { applyPending } from '$lib/offline/overlay';
  import { pendingOps } from '$lib/offline/pending.svelte';
  import type { CellarRow } from '$lib/server/wines';
  import type { Phase } from '$lib/phase';
  import { activePhase, visibleSections } from '$lib/home-filter';

  let { data } = $props();

  // Pending gestures (queued offline, or applied and not reloaded yet) show at once.
  const sections = $derived.by(() => {
    const ops = pendingOps();
    if (ops.length === 0) return data.sections;
    return data.sections.map((s) => ({ ...s, rows: s.rows.map((r) => applyPending(r, ops)) }));
  });
  const total = $derived(sections.reduce((n, s) => n + s.rows.reduce((k, r) => k + r.bottles, 0), 0));

  // Phase filter: client-side only, applied on the sections above (pending gestures included).
  let selected = $state<Phase | null>(null);
  const active = $derived(activePhase(sections, selected));
  const shown = $derived(visibleSections(sections, active));
  const shownBottles = $derived(shown.reduce((n, s) => n + s.rows.reduce((k, r) => k + r.bottles, 0), 0));
  const toggle = (phase: Phase) => (selected = active === phase ? null : phase);

  // The wine being estimated (a snapshot of its row: the sheet only needs its id and current window).
  let estimating = $state<CellarRow | null>(null);
  const estimate = $derived(data.aiEnabled ? (row: CellarRow) => (estimating = row) : undefined);
</script>

<svelte:head><title>{m.home_title()}</title></svelte:head>

<header class="head">
  <h1>{m.home_title()}</h1>
  <p class="muted">
    {active === null ? m.home_total({ count: total }) : m.home_total_filtered({ count: shownBottles, total })}
  </p>
</header>

{#if sections.length === 0}
  <EmptyState title={m.home_empty_title()} description={m.home_empty_desc()} icon={Wine}>
    <Button href="/app/add">{m.home_empty_action()}</Button>
  </EmptyState>
{:else}
  {#if sections.length > 1}
    <div class="chips" role="group" aria-label={m.home_filter_label()}>
      <button type="button" class="chip" class:on={active === null} aria-pressed={active === null} onclick={() => (selected = null)}>
        {m.home_filter_all()}
      </button>
      {#each sections as section (section.phase)}
        <button type="button" class="chip" class:on={active === section.phase} aria-pressed={active === section.phase} onclick={() => toggle(section.phase)}>
          <PhaseBadge phase={section.phase} />
          <span class="count">{section.rows.length}</span>
        </button>
      {/each}
    </div>
  {/if}
  <div class="sections">
    {#each shown as section (section.phase)}
      {#if section.phase === 'too_young' && active === null}
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
  .chips {
    display: flex;
    gap: var(--s-2);
    margin-bottom: var(--s-4);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar { display: none; }
  .chip {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    min-height: var(--tap);
    padding: 0 var(--s-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-card);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .chip.on { border-color: var(--c-accent); box-shadow: inset 0 0 0 1px var(--c-accent); }
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
