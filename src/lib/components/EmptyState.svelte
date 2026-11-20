<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import type { IconComponentProps } from 'phosphor-svelte';

  type Props = {
    title: string;
    description?: string;
    /** A phosphor-svelte icon component. */
    icon?: Component<IconComponentProps>;
    /** Call to action(s), usually one <Button>. */
    children?: Snippet;
  };

  let { title, description, icon: Icon, children }: Props = $props();
</script>

<section class="empty">
  {#if Icon}
    <span class="icon" aria-hidden="true"><Icon size={28} weight="duotone" aria-hidden="true" /></span>
  {/if}
  <h2 class="title">{title}</h2>
  {#if description}<p class="description">{description}</p>{/if}
  {#if children}<div class="actions">{@render children()}</div>{/if}
</section>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--s-2);
    padding: var(--s-6) var(--s-5);
    border: 1.5px dashed var(--c-border);
    border-radius: var(--r-card);
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    margin-bottom: var(--s-2);
    border-radius: var(--r-pill);
    background: var(--c-bg-sunken);
    color: var(--c-accent);
  }
  .title {
    margin: 0;
    font-size: var(--fs-lg);
  }
  .description {
    max-width: 40ch;
    margin: 0;
    color: var(--c-text-muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
    margin-top: var(--s-3);
  }
</style>
