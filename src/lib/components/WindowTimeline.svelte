<script lang="ts">
  import * as m from '$paraglide/messages';

  type Props = {
    drinkFrom: number | null;
    peakFrom: number | null;
    peakTo: number | null;
    drinkUntil: number | null;
    currentYear: number;
  };

  let { drinkFrom, peakFrom, peakTo, drinkUntil, currentYear }: Props = $props();

  // A window needs both ends (spec §6.3); the peak is optional.
  const known = $derived(drinkFrom !== null && drinkUntil !== null);
  const hasPeak = $derived(known && peakFrom !== null && peakTo !== null);

  // Years are cells: year Y covers [Y, Y + 1) on the axis. One spare year on
  // each side, and the current year always in view.
  const lo = $derived(Math.min(drinkFrom ?? currentYear, currentYear) - 1);
  const hi = $derived(Math.max(drinkUntil ?? currentYear, currentYear) + 2);
  const pct = (year: number) => ((year - lo) / (hi - lo)) * 100;

  type Segment = { kind: 'too-young' | 'ready' | 'peak' | 'last-call'; from: number; to: number };

  const segments = $derived.by((): Segment[] => {
    if (drinkFrom === null || drinkUntil === null) return [];
    const end = drinkUntil + 1;
    const out: Segment[] = [{ kind: 'too-young', from: lo, to: drinkFrom }];
    if (hasPeak) {
      // Clamped so the segments stay in order whatever was typed. The final
      // year is always "drink soon" (spec §6.3: Y == drink_until).
      const pFrom = Math.min(Math.max(peakFrom!, drinkFrom), drinkUntil);
      const pTo = Math.min(Math.max(peakTo! + 1, pFrom), drinkUntil);
      out.push({ kind: 'ready', from: drinkFrom, to: pFrom });
      out.push({ kind: 'peak', from: pFrom, to: pTo });
      out.push({ kind: 'last-call', from: pTo, to: end });
    } else {
      // Without a peak, the final year is the "drink soon" year.
      out.push({ kind: 'ready', from: drinkFrom, to: drinkUntil });
      out.push({ kind: 'last-call', from: drinkUntil, to: end });
    }
    return out.filter((s) => s.to > s.from);
  });

  const summary = $derived.by(() => {
    if (drinkFrom === null || drinkUntil === null) return m.timeline_unknown();
    const base = { from: drinkFrom, until: drinkUntil, current: currentYear };
    return hasPeak
      ? m.timeline_summary_peak({ ...base, peakFrom: peakFrom!, peakTo: peakTo! })
      : m.timeline_summary(base);
  });

  // Middle of the current year's cell.
  const nowPct = $derived(pct(currentYear + 0.5));
</script>

<figure class="timeline" aria-label={m.timeline_label()}>
  {#if known}
    <div class="now-row" aria-hidden="true">
      <span class="now-label" style:--x="{nowPct}%">{currentYear}</span>
    </div>
    <div class="track" aria-hidden="true">
      {#each segments as s (s.kind)}
        <span
          class="seg seg-{s.kind}"
          style:left="{pct(s.from)}%"
          style:width="{pct(s.to) - pct(s.from)}%"
        ></span>
      {/each}
      <span class="now-mark" style:left="{nowPct}%"></span>
    </div>
    <div class="ends" aria-hidden="true">
      <!-- drinkFrom ends at the window start, drinkUntil starts at its end:
           they grow away from each other and are clamped inside the figure. -->
      <span class="end end-from" style:--x="{pct(drinkFrom!)}%">{drinkFrom}</span>
      <span class="end end-until" style:--x="{pct(drinkUntil! + 1)}%">{drinkUntil}</span>
    </div>
    {#if hasPeak}
      <p class="peak-legend" aria-hidden="true">
        <span class="swatch"></span>{m.timeline_peak_range({ peakFrom: peakFrom!, peakTo: peakTo! })}
      </p>
    {/if}
    <figcaption class="visually-hidden">{summary}</figcaption>
  {:else}
    <div class="track track-unknown" aria-hidden="true"></div>
    <figcaption class="unknown">{summary}</figcaption>
  {/if}
</figure>

<style>
  .timeline {
    --label-w: 4.6ch;
    margin: 0;
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    color: var(--c-text-muted);
    min-width: 0;
  }

  .track {
    position: relative;
    height: 12px;
    border-radius: var(--r-pill);
    background: var(--c-bg-sunken);
    overflow: hidden;
  }
  .track-unknown {
    background: repeating-linear-gradient(
      -45deg,
      var(--c-bg-sunken) 0 6px,
      var(--c-border) 6px 8px
    );
  }

  .seg {
    position: absolute;
    top: 0;
    bottom: 0;
  }
  .seg-too-young { background: var(--c-phase-too-young-mark); top: 4px; bottom: 4px; }
  .seg-ready { background: var(--c-phase-ready-mark); }
  .seg-peak { background: var(--c-phase-peak-mark); }
  .seg-last-call { background: var(--c-phase-last-call-mark); }

  .now-mark {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    transform: translateX(-50%);
    background: var(--c-text);
    box-shadow: 0 0 0 2px var(--c-bg-card);
  }

  .now-row,
  .ends {
    position: relative;
    height: 1.4em;
  }
  .now-row { margin-bottom: var(--s-1); }
  .ends { margin-top: var(--s-1); }

  .now-label,
  .end {
    position: absolute;
    top: 0;
    width: var(--label-w);
    white-space: nowrap;
  }
  .now-label {
    left: clamp(0%, calc(var(--x) - var(--label-w) / 2), calc(100% - var(--label-w)));
    text-align: center;
    color: var(--c-text);
    font-weight: var(--fw-bold);
  }
  .end-from {
    left: clamp(0%, calc(var(--x) - var(--label-w)), calc(100% - var(--label-w) * 2));
    text-align: right;
    padding-right: 2px;
  }
  .end-until {
    left: clamp(var(--label-w), var(--x), calc(100% - var(--label-w)));
    text-align: left;
    padding-left: 2px;
  }

  .peak-legend {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    margin: var(--s-2) 0 0;
    color: var(--c-text);
  }
  .swatch {
    width: 14px;
    height: 8px;
    border-radius: var(--r-pill);
    background: var(--c-phase-peak-mark);
  }

  .unknown {
    margin-top: var(--s-2);
  }
</style>
