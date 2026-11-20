<script lang="ts">
  import Wine from 'phosphor-svelte/lib/Wine';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import PhaseBadge from '$lib/components/PhaseBadge.svelte';
  import WindowTimeline from '$lib/components/WindowTimeline.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Field from '$lib/components/Field.svelte';
  import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { showToast } from '$lib/toast.svelte';

  let { data } = $props();

  const year = new Date().getFullYear();
  // Sample cellar data (what the database will hold), not UI copy.
  const sampleWine = 'Chinon 2016';
  const sampleLots = ['Cave, casier 3', 'Cave électrique, étagère 2'];

  const phases = ['unknown', 'too_young', 'ready', 'peak', 'last_call', 'past'] as const;

  const swatches = [
    'c-bg-app', 'c-bg-card', 'c-bg-sunken', 'c-border', 'c-text', 'c-text-muted',
    'c-accent', 'c-danger', 'c-phase-too-young-mark', 'c-phase-ready-mark',
    'c-phase-peak-mark', 'c-phase-last-call-mark'
  ];

  const timelines = [
    { caption: m.dev_sg_tl_peak, w: { drinkFrom: year - 4, peakFrom: year - 1, peakTo: year + 4, drinkUntil: year + 8 } },
    { caption: m.dev_sg_tl_nopeak, w: { drinkFrom: year - 6, peakFrom: null, peakTo: null, drinkUntil: year } },
    { caption: m.dev_sg_tl_young, w: { drinkFrom: year + 3, peakFrom: year + 6, peakTo: year + 12, drinkUntil: year + 20 } },
    { caption: m.dev_sg_tl_past, w: { drinkFrom: year - 12, peakFrom: year - 8, peakTo: year - 5, drinkUntil: year - 2 } },
    { caption: m.dev_sg_tl_unknown, w: { drinkFrom: null, peakFrom: null, peakTo: null, drinkUntil: null } }
  ];

  let vintage = $state(String(year + 3));
  let sheetOpen = $state(false);
</script>

<svelte:head><title>{m.dev_sg_title()}</title></svelte:head>

<div class="sg">
  <header>
    <h1>{m.dev_sg_title()}</h1>
    <p class="muted">{m.dev_sg_intro()}</p>
  </header>

  <section>
    <h2>{m.dev_sg_typography()}</h2>
    <h1>{m.dev_sg_type_page()}</h1>
    <h2>{m.dev_sg_type_section()}</h2>
    <h3>{sampleWine}</h3>
    <p>{m.dev_sg_type_body()}</p>
    <p class="muted">{m.dev_sg_type_muted()}</p>
  </section>

  <section>
    <h2>{m.dev_sg_colors()}</h2>
    <ul class="swatches">
      {#each swatches as s (s)}
        <li><span class="chip" style:background="var(--{s})"></span><code>--{s}</code></li>
      {/each}
    </ul>
  </section>

  <section>
    <h2>{m.dev_sg_buttons()}</h2>
    <div class="row">
      <Button>{m.dev_sg_btn_primary()}</Button>
      <Button variant="secondary">{m.dev_sg_btn_secondary()}</Button>
      <Button variant="ghost">{m.dev_sg_btn_ghost()}</Button>
      <Button variant="danger">{m.dev_sg_btn_danger()}</Button>
      <Button size="sm">{m.dev_sg_btn_small()}</Button>
      <Button disabled>{m.dev_sg_btn_disabled()}</Button>
    </div>
    <Button block>{m.dev_sg_btn_primary()}</Button>
  </section>

  <section>
    <h2>{m.dev_sg_cards()}</h2>
    <Card class="wine-row">
      <div class="wine-main">
        <h3>{sampleWine}</h3>
        <p class="muted">{m.dev_sg_type_muted()}</p>
        <p class="meta">{m.dev_sg_card_count({ count: 2 })}, {m.dev_sg_card_until({ year })}</p>
      </div>
      <div class="wine-side">
        <PhaseBadge phase="last_call" />
        <Button size="sm" variant="secondary">{m.dev_sg_btn_small()}</Button>
      </div>
    </Card>
  </section>

  <section>
    <h2>{m.dev_sg_badges()}</h2>
    <div class="row">
      {#each phases as p (p)}<PhaseBadge phase={p} />{/each}
    </div>
  </section>

  <section>
    <h2>{m.dev_sg_timeline()}</h2>
    <div class="stack">
      {#each timelines as t (t.caption)}
        <Card>
          <h3 class="tl-caption">{t.caption()}</h3>
          <WindowTimeline {...t.w} currentYear={year} />
        </Card>
      {/each}
    </div>
  </section>

  <section>
    <h2>{m.dev_sg_fields()}</h2>
    <div class="stack">
      <Field label={m.dev_sg_field_name()} hint={m.dev_sg_field_name_hint()} name="name" value={sampleWine} />
      <Field
        label={m.dev_sg_field_vintage()}
        name="vintage"
        inputmode="numeric"
        bind:value={vintage}
        error={m.dev_sg_field_vintage_error({ max: year })}
      />
      <Field label={m.dev_sg_field_color()}>
        {#snippet children(control)}
          <select {...control} name="color">
            <option>{m.dev_sg_color_red()}</option>
            <option>{m.dev_sg_color_white()}</option>
            <option>{m.dev_sg_color_rose()}</option>
            <option>{m.dev_sg_color_sparkling()}</option>
          </select>
        {/snippet}
      </Field>
    </div>
  </section>

  <section>
    <h2>{m.dev_sg_empty()}</h2>
    <EmptyState icon={Wine} title={m.dev_sg_empty_title()} description={m.dev_sg_empty_body()}>
      <Button href="/app/add">{m.dev_sg_empty_action()}</Button>
    </EmptyState>
  </section>

  <section>
    <h2>{m.dev_sg_feedback()}</h2>
    <div class="row">
      <Button variant="secondary" onclick={() => showToast(m.dev_sg_toast_simple_msg())}>
        {m.dev_sg_toast_simple()}
      </Button>
      <Button
        variant="secondary"
        onclick={() =>
          showToast(m.dev_sg_toast_action_msg({ wine: sampleWine }), {
            label: m.toast_undo(),
            run: () => showToast(m.dev_sg_toast_undone())
          })}
      >
        {m.dev_sg_toast_action()}
      </Button>
      <Button variant="secondary" onclick={() => (sheetOpen = true)}>{m.dev_sg_sheet_open()}</Button>
    </div>
    <Sheet open={sheetOpen} onclose={() => (sheetOpen = false)} title={m.dev_sg_sheet_title()}>
      <p>{m.dev_sg_sheet_body()}</p>
      <div class="stack">
        {#each sampleLots as lot (lot)}
          <Button block variant="secondary" onclick={() => (sheetOpen = false)}>{lot}</Button>
        {/each}
      </div>
    </Sheet>
  </section>

  <section>
    <h2>{m.dev_sg_prefs()}</h2>
    <div class="row">
      <LocaleSwitcher current={data.locale} />
      <ThemeToggle initial={data.theme} />
    </div>
  </section>

  <section>
    <h2>{m.dev_sg_nav()}</h2>
    <p class="muted">{m.dev_sg_nav_note()}</p>
  </section>
</div>

<BottomNav />

<style>
  .sg {
    display: flex;
    flex-direction: column;
    gap: var(--s-8);
  }
  section > h2:first-child {
    padding-bottom: var(--s-2);
    border-bottom: 1px solid var(--c-border);
    margin-bottom: var(--s-4);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
    margin-bottom: var(--s-3);
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--s-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .swatches li {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    min-width: 0;
    font-size: var(--fs-xs);
  }
  .swatches code { overflow-wrap: anywhere; }
  .chip {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: var(--r-control);
    border: 1px solid var(--c-border);
  }

  :global(.wine-row) {
    display: flex;
    justify-content: space-between;
    gap: var(--s-3);
  }
  .wine-main { min-width: 0; }
  .wine-main h3 { margin-bottom: var(--s-1); }
  .wine-main p { margin: 0; }
  .meta { font-size: var(--fs-sm); margin-top: var(--s-2) !important; }
  .wine-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--s-3);
  }

  .tl-caption {
    font-size: var(--fs-sm);
    margin-bottom: var(--s-3);
  }
</style>
