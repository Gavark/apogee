<script lang="ts">
  import { onMount } from 'svelte';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import PaperPlaneTilt from 'phosphor-svelte/lib/PaperPlaneTilt';
  import * as m from '$paraglide/messages';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import Button from '$lib/components/Button.svelte';
  import NetworkRequired from '$lib/components/NetworkRequired.svelte';
  import { network } from '$lib/offline/online.svelte';
  import Card from '$lib/components/Card.svelte';
  import EnablePushButton from '$lib/components/EnablePushButton.svelte';
  import { formatDateTime } from '$lib/format';
  import { showToast } from '$lib/toast.svelte';

  let { data } = $props();

  const testMessages = {
    sent: m.notif_test_sent,
    none: m.notif_test_no_device,
    failed: m.notif_test_failed,
    limit: m.notif_test_limit
  };

  // Id of this browser's own device row; the server answers, endpoints are never sent to the page.
  let currentId = $state<number | null>(null);

  async function locateCurrent(): Promise<void> {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (!sub) {
        currentId = null;
        return;
      }
      const lookup = async (): Promise<number | null> => {
        const res = await fetch('/api/push/current', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        return res.ok ? ((await res.json()) as { id: number | null }).id : null;
      };
      currentId = await lookup();
      if (currentId === null) {
        // Subscribed in the browser but unknown to the server: register it again.
        const json = sub.toJSON();
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
            userAgent: navigator.userAgent
          })
        });
        if (res.ok) {
          currentId = await lookup();
          await invalidateAll();
        }
      }
    } catch {
      currentId = null;
    }
  }
  onMount(locateCurrent);

  async function remove(id: number) {
    const res = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!res.ok) return;
    // Removing this very device also drops the browser-side subscription.
    if (currentId === id) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await (await reg.pushManager.getSubscription())?.unsubscribe();
        currentId = null;
      } catch {
        /* the server row is gone; a stale browser subscription is harmless */
      }
    }
    showToast(m.notif_device_removed());
    await invalidateAll();
  }
</script>

<svelte:head><title>{m.notif_page_title()}</title></svelte:head>

<p><a class="back" href="/account"><ArrowLeft size={16} aria-hidden="true" /> {m.account_back()}</a></p>

<h1>{m.notif_page_title()}</h1>
<NetworkRequired />

<div class="stack">
  <section>
    <h2>{m.notif_this_device_title()}</h2>
    <Card>
      <EnablePushButton
        onchange={async () => {
          await invalidateAll();
          await locateCurrent();
        }}
      />
    </Card>
  </section>

  <section>
    <h2>{m.notif_prefs_title()}</h2>
    <Card>
      <form
        method="POST"
        action="?/save"
        class="prefs"
        use:enhance={() =>
          async ({ result, update }) => {
            await update({ reset: false });
            if (result.type === 'success') showToast(m.notif_saved());
          }}
      >
        <label class="pref">
          <input
            type="checkbox"
            name="notify_phases"
            checked={data.notifyPhases}
            disabled={!network.online}
            onchange={(e) => e.currentTarget.form?.requestSubmit()}
          />
          <span>
            <strong>{m.notif_pref_phases()}</strong>
            <span class="muted">{m.notif_pref_phases_hint()}</span>
          </span>
        </label>
        <label class="pref">
          <input
            type="checkbox"
            name="notify_monthly"
            checked={data.notifyMonthly}
            disabled={!network.online}
            onchange={(e) => e.currentTarget.form?.requestSubmit()}
          />
          <span>
            <strong>{m.notif_pref_monthly()}</strong>
            <span class="muted">{m.notif_pref_monthly_hint()}</span>
          </span>
        </label>
      </form>
      <p class="muted hint">
        {m.notif_schedule_hint({ timezone: data.timezone })}
        <a href="/account#timezone">{m.notif_schedule_change()}</a>
      </p>
    </Card>
  </section>

  <section>
    <h2>{m.notif_devices_title()}</h2>
    {#if data.devices.length === 0}
      <p class="muted">{m.notif_devices_none()}</p>
    {:else}
      <ul class="devices">
        {#each data.devices as d (d.id)}
          <li>
            <Card class="device-row">
              <div class="device-main">
                <strong class="ua">{d.userAgent ?? m.notif_device_unknown()}</strong>
                <p class="muted meta">
                  {m.notif_device_dates({
                    added: formatDateTime(d.createdAt, data.locale),
                    seen: formatDateTime(d.lastSeenAt, data.locale)
                  })}
                </p>
              </div>
              <Button variant="ghost" size="sm" disabled={!network.online} onclick={() => remove(d.id)}>{m.notif_device_remove()}</Button>
            </Card>
          </li>
        {/each}
      </ul>
      <form
        method="POST"
        action="?/test"
        use:enhance={() =>
          async ({ result, update }) => {
            await update({ reset: false });
            const code =
              result.type === 'success' || result.type === 'failure'
                ? (result.data as { test?: keyof typeof testMessages } | undefined)?.test
                : undefined;
            showToast((code ? testMessages[code] : m.notif_test_failed)());
          }}
      >
        <Button type="submit" variant="secondary" block disabled={!network.online}>
          <PaperPlaneTilt size={18} aria-hidden="true" />
          {m.notif_test_button()}
        </Button>
      </form>
    {/if}
  </section>
</div>

<BottomNav />

<style>
  .stack { display: flex; flex-direction: column; gap: var(--s-6); margin-top: var(--s-5); }
  .prefs { display: grid; gap: var(--s-4); }
  .pref { display: flex; align-items: flex-start; gap: var(--s-3); cursor: pointer; }
  .pref input { width: 1.25rem; height: 1.25rem; margin-top: 0.15rem; flex: none; accent-color: var(--c-link); }
  .pref span { display: flex; flex-direction: column; font-size: var(--fs-sm); }
  .pref strong { font-size: var(--fs-base); }
  .hint { margin: var(--s-4) 0 0; font-size: var(--fs-sm); }
  .devices { list-style: none; padding: 0; margin: 0 0 var(--s-4); display: grid; gap: var(--s-2); }
  :global(.device-row) { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); }
  .device-main { min-width: 0; }
  .ua { overflow-wrap: anywhere; font-size: var(--fs-sm); }
  .meta { margin: var(--s-1) 0 0; font-size: var(--fs-xs); }
</style>
