<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$paraglide/messages';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Field from '$lib/components/Field.svelte';

  let { form } = $props();
</script>

<svelte:head><title>{m.login_page_title()}</title></svelte:head>

<div class="auth">
  <h1>{m.login_title()}</h1>

  <Card>
    {#if form?.error}<p class="form-alert" role="alert">{form.error}</p>{/if}
    <form method="POST" use:enhance>
      <Field
        label={m.auth_email_label()}
        name="email"
        type="email"
        required
        autocomplete="username"
        value={form?.email ?? ''}
      />
      <Field
        label={m.auth_password_label()}
        name="password"
        type="password"
        required
        autocomplete="current-password"
      />
      <Button type="submit" block>{m.login_submit()}</Button>
    </form>
  </Card>
</div>
