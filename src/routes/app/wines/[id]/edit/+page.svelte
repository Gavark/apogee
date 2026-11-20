<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import WineForm from '$lib/components/WineForm.svelte';

  let { data, form } = $props();

  const values = $derived(form && 'values' in form ? (form.values as Record<string, string>) : data.values);
  const error = $derived(form && 'error' in form ? (form.error as { field: string; message: string }) : null);
</script>

<svelte:head><title>{m.wine_edit_page_title()}</title></svelte:head>

<h1>{m.wine_edit_title()}</h1>

<form method="POST" use:enhance={() => async ({ update }) => update({ reset: false })} class="stack">
  <WineForm {values} {error} />
  <div class="actions">
    <Button type="submit" block>{m.wine_save()}</Button>
    <Button href="/app/wines/{data.wineId}" variant="ghost" block>{m.wine_cancel()}</Button>
  </div>
</form>

<style>
  .stack { display: grid; gap: var(--s-5); margin-top: var(--s-4); padding-bottom: var(--s-6); }
  .actions { display: grid; gap: var(--s-2); }
</style>
