<script lang="ts">
  import '$lib/styles/tokens.css';
  import '$lib/styles/base.css';
  import '$lib/styles/components.css';
  import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import Toast from '$lib/components/Toast.svelte';

  let { children, data } = $props();
</script>

<svelte:head>
  <link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<!-- Anonymous visitors (login, signup, setup, public error pages) get the
     language and theme controls here. Once logged in, the account screen
     carries them, so they are not shown twice. -->
{#if !data.user}
  <header class="public-topbar">
    <LocaleSwitcher current={data.locale} />
    <ThemeToggle initial={data.theme} />
  </header>
{/if}

<main>
  {@render children()}
</main>

<Toast />

<style>
  .public-topbar {
    display: flex;
    justify-content: flex-end;
    gap: var(--s-2);
    max-width: var(--page-max);
    margin: 0 auto;
    padding: var(--s-3) var(--s-4) 0;
  }
</style>
