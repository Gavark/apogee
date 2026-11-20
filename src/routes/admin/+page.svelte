<script lang="ts">
  import { enhance } from '$app/forms';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import HouseLine from 'phosphor-svelte/lib/HouseLine';
  import * as m from '$paraglide/messages';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import CopyLink from '$lib/components/CopyLink.svelte';
  import Sheet from '$lib/components/Sheet.svelte';
  import { formatDate } from '$lib/format';
  import { showToast } from '$lib/toast.svelte';

  let { data, form } = $props();

  type Target =
    | { kind: 'user'; id: number; label: string }
    | { kind: 'household'; id: number; label: string };
  let target = $state<Target | null>(null);

  const statusLabel = {
    pending: m.invite_status_pending,
    used: m.invite_status_used,
    expired: m.invite_status_expired
  };

  const aiTestErrors: Record<string, () => string> = {
    not_configured: m.admin_ai_test_err_not_configured,
    auth: m.admin_ai_test_err_auth,
    rate_limited: m.admin_ai_test_err_rate_limited,
    refused: m.admin_ai_test_err_refused,
    invalid_response: m.admin_ai_test_err_invalid_response
  };
  const aiTestError = (code: string) => (aiTestErrors[code] ?? m.admin_ai_test_err_unavailable)();

  let testing = $state(false);

  const afterAction = (message: string) => () => async ({ result, update }: any) => {
    await update();
    if (result.type === 'success') showToast(message);
    target = null;
  };
</script>

<svelte:head><title>{m.admin_page_title()}</title></svelte:head>

<p><a class="back" href="/account"><ArrowLeft size={16} aria-hidden="true" /> {m.account_back()}</a></p>

<h1>{m.admin_title()}</h1>
<p class="muted">{m.admin_privacy_note()}</p>

{#if form?.error}<p class="form-alert" role="alert">{form.error}</p>{/if}

<div class="stack">
  <section>
    <h2>{m.admin_households()}</h2>
    <ul class="list">
      {#each data.households as h (h.id)}
        <li>
          <Card>
            <div class="head">
              <div class="title">
                <HouseLine size={20} weight="duotone" aria-hidden="true" />
                <strong>{h.name}</strong>
              </div>
              <span class="muted count">{m.admin_member_count({ count: h.memberCount })}</span>
            </div>
            <ul class="members">
              {#each h.members as member (member.id)}
                <li>
                  <span class="email">
                    {member.email}
                    {#if member.isAdmin}<span class="badge badge-ready">{m.account_badge_admin()}</span>{/if}
                  </span>
                  {#if member.id === data.currentUserId}
                    <span class="muted you">{m.household_you()}</span>
                  {:else}
                    <Button
                      variant="ghost"
                      size="sm"
                      onclick={() => (target = { kind: 'user', id: member.id, label: member.email })}
                    >
                      {m.admin_delete_user()}
                    </Button>
                  {/if}
                </li>
              {/each}
            </ul>
            {#if h.memberCount === 0 && h.id !== data.ownHouseholdId}
              <Button
                variant="danger"
                size="sm"
                onclick={() => (target = { kind: 'household', id: h.id, label: h.name })}
              >
                {m.admin_delete_household()}
              </Button>
            {/if}
          </Card>
        </li>
      {/each}
    </ul>
  </section>

  <section>
    <h2>{m.admin_ai_title()}</h2>
    <Card>
      {#if data.ai.configured}
        <ul class="ai">
          <li>{m.admin_ai_provider({ provider: data.ai.provider })}</li>
          <li>{m.admin_ai_model({ model: data.ai.model ?? '' })}</li>
          {#if data.ai.baseUrl}<li class="url">{m.admin_ai_base_url({ url: data.ai.baseUrl })}</li>{/if}
          <li>
            {data.ai.dailyLimit === 0
              ? m.admin_ai_limit_unlimited()
              : m.admin_ai_limit({ count: data.ai.dailyLimit })}
          </li>
          <li>{m.admin_ai_today({ count: data.ai.analysesToday })}</li>
        </ul>
      {:else}
        <p class="muted">{m.admin_ai_off()}</p>
      {/if}
      <form
        method="POST"
        action="?/testAi"
        class="ai-test"
        use:enhance={() => {
          testing = true;
          return async ({ update }) => {
            await update({ reset: false });
            testing = false;
          };
        }}
      >
        <Button type="submit" variant="secondary" disabled={testing}>{m.admin_ai_test()}</Button>
        <p class="muted hint">{m.admin_ai_test_hint()}</p>
      </form>
      {#if form?.aiTest}
        {#if form.aiTest.ok}
          <p class="ai-result" role="status">{m.admin_ai_test_ok({ model: form.aiTest.model, ms: form.aiTest.ms })}</p>
        {:else}
          <p class="form-alert" role="alert">{aiTestError(form.aiTest.error)}</p>
        {/if}
      {/if}
    </Card>
  </section>

  <section>
    <h2>{m.admin_invitations()}</h2>
    <p class="muted">{m.admin_invite_intro()}</p>
    <form method="POST" action="?/inviteHousehold" use:enhance={afterAction(m.invite_created())}>
      <Button type="submit">{m.admin_invite_household()}</Button>
    </form>

    {#if data.invitations.length === 0}
      <p class="muted gap">{m.household_invitations_empty()}</p>
    {:else}
      <ul class="list gap">
        {#each data.invitations as inv (inv.id)}
          <li>
            <Card>
              <p class="meta">
                <span class="badge {inv.status === 'pending' ? 'badge-peak' : 'badge-unknown'}">
                  {statusLabel[inv.status]()}
                </span>
                <span>
                  {inv.householdName === null
                    ? m.admin_invite_new_household()
                    : m.admin_invite_for_household({ name: inv.householdName })}
                </span>
                {#if inv.status === 'pending'}
                  <span class="muted">{m.invite_expires({ when: formatDate(inv.expiresAt, data.locale) })}</span>
                {/if}
              </p>
              {#if inv.link}<CopyLink url={inv.link} />{/if}
            </Card>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<Sheet
  open={target !== null}
  onclose={() => (target = null)}
  title={target?.kind === 'household' ? m.admin_confirm_household_title() : m.admin_confirm_user_title()}
>
  {#if target}
    <p>
      {target.kind === 'household'
        ? m.admin_confirm_household_body({ name: target.label })
        : m.admin_confirm_user_body({ email: target.label })}
    </p>
    <form
      method="POST"
      action={target.kind === 'household' ? '?/deleteHousehold' : '?/deleteUser'}
      use:enhance={afterAction(m.admin_deleted())}
      class="confirm"
    >
      <input type="hidden" name="id" value={target.id} />
      <Button type="submit" variant="danger" block>{m.admin_confirm_delete()}</Button>
      <Button variant="ghost" block onclick={() => (target = null)}>{m.admin_confirm_cancel()}</Button>
    </form>
  {/if}
</Sheet>

<BottomNav />

<style>
  .back { display: inline-flex; align-items: center; gap: var(--s-1); font-size: var(--fs-sm); }
  .stack { display: flex; flex-direction: column; gap: var(--s-6); margin-top: var(--s-5); }
  .list { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--s-3); }
  .gap { margin-top: var(--s-4); }
  .head { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); }
  .title { display: flex; align-items: center; gap: var(--s-2); min-width: 0; overflow-wrap: anywhere; }
  .count { font-size: var(--fs-sm); flex: none; }
  .members { list-style: none; padding: 0; margin: var(--s-3) 0; display: grid; gap: var(--s-1); }
  .members li { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); }
  .email { display: flex; align-items: center; gap: var(--s-2); flex-wrap: wrap; min-width: 0; overflow-wrap: anywhere; font-size: var(--fs-sm); }
  .you { font-size: var(--fs-sm); }
  .meta { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s-2); font-size: var(--fs-sm); margin-bottom: var(--s-3); }
  .ai { list-style: none; padding: 0; margin: 0 0 var(--s-3); display: grid; gap: var(--s-1); font-size: var(--fs-sm); }
  .url { overflow-wrap: anywhere; }
  .ai-test { display: grid; gap: var(--s-2); }
  .hint { font-size: var(--fs-sm); margin: 0; }
  .ai-result { margin: var(--s-3) 0 0; font-size: var(--fs-sm); }
  .confirm { display: grid; gap: var(--s-2); }
</style>
