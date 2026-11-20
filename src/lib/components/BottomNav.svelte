<script lang="ts">
  import { page } from '$app/state';
  import Wine from 'phosphor-svelte/lib/Wine';
  import Rows from 'phosphor-svelte/lib/Rows';
  import Plus from 'phosphor-svelte/lib/Plus';
  import UserCircle from 'phosphor-svelte/lib/UserCircle';
  import * as m from '$paraglide/messages';

  const path = $derived(page.url.pathname);
  const under = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

  const tabs = $derived([
    { href: '/app', icon: Wine, label: m.nav_what_to_open, active: path === '/app' },
    { href: '/app/cave', icon: Rows, label: m.nav_cellar, active: under('/app/cave') },
    { href: '/app/add', icon: Plus, label: m.nav_add, active: under('/app/add'), primary: true },
    { href: '/account', icon: UserCircle, label: m.nav_account, active: under('/account') }
  ]);
</script>

<nav class="bottom-nav" aria-label={m.nav_label()}>
  <div class="inner">
    {#each tabs as t (t.href)}
      {@const Icon = t.icon}
      {#if t.primary}
        <a href={t.href} class="tab add" aria-current={t.active ? 'page' : undefined}>
          <span class="add-disc"><Icon size={26} weight="bold" aria-hidden="true" /></span>
          <span class="visually-hidden">{t.label()}</span>
        </a>
      {:else}
        <a href={t.href} class="tab" aria-current={t.active ? 'page' : undefined}>
          <Icon size={24} weight={t.active ? 'fill' : 'regular'} aria-hidden="true" />
          <span class="label">{t.label()}</span>
        </a>
      {/if}
    {/each}
  </div>
</nav>

<style>
  .bottom-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-nav);
    background: var(--c-bg-card);
    border-top: 1px solid var(--c-border);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .inner {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    max-width: var(--page-max);
    height: var(--nav-h);
    margin: 0 auto;
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 0;
    color: var(--c-text-muted);
    text-decoration: none;
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    -webkit-tap-highlight-color: transparent;
  }
  .tab:hover { color: var(--c-text); }
  .tab[aria-current='page'] {
    color: var(--c-link);
    font-weight: var(--fw-semibold);
  }
  .tab:focus-visible { outline-offset: -4px; }

  .label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0 var(--s-1);
  }

  .add-disc {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: var(--r-pill);
    background: var(--c-fill);
    color: var(--c-on-fill);
    box-shadow: var(--shadow-md);
    transition: transform var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
  }
  .add:hover .add-disc { background: var(--c-fill-hover); }
  .add:active .add-disc { transform: scale(0.95); }
  .add[aria-current='page'] .add-disc { background: var(--c-fill-hover); }
</style>
