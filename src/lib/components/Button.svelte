<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  type Props = HTMLButtonAttributes & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'md' | 'sm';
    block?: boolean;
    /** Renders a link styled as a button. */
    href?: string;
    children: Snippet;
  };

  let {
    variant = 'primary',
    size = 'md',
    block = false,
    href,
    type = 'button',
    class: extra = '',
    children,
    ...rest
  }: Props = $props();

  const cls = $derived(
    ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', extra]
      .filter(Boolean)
      .join(' ')
  );
</script>

{#if href}
  <a {href} class={cls} {...(rest as HTMLAnchorAttributes)}>{@render children()}</a>
{:else}
  <button {type} class={cls} {...rest}>{@render children()}</button>
{/if}
