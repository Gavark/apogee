type Deps = {
  serviceWorker?: { ready: Promise<{ pushManager: { getSubscription(): Promise<PushSubscriptionLike | null> } }> };
  fetch: typeof fetch;
};
type PushSubscriptionLike = { endpoint: string; unsubscribe(): Promise<boolean> };

/**
 * Best-effort: removes this device's push subscription (server row, then the browser's) so a logged-out
 * browser stops receiving the account's notifications. Never throws; gives up after `timeoutMs`.
 */
export async function unsubscribeThisDevice(deps: Deps, timeoutMs = 2000): Promise<void> {
  const work = (async () => {
    if (!deps.serviceWorker) return;
    const reg = await deps.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await deps
      .fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint })
      })
      .catch(() => {});
    await sub.unsubscribe().catch(() => {});
  })().catch(() => {});
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<void>((r) => (timer = setTimeout(r, timeoutMs)));
  await Promise.race([work, timeout]);
  clearTimeout(timer!);
}
