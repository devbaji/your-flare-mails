<script setup lang="ts">
const colorMode = useState<'light' | 'dark'>('yfm-color-mode', () => 'light');

const STORAGE_KEY = 'yfm-color-mode';

function applyMode(mode: 'light' | 'dark') {
  colorMode.value = mode;
  if (import.meta.client) {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore quota / private mode
    }
  }
}

function toggleMode() {
  applyMode(colorMode.value === 'dark' ? 'light' : 'dark');
}

onMounted(() => {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  if (stored === 'dark' || stored === 'light') {
    applyMode(stored);
    return;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyMode(prefersDark ? 'dark' : 'light');
});
</script>

<template>
  <div class="yfm-root">
    <div class="yfm-shell-bar">
      <button
        type="button"
        class="yfm-shell-bar__toggle"
        :aria-label="colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        :title="colorMode === 'dark' ? 'Light mode' : 'Dark mode'"
        @click="toggleMode"
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
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
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
    </div>
    <NuxtPage />
  </div>
</template>

<style scoped>
.yfm-shell-bar {
  display: flex;
  justify-content: flex-end;
  padding: 0.35rem 0.75rem;
}

.yfm-shell-bar__toggle {
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
}

.yfm-shell-bar__toggle:hover {
  color: var(--yfm-fg);
  border-color: var(--yfm-accent);
}
</style>
