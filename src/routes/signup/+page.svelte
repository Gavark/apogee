<script lang="ts">
  import { enhance } from '$app/forms';
  import EnvelopeSimple from 'phosphor-svelte/lib/EnvelopeSimple';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Field from '$lib/components/Field.svelte';

  let { data, form } = $props();
  const errors = $derived((form?.errors ?? {}) as Record<string, string | undefined>);
</script>

<svelte:head><title>{m.signup_page_title()}</title></svelte:head>

<div class="auth">
  <h1>{m.signup_title()}</h1>

  {#if !data.tokenValid}
    <EmptyState icon={EnvelopeSimple} title={m.signup_invite_only_title()} description={m.signup_invite_only()}>
      <Button href="/login" variant="secondary">{m.login_title()}</Button>
    </EmptyState>
  {:else}
    <Card>
      {#if errors.form}<p class="form-alert" role="alert">{errors.form}</p>{/if}
      <form method="POST" use:enhance>
        <input type="hidden" name="token" value={data.token} />
        <Field
          label={m.auth_email_label()}
          name="email"
          type="email"
          required
          autocomplete="username"
          value={form?.email ?? ''}
          error={errors.email}
        />
        {#if data.needsHousehold}
          <Field
            label={m.auth_household_name_label()}
            hint={m.signup_household_hint()}
            name="householdName"
            required
            maxlength={100}
            autocomplete="off"
            value={form?.householdName ?? ''}
            error={errors.householdName}
          />
        {/if}
        <Field
          label={m.auth_password_new_label()}
          name="password"
          type="password"
          required
          minlength={10}
          autocomplete="new-password"
          error={errors.password}
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
        <Button type="submit" block>{m.signup_submit()}</Button>
      </form>
    </Card>
  {/if}
</div>
