<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Field from '$lib/components/Field.svelte';

  let { form } = $props();
  const errors = $derived((form?.errors ?? {}) as Record<string, string | undefined>);
</script>

<svelte:head><title>{m.setup_page_title()}</title></svelte:head>

<div class="auth">
  <h1>{m.setup_title()}</h1>
  <p class="intro">{m.setup_intro()}</p>

  <Card>
    {#if errors.form}<p class="form-alert" role="alert">{errors.form}</p>{/if}
    <form method="POST" use:enhance>
      <Field
        label={m.auth_email_label()}
        name="email"
        type="email"
        required
        autocomplete="username"
        value={form?.email ?? ''}
        error={errors.email}
      />
      <Field
        label={m.auth_household_name_label()}
        hint={m.setup_household_hint()}
        name="householdName"
        required
        maxlength={100}
        autocomplete="off"
        value={form?.householdName ?? ''}
        error={errors.householdName}
      />
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
      <Button type="submit" block>{m.setup_submit()}</Button>
    </form>
  </Card>
</div>
