<script lang="ts">
  import { enhance } from '$app/forms';
  import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
  import Trash from 'phosphor-svelte/lib/Trash';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import DrinkButton from '$lib/components/DrinkButton.svelte';
  import Field from '$lib/components/Field.svelte';
  import LotList from '$lib/components/LotList.svelte';
  import PhaseBadge from '$lib/components/PhaseBadge.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import AiEstimateSheet from '$lib/components/AiEstimateSheet.svelte';
  import WindowTimeline from '$lib/components/WindowTimeline.svelte';
  import { applyPending } from '$lib/offline/overlay';
  import { network } from '$lib/offline/online.svelte';
  import { pendingOps, reload } from '$lib/offline/pending.svelte';
  import { newOpId, sendStockOps, SessionExpiredError, undoGesture, type ClientOpResult } from '$lib/stock-client';
  import { showToast } from '$lib/toast.svelte';
  import { applyPendingReviews } from '$lib/verdict';
  import { askVerdict } from '$lib/verdict-sheet.svelte';
  import { colorLabel, confidenceLabel, formatLabel, verdictLabel, wineTitle } from '$lib/wine-labels';
  import { currentYear } from '$lib/phase';
  import type { CellarLot } from '$lib/server/wines';
  import type { OpResult, StockOp } from '$lib/server/stock';

  let { data } = $props();

  // Pending gestures (queued offline, or applied and not reloaded yet) show at once.
  const detail = $derived(applyPending(data.detail, pendingOps()));
  const wine = $derived(detail.wine);
  const history = $derived(applyPendingReviews(detail.consumptions, pendingOps()));
  const lots = $derived(detail.lots.filter((l) => l.quantity > 0));
  const year = $derived(currentYear(data.user?.timezone ?? 'UTC'));

  let busy = $state(false);
  let errorMsg = $state<string | null>(null);
  let moving = $state<CellarLot | null>(null);
  let moveTo = $state('');
  let moveQty = $state('1');
  let movePosition = $state('');
  let confirmingDelete = $state(false);
  let photoOpen = $state(false);
  let estimating = $state(false);

  const title = $derived(wineTitle(wine));
  const subtitle = $derived(
    [
      wine.appellation,
      wine.region,
      wine.vintage ?? m.wine_nv(),
      colorLabel(wine.color),
      wine.formatCl === 75 ? null : formatLabel(wine.formatCl)
    ]
      .filter((x) => x !== null && x !== '')
      .join(' · ')
  );

  const REASONS: Record<NonNullable<OpResult['reason']>, () => string> = {
    empty_lot: m.wine_err_empty_lot,
    not_found: m.wine_err_op,
    invalid: m.wine_err_op
  };

  /**
   * Sends one op and refreshes the page data (not needed while it is queued: the overlay shows it).
   * Resolves with the result, or null when it failed (message shown).
   */
  async function run(op: StockOp): Promise<ClientOpResult | null> {
    if (busy) return null;
    busy = true;
    errorMsg = null;
    let queued = false;
    try {
      const [result] = await sendStockOps([op]);
      queued = result.status === 'queued';
      if (result.status === 'rejected') {
        errorMsg = REASONS[result.reason ?? 'invalid']();
        return null;
      }
      return result;
    } catch (e) {
      if (!(e instanceof SessionExpiredError)) errorMsg = m.wine_err_network();
      return null;
    } finally {
      if (!queued) await reload();
      busy = false;
    }
  }

  async function adjust(lot: CellarLot, delta: 1 | -1) {
    const op: StockOp = { opId: newOpId(), kind: 'adjust', lotId: lot.lotId, delta };
    const r = await run(op);
    if (!r) return;
    const undo = { label: m.wine_toast_undo(), run: () => void undoGesture(op) };
    if (r.status === 'queued') {
      showToast(m.offline_saved(), delta === -1 ? undo : undefined);
      return;
    }
    // Undo only what was really removed: a lot already emptied elsewhere applies 0.
    if (delta === -1 && (r.appliedQuantity ?? 0) < 0) showToast(m.wine_toast_removed(), undo);
  }

  // Moving a lot onto itself (same location, same spot) is rejected by the server: block it here.
  const moveIsNoop = $derived(
    moving !== null && Number(moveTo) === moving.locationId && movePosition.trim() === moving.position
  );

  function openMove(lot: CellarLot) {
    moving = lot;
    moveTo = String(data.locations.find((l) => l.id !== lot.locationId)?.id ?? lot.locationId);
    movePosition = '';
    moveQty = '1';
  }

  async function submitMove(e: SubmitEvent) {
    e.preventDefault();
    const lot = moving;
    if (!lot || moveIsNoop) return;
    const quantity = Math.min(Math.max(1, Math.floor(Number(moveQty) || 1)), lot.quantity);
    const r = await run({
      opId: newOpId(),
      kind: 'move',
      lotId: lot.lotId,
      toLocationId: Number(moveTo),
      toPosition: movePosition.trim(),
      quantity
    });
    moving = null;
    if (r?.status === 'queued') showToast(m.offline_saved());
    else if (r?.appliedQuantity) showToast(m.wine_toast_moved({ count: r.appliedQuantity }));
  }
</script>

<svelte:head><title>{title}</title></svelte:head>

<header class="head">
  <div class="head-text">
    <h1>{title}</h1>
    <p class="muted">{subtitle}</p>
  </div>
  <PhaseBadge phase={detail.phase} />
</header>

<div class="stack">
  {#if detail.hasPhoto}
    <button type="button" class="photo" aria-label={m.wine_photo_open()} onclick={() => (photoOpen = true)}>
      <img src="/app/wines/{wine.id}/photo" alt={title} loading="lazy" />
    </button>
  {/if}

  <Card>
    <h2>{m.wine_window_title()}</h2>
    <WindowTimeline
      drinkFrom={wine.drinkFrom}
      peakFrom={wine.peakFrom}
      peakTo={wine.peakTo}
      drinkUntil={wine.drinkUntil}
      currentYear={year}
    />
    <p class="muted small">
      {#if wine.windowSource === 'ai'}
        {m.wine_window_ai({ confidence: confidenceLabel(wine.aiConfidence) })}
      {:else if wine.drinkFrom === null}
        {m.wine_window_unknown()}
      {:else}
        {m.wine_window_manual()}
      {/if}
    </p>
    {#if wine.windowSource === 'ai'}
      {#if wine.aiRationale}
        <details class="why">
          <summary>{m.wine_window_ai_why()}</summary>
          <p>{wine.aiRationale}</p>
        </details>
      {/if}
      {#if wine.aiModel}<p class="muted tiny">{m.wine_window_ai_model({ model: wine.aiModel })}</p>{/if}
    {/if}
    {#if data.aiEnabled}
      <div class="estimate">
        <Button variant="secondary" size="sm" disabled={!network.online} onclick={() => (estimating = true)}>
          {m.wine_ai_reestimate()}
        </Button>
      </div>
    {/if}
  </Card>

  <Card>
    <div class="card-head">
      <h2>{m.wine_lots_title()}</h2>
      <span class="muted">{m.wine_bottle_count({ count: detail.bottles })}</span>
    </div>
    {#if lots.length === 0}
      <p class="muted">{m.wine_lots_empty()}</p>
    {:else}
      <LotList {lots} {busy} onadjust={adjust} onmove={openMove} />
      <div class="drink">
        <DrinkButton row={detail} block />
      </div>
    {/if}
    {#if errorMsg}<p class="error" role="alert">{errorMsg}</p>{/if}
  </Card>

  {#if wine.notes}
    <Card><p class="notes">{wine.notes}</p></Card>
  {/if}

  <Card>
    <h2>{m.wine_history_title()}</h2>
    {#if history.length === 0}
      <p class="muted">{m.wine_history_empty()}</p>
    {:else}
      <ul class="history">
        {#each history as c (c.id)}
          <li>
            <strong>{c.consumedOn}{c.verdict ? ` · ${verdictLabel(c.verdict)}` : ''}</strong>
            <span class="muted">
              {[
                c.locationName ? m.wine_history_from({ location: c.locationName }) : null,
                c.userEmail ? m.wine_history_by({ user: c.userEmail }) : null
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {#if c.note}<span class="note">{c.note}</span>{/if}
            <span class="verdict-action">
              <Button
                variant="ghost"
                size="sm"
                onclick={() =>
                  askVerdict({
                    title: `${title} ${wine.vintage ?? m.wine_nv()}`,
                    ref: { consumptionId: c.id },
                    verdict: c.verdict,
                    note: c.note
                  })}
              >
                {c.verdict ? m.wine_history_verdict_edit() : m.wine_history_verdict_add()}
              </Button>
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>

  <div class="actions">
    <Button variant="secondary" href="/app/wines/{wine.id}/edit"><PencilSimple size={18} aria-hidden="true" />{m.wine_edit()}</Button>
    <Button variant="ghost" disabled={!network.online} onclick={() => (confirmingDelete = true)}><Trash size={18} aria-hidden="true" />{m.wine_delete()}</Button>
  </div>
</div>

<Sheet open={moving !== null} onclose={() => (moving = null)} title={m.wine_move_title()}>
  <form class="sheet-form" onsubmit={submitMove}>
    <Field label={m.wine_move_to()}>
      {#snippet children(control)}
        <select {...control} bind:value={moveTo}>
          {#each data.locations as loc (loc.id)}
            <option value={String(loc.id)}>{loc.name}</option>
          {/each}
        </select>
      {/snippet}
    </Field>
    <Field label={m.form_position()} bind:value={movePosition} autocomplete="off" />
    <Field label={m.form_quantity()} type="number" inputmode="numeric" min="1" max={moving?.quantity} bind:value={moveQty} />
    {#if moveIsNoop}<p class="muted small">{m.wine_move_same_hint()}</p>{/if}
    <Button type="submit" block disabled={busy || moveIsNoop}>{m.wine_move_submit()}</Button>
  </form>
</Sheet>

<AiEstimateSheet
  open={estimating}
  onclose={() => (estimating = false)}
  wineId={wine.id}
  current={{ drinkFrom: wine.drinkFrom, peakFrom: wine.peakFrom, peakTo: wine.peakTo, drinkUntil: wine.drinkUntil }}
  currentYear={year}
/>

{#if detail.hasPhoto}
  <Sheet open={photoOpen} onclose={() => (photoOpen = false)} title={m.wine_photo_title()}>
    {#if photoOpen}<img class="photo-full" src="/app/wines/{wine.id}/photo" alt={title} />{/if}
  </Sheet>
{/if}

<Sheet open={confirmingDelete} onclose={() => (confirmingDelete = false)} title={m.wine_delete_title()}>
  <p>{m.wine_delete_body()}</p>
  <form method="POST" action="?/delete" use:enhance class="sheet-form">
    <Button type="submit" variant="danger" block disabled={!network.online}>{m.wine_delete_confirm()}</Button>
    <Button variant="ghost" block onclick={() => (confirmingDelete = false)}>{m.wine_cancel()}</Button>
  </form>
</Sheet>

<style>
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-3); }
  .head-text { min-width: 0; }
  h1 { margin: 0; overflow-wrap: anywhere; }
  h2 { margin: 0 0 var(--s-3); font-size: var(--fs-lg); }
  .muted { color: var(--c-text-muted); margin: 0; }
  .small { font-size: var(--fs-sm); margin-top: var(--s-2); }
  .stack { display: grid; gap: var(--s-4); margin-top: var(--s-5); padding-bottom: var(--s-6); }
  .card-head { display: flex; align-items: baseline; justify-content: space-between; }
  .drink { margin-top: var(--s-4); }
  .error { color: var(--c-danger); font-size: var(--fs-sm); margin: var(--s-3) 0 0; }
  .notes { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .history { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--s-3); }
  .history li { display: flex; flex-direction: column; }
  .note { font-size: var(--fs-sm); }
  /* Pull the ghost button back by its padding + border so its text lines up with the row above. */
  .verdict-action { align-self: flex-start; margin-inline-start: calc(-1 * (var(--s-4) + 1.5px)); }
  .actions { display: flex; gap: var(--s-2); justify-content: space-between; }
  .sheet-form { display: grid; gap: var(--s-3); }
  .photo { padding: 0; border: 1px solid var(--c-border); border-radius: var(--r-card); background: var(--c-bg-card); overflow: hidden; cursor: zoom-in; }
  .photo img { display: block; width: 100%; max-height: 240px; object-fit: contain; }
  .photo-full { display: block; width: 100%; max-height: 70dvh; object-fit: contain; }
  .why { margin-top: var(--s-2); font-size: var(--fs-sm); }
  .why summary { cursor: pointer; min-height: var(--tap); display: flex; align-items: center; color: var(--c-accent); }
  .why p { margin: 0 0 var(--s-2); overflow-wrap: anywhere; }
  .tiny { font-size: var(--fs-xs, 0.75rem); margin-top: var(--s-1); }
  .estimate { margin-top: var(--s-3); }
</style>
