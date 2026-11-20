<script lang="ts">
  import { enhance, type SubmitFunction } from '$app/forms';
  import Plus from 'phosphor-svelte/lib/Plus';
  import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
  import MapPin from 'phosphor-svelte/lib/MapPin';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Field from '$lib/components/Field.svelte';
  import WineForm from '$lib/components/WineForm.svelte';
  import LabelCapture from '$lib/components/LabelCapture.svelte';
  import type { AnalysisOutcome } from '$lib/server/label-analyses';

  let { data, form } = $props();

  // The location survives between additions: the initial fill goes shelf by shelf.
  // svelte-ignore state_referenced_locally
  let locationId = $state(String(data.locationId ?? ''));
  let added = $state<{ wineId: number } | null>(null);
  // Remounting the form gives the next bottle a clean slate.
  let formKey = $state(0);

  // Photo-first when the AI is configured; otherwise straight to the manual form (a photo can still be attached).
  // svelte-ignore state_referenced_locally
  let stage = $state<'capture' | 'form'>(data.aiEnabled ? 'capture' : 'form');
  let captured = $state<{ analysisId: number | null; preview: string; outcome: AnalysisOutcome } | null>(null);
  let captureError = $state<string | null>(null);

  const ERRORS: Record<string, () => string> = {
    unavailable: m.add_ai_error_unavailable,
    limit_reached: m.add_ai_error_limit,
    not_configured: m.add_ai_error_not_configured,
    refused: m.add_ai_error_refused,
    auth: m.add_ai_error_auth,
    rate_limited: m.add_ai_error_rate_limited,
    invalid_response: m.add_ai_error_invalid_response,
    invalid_photo: m.add_ai_error_invalid_photo
  };

  const analysis = $derived(captured?.outcome.ok ? captured.outcome.analysis : null);
  const label = $derived(analysis?.isWineLabel ? analysis : null);
  const notice = $derived.by(() => {
    const o = captured?.outcome;
    if (!o) return null;
    if (o.ok) return o.analysis.isWineLabel ? null : m.add_ai_not_label();
    // Without a configured provider the photo is simply attached: nothing to apologise for.
    return data.aiEnabled ? (ERRORS[o.error]?.() ?? m.add_ai_error_unavailable()) : null;
  });

  const str = (x: string | number | null | undefined) => (x === null || x === undefined ? '' : String(x));
  const FORMATS = ['37', '50', '75', '150', '300', '600'];
  const prefill = $derived<Record<string, string>>(
    label
      ? {
          producer: str(label.producer),
          cuvee: str(label.cuvee),
          appellation: str(label.appellation),
          region: str(label.region),
          country: str(label.country),
          color: str(label.color),
          vintage: str(label.vintage),
          grapes: str(label.grapes),
          formatCl: FORMATS.includes(str(label.formatCl)) ? str(label.formatCl) : '75',
          drinkFrom: str(label.window?.drinkFrom),
          peakFrom: str(label.window?.peakFrom),
          peakTo: str(label.window?.peakTo),
          drinkUntil: str(label.window?.drinkUntil)
        }
      : {}
  );

  // The "analysis rejected" alert belongs to one submit: a new capture dismisses it (form persists until the next submit).
  let staleDismissed = $state(false);

  function revoke() {
    if (captured) URL.revokeObjectURL(captured.preview);
  }
  $effect(() => revoke);

  function onCaptured(outcome: AnalysisOutcome, preview: string) {
    if (!outcome.ok && outcome.error === 'invalid_photo') {
      URL.revokeObjectURL(preview);
      captureError = m.add_ai_error_invalid_photo();
      return;
    }
    captureError = null;
    staleDismissed = true;
    // Replacing the photo starts the form afresh only when a new analysis pre-fills it.
    revoke();
    captured = { analysisId: outcome.analysisId, preview, outcome };
    stage = 'form';
    if (data.aiEnabled) formKey++;
  }

  function retake() {
    revoke();
    captured = null;
    captureError = null;
    stage = 'capture';
    formKey++;
  }

  const values = $derived<Record<string, string>>({
    acquiredYear: String(data.year),
    quantity: '1',
    ...prefill,
    ...(form && 'values' in form ? (form.values as Record<string, string>) : {})
  });
  const error = $derived(form && 'error' in form ? (form.error as { field: string; message: string }) : null);
  const duplicate = $derived(
    form && 'duplicate' in form ? (form.duplicate as { wineId: number; bottles: number }) : null
  );

  const afterSubmit: SubmitFunction = () => {
    staleDismissed = false;
    return async ({ result, update }) => {
      // Drop exactly the analysis the server rejected, so the retry saves as a manual entry.
      if (result.type === 'failure' && (result.data as { error?: { field?: string } })?.error?.field === 'analysisId' && captured)
        captured.analysisId = null;
      if (result.type === 'success') {
        const d = result.data as { wineId: number; locationId: number };
        // update() replaces form, so a stale duplicate warning cannot come back.
        await update({ reset: false });
        added = { wineId: d.wineId };
        locationId = String(d.locationId);
        return;
      }
      await update({ reset: false });
    };
  };

  function another() {
    added = null;
    revoke();
    captured = null;
    captureError = null;
    stage = data.aiEnabled ? 'capture' : 'form';
    formKey++;
  }
</script>

<svelte:head><title>{m.add_page_title()}</title></svelte:head>

<h1>{m.add_title()}</h1>

{#if data.locations.length === 0}
  <EmptyState title={m.add_no_location_title()} description={m.add_no_location_desc()} icon={MapPin}>
    <Button href="/app/locations">{m.add_no_location_action()}</Button>
  </EmptyState>
{:else if added}
  <div class="done">
    <CheckCircle size={40} weight="duotone" aria-hidden="true" />
    <h2>{m.add_done_title()}</h2>
    <Button block onclick={another}>{m.add_another()}</Button>
    <Button block variant="secondary" href="/app/wines/{added.wineId}">{m.add_view_wine()}</Button>
  </div>
{:else if stage === 'capture'}
  {#if captureError}<Card role="alert"><p class="msg">{captureError}</p></Card>{/if}
  <LabelCapture onresult={onCaptured} onskip={() => (stage = 'form')} />
{:else}
  {#key formKey}
    <form method="POST" use:enhance={afterSubmit} class="stack">
      {#if duplicate}
        <Card role="alert">
          <div class="dup">
            <h2>{m.add_dup_title()}</h2>
            <p>{m.add_dup_body({ count: duplicate.bottles })}</p>
            <div class="dup-actions">
              <Button type="submit" name="confirmDuplicate" value="add-stock" block>{m.add_dup_add_stock()}</Button>
              <Button type="submit" name="confirmDuplicate" value="new" variant="secondary" block>{m.add_dup_new()}</Button>
              <Button href="/app/wines/{duplicate.wineId}" variant="ghost" block>{m.add_dup_view()}</Button>
            </div>
          </div>
        </Card>
      {/if}

      {#if error?.field === 'analysisId' && !staleDismissed}<Card role="alert"><p class="msg">{error.message}</p></Card>{/if}
      {#if captured?.analysisId != null}
        <input type="hidden" name="analysisId" value={captured.analysisId} />
      {/if}

      {#if captured}
        <div class="photo">
          <img src={captured.preview} alt={m.add_ai_preview_alt()} />
          {#if data.aiEnabled}
            <Button variant="ghost" size="sm" onclick={retake}>{m.add_ai_attach_replace()}</Button>
          {/if}
        </div>
      {/if}
      {#if notice}<Card role="status"><p class="msg">{notice}</p></Card>{/if}
      {#if !data.aiEnabled}
        {#if captureError}<p class="msg" role="alert">{captureError}</p>{/if}
        <LabelCapture
          variant="attach"
          attachLabel={captured ? m.add_ai_attach_replace() : m.add_ai_attach()}
          onresult={onCaptured}
        />
      {/if}

      <WineForm
        {values}
        {error}
        aiWindow={label?.window ?? null}
        aiConfidence={label?.confidence ?? null}
        aiRationale={label?.rationale ?? null}
      />

      <fieldset class="group">
        <legend>{m.form_section_stock()}</legend>
        <Field label={m.form_location()} error={error?.field === 'locationId' ? error.message : null}>
          {#snippet children(control)}
            <select {...control} name="locationId" bind:value={locationId}>
              {#each data.locations as loc (loc.id)}
                <option value={String(loc.id)}>{loc.name}</option>
              {/each}
            </select>
          {/snippet}
        </Field>
        <Field label={m.form_position()} name="position"
          value={values.position ?? ''}
          autocomplete="off"
          error={error?.field === 'position' ? error.message : null}
        />
        <Field
          label={m.form_quantity()}
          name="quantity"
          type="number"
          inputmode="numeric"
          min="1"
          max="10000"
          value={values.quantity}
          error={error?.field === 'quantity' ? error.message : null}
        />
      </fieldset>

      <Button type="submit" block><Plus size={20} weight="bold" aria-hidden="true" />{m.add_submit()}</Button>
    </form>
  {/key}
{/if}

<style>
  .stack { display: grid; gap: var(--s-5); margin-top: var(--s-4); padding-bottom: var(--s-6); }
  .group { display: grid; gap: var(--s-3); border: 0; padding: 0; margin: 0; min-width: 0; }
  legend { font-size: var(--fs-lg); font-weight: var(--fw-semibold); padding: 0; margin-bottom: var(--s-3); }
  .photo { display: flex; align-items: center; gap: var(--s-3); }
  .photo img { width: 96px; height: 96px; object-fit: cover; border-radius: var(--r-control); border: 1px solid var(--c-border); }
  .msg { margin: 0; }
  .dup h2 { margin: 0 0 var(--s-1); font-size: var(--fs-lg); }
  .dup p { margin: 0 0 var(--s-3); color: var(--c-text-muted); }
  .dup-actions { display: grid; gap: var(--s-2); }
  .done { display: grid; gap: var(--s-3); justify-items: center; text-align: center; margin-top: var(--s-7); color: var(--c-accent); }
  .done h2 { margin: 0; color: var(--c-text); }
</style>
