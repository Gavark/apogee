import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast, showToast, dismissToast, pauseToast, resumeToast } from '../../src/lib/toast.svelte';

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

  it('pause freezes the countdown and resume restarts a full duration', () => {
    showToast('Bue', { label: 'Annuler', run: () => {} });
    vi.advanceTimersByTime(4000);
    pauseToast();
    vi.advanceTimersByTime(60_000);
    expect(toast.current?.message).toBe('Bue');
    resumeToast();
    vi.advanceTimersByTime(4999);
    expect(toast.current).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(toast.current).toBeNull();
  });

  it('resume keeps the duration the toast was shown with', () => {
    showToast('Court', undefined, 1000);
    pauseToast();
    resumeToast();
    vi.advanceTimersByTime(1000);
    expect(toast.current).toBeNull();
  });

  it('resume without a toast, or without a prior pause, does nothing', () => {
    resumeToast();
    expect(toast.current).toBeNull();
    showToast('Plein', undefined, 2000);
    vi.advanceTimersByTime(1500);
    resumeToast(); // not paused: must not extend the countdown
    vi.advanceTimersByTime(500);
    expect(toast.current).toBeNull();
  });

  it('a new toast while paused starts running again', () => {
    showToast('A');
    pauseToast();
    showToast('B');
    vi.advanceTimersByTime(5000);
    expect(toast.current).toBeNull();
  });
});
