<script lang="ts">
  import * as m from '$paraglide/messages';
  import Field from '$lib/components/Field.svelte';
  import { COLOR_OPTIONS, FORMAT_OPTIONS } from '$lib/wine-labels';
  import type { WindowYears } from '$lib/phase';
  import type { AiConfidence } from '$lib/server/ai/types';

  type Props = {
    /** Initial field values by form field name (strings, as typed). */
    values?: Record<string, string>;
    /** One validation error, shown under its field. */
    error?: { field: string; message: string } | null;
    /** Window proposed by the AI: a reminder shows under the window until the user changes a year. */
    aiWindow?: WindowYears | null;
    aiConfidence?: AiConfidence | null;
    aiRationale?: string | null;
  };

  let { values = {}, error = null, aiWindow = null, aiConfidence = null, aiRationale = null }: Props = $props();

  const v = (name: string) => values[name] ?? '';
  const err = (name: string) => (error?.field === name ? error.message : null);

  // The entry year only matters for a wine without a vintage.
  // A type=number input binds a number (null when empty), not the typed string.
  let vintage = $state<string | number | null>(v('vintage'));
  // The window fields are tracked only to know whether they still match the AI's proposal.
  let win = $state<Record<keyof WindowYears, string | number | null>>({
    drinkFrom: v('drinkFrom'),
    peakFrom: v('peakFrom'),
    peakTo: v('peakTo'),
    drinkUntil: v('drinkUntil')
  });
  const asYear = (x: string | number | null) => (String(x ?? '').trim() === '' ? null : Number(x));
  const KEYS = ['drinkFrom', 'peakFrom', 'peakTo', 'drinkUntil'] as const;
  const showAiReminder = $derived(
    aiWindow !== null && KEYS.some((k) => aiWindow[k] !== null) && KEYS.every((k) => asYear(win[k]) === aiWindow[k])
  );
  const confidenceLabel = $derived(
    aiConfidence === 'high'
      ? m.add_ai_confidence_high()
      : aiConfidence === 'medium'
        ? m.add_ai_confidence_medium()
        : aiConfidence === 'low'
          ? m.add_ai_confidence_low()
          : null
  );
  const nonVintage = $derived(String(vintage ?? '').trim() === '');
</script>

<fieldset class="group">
  <legend>{m.form_section_wine()}</legend>
  <Field label={m.form_producer()} name="producer" value={v('producer')} autocomplete="off" error={err('producer')} />
  <Field label={m.form_cuvee()} name="cuvee" value={v('cuvee')} autocomplete="off" error={err('cuvee')} />
  <Field label={m.form_appellation()} name="appellation" value={v('appellation')} autocomplete="off" error={err('appellation')} />
  <div class="pair">
    <Field label={m.form_region()} name="region" value={v('region')} autocomplete="off" error={err('region')} />
    <Field label={m.form_country()} name="country" value={v('country')} autocomplete="off" error={err('country')} />
  </div>
  <Field label={m.form_color()} error={err('color')}>
    {#snippet children(control)}
      <select {...control} name="color">
        <option value="" selected={v('color') === ''}>{m.form_color_none()}</option>
        {#each COLOR_OPTIONS as o (o.value)}
          <option value={o.value} selected={v('color') === o.value}>{o.label()}</option>
        {/each}
      </select>
    {/snippet}
  </Field>
  <div class="pair">
    <Field
      label={m.form_vintage()}
      name="vintage"
      type="number"
      inputmode="numeric"
      min="1900"
      bind:value={vintage}
      error={err('vintage')}
    />
    <Field label={m.form_format()} error={err('formatCl')}>
      {#snippet children(control)}
        <select {...control} name="formatCl">
          {#each FORMAT_OPTIONS as o (o.value)}
            <option value={o.value} selected={String(o.value) === (v('formatCl') || '75')}>{o.label()}</option>
          {/each}
        </select>
      {/snippet}
    </Field>
  </div>
  <p class="hint">{m.form_vintage_hint()}</p>
  {#if nonVintage}
    <Field
      label={m.form_acquired_year()}
      name="acquiredYear"
      type="number"
      inputmode="numeric"
      value={v('acquiredYear')}
      hint={m.form_acquired_hint()}
      error={err('acquiredYear')}
    />
  {/if}
  <Field label={m.form_grapes()} name="grapes" value={v('grapes')} autocomplete="off" error={err('grapes')} />
</fieldset>

<fieldset class="group">
  <legend>{m.form_section_window()}</legend>
  <p class="hint">{m.form_window_hint()}</p>
  <div class="pair">
    <Field label={m.form_drink_from()} name="drinkFrom" type="number" inputmode="numeric" bind:value={win.drinkFrom} error={err('drinkFrom')} />
    <Field label={m.form_drink_until()} name="drinkUntil" type="number" inputmode="numeric" bind:value={win.drinkUntil} error={err('drinkUntil')} />
  </div>
  <div class="pair">
    <Field label={m.form_peak_from()} name="peakFrom" type="number" inputmode="numeric" bind:value={win.peakFrom} error={err('peakFrom')} />
    <Field label={m.form_peak_to()} name="peakTo" type="number" inputmode="numeric" bind:value={win.peakTo} error={err('peakTo')} />
  </div>
  {#if showAiReminder}
    <p class="ai" role="note">
      <strong>{m.add_ai_window_title()}{confidenceLabel ? ` (${confidenceLabel})` : ''}</strong>
      {#if aiRationale}<span>{aiRationale}</span>{/if}
      <span>{m.add_ai_window_check()}</span>
    </p>
  {/if}
</fieldset>

<Field label={m.form_notes()} error={err('notes')}>
  {#snippet children(control)}
    <textarea {...control} name="notes" rows="3">{v('notes')}</textarea>
  {/snippet}
</Field>

<style>
  .group { display: grid; gap: var(--s-3); border: 0; padding: 0; margin: 0; min-width: 0; }
  legend { font-size: var(--fs-lg); font-weight: var(--fw-semibold); padding: 0; margin-bottom: var(--s-3); }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); }
  .pair > :global(.field) { min-width: 0; }
  .ai { margin: 0; display: grid; gap: var(--s-1); font-size: var(--fs-sm); color: var(--c-text-muted); border-left: 3px solid var(--c-accent); padding-left: var(--s-3); }
  .ai strong { color: var(--c-text); }
  .hint { margin: 0; font-size: var(--fs-sm); color: var(--c-text-muted); }
</style>
