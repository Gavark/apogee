<script lang="ts">
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import { reload } from '$lib/offline/pending.svelte';
  import { sendStockOps, SessionExpiredError } from '$lib/stock-client';
  import { VERDICTS, type Verdict } from '$lib/stock-ops';
  import { verdictLabel } from '$lib/wine-labels';
  import { reviewOp } from '$lib/verdict';
  import { closeVerdict, dropVerdict, verdictSheet } from '$lib/verdict-sheet.svelte';

  const req = $derived(verdictSheet.current);
  let note = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  // A request that outlives its sheet (route change) must not reopen it later.
  $effect(() => () => dropVerdict());

  // Each new request starts from its own note.
  $effect(() => {
    note = req?.note ?? '';
    error = null;
  });

  async function choose(verdict: Verdict) {
    const current = req;
    // `busy` is set synchronously: a double tap sends one operation.
    if (!current || busy) return;
    busy = true;
    error = null;
    let queued = false;
    try {
      const [r] = await sendStockOps([reviewOp(current.ref, verdict, note)]);
      queued = r.status === 'queued';
      closeVerdict();
    } catch (e) {
      // Stay open so the choice can be retried. Shown inside the sheet: a toast would be inert behind the modal.
      if (!(e instanceof SessionExpiredError)) error = m.wine_err_network();
    } finally {
      // Queued: nothing changed on the server yet, the overlay already shows it.
      if (!queued) await reload();
      busy = false;
    }
  }
</script>

<Sheet open={req !== null} onclose={closeVerdict} title={req?.title}>
  <p class="question">{m.verdict_question()}</p>
  <label class="note">
    <span>{m.verdict_note_label()}</span>
    <input type="text" class="field-input" maxlength="200" bind:value={note} autocomplete="off" />
  </label>
  <ul class="choices">
    {#each VERDICTS as v (v)}
      <li>
        <Button variant="secondary" block disabled={busy} aria-pressed={req?.verdict === v} onclick={() => choose(v)}>
          {verdictLabel(v)}
        </Button>
      </li>
    {/each}
  </ul>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <Button variant="ghost" block onclick={closeVerdict}>{m.verdict_later()}</Button>
</Sheet>

<style>
  .question { margin: 0 0 var(--s-3); }
  .note { display: grid; gap: var(--s-1); margin-bottom: var(--s-3); font-size: var(--fs-sm); color: var(--c-text-muted); }
  .choices { list-style: none; margin: 0 0 var(--s-2); padding: 0; display: grid; gap: var(--s-2); }
  .choices :global(.btn[aria-pressed='true']) {
    border-color: var(--c-accent);
    background: var(--c-bg-sunken);
    color: var(--c-accent);
  }
  .error { color: var(--c-danger); font-size: var(--fs-sm); margin: 0 0 var(--s-2); }
</style>
