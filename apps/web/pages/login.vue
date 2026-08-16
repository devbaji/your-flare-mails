<script setup lang="ts">
const brandName = useRuntimeConfig().public.yourFlareMails.brandName as string;
const { login, pending, error, refreshSession, isAuthenticated } = useAuth();

const email = ref('owner@example.com');
const password = ref('owner-dev-password');

onMounted(async () => {
  await refreshSession();
  if (isAuthenticated()) {
    await navigateTo('/mail');
  }
});

async function onSubmit() {
  try {
    await login(email.value, password.value);
    await navigateTo('/mail');
  } catch {
    // error state set by useAuth
  }
}
</script>

<template>
  <main class="yfm-login">
    <form class="yfm-login__form" @submit.prevent="onSubmit">
      <p class="yfm-login__brand">{{ brandName }}</p>
      <h1>Sign in</h1>
      <p class="yfm-login__hint">Local seed: owner@example.com / owner-dev-password</p>
      <label>
        Email
        <input v-model="email" type="email" autocomplete="username" required />
      </label>
      <label>
        Password
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>
      <p v-if="error" class="yfm-error">{{ error }}</p>
      <button type="submit" :disabled="pending">
        {{ pending ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.yfm-login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
  background:
    radial-gradient(ellipse at 20% 0%, color-mix(in oklab, var(--yfm-accent) 18%, transparent), transparent 55%),
    var(--yfm-bg);
}

.yfm-login__form {
  width: min(24rem, 100%);
  display: grid;
  gap: 0.85rem;
}

.yfm-login__brand {
  margin: 0;
  font-family: var(--yfm-font-display);
  font-size: 1.75rem;
  font-weight: 650;
}

.yfm-login__form h1 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.yfm-login__hint {
  margin: 0;
  color: var(--yfm-fg-muted);
  font-size: 0.85rem;
}

label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.85rem;
}

input {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-elevated);
  color: inherit;
  border-radius: var(--yfm-radius);
  padding: 0.65rem 0.75rem;
  font: inherit;
}

button {
  appearance: none;
  border: 0;
  background: var(--yfm-accent);
  color: var(--yfm-accent-fg);
  border-radius: var(--yfm-radius);
  padding: 0.7rem 0.9rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

button:disabled {
  opacity: 0.7;
  cursor: wait;
}

.yfm-error {
  margin: 0;
  color: var(--yfm-danger);
}
</style>
