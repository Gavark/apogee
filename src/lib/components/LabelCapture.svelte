<script lang="ts">
  import { onDestroy } from 'svelte';
  import Camera from 'phosphor-svelte/lib/Camera';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import { resizeImage } from '$lib/image-resize';
  import { analyzeLabel } from '$lib/label-client';
  import { SessionExpiredError } from '$lib/stock-client';
  import type { AnalysisOutcome } from '$lib/server/label-analyses';

  type Props = {
    /** Called with the analysis outcome and an object URL of the (resized) photo. */
    onresult: (outcome: AnalysisOutcome, preview: string) => void;
    /** full: big camera button + "enter without a photo". attach: one small button, to add a photo to a manual entry. */
    variant?: 'full' | 'attach';
    /** Label of the button in the attach variant. */
    attachLabel?: string;
    onskip?: () => void;
  };

  let { onresult, variant = 'full', attachLabel, onskip }: Props = $props();

  let cameraInput: HTMLInputElement | undefined = $state();
  let galleryInput: HTMLInputElement | undefined = $state();
  let busy = $state(false);
  let alive = true;
  onDestroy(() => (alive = false));

  async function picked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    busy = true;
    try {
      const blob = await resizeImage(file, 1600, 0.8);
      const preview = URL.createObjectURL(blob);
      let outcome: AnalysisOutcome;
      try {
        outcome = await analyzeLabel({ photo: blob });
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          URL.revokeObjectURL(preview);
          return;
        }
        outcome = { ok: false, analysisId: null, error: 'unavailable' };
      }
      if (alive) onresult(outcome, preview);
      else URL.revokeObjectURL(preview);
    } finally {
      busy = false;
    }
  }
</script>

<input
  bind:this={cameraInput}
  class="file"
  type="file"
  accept="image/*"
  capture="environment"
  tabindex="-1"
  aria-hidden="true"
  onchange={picked}
/>
<input
  bind:this={galleryInput}
  class="file"
  type="file"
  accept="image/*"
  tabindex="-1"
  aria-hidden="true"
  onchange={picked}
/>

{#if variant === 'full'}
  <div class="capture">
    <p class="hint">{m.add_ai_hint()}</p>
    <Button block disabled={busy} onclick={() => cameraInput?.click()}>
      <Camera size={22} weight="bold" aria-hidden="true" />{m.add_ai_take()}
    </Button>
    <div class="links">
      <Button variant="ghost" disabled={busy} onclick={() => galleryInput?.click()}>{m.add_ai_pick()}</Button>
      {#if onskip}
        <Button variant="ghost" disabled={busy} onclick={onskip}>{m.add_ai_skip()}</Button>
      {/if}
    </div>
    {#if busy}<p class="busy" role="status">{m.add_ai_analyzing()}</p>{/if}
  </div>
{:else}
  <div class="attach">
    <Button variant="secondary" size="sm" disabled={busy} onclick={() => galleryInput?.click()}>
      <Camera size={18} aria-hidden="true" />{attachLabel ?? m.add_ai_attach()}
    </Button>
    {#if busy}<span class="busy" role="status">{m.add_ai_analyzing()}</span>{/if}
  </div>
{/if}

<style>
  .file { display: none; }
  .capture { display: grid; gap: var(--s-3); margin-top: var(--s-4); }
  .hint { margin: 0; color: var(--c-text-muted); }
  .links { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--s-2); }
  .busy { margin: 0; text-align: center; color: var(--c-text-muted); }
  .attach { display: flex; align-items: center; gap: var(--s-3); }
</style>
