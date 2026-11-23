// Phase filter of the home screen. Pure: it only narrows the sections already computed.
// Several phases can be combined; an empty selection means "all".
import type { Phase } from '$lib/phase';

/** The selected phases still among the sections, in section order. Empty means all. */
export function activePhases(sections: { phase: Phase }[], selected: Phase[]): Phase[] {
  return sections.map((s) => s.phase).filter((p) => selected.includes(p));
}

/** Adds `phase` to the active phases, or removes it when it is already there. */
export function togglePhase(active: Phase[], phase: Phase): Phase[] {
  return active.includes(phase) ? active.filter((p) => p !== phase) : [...active, phase];
}

/** All sections when nothing is active, otherwise only the active phases' sections. */
export function visibleSections<S extends { phase: Phase }>(sections: S[], active: Phase[]): S[] {
  return active.length === 0 ? sections : sections.filter((s) => active.includes(s.phase));
}
