<script lang="ts">
  import CloudSlash from 'phosphor-svelte/lib/CloudSlash';
  import * as m from '$paraglide/messages';
  import { network } from '$lib/offline/online.svelte';
</script>

{#if !network.online}
  <p class="required" role="status">
    <CloudSlash size={16} aria-hidden="true" />{m.network_required()}
  </p>
{/if}

<style>
  .required {
    display: flex;
    align-items: center;
    gap: var(--s-1);
    margin: 0 0 var(--s-3);
    padding: var(--s-2) var(--s-3);
    border-radius: var(--r-control);
    background: var(--c-bg-sunken);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
</style>
