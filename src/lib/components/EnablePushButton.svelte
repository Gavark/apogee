<script lang="ts">
  import { onMount } from 'svelte';
  import Bell from 'phosphor-svelte/lib/Bell';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import { showToast } from '$lib/toast.svelte';

  /** Called after this device was subscribed and registered server-side. */
  let { onchange }: { onchange?: () => void } = $props();

  type PushState = 'checking' | 'idle' | 'subscribing' | 'active' | 'denied' | 'unsupported';
  let pushState = $state<PushState>('checking');
  let isStandalone = $state(false);
  let isIOS = $state(false);

  onMount(async () => {
    isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    isStandalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      pushState = 'unsupported';
      return;
    }
    if (Notification.permission === 'denied') {
      pushState = 'denied';
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      pushState = (await reg.pushManager.getSubscription()) ? 'active' : 'idle';
    } catch {
      pushState = 'unsupported';
    }
  });

  async function enable() {
    pushState = 'subscribing';
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        pushState = 'denied';
        return;
      }
      const keyRes = await fetch('/api/push/vapid-public-key');
      if (!keyRes.ok) throw new Error('vapid key');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(await keyRes.text())
      });
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
      if (!res.ok) throw new Error('register');
      pushState = 'active';
      onchange?.();
    } catch {
      pushState = 'idle';
      showToast(m.notif_btn_error());
    }
  }

  function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
    const s = b64.trim();
    const padded = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded);
    const arr = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }
</script>

{#if pushState === 'checking'}
  <!-- silent, avoids flicker -->
{:else if pushState === 'unsupported'}
  <p class="hint">{m.notif_btn_unsupported()}</p>
{:else if pushState === 'denied'}
  <p class="hint">{m.notif_btn_denied()}</p>
{:else if pushState === 'active'}
  <p class="ok"><Bell size={18} weight="fill" aria-hidden="true" /> {m.notif_btn_active()}</p>
{:else if isIOS && !isStandalone}
  <p class="hint">{m.notif_btn_ios_hint()}</p>
{:else}
  <Button variant="primary" onclick={enable} disabled={pushState === 'subscribing'}>
    <Bell size={18} aria-hidden="true" />
    {m.notif_btn_enable()}
  </Button>
{/if}

<style>
  .hint { margin: 0; font-size: var(--fs-sm); color: var(--c-text-muted); }
  .ok { margin: 0; display: inline-flex; align-items: center; gap: var(--s-2); }
</style>
