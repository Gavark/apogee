<script lang="ts">
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import { reload } from '$lib/offline/pending.svelte';
  import { sendStockOps, SessionExpiredError } from '$lib/stock-client';
  import { VERDICTS, type Verdict } from '$lib/stock-ops';
  import { showToast } from '$lib/toast.svelte';
  import { reviewOp } from '$lib/verdict';
  import { closeVerdict, verdictSheet } from '$lib/verdict-sheet.svelte';

  const LABELS: Record<Verdict, () => string> = {
    early: m.verdict_early,
    right: m.verdict_right,
    late: m.verdict_late
  };

  const req = $derived(verdictSheet.current);
  let note = $state('');
  let busy = $state(false);

  // Each new request starts from its own note.
  $effect(() => {
    note = req?.note ?? '';
  });

  async function choose(verdict: Verdict) {
    const current = req;
    // `busy` is set synchronously: a double tap sends one operation.
    if (!current || busy) return;
    busy = true;
    let queued = false;
    try {
      const [r] = await sendStockOps([reviewOp(current.ref, verdict, note)]);
      queued = r.status === 'queued';
      closeVerdict();
    } catch (e) {
      // Stay open so the choice can be retried.
      if (!(e instanceof SessionExpiredError)) showToast(m.wine_err_network());
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
          {LABELS[v]()}
        </Button>
      </li>
    {/each}
  </ul>
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
</style>
