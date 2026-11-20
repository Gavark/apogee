<script lang="ts">
  import type { Snippet } from 'svelte';
  import X from 'phosphor-svelte/lib/X';
  import * as m from '$paraglide/messages';

  type Props = {
    open: boolean;
    onclose: () => void;
    title?: string;
    children: Snippet;
  };

  let { open, onclose, title, children }: Props = $props();

  const uid = $props.id();
  let dialog: HTMLDialogElement | undefined = $state();

  // The native modal <dialog> gives focus trapping, inert background and
  // Escape handling for free; `open` stays the single source of truth.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  function onCancel(e: Event) {
    e.preventDefault();
    onclose();
  }

  // A click that lands on the <dialog> itself (not its content) is the backdrop.
  function onClick(e: MouseEvent) {
    if (e.target === dialog) onclose();
  }
</script>

<dialog
  bind:this={dialog}
  class="sheet"
  aria-labelledby={title ? `${uid}-title` : undefined}
  oncancel={onCancel}
  onclick={onClick}
>
  <div class="sheet-body">
    <div class="grip" aria-hidden="true"></div>
    <header class="sheet-head">
      {#if title}<h2 id="{uid}-title">{title}</h2>{/if}
      <button type="button" class="close" aria-label={m.sheet_close()} onclick={onclose}>
        <X size={20} weight="bold" aria-hidden="true" />
      </button>
    </header>
    {@render children()}
  </div>
</dialog>

<style>
  .sheet {
    position: fixed;
    inset: auto 0 0 0;
    width: 100%;
    max-width: var(--page-max);
    max-height: 85dvh;
    margin: 0 auto;
    padding: 0;
    border: 1px solid var(--c-border);
    border-bottom: 0;
    border-radius: var(--r-card) var(--r-card) 0 0;
    background: var(--c-bg-card);
    color: var(--c-text);
    box-shadow: var(--shadow-lg);
    z-index: var(--z-sheet);
  }
  .sheet[open] {
    animation: sheet-in var(--dur-base) var(--ease-out);
  }
  .sheet::backdrop {
    background: color-mix(in srgb, var(--c-scrim) 55%, transparent);
  }

  .sheet-body {
    padding: var(--s-2) var(--s-4) calc(var(--s-6) + env(safe-area-inset-bottom));
    overflow-y: auto;
    max-height: 85dvh;
  }

  .grip {
    width: 40px;
    height: 4px;
    margin: 0 auto var(--s-2);
    border-radius: var(--r-pill);
    background: var(--c-border-strong);
  }

  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-3);
    margin-bottom: var(--s-3);
  }
  .sheet-head h2 {
    margin: 0;
    font-size: var(--fs-lg);
  }

  .close {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--tap);
    height: var(--tap);
    margin-left: auto;
    margin-right: calc(-1 * var(--s-2));
    border: 0;
    border-radius: var(--r-pill);
    background: transparent;
    color: var(--c-text-muted);
    cursor: pointer;
  }
  .close:hover { background: var(--c-bg-sunken); color: var(--c-text); }

  @keyframes sheet-in {
    from { transform: translateY(24px); opacity: 0; }
  }
</style>
