<script lang="ts">
  import Question from 'phosphor-svelte/lib/Question';
  import * as m from '$paraglide/messages';
  import PhaseBadge from '$lib/components/PhaseBadge.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import { HOME_SECTION_ORDER, type Phase } from '$lib/phase';

  let open = $state(false);

  // One sentence per phase, listed in urgency order (HOME_SECTION_ORDER).
  const hints: Record<Phase, () => string> = {
    past: () => m.phase_hint_past(),
    last_call: () => m.phase_hint_last_call(),
    peak: () => m.phase_hint_peak(),
    ready: () => m.phase_hint_ready(),
    too_young: () => m.phase_hint_too_young(),
    unknown: () => m.phase_hint_unknown()
  };
</script>

<button type="button" class="open" aria-label={m.phase_legend_open()} onclick={() => (open = true)}>
  <Question size={20} weight="bold" aria-hidden="true" />
</button>

<Sheet {open} onclose={() => (open = false)} title={m.phase_legend_title()}>
  <p class="intro">{m.phase_legend_intro()}</p>
  <ul class="list">
    {#each HOME_SECTION_ORDER as phase (phase)}
      <li>
        <PhaseBadge {phase} />
        <span>{hints[phase]()}</span>
      </li>
    {/each}
  </ul>
</Sheet>

<style>
  .open {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--tap);
    height: var(--tap);
    border: 0;
    border-radius: var(--r-pill);
    background: transparent;
    color: var(--c-text-muted);
    cursor: pointer;
  }
  .open:hover { background: var(--c-bg-sunken); color: var(--c-text); }
  .intro { margin: 0 0 var(--s-3); color: var(--c-text-muted); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-3); }
  .list li { display: flex; align-items: center; gap: var(--s-3); }
  .list li > :global(:first-child) { flex: none; }
</style>
