<script setup lang="ts">
const brandName = useRuntimeConfig().public.yourFlareMails.brandName as string;
const { login, pending, error, ready, ensureSession, isAuthenticated } = useAuth();

const email = ref('');
const password = ref('');
const colorMode = useState<'light' | 'dark'>('yfm-color-mode', () => 'light');

const showForm = computed(() => ready.value && !isAuthenticated());

function toggleColorMode() {
  const next = colorMode.value === 'dark' ? 'light' : 'dark';
  colorMode.value = next;
  if (import.meta.client) {
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem('yfm-color-mode', next);
    } catch {
      // ignore
    }
  }
}

onMounted(async () => {
  await ensureSession();
  if (isAuthenticated()) {
    await navigateTo('/mail');
  }
});

watch(ready, async (isReady) => {
  if (isReady && isAuthenticated()) {
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
  <div v-if="!showForm" class="yfm-boot">
    <p class="yfm-boot__brand">{{ brandName }}</p>
    <p class="yfm-boot__status">Loading…</p>
  </div>
  <div v-else class="yfm-login">
    <header class="yfm-login__header">
      <p class="yfm-login__brand">{{ brandName }}</p>
      <button
        type="button"
        class="yfm-login__theme"
        :aria-label="colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleColorMode"
      >
        <svg
          v-if="colorMode === 'dark'"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 14.5A8.5 8.5 0 1 1 12.5 3a7 7 0 0 0 8.5 11.5z" />
        </svg>
      </button>
    </header>

    <main class="yfm-login__main">
      <form class="yfm-login__form" @submit.prevent="onSubmit">
        <h1>Sign in</h1>
        <p class="yfm-login__hint">Use your mailbox owner account to sign in.</p>
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
  </div>
</template>

<style scoped>
.yfm-login {
  --yfm-safe-top: max(
    env(safe-area-inset-top, 0px),
    var(--yfm-safe-top-fallback, 0px)
  );
  --yfm-safe-bottom: max(
    env(safe-area-inset-bottom, 0px),
    var(--yfm-safe-bottom-fallback, 0px)
  );
  min-height: 100dvh;
  max-width: 100vw;
  overflow-x: hidden;
  display: grid;
  grid-template-rows: calc(3.25rem + var(--yfm-safe-top)) 1fr;
  background:
    radial-gradient(
      ellipse at 20% 0%,
      color-mix(in oklab, var(--yfm-accent) 18%, transparent),
      transparent 55%
    ),
    var(--yfm-bg);
  padding-bottom: var(--yfm-safe-bottom);
}

.yfm-login__header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: var(--yfm-safe-top) 0.85rem 0;
  height: calc(3.25rem + var(--yfm-safe-top));
  box-sizing: border-box;
  border-bottom: 1px solid var(--yfm-border);
  background: color-mix(in srgb, var(--yfm-bg-elevated) 92%, transparent);
  backdrop-filter: blur(10px);
  min-width: 0;
}

.yfm-login__brand {
  margin: 0;
  min-width: 0;
  font-family: var(--yfm-font-display);
  font-size: 1.2rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.yfm-login__theme {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-elevated);
  color: var(--yfm-fg-muted);
  border-radius: var(--yfm-radius);
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.yfm-login__main {
  display: grid;
  place-items: center;
  padding: 1.25rem;
  min-width: 0;
}

.yfm-login__form {
  width: min(24rem, 100%);
  display: grid;
  gap: 0.85rem;
  min-width: 0;
}

.yfm-login__form h1 {
  margin: 0;
  font-size: 1.15rem;
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
  min-width: 0;
}

input {
  appearance: none;
  width: 100%;
  max-width: 100%;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-elevated);
  color: inherit;
  border-radius: var(--yfm-radius);
  padding: 0.65rem 0.75rem;
  font: inherit;
}

button[type='submit'] {
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

button[type='submit']:disabled {
  opacity: 0.7;
  cursor: wait;
}

.yfm-error {
  margin: 0;
  color: var(--yfm-danger);
  word-break: break-word;
}
</style>
