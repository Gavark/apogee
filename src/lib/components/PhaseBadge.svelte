<script lang="ts">
  import type { Component } from 'svelte';
  import type { IconComponentProps } from 'phosphor-svelte';
  import Question from 'phosphor-svelte/lib/Question';
  import HourglassMedium from 'phosphor-svelte/lib/HourglassMedium';
  import Check from 'phosphor-svelte/lib/Check';
  import Star from 'phosphor-svelte/lib/Star';
  import Timer from 'phosphor-svelte/lib/Timer';
  import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
  import * as m from '$paraglide/messages';

  // Local until Task 7 exports it from $lib/phase.
  type Phase = 'unknown' | 'too_young' | 'ready' | 'peak' | 'last_call' | 'past';

  let { phase }: { phase: Phase } = $props();

  // Every phase has its own icon too: colour is never the only cue.
  const PHASES: Record<Phase, { label: () => string; icon: Component<IconComponentProps> }> = {
    unknown: { label: m.phase_unknown, icon: Question },
    too_young: { label: m.phase_too_young, icon: HourglassMedium },
    ready: { label: m.phase_ready, icon: Check },
    peak: { label: m.phase_peak, icon: Star },
    last_call: { label: m.phase_last_call, icon: Timer },
    past: { label: m.phase_past, icon: WarningCircle }
  };

  const entry = $derived(PHASES[phase]);
</script>

<span class="badge badge-{phase}">
  <entry.icon size={14} weight={phase === 'peak' ? 'fill' : 'bold'} aria-hidden="true" />
  {entry.label()}
</span>
