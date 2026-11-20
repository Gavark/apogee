<script lang="ts">
  import { enhance } from '$app/forms';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import UserPlus from 'phosphor-svelte/lib/UserPlus';
  import * as m from '$paraglide/messages';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import Button from '$lib/components/Button.svelte';
  import NetworkRequired from '$lib/components/NetworkRequired.svelte';
  import { network } from '$lib/offline/online.svelte';
  import Card from '$lib/components/Card.svelte';
  import CopyLink from '$lib/components/CopyLink.svelte';
  import { formatDate } from '$lib/format';
  import { showToast } from '$lib/toast.svelte';

  let { data } = $props();

  const statusLabel = {
    pending: m.invite_status_pending,
    used: m.invite_status_used,
    expired: m.invite_status_expired
  };
</script>

<svelte:head><title>{m.household_page_title()}</title></svelte:head>

<p><a class="back" href="/account"><ArrowLeft size={16} aria-hidden="true" /> {m.account_back()}</a></p>

<h1>{data.householdName}</h1>
<NetworkRequired />

<div class="stack">
  <section>
    <h2>{m.household_members()}</h2>
    <ul class="list">
      {#each data.members as member (member.id)}
        <li>
          <Card class="row">
            <span class="email">{member.email}</span>
            <span class="tags">
              {#if member.id === data.currentUserId}<span class="muted tag">{m.household_you()}</span>{/if}
              {#if member.isAdmin}<span class="badge badge-ready">{m.account_badge_admin()}</span>{/if}
            </span>
          </Card>
        </li>
      {/each}
    </ul>
  </section>

  <section>
    <h2>{m.household_invitations()}</h2>
    <p class="muted">{m.household_invite_intro()}</p>
    <form
      method="POST"
      action="?/invite"
      use:enhance={() => async ({ result, update }) => {
        await update();
        if (result.type === 'success') showToast(m.invite_created());
      }}
    >
      <Button type="submit" disabled={!network.online}>
        <UserPlus size={18} aria-hidden="true" />
        {m.household_invite()}
      </Button>
    </form>

    {#if data.invitations.length === 0}
      <p class="muted empty">{m.household_invitations_empty()}</p>
    {:else}
      <ul class="list invites">
        {#each data.invitations as inv (inv.id)}
          <li>
            <Card>
              {#if inv.status === 'pending'}
                <p class="meta">
                  <span class="badge badge-peak">{statusLabel.pending()}</span>
                  {m.invite_expires({ when: formatDate(inv.expiresAt, data.locale) })}
                </p>
                <CopyLink url={inv.link} />
              {:else}
                <p class="meta">
                  <span class="badge badge-unknown">{statusLabel[inv.status]()}</span>
                </p>
              {/if}
            </Card>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<BottomNav />

<style>
  .back { display: inline-flex; align-items: center; gap: var(--s-1); font-size: var(--fs-sm); }
  .stack { display: flex; flex-direction: column; gap: var(--s-6); margin-top: var(--s-4); }
  .list { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--s-2); }
  .invites, .empty { margin-top: var(--s-4); }
  :global(.row) { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); }
  .email { overflow-wrap: anywhere; min-width: 0; }
  .tags { display: flex; align-items: center; gap: var(--s-2); flex: none; }
  .tag { font-size: var(--fs-sm); }
  .meta { display: flex; align-items: center; gap: var(--s-2); font-size: var(--fs-sm); margin-bottom: var(--s-3); }
</style>
