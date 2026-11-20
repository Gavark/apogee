<script lang="ts">
  import Globe from 'phosphor-svelte/lib/Globe';
  import CaretDown from 'phosphor-svelte/lib/CaretDown';
  import Check from 'phosphor-svelte/lib/Check';
  import * as m from '$paraglide/messages';
  import type { Locale } from '$lib/server/auth/locale';

  let { current }: { current: Locale } = $props();

  const OPTIONS: Array<{ code: Locale; label: () => string }> = [
    { code: 'fr', label: m.locale_name_fr },
    { code: 'en', label: m.locale_name_en }
  ];

  let open = $state(false);
  let busy = $state(false);

  async function pick(code: Locale) {
    if (busy || code === current) { open = false; return; }
    busy = true;
    try {
      const res = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: code })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      location.reload();
    } catch (e) {
      busy = false;
      open = false;
      console.error('locale switch failed', e);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="locale-switcher">
  <button
    type="button"
    class="trigger"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={m.locale_switcher_label()}
    onclick={() => (open = !open)}
    disabled={busy}
  >
    <Globe size={20} weight="regular" aria-hidden="true" />
    <span>{current.toUpperCase()}</span>
    <CaretDown size={12} weight="bold" aria-hidden="true" />
  </button>
  {#if open}
    <ul class="menu" role="listbox" aria-label={m.locale_switcher_label()}>
      {#each OPTIONS as opt (opt.code)}
        <li>
          <button
            type="button"
            role="option"
            aria-selected={opt.code === current}
            lang={opt.code}
            class="option"
            onclick={() => pick(opt.code)}
          >
            <span>{opt.label()}</span>
            {#if opt.code === current}<Check size={16} weight="bold" aria-hidden="true" />{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .locale-switcher { position: relative; display: inline-block; }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--s-1);
    min-height: var(--tap);
    padding: 0 var(--s-3);
    border: 1.5px solid var(--c-border);
    border-radius: var(--r-pill);
    background: transparent;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    font-weight: var(--fw-semibold);
    cursor: pointer;
  }
  .trigger:hover { color: var(--c-text); border-color: var(--c-border-strong); }

  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + var(--s-1));
    min-width: 168px;
    margin: 0;
    padding: var(--s-1);
    list-style: none;
    background: var(--c-bg-card);
    border: 1px solid var(--c-border);
    border-radius: var(--r-control);
    box-shadow: var(--shadow-md);
    z-index: var(--z-sheet);
  }

  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: var(--tap);
    padding: 0 var(--s-3);
    border: 0;
    border-radius: calc(var(--r-control) - 4px);
    background: transparent;
    color: var(--c-text);
    text-align: left;
    cursor: pointer;
  }
  .option:hover { background: var(--c-bg-sunken); }
  .option[aria-selected='true'] { color: var(--c-link); font-weight: var(--fw-semibold); }
</style>
