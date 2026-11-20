<script lang="ts">
  import X from 'phosphor-svelte/lib/X';
  import * as m from '$paraglide/messages';
  import { toast, dismissToast } from '$lib/toast.svelte';

  function runAction() {
    const action = toast.current?.action;
    dismissToast();
    action?.run();
  }
</script>

<!-- Mounted once in the root layout. The live region stays in the DOM so
     screen readers announce each new message. -->
<div class="toast-region" role="status" aria-live="polite" aria-label={m.toast_region()}>
  {#if toast.current}
    {#key toast.current.id}
      <div class="toast">
        <p class="message">{toast.current.message}</p>
        {#if toast.current.action}
          <button type="button" class="action" onclick={runAction}>
            {toast.current.action.label}
          </button>
        {/if}
        <button type="button" class="dismiss" aria-label={m.toast_dismiss()} onclick={dismissToast}>
          <X size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>
    {/key}
  {/if}
</div>

<style>
  .toast-region {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--s-4) + env(safe-area-inset-bottom));
    z-index: var(--z-toast);
    display: flex;
    justify-content: center;
    padding: 0 var(--s-4);
    pointer-events: none;
  }
  /* Sit above the bottom bar when the page has one. */
  :global(body:has(.bottom-nav)) .toast-region {
    bottom: calc(var(--nav-h) + var(--s-3) + env(safe-area-inset-bottom));
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--s-1);
    width: 100%;
    max-width: calc(var(--page-max) - 2 * var(--s-4));
    min-height: 56px;
    padding: var(--s-1) var(--s-1) var(--s-1) var(--s-4);
    border-radius: var(--r-card);
    background: var(--c-toast-bg);
    color: var(--c-toast-text);
    box-shadow: var(--shadow-lg);
    animation: toast-in var(--dur-base) var(--ease-out);
  }

  .message {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }

  .action,
  .dismiss {
    flex: none;
    min-height: var(--tap);
    border: 0;
    border-radius: var(--r-control);
    background: transparent;
    cursor: pointer;
  }
  .action {
    padding: 0 var(--s-3);
    color: var(--c-toast-action);
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
  }
  .dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--tap);
    color: var(--c-toast-text);
  }
  .action:hover,
  .dismiss:hover {
    background: color-mix(in srgb, var(--c-toast-text) 10%, transparent);
  }

  @keyframes toast-in {
    from { transform: translateY(12px); opacity: 0; }
  }
</style>
