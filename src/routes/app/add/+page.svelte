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

  let { data, form } = $props();

  // The location survives between additions: the initial fill goes shelf by shelf.
  // svelte-ignore state_referenced_locally
  let locationId = $state(String(data.locationId ?? ''));
  let added = $state<{ wineId: number } | null>(null);
  // Remounting the form gives the next bottle a clean slate.
  let formKey = $state(0);

  const values = $derived<Record<string, string>>({
    acquiredYear: String(data.year),
    quantity: '1',
    ...(form && 'values' in form ? (form.values as Record<string, string>) : {})
  });
  const error = $derived(form && 'error' in form ? (form.error as { field: string; message: string }) : null);
  const duplicate = $derived(
    form && 'duplicate' in form ? (form.duplicate as { wineId: number; bottles: number }) : null
  );

  const afterSubmit: SubmitFunction = () => {
    return async ({ result, update }) => {
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

      <WineForm {values} {error} />

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
        <Field label={m.form_position()} name="position" value={values.position ?? ''} autocomplete="off" />
        <Field
          label={m.form_quantity()}
          name="quantity"
          type="number"
          inputmode="numeric"
          min="1"
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
  .dup h2 { margin: 0 0 var(--s-1); font-size: var(--fs-lg); }
  .dup p { margin: 0 0 var(--s-3); color: var(--c-text-muted); }
  .dup-actions { display: grid; gap: var(--s-2); }
  .done { display: grid; gap: var(--s-3); justify-items: center; text-align: center; margin-top: var(--s-7); color: var(--c-accent); }
  .done h2 { margin: 0; color: var(--c-text); }
</style>
