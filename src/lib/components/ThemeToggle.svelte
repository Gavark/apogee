<script lang="ts">
  import CircleHalf from 'phosphor-svelte/lib/CircleHalf';
  import Sun from 'phosphor-svelte/lib/Sun';
  import Moon from 'phosphor-svelte/lib/Moon';
  import * as m from '$paraglide/messages';

  import { themeFromAttr, type ThemeValue } from '$lib/theme';

  let { initial }: { initial: ThemeValue } = $props();
  // svelte-ignore state_referenced_locally — `initial` seeds the server render; the client then follows <html data-theme>
  let theme = $state<ThemeValue>(initial);

  // Several toggles can be mounted at once: follow the attribute rather than
  // a private copy of the state.
  $effect(() => {
    const el = document.documentElement;
    const sync = () => { theme = themeFromAttr(el.getAttribute('data-theme')); };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  });

  const order: ThemeValue[] = ['auto', 'light', 'dark'];

  async function cycle() {
    const idx = order.indexOf(theme);
    const next = order[(idx + 1) % order.length];
    theme = next;

    if (next === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', next);
    }

    const fd = new FormData();
    fd.set('value', next);
    try {
      await fetch('/api/theme', { method: 'POST', body: fd });
    } catch {
      /* network glitch: UI state remains in sync, cookie may be stale until next request */
    }
  }

  function label(t: ThemeValue): string {
    if (t === 'auto') return m.theme_label_auto();
    if (t === 'light') return m.theme_label_light();
    return m.theme_label_dark();
  }
</script>

<button
  type="button"
  class="theme-toggle"
  onclick={cycle}
  title={label(theme)}
  aria-label={label(theme)}
>
  {#if theme === 'auto'}
    <CircleHalf size={22} weight="regular" aria-hidden="true" />
  {:else if theme === 'light'}
    <Sun size={22} weight="regular" aria-hidden="true" />
  {:else}
    <Moon size={22} weight="regular" aria-hidden="true" />
  {/if}
</button>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--tap);
    height: var(--tap);
    padding: 0;
    border: 1.5px solid var(--c-border);
    border-radius: var(--r-pill);
    background: transparent;
    color: var(--c-text-muted);
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
  }
  .theme-toggle:hover {
    color: var(--c-text);
    border-color: var(--c-border-strong);
  }
</style>
