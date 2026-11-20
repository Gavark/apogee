<script lang="ts" module>
  /** What a custom control (select, textarea) must spread to stay labelled. */
  export type FieldControl = {
    id: string;
    class: string;
    'aria-invalid': 'true' | undefined;
    'aria-describedby': string | undefined;
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';
  import WarningCircle from 'phosphor-svelte/lib/WarningCircle';

  type Props = Omit<HTMLInputAttributes, 'children'> & {
    label: string;
    error?: string | null;
    hint?: string;
    /** Replaces the default <input>: `{#snippet children(control)}<select {...control}>…{/snippet}` */
    children?: Snippet<[FieldControl]>;
  };

  let {
    label,
    error = null,
    hint,
    value = $bindable(),
    children,
    ...rest
  }: Props = $props();

  const uid = $props.id();
  const id = $derived(rest.id ?? `${uid}-input`);
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;

  const control = $derived<FieldControl>({
    id,
    class: 'field-input',
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby':
      [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  });
</script>

<div class="field">
  <label class="field-label" for={id}>{label}</label>
  {#if children}
    {@render children(control)}
  {:else}
    <input {...rest} {...control} bind:value />
  {/if}
  {#if hint}<p class="field-hint" id={hintId}>{hint}</p>{/if}
  {#if error}
    <p class="field-error" id={errorId}>
      <WarningCircle size={16} weight="bold" aria-hidden="true" />
      <span>{error}</span>
    </p>
  {/if}
</div>
