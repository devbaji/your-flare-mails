<script setup lang="ts">
const colorMode = useState<'light' | 'dark'>('yfm-color-mode', () => 'light');

function applyMode(mode: 'light' | 'dark') {
  colorMode.value = mode;
  if (import.meta.client) {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }
}

function toggleMode() {
  applyMode(colorMode.value === 'dark' ? 'light' : 'dark');
}

onMounted(() => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyMode(prefersDark ? 'dark' : 'light');
});
</script>

<template>
  <div class="yfm-root">
    <div class="yfm-shell-bar">
      <button type="button" class="yfm-shell-bar__toggle" @click="toggleMode">
        {{ colorMode === 'dark' ? 'Light' : 'Dark' }} mode
      </button>
    </div>
    <NuxtPage />
  </div>
</template>

<style scoped>
.yfm-shell-bar {
  display: flex;
  justify-content: flex-end;
  padding: 0.5rem 1rem;
}

.yfm-shell-bar__toggle {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-elevated);
  color: var(--yfm-fg-muted);
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  font: inherit;
  cursor: pointer;
}
</style>
