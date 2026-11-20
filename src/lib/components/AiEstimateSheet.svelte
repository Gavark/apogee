<script lang="ts">
  import { untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import WindowTimeline from '$lib/components/WindowTimeline.svelte';
  import { analyzeLabel } from '$lib/label-client';
  import { SessionExpiredError } from '$lib/stock-client';
  import { aiErrorMessage, confidenceLabel } from '$lib/wine-labels';
  import type { WindowYears } from '$lib/phase';
  import type { LabelAnalysis } from '$lib/server/ai/types';

  type Props = {
    open: boolean;
    onclose: () => void;
    wineId: number;
    current: WindowYears;
    currentYear: number;
  };

  let { open, onclose, wineId, current, currentYear }: Props = $props();

  type State =
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; analysisId: number; analysis: LabelAnalysis };

  let view = $state<State>({ kind: 'loading' });
  let applyError = $state<string | null>(null);
  let applying = $state(false);
  // Only the latest request may write the state (a closed-and-reopened sheet ignores the earlier answer).
  let run = 0;

  const hasWindow = (w: WindowYears) =>
    w.drinkFrom !== null && w.drinkUntil !== null;

  async function estimate(id: number) {
    const mine = ++run;
    view = { kind: 'loading' };
    applyError = null;
    let next: State;
    try {
      const outcome = await analyzeLabel({ wineId: id });
      if (!outcome.ok) next = { kind: 'error', message: aiErrorMessage(outcome.error) };
      else if (!hasWindow(outcome.analysis.window)) next = { kind: 'error', message: m.ai_est_no_window() };
      else next = { kind: 'ready', analysisId: outcome.analysisId, analysis: outcome.analysis };
    } catch (e) {
      if (e instanceof SessionExpiredError) return;
      next = { kind: 'error', message: aiErrorMessage('unavailable') };
    }
    if (mine === run) view = next;
  }

  $effect(() => {
    if (open) {
      const id = wineId;
      untrack(() => void estimate(id));
    } else run++;
  });

  const proposal = $derived(view.kind === 'ready' ? view.analysis : null);
</script>

<Sheet {open} {onclose} title={m.ai_est_title()}>
  <div class="body">
    {#if view.kind === 'loading'}
      <p class="muted" role="status">{m.ai_est_loading()}</p>
    {:else if view.kind === 'error'}
      <p class="error" role="alert">{view.message}</p>
      <Button variant="secondary" block onclick={onclose}>{m.ai_est_close()}</Button>
    {:else if proposal}
      <section>
        <h3>{m.ai_est_current()}</h3>
        <WindowTimeline {...current} {currentYear} />
      </section>
      <section>
        <h3>{m.ai_est_proposed({ confidence: confidenceLabel(proposal.confidence) })}</h3>
        <WindowTimeline {...proposal.window} {currentYear} />
        {#if proposal.rationale}<p class="rationale">{proposal.rationale}</p>{/if}
      </section>
      {#if applyError}<p class="error" role="alert">{applyError}</p>{/if}
      <form
        method="POST"
        action="/app/wines/{wineId}?/applyAi"
        class="actions"
        use:enhance={() => {
          applying = true;
          applyError = null;
          return async ({ result }) => {
            applying = false;
            if (result.type === 'success') {
              await invalidateAll();
              onclose();
            } else {
              applyError = m.ai_est_apply_error();
            }
          };
        }}
      >
        <input type="hidden" name="analysisId" value={view.analysisId} />
        <Button type="submit" block disabled={applying}>{m.ai_est_apply()}</Button>
        <Button variant="ghost" block onclick={onclose}>{m.ai_est_keep()}</Button>
      </form>
    {/if}
  </div>
</Sheet>

<style>
  .body { display: grid; gap: var(--s-4); }
  h3 { margin: 0 0 var(--s-2); font-size: var(--fs-base); }
  .muted { color: var(--c-text-muted); margin: 0; }
  .rationale { margin: var(--s-2) 0 0; font-size: var(--fs-sm); color: var(--c-text-muted); overflow-wrap: anywhere; }
  .error { color: var(--c-danger); margin: 0; }
  .actions { display: grid; gap: var(--s-2); }
</style>
