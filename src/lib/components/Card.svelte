<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  let {
    class: extra = '',
    children,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & { children: Snippet } = $props();
</script>

<div class="card {extra}" {...rest}>{@render children()}</div>
