<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Rows from 'phosphor-svelte/lib/Rows';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Field from '$lib/components/Field.svelte';
  import WineRow from '$lib/components/WineRow.svelte';
  import { COLOR_OPTIONS } from '$lib/wine-labels';
  import { HOME_SECTION_ORDER, type Phase } from '$lib/phase';

  let { data } = $props();

  const PHASE_LABELS: Record<Phase, () => string> = {
    unknown: m.phase_unknown,
    too_young: m.phase_too_young,
    ready: m.phase_ready,
    peak: m.phase_peak,
    last_call: m.phase_last_call,
    past: m.phase_past
  };

  let q = $state('');
  $effect(() => {
    q = data.filter.q ?? '';
  });

  /** Rewrites the URL query: the URL is the single source of truth for the filters. */
  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(page.url.search);
    if (value) params.set(key, value);
    else params.delete(key);
    goto(`?${params}`, { replace: true, reset: false });
  }

  const onChange = (key: string) => (e: Event) => setParam(key, (e.currentTarget as HTMLSelectElement).value || null);
  const hasFilter = $derived(Object.keys(data.filter).length > 0);
</script>

<svelte:head><title>{m.cave_title()}</title></svelte:head>

<header class="head">
  <h1>{m.cave_title()}</h1>
  <p class="muted">{m.wine_bottle_count({ count: data.total })}</p>
</header>

<form
  class="filters"
  role="search"
  onsubmit={(e) => {
    e.preventDefault();
    setParam('q', q.trim() || null);
  }}
>
  <Field label={m.cave_search()} type="search" bind:value={q} autocomplete="off" enterkeyhint="search" />
  <div class="selects">
    <Field label={m.cave_filter_location()}>
      {#snippet children(control)}
        <select {...control} value={String(data.filter.locationId ?? '')} onchange={onChange('location')}>
          <option value="">{m.cave_filter_all()}</option>
          {#each data.locations as loc (loc.id)}<option value={String(loc.id)}>{loc.name}</option>{/each}
        </select>
      {/snippet}
    </Field>
    <Field label={m.cave_filter_color()}>
      {#snippet children(control)}
        <select {...control} value={data.filter.color ?? ''} onchange={onChange('color')}>
          <option value="">{m.cave_filter_all()}</option>
          {#each COLOR_OPTIONS as o (o.value)}<option value={o.value}>{o.label()}</option>{/each}
        </select>
      {/snippet}
    </Field>
    <Field label={m.cave_filter_phase()}>
      {#snippet children(control)}
        <select {...control} value={data.filter.phase ?? ''} onchange={onChange('phase')}>
          <option value="">{m.cave_filter_all()}</option>
          {#each HOME_SECTION_ORDER as p (p)}<option value={p}>{PHASE_LABELS[p]()}</option>{/each}
        </select>
      {/snippet}
    </Field>
  </div>
  <label class="check">
    <input
      type="checkbox"
      checked={data.filter.finished === true}
      onchange={(e) => setParam('finished', e.currentTarget.checked ? '1' : null)}
    />
    {m.cave_filter_finished()}
  </label>
</form>

{#if data.rows.length === 0}
  <EmptyState
    title={m.cave_empty_title()}
    description={data.filter.finished && !data.filter.q ? m.cave_empty_finished() : m.cave_empty_desc()}
    icon={Rows}
  >
    {#if hasFilter}<Button variant="secondary" href="/app/cave">{m.cave_reset()}</Button>{/if}
  </EmptyState>
{:else}
  <ul class="rows">
    {#each data.rows as row (row.wine.id)}<WineRow {row} />{/each}
  </ul>
{/if}

<style>
  .head { margin-bottom: var(--s-3); }
  h1 { margin: 0; }
  .muted { margin: 0; color: var(--c-text-muted); }
  .filters { display: grid; gap: var(--s-3); margin-bottom: var(--s-4); }
  .selects { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--s-3); }
  .check { display: inline-flex; align-items: center; gap: var(--s-2); min-height: var(--tap); }
  .check input { width: 20px; height: 20px; accent-color: var(--c-accent); }
  .rows { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-2); }
</style>
