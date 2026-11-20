<script lang="ts">
  import { enhance } from '$app/forms';
  import CaretRight from 'phosphor-svelte/lib/CaretRight';
  import SignOut from 'phosphor-svelte/lib/SignOut';
  import UsersThree from 'phosphor-svelte/lib/UsersThree';
  import ShieldCheck from 'phosphor-svelte/lib/ShieldCheck';
  import MapPin from 'phosphor-svelte/lib/MapPin';
  import * as m from '$paraglide/messages';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Field from '$lib/components/Field.svelte';
  import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { formatDate, formatDateTime } from '$lib/format';

  let { data, form } = $props();
  const errors = $derived((form?.errors ?? {}) as Record<string, string | undefined>);
</script>

<svelte:head><title>{m.account_page_title()}</title></svelte:head>

<h1>{m.account_title()}</h1>
<p class="muted">
  {m.account_signed_in_as()} <strong>{data.account.email}</strong>
  {#if data.account.isAdmin}<span class="badge badge-ready">{m.account_badge_admin()}</span>{/if}
</p>

<div class="stack">
  <section>
    <h2>{m.account_household_title()}</h2>
    <a class="nav-card card" href="/account/household">
      <UsersThree size={24} weight="duotone" aria-hidden="true" />
      <span class="nav-text">
        <strong>{data.account.householdName}</strong>
        <span class="muted">{m.account_household_link()}</span>
      </span>
      <CaretRight size={18} aria-hidden="true" />
    </a>
    <a class="nav-card card" href="/app/locations">
      <MapPin size={24} weight="duotone" aria-hidden="true" />
      <span class="nav-text">
        <strong>{m.loc_page_title()}</strong>
        <span class="muted">{m.account_locations_link()}</span>
      </span>
      <CaretRight size={18} aria-hidden="true" />
    </a>
    {#if data.account.isAdmin}
      <a class="nav-card card" href="/admin">
        <ShieldCheck size={24} weight="duotone" aria-hidden="true" />
        <span class="nav-text">
          <strong>{m.account_admin_title()}</strong>
          <span class="muted">{m.account_admin_link()}</span>
        </span>
        <CaretRight size={18} aria-hidden="true" />
      </a>
    {/if}
  </section>

  <section>
    <h2>{m.account_prefs_title()}</h2>
    <Card>
      <div class="pref-row">
        <span>{m.account_prefs_language()}</span>
        <LocaleSwitcher current={data.locale} />
      </div>
      <div class="pref-row">
        <span>{m.account_prefs_theme()}</span>
        <ThemeToggle initial={data.theme} />
      </div>
    </Card>
  </section>

  <section>
    <h2>{m.account_password_title()}</h2>
    <Card>
      {#if form?.success}<p class="success" role="status">{form.success}</p>{/if}
      <form method="POST" action="?/changePassword" use:enhance class="form">
        <Field
          label={m.account_password_current()}
          name="current_password"
          type="password"
          required
          autocomplete="current-password"
          error={errors.current}
        />
        <Field
          label={m.auth_password_new_label()}
          name="new_password"
          type="password"
          required
          minlength={10}
          autocomplete="new-password"
          error={errors.next}
        />
        <Field
          label={m.auth_password_confirm_label()}
          name="confirm"
          type="password"
          required
          minlength={10}
          autocomplete="new-password"
          error={errors.confirm}
        />
        <Button type="submit">{m.account_password_submit()}</Button>
      </form>
    </Card>
  </section>

  <section>
    <h2>{m.account_sessions_title()}</h2>
    <ul class="sessions">
      {#each data.sessions as s (s.id)}
        <li>
          <Card class="session-row">
            <div class="session-main">
              <strong class="ua">{s.userAgent ?? m.account_sessions_unknown_ua()}</strong>
              {#if s.isCurrent}<span class="badge badge-ready">{m.account_sessions_current()}</span>{/if}
              <p class="muted meta">
                {m.account_sessions_last_used({ when: formatDateTime(s.lastUsedAt, data.locale) })}
                · {m.account_sessions_expires({ when: formatDate(s.expiresAt, data.locale) })}
              </p>
            </div>
            {#if !s.isCurrent}
              <form method="POST" action="/account/sessions/{s.id}" use:enhance>
                <Button type="submit" variant="ghost" size="sm">{m.account_sessions_revoke()}</Button>
              </form>
            {/if}
          </Card>
        </li>
      {/each}
    </ul>
  </section>

  <form method="POST" action="/logout">
    <Button type="submit" variant="secondary" block>
      <SignOut size={18} aria-hidden="true" />
      {m.account_logout()}
    </Button>
  </form>
</div>

<BottomNav />

<style>
  .stack { display: flex; flex-direction: column; gap: var(--s-6); margin-top: var(--s-5); }
  .form { display: grid; gap: var(--s-4); }
  .success { color: var(--c-link); font-weight: var(--fw-medium); }

  .nav-card {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    margin-bottom: var(--s-2);
    color: var(--c-text);
    text-decoration: none;
  }
  .nav-card:hover { border-color: var(--c-border-strong); }
  .nav-text { display: flex; flex-direction: column; flex: 1; min-width: 0; font-size: var(--fs-sm); }
  .nav-text strong { font-size: var(--fs-base); overflow-wrap: anywhere; }

  .pref-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-3);
  }
  .pref-row + .pref-row { margin-top: var(--s-3); }

  .sessions { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--s-2); }
  :global(.session-row) { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); }
  .session-main { min-width: 0; }
  .ua { overflow-wrap: anywhere; font-size: var(--fs-sm); }
  .meta { margin: var(--s-1) 0 0; font-size: var(--fs-xs); }
</style>
