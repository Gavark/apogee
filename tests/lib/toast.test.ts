import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast, showToast, dismissToast } from '../../src/lib/toast.svelte';

describe('toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dismissToast();
  });
  afterEach(() => vi.useRealTimers());

  it('shows a message and hides it after 5 s by default', () => {
    showToast('Lieu enregistré.');
    expect(toast.current?.message).toBe('Lieu enregistré.');
    vi.advanceTimersByTime(4999);
    expect(toast.current).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(toast.current).toBeNull();
  });

  it('honours a custom duration', () => {
    showToast('Court', undefined, 1000);
    vi.advanceTimersByTime(1000);
    expect(toast.current).toBeNull();
  });

  it('a new toast replaces the current one and restarts the timer', () => {
    showToast('Premier');
    vi.advanceTimersByTime(4000);
    showToast('Second');
    expect(toast.current?.message).toBe('Second');
    vi.advanceTimersByTime(4000);
    expect(toast.current?.message).toBe('Second');
    vi.advanceTimersByTime(1000);
    expect(toast.current).toBeNull();
  });

  it('carries an optional action', () => {
    const run = vi.fn();
    showToast('Chinon 2016 marqué comme bu.', { label: 'Annuler', run });
    expect(toast.current?.action?.label).toBe('Annuler');
    toast.current?.action?.run();
    expect(run).toHaveBeenCalledOnce();
  });

  it('dismissToast hides it at once and cancels the timer', () => {
    showToast('Bientôt fermé');
    dismissToast();
    expect(toast.current).toBeNull();
    showToast('Suivant', undefined, 3000);
    vi.advanceTimersByTime(2999);
    expect(toast.current?.message).toBe('Suivant');
  });
});
