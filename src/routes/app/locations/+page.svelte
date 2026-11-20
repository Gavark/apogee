<script lang="ts">
  import { enhance, type SubmitFunction } from '$app/forms';
  import ArrowUp from 'phosphor-svelte/lib/ArrowUp';
  import ArrowDown from 'phosphor-svelte/lib/ArrowDown';
  import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
  import Trash from 'phosphor-svelte/lib/Trash';
  import MapPin from 'phosphor-svelte/lib/MapPin';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Field from '$lib/components/Field.svelte';
  import { showToast } from '$lib/toast.svelte';

  let { data, form } = $props();

  let editingId = $state<number | null>(null);
  let newName = $state('');

  const formError = $derived(form && 'error' in form ? (form.error as string) : null);
  const formId = $derived(form && 'id' in form ? (form.id as number) : null);
  const createError = $derived(form?.action === 'create' ? formError : null);
  // Errors tied to a row show in that row; the rest (e.g. not found) show above the list.
  const generalError = $derived(form?.action !== 'create' && formId === null ? formError : null);
  const rowError = (id: number) => (formId === id ? formError : null);

  const afterAction: SubmitFunction = () => {
    return async ({ result, update }) => {
      await update({ reset: false });
      if (result.type === 'success') {
        const d = result.data as { action?: string; message?: string } | undefined;
        if (d?.action === 'create') newName = '';
        if (d?.action === 'rename') editingId = null;
        if (d?.message) showToast(d.message);
      }
    };
  };
</script>

<svelte:head><title>{m.loc_page_title()}</title></svelte:head>

<h1>{m.loc_title()}</h1>
<p class="muted">{m.loc_intro()}</p>

<div class="stack">
  <Card>
    <form method="POST" action="?/create" use:enhance={afterAction} class="add">
      <Field
        label={m.loc_add_label()}
        name="name"
        bind:value={newName}
        placeholder={m.loc_add_placeholder()}
        maxlength={60}
        required
        autocomplete="off"
        error={createError}
      />
      <Button type="submit">{m.loc_add_submit()}</Button>
    </form>
  </Card>

  {#if generalError}<p class="error" role="alert">{generalError}</p>{/if}

  {#if data.locations.length === 0}
    <EmptyState title={m.loc_empty_title()} description={m.loc_empty_desc()} icon={MapPin} />
  {:else}
    <ul class="list">
      {#each data.locations as loc, i (loc.id)}
        <li>
          <Card>
            {#if editingId === loc.id}
              <form method="POST" action="?/rename" use:enhance={afterAction} class="rename">
                <input type="hidden" name="id" value={loc.id} />
                <Field
                  label={m.loc_rename_label()}
                  name="name"
                  value={loc.name}
                  maxlength={60}
                  required
                  autocomplete="off"
                  error={rowError(loc.id)}
                />
                <div class="row-actions">
                  <Button type="submit" size="sm">{m.loc_save()}</Button>
                  <Button variant="ghost" size="sm" onclick={() => (editingId = null)}>{m.loc_cancel()}</Button>
                </div>
              </form>
            {:else}
              <div class="row">
                <div class="info">
                  <strong class="name">{loc.name}</strong>
                  <span class="muted count">{m.loc_bottle_count({ count: loc.bottleCount })}</span>
                </div>
                <div class="row-actions">
                  <form method="POST" action="?/move" use:enhance={afterAction}>
                    <input type="hidden" name="id" value={loc.id} />
                    <input type="hidden" name="dir" value="up" />
                    <Button type="submit" variant="ghost" size="sm" disabled={i === 0} aria-label={m.loc_move_up()}>
                      <ArrowUp size={18} aria-hidden="true" />
                    </Button>
                  </form>
                  <form method="POST" action="?/move" use:enhance={afterAction}>
                    <input type="hidden" name="id" value={loc.id} />
                    <input type="hidden" name="dir" value="down" />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      disabled={i === data.locations.length - 1}
                      aria-label={m.loc_move_down()}
                    >
                      <ArrowDown size={18} aria-hidden="true" />
                    </Button>
                  </form>
                  <Button variant="ghost" size="sm" aria-label={m.loc_rename()} onclick={() => (editingId = loc.id)}>
                    <PencilSimple size={18} aria-hidden="true" />
                  </Button>
                  <form method="POST" action="?/delete" use:enhance={afterAction}>
                    <input type="hidden" name="id" value={loc.id} />
                    <Button type="submit" variant="ghost" size="sm" aria-label={m.loc_delete()}>
                      <Trash size={18} aria-hidden="true" />
                    </Button>
                  </form>
                </div>
              </div>
              {#if rowError(loc.id)}<p class="error" role="alert">{rowError(loc.id)}</p>{/if}
            {/if}
          </Card>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .stack { display: flex; flex-direction: column; gap: var(--s-4); margin-top: var(--s-5); }
  .add { display: grid; gap: var(--s-3); }
  .list { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--s-2); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); }
  .info { display: flex; flex-direction: column; min-width: 0; }
  .name { overflow-wrap: anywhere; }
  .count { font-size: var(--fs-sm); white-space: nowrap; }
  .row-actions { display: flex; align-items: center; gap: var(--s-1); flex: none; }
  .rename { display: grid; gap: var(--s-3); }
  .error { color: var(--c-danger); font-size: var(--fs-sm); margin: var(--s-2) 0 0; }
</style>
