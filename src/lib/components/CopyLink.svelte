<script lang="ts">
  import Copy from 'phosphor-svelte/lib/Copy';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import { showToast } from '$lib/toast.svelte';

  let { url }: { url: string } = $props();

  const uid = $props.id();
  let input: HTMLInputElement | undefined = $state();

  // navigator.clipboard is missing on plain-HTTP origins and can be refused:
  // the selectable input stays as the fallback.
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      showToast(m.invite_copied());
    } catch {
      input?.focus();
      input?.select();
      showToast(m.invite_copy_manual());
    }
  }
</script>

<div class="copy-link">
  <label class="visually-hidden" for="{uid}-url">{m.invite_link_label()}</label>
  <input
    id="{uid}-url"
    class="field-input"
    readonly
    value={url}
    bind:this={input}
    onfocus={(e) => e.currentTarget.select()}
  />
  <Button size="sm" variant="secondary" onclick={copy}>
    <Copy size={16} aria-hidden="true" />
    {m.invite_copy()}
  </Button>
</div>

<style>
  .copy-link {
    display: flex;
    gap: var(--s-2);
    align-items: center;
  }
  .copy-link input {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-sm);
  }
</style>
