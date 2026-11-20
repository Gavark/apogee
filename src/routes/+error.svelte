<script lang="ts">
  import { page } from '$app/state';
  import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  const signedIn = $derived(!!(page.data as { user?: unknown }).user);
  // SvelteKit's own messages are English: show localised ones instead.
  const description = $derived(page.status === 404 ? m.error_not_found() : m.error_generic());
</script>

<svelte:head><title>{m.error_title({ status: page.status })}</title></svelte:head>

<EmptyState title={m.error_title({ status: page.status })} {description} icon={WarningCircle}>
  <Button href={signedIn ? '/app' : '/login'}>{signedIn ? m.error_back_app() : m.error_back_login()}</Button>
</EmptyState>
