<script lang="ts">
  import { onDestroy } from 'svelte';
  import Camera from 'phosphor-svelte/lib/Camera';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import { resizeImage } from '$lib/image-resize';
  import { analyzeLabel, isLostUpload } from '$lib/label-client';
  import { SessionExpiredError } from '$lib/stock-client';
  import { network } from '$lib/offline/online.svelte';
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

  // A photo that never reached storage stays here (not attached anywhere) until it is resent or replaced.
  let failedBlob: Blob | null = $state(null);

  async function send(blob: Blob) {
    if (!network.online) return; // the banner says why; the photo stays in failedBlob / the picker
    busy = true;
    try {
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
      if (isLostUpload(outcome)) {
        URL.revokeObjectURL(preview);
        if (alive) failedBlob = blob;
        return;
      }
      failedBlob = null;
      if (alive) onresult(outcome, preview);
      else URL.revokeObjectURL(preview);
    } finally {
      busy = false;
    }
  }

  async function picked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    busy = true;
    let blob: Blob;
    try {
      blob = await resizeImage(file, 1600, 0.8);
    } finally {
      busy = false;
    }
    await send(blob);
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

{#snippet failure()}
  {#if failedBlob}
    <Card role="alert">
      <div class="failed">
        <p>{m.add_ai_error_send_failed()}</p>
        <Button size="sm" disabled={busy || !network.online} onclick={() => failedBlob && send(failedBlob)}>{m.add_ai_retry()}</Button>
      </div>
    </Card>
  {/if}
{/snippet}

{#if variant === 'full'}
  <div class="capture">
    {@render failure()}
    <p class="hint">{m.add_ai_hint()}</p>
    <Button block disabled={busy || !network.online} onclick={() => cameraInput?.click()}>
      <Camera size={22} weight="bold" aria-hidden="true" />{m.add_ai_take()}
    </Button>
    <div class="links">
      <Button variant="ghost" disabled={busy || !network.online} onclick={() => galleryInput?.click()}>{m.add_ai_pick()}</Button>
      {#if onskip}
        <Button variant="ghost" disabled={busy} onclick={onskip}>{m.add_ai_skip()}</Button>
      {/if}
    </div>
    {#if busy}<p class="busy" role="status">{m.add_ai_analyzing()}</p>{/if}
  </div>
{:else}
  <div class="attach-wrap">
    {@render failure()}
  <div class="attach">
    <Button variant="secondary" size="sm" disabled={busy || !network.online} onclick={() => galleryInput?.click()}>
      <Camera size={18} aria-hidden="true" />{attachLabel ?? m.add_ai_attach()}
    </Button>
    {#if busy}<span class="busy" role="status">{m.add_ai_analyzing()}</span>{/if}
  </div>
  </div>
{/if}

<style>
  .file { display: none; }
  .capture { display: grid; gap: var(--s-3); margin-top: var(--s-4); }
  .hint { margin: 0; color: var(--c-text-muted); }
  .links { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--s-2); }
  .busy { margin: 0; text-align: center; color: var(--c-text-muted); }
  .failed { display: grid; gap: var(--s-2); justify-items: start; }
  .failed p { margin: 0; }
  .attach-wrap { display: grid; gap: var(--s-3); }
  .attach { display: flex; align-items: center; gap: var(--s-3); }
</style>
