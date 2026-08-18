<script setup lang="ts">
withDefaults(
  defineProps<{
    brandName?: string;
    /** On narrow viewports: which pane is visible. */
    mobilePane?: 'list' | 'reader';
    /** Narrow layout: hamburger drawer instead of permanent sidebar. */
    mobileNav?: boolean;
    /** Controlled drawer open state (mobile only). */
    sidebarOpen?: boolean;
  }>(),
  {
    mobilePane: 'list',
    mobileNav: false,
    sidebarOpen: false,
  },
);

const emit = defineEmits<{
  'update:sidebarOpen': [open: boolean];
}>();

function setSidebarOpen(open: boolean) {
  emit('update:sidebarOpen', open);
}
</script>

<template>
  <div
    class="yfm-mail-layout"
    :class="[
      mobilePane === 'reader' ? 'is-reader' : 'is-list',
      { 'is-mobile-nav': mobileNav, 'is-sidebar-open': sidebarOpen },
    ]"
  >
    <header class="yfm-mail-layout__header">
      <div class="yfm-mail-layout__header-start">
        <button
          v-if="mobileNav"
          type="button"
          class="yfm-mail-layout__menu-btn"
          :aria-label="sidebarOpen ? 'Close menu' : 'Open menu'"
          :aria-expanded="sidebarOpen"
          @click="setSidebarOpen(!sidebarOpen)"
        >
          <svg
            v-if="!sidebarOpen"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            stroke-width="1.85"
            stroke-linecap="round"
          >
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            stroke-width="1.85"
            stroke-linecap="round"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>
        <div class="yfm-mail-layout__brand">
          <img
            class="yfm-mail-layout__logo"
            src="/logo.png"
            width="28"
            height="28"
            alt=""
            aria-hidden="true"
          />
          <span>{{ brandName ?? 'Mail' }}</span>
        </div>
      </div>
      <div class="yfm-mail-layout__header-actions">
        <slot name="header-actions" />
      </div>
    </header>

    <div
      v-if="mobileNav && sidebarOpen"
      class="yfm-mail-layout__scrim"
      aria-hidden="true"
      @click="setSidebarOpen(false)"
    />

    <aside class="yfm-mail-layout__sidebar" :aria-hidden="mobileNav && !sidebarOpen">
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
  --yfm-header-height: 3.25rem;
  --yfm-safe-top: max(
    env(safe-area-inset-top, 0px),
    var(--yfm-safe-top-fallback, 0px)
  );
  --yfm-safe-bottom: max(
    env(safe-area-inset-bottom, 0px),
    var(--yfm-safe-bottom-fallback, 0px)
  );
  display: grid;
  grid-template-columns: var(--yfm-sidebar-width) var(--yfm-list-width) 1fr;
  grid-template-rows: calc(var(--yfm-header-height) + var(--yfm-safe-top)) 1fr;
  min-height: 100dvh;
  max-width: 100vw;
  overflow-x: hidden;
  padding-bottom: var(--yfm-safe-bottom);
}

.yfm-mail-layout__header {
  grid-column: 1 / -1;
  grid-row: 1;
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
  padding: var(--yfm-safe-top) 0.85rem 0;
  height: calc(var(--yfm-header-height) + var(--yfm-safe-top));
  box-sizing: border-box;
  border-bottom: 1px solid var(--yfm-border);
  background: color-mix(in srgb, var(--yfm-bg-elevated) 94%, transparent);
  backdrop-filter: blur(10px);
}

.yfm-mail-layout__header-start {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.yfm-mail-layout__menu-btn {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-elevated);
  color: var(--yfm-fg);
  border-radius: var(--yfm-radius);
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.yfm-mail-layout__brand {
  margin: 0;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--yfm-font-display);
  font-size: 1.2rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.yfm-mail-layout__logo {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.4rem;
  flex-shrink: 0;
}

.yfm-mail-layout__header-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.yfm-mail-layout__sidebar,
.yfm-mail-layout__list {
  border-right: 1px solid var(--yfm-border);
  background: color-mix(in srgb, var(--yfm-bg-elevated) 88%, transparent);
  backdrop-filter: blur(8px);
  min-width: 0;
  overflow: auto;
}

.yfm-mail-layout__sidebar {
  grid-column: 1;
  grid-row: 2;
  padding: 1rem 0.85rem;
}

.yfm-mail-layout__list {
  grid-column: 2;
  grid-row: 2;
}

.yfm-mail-layout__main {
  grid-column: 3;
  grid-row: 2;
  min-width: 0;
  overflow: auto;
  background: color-mix(in srgb, var(--yfm-bg-elevated) 70%, transparent);
}

.yfm-mail-layout__scrim {
  display: none;
}

/* Mobile: full-width content + off-canvas drawer */
@media (max-width: 960px) {
  .yfm-mail-layout,
  .yfm-mail-layout.is-mobile-nav {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: calc(var(--yfm-header-height) + var(--yfm-safe-top)) 1fr;
    min-height: 100dvh;
  }

  .yfm-mail-layout__brand {
    font-size: 1.05rem;
  }

  .yfm-mail-layout__scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 45;
    background: color-mix(in srgb, #000 45%, transparent);
  }

  .yfm-mail-layout__sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 50;
    width: min(18.5rem, 86vw);
    padding: calc(var(--yfm-safe-top) + var(--yfm-header-height) + 0.75rem)
      1rem calc(1rem + var(--yfm-safe-bottom));
    border-right: 1px solid var(--yfm-border);
    background: var(--yfm-bg-elevated);
    box-shadow: 8px 0 28px color-mix(in srgb, #000 28%, transparent);
    transform: translateX(-105%);
    transition: transform 0.22s ease;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }

  .yfm-mail-layout.is-sidebar-open .yfm-mail-layout__sidebar {
    transform: translateX(0);
  }

  .yfm-mail-layout.is-list .yfm-mail-layout__list {
    display: block;
    grid-column: 1;
    grid-row: 2;
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
    grid-column: 1;
    grid-row: 2;
    background: var(--yfm-bg);
  }

  /* Reading pane: bleed to edges — no outer chrome padding */
  .yfm-mail-layout.is-reader.is-mobile-nav .yfm-mail-layout__main {
    padding: 0;
  }
}
</style>
