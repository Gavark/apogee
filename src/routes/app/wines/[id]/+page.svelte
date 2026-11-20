<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import Wine from 'phosphor-svelte/lib/Wine';
  import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
  import Trash from 'phosphor-svelte/lib/Trash';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Field from '$lib/components/Field.svelte';
  import LotList from '$lib/components/LotList.svelte';
  import PhaseBadge from '$lib/components/PhaseBadge.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import WindowTimeline from '$lib/components/WindowTimeline.svelte';
  import { newOpId, sendStockOps } from '$lib/stock-client';
  import { showToast } from '$lib/toast.svelte';
  import { colorLabel, formatLabel } from '$lib/wine-labels';
  import { currentYear } from '$lib/phase';
  import type { CellarLot } from '$lib/server/wines';
  import type { OpResult, StockOp } from '$lib/server/stock';

  let { data } = $props();

  const detail = $derived(data.detail);
  const wine = $derived(detail.wine);
  const lots = $derived(detail.lots.filter((l) => l.quantity > 0));
  const year = $derived(currentYear(data.user?.timezone ?? 'UTC'));

  let busy = $state(false);
  let errorMsg = $state<string | null>(null);
  let moving = $state<CellarLot | null>(null);
  let moveTo = $state('');
  let moveQty = $state('1');
  let movePosition = $state('');
  let pickingLot = $state(false);
  let confirmingDelete = $state(false);

  const title = $derived([wine.producer, wine.cuvee].filter(Boolean).join(' - ') || m.wine_unnamed());
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

  /** Sends one op and refreshes the page data. Resolves with the result, or null when it failed (message shown). */
  async function run(op: StockOp): Promise<OpResult | null> {
    if (busy) return null;
    busy = true;
    errorMsg = null;
    try {
      const [result] = await sendStockOps([op]);
      if (result.status === 'rejected') {
        errorMsg = REASONS[result.reason ?? 'invalid']();
        return null;
      }
      return result;
    } catch {
      errorMsg = m.wine_err_network();
      return null;
    } finally {
      await invalidateAll();
      busy = false;
    }
  }

  async function adjust(lot: CellarLot, delta: 1 | -1) {
    const r = await run({ opId: newOpId(), kind: 'adjust', lotId: lot.lotId, delta });
    if (r && delta === -1) {
      showToast(m.wine_toast_removed(), {
        label: m.wine_toast_undo(),
        run: async () => {
          await run({ opId: newOpId(), kind: 'adjust', lotId: lot.lotId, delta: 1 });
        }
      });
    }
  }

  function openMove(lot: CellarLot) {
    moving = lot;
    moveTo = String(data.locations.find((l) => l.id !== lot.locationId)?.id ?? lot.locationId);
    movePosition = '';
    moveQty = '1';
  }

  async function submitMove(e: SubmitEvent) {
    e.preventDefault();
    const lot = moving;
    if (!lot) return;
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
    if (r) showToast(m.wine_toast_moved({ count: r.appliedQuantity ?? quantity }));
  }

  async function drink(lot: CellarLot) {
    pickingLot = false;
    // Local calendar date, not UTC: a bottle opened at 00:30 belongs to today.
    const now = new Date();
    const consumedOn = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const r = await run({ opId: newOpId(), kind: 'consume', lotId: lot.lotId, consumedOn });
    if (r?.consumptionId) {
      const consumptionId = r.consumptionId;
      showToast(m.wine_toast_drunk(), {
        label: m.wine_toast_undo(),
        run: async () => {
          if (await run({ opId: newOpId(), kind: 'unconsume', consumptionId })) showToast(m.wine_toast_undone());
        }
      });
    }
  }

  const onDrinkClick = () => (lots.length === 1 ? drink(lots[0]) : (pickingLot = true));
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
      {wine.drinkFrom === null ? m.wine_window_unknown() : m.wine_window_manual()}
    </p>
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
        <Button block disabled={busy} onclick={onDrinkClick}><Wine size={20} aria-hidden="true" />{m.wine_drink()}</Button>
      </div>
    {/if}
    {#if errorMsg}<p class="error" role="alert">{errorMsg}</p>{/if}
  </Card>

  {#if wine.notes}
    <Card><p class="notes">{wine.notes}</p></Card>
  {/if}

  <Card>
    <h2>{m.wine_history_title()}</h2>
    {#if detail.consumptions.length === 0}
      <p class="muted">{m.wine_history_empty()}</p>
    {:else}
      <ul class="history">
        {#each detail.consumptions as c (c.id)}
          <li>
            <strong>{c.consumedOn}</strong>
            <span class="muted">
              {[
                c.locationName ? m.wine_history_from({ location: c.locationName }) : null,
                c.userEmail ? m.wine_history_by({ user: c.userEmail }) : null
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {#if c.note}<span class="note">{c.note}</span>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Card>

  <div class="actions">
    <Button variant="secondary" href="/app/wines/{wine.id}/edit"><PencilSimple size={18} aria-hidden="true" />{m.wine_edit()}</Button>
    <Button variant="ghost" onclick={() => (confirmingDelete = true)}><Trash size={18} aria-hidden="true" />{m.wine_delete()}</Button>
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
    <Button type="submit" block disabled={busy}>{m.wine_move_submit()}</Button>
  </form>
</Sheet>

<Sheet open={pickingLot} onclose={() => (pickingLot = false)} title={m.wine_drink_which()}>
  <ul class="pick">
    {#each lots as lot (lot.lotId)}
      <li>
        <Button variant="secondary" block onclick={() => drink(lot)}>
          {lot.locationName}{lot.position ? ` · ${lot.position}` : ''} ({lot.quantity})
        </Button>
      </li>
    {/each}
  </ul>
</Sheet>

<Sheet open={confirmingDelete} onclose={() => (confirmingDelete = false)} title={m.wine_delete_title()}>
  <p>{m.wine_delete_body()}</p>
  <form method="POST" action="?/delete" use:enhance class="sheet-form">
    <Button type="submit" variant="danger" block>{m.wine_delete_confirm()}</Button>
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
  .actions { display: flex; gap: var(--s-2); justify-content: space-between; }
  .sheet-form { display: grid; gap: var(--s-3); }
  .pick { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-2); }
</style>
