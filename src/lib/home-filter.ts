// Phase filter of the home screen. Pure: it only narrows the sections already computed.
import type { Phase } from '$lib/phase';

/** The selected phase if it is still among the sections, otherwise null (= all). */
export function activePhase(sections: { phase: Phase }[], selected: Phase | null): Phase | null {
  return selected !== null && sections.some((s) => s.phase === selected) ? selected : null;
}

/** All sections when nothing is active, otherwise only the active phase's section. */
export function visibleSections<S extends { phase: Phase }>(sections: S[], active: Phase | null): S[] {
  return active === null ? sections : sections.filter((s) => s.phase === active);
}
