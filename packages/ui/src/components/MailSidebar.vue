<script setup lang="ts">
withDefaults(
  defineProps<{
    labels: Array<{ slug: string; name: string }>;
    activeSlug?: string | null;
    compact?: boolean;
  }>(),
  { compact: false },
);

defineEmits<{
  select: [slug: string];
}>();
</script>

<template>
  <nav class="yfm-sidebar" :class="{ 'is-compact': compact }" aria-label="Mailbox folders">
    <button
      v-for="label in labels"
      :key="label.slug"
      type="button"
      class="yfm-sidebar__item"
      :class="{ 'is-active': activeSlug === label.slug }"
      :aria-label="label.name"
      :title="label.name"
      @click="$emit('select', label.slug)"
    >
      <svg
        class="yfm-sidebar__icon"
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
        <template v-if="label.slug === 'inbox'">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path
            d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
          />
        </template>
        <template v-else-if="label.slug === 'sent'">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </template>
        <template v-else-if="label.slug === 'drafts'">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </template>
        <template v-else-if="label.slug === 'archive'">
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </template>
        <template v-else-if="label.slug === 'trash'">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </template>
        <template v-else>
          <circle cx="12" cy="12" r="9" />
        </template>
      </svg>
      <span class="yfm-sidebar__label">{{ label.name }}</span>
    </button>
  </nav>
</template>

<style scoped>
.yfm-sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.yfm-sidebar__item {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--yfm-fg-muted);
  text-align: left;
  padding: 0.55rem 0.75rem;
  border-radius: var(--yfm-radius);
  font: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.yfm-sidebar__item:hover {
  background: var(--yfm-bg-muted);
  color: var(--yfm-fg);
}

.yfm-sidebar__item.is-active {
  background: color-mix(in srgb, var(--yfm-accent) 16%, transparent);
  color: var(--yfm-fg);
  font-weight: 600;
}

.yfm-sidebar__icon {
  flex-shrink: 0;
}

.yfm-sidebar.is-compact .yfm-sidebar__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.yfm-sidebar.is-compact .yfm-sidebar__item {
  justify-content: center;
  padding: 0.65rem;
}

@media (max-width: 960px) {
  .yfm-sidebar.is-compact {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
