<script setup lang="ts">
defineProps<{
  brandName?: string;
}>();
</script>

<template>
  <div class="yfm-mail-layout">
    <aside class="yfm-mail-layout__sidebar">
      <div class="yfm-mail-layout__brand">{{ brandName ?? 'YourFlareMails' }}</div>
      <slot name="sidebar" />
    </aside>
    <section class="yfm-mail-layout__list">
      <slot name="list" />
    </section>
    <main class="yfm-mail-layout__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.yfm-mail-layout {
  display: grid;
  grid-template-columns: var(--yfm-sidebar-width) var(--yfm-list-width) 1fr;
  min-height: 100vh;
  border-top: 1px solid var(--yfm-border);
}

.yfm-mail-layout__sidebar,
.yfm-mail-layout__list {
  border-right: 1px solid var(--yfm-border);
  background: color-mix(in srgb, var(--yfm-bg-elevated) 88%, transparent);
  backdrop-filter: blur(8px);
}

.yfm-mail-layout__sidebar {
  padding: 1.25rem 1rem;
}

.yfm-mail-layout__brand {
  font-family: var(--yfm-font-display);
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 1.5rem;
}

.yfm-mail-layout__list {
  overflow: auto;
}

.yfm-mail-layout__main {
  overflow: auto;
  background: color-mix(in srgb, var(--yfm-bg-elevated) 70%, transparent);
}

@media (max-width: 960px) {
  .yfm-mail-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr;
  }

  .yfm-mail-layout__sidebar,
  .yfm-mail-layout__list {
    border-right: none;
    border-bottom: 1px solid var(--yfm-border);
  }
}
</style>
