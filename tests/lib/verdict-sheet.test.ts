import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verdictSheet, askVerdict, closeVerdict, dropVerdict } from '../../src/lib/verdict-sheet.svelte';

const base = { title: 'Chinon 2016', ref: { consumptionId: 1 }, verdict: null, note: null };

describe('verdict sheet', () => {
  beforeEach(() => dropVerdict());

  it('askVerdict sets the current request', () => {
    askVerdict({ ...base });
    expect(verdictSheet.current?.title).toBe('Chinon 2016');
  });

  it('closeVerdict calls onclosed once and clears; a second close is a no-op', () => {
    const onclosed = vi.fn();
    askVerdict({ ...base, onclosed });
    closeVerdict();
    expect(verdictSheet.current).toBeNull();
    closeVerdict();
    expect(onclosed).toHaveBeenCalledOnce();
  });

  it('a new request settles the open one first, then replaces it', () => {
    const first = vi.fn();
    const second = vi.fn();
    askVerdict({ ...base, title: 'A', onclosed: first });
    askVerdict({ ...base, title: 'B', onclosed: second });
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    expect(verdictSheet.current?.title).toBe('B');
  });

  it('dropVerdict clears without calling onclosed', () => {
    const onclosed = vi.fn();
    askVerdict({ ...base, onclosed });
    dropVerdict();
    expect(verdictSheet.current).toBeNull();
    expect(onclosed).not.toHaveBeenCalled();
  });
});
