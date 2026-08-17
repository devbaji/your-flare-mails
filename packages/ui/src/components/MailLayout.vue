<script setup lang="ts">
withDefaults(
  defineProps<{
    brandName?: string;
    /** On narrow viewports: which pane is visible. */
    mobilePane?: 'list' | 'reader';
    compactSidebar?: boolean;
  }>(),
  {
    mobilePane: 'list',
    compactSidebar: false,
  },
);
</script>

<template>
  <div
    class="yfm-mail-layout"
    :class="[
      mobilePane === 'reader' ? 'is-reader' : 'is-list',
      { 'is-compact-sidebar': compactSidebar },
    ]"
  >
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

.yfm-mail-layout.is-compact-sidebar {
  grid-template-columns: 4.5rem var(--yfm-list-width) 1fr;
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

.yfm-mail-layout.is-compact-sidebar .yfm-mail-layout__sidebar {
  padding: 1rem 0.4rem;
}

.yfm-mail-layout.is-compact-sidebar .yfm-mail-layout__brand {
  font-size: 0.7rem;
  text-align: center;
  margin-bottom: 1rem;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
    grid-template-columns: 4.25rem 1fr;
    grid-template-rows: 1fr;
    min-height: calc(100vh - 2.5rem);
  }

  .yfm-mail-layout__sidebar {
    grid-row: 1;
    grid-column: 1;
    border-right: 1px solid var(--yfm-border);
    border-bottom: none;
    padding: 0.75rem 0.35rem;
  }

  .yfm-mail-layout__brand {
    font-size: 0.65rem;
    text-align: center;
    margin-bottom: 0.75rem;
  }

  .yfm-mail-layout.is-list .yfm-mail-layout__list {
    display: block;
    grid-column: 2;
    border-right: none;
  }

  .yfm-mail-layout.is-list .yfm-mail-layout__main {
    display: none;
  }

  .yfm-mail-layout.is-reader .yfm-mail-layout__list {
    display: none;
  }

  .yfm-mail-layout.is-reader .yfm-mail-layout__main {
    display: block;
    grid-column: 2;
  }
}
</style>
