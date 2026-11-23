import { describe, expect, it } from 'vitest';
import { activePhases, togglePhase, visibleSections } from '../../src/lib/home-filter';
import type { Phase } from '../../src/lib/phase';

const s = (phase: Phase) => ({ phase });
const sections = [s('last_call'), s('peak'), s('ready'), s('too_young')];

describe('activePhases', () => {
  it('keeps the selected phases that are present, in section order', () =>
    expect(activePhases(sections, ['too_young', 'last_call'])).toEqual(['last_call', 'too_young']));
  it('is empty (= all) when nothing is selected', () => expect(activePhases(sections, [])).toEqual([]));
  it('drops a selected phase that has gone', () => expect(activePhases(sections, ['past', 'peak'])).toEqual(['peak']));
  it('falls back to all when every selected phase has gone', () =>
    expect(activePhases(sections, ['past', 'unknown'])).toEqual([]));
});

describe('togglePhase', () => {
  it('adds a phase that is not active', () => expect(togglePhase(['peak'], 'ready')).toEqual(['peak', 'ready']));
  it('removes a phase that is active', () => expect(togglePhase(['peak', 'ready'], 'peak')).toEqual(['ready']));
  it('starts a selection from all', () => expect(togglePhase([], 'peak')).toEqual(['peak']));
});

describe('visibleSections', () => {
  it('shows everything when nothing is active', () => expect(visibleSections(sections, [])).toEqual(sections));
  it('shows the active phases, in section order', () =>
    expect(visibleSections(sections, ['too_young', 'peak'])).toEqual([s('peak'), s('too_young')]));
});
