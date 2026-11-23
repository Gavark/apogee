import { describe, expect, it } from 'vitest';
import { activePhase, visibleSections } from '../../src/lib/home-filter';

const s = (phase: string) => ({ phase }) as { phase: import('../../src/lib/phase').Phase };
const sections = [s('last_call'), s('peak'), s('too_young')];

describe('activePhase', () => {
  it('keeps a selected phase that is present', () => expect(activePhase(sections, 'peak')).toBe('peak'));
  it('falls back to all when nothing is selected', () => expect(activePhase(sections, null)).toBeNull());
  it('falls back to all when the selected phase has gone', () => expect(activePhase(sections, 'ready')).toBeNull());
});

describe('visibleSections', () => {
  it('shows everything for null', () => expect(visibleSections(sections, null)).toEqual(sections));
  it('shows only the active phase', () => expect(visibleSections(sections, 'too_young')).toEqual([s('too_young')]));
});
