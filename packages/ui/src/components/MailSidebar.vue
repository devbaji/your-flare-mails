<script setup lang="ts">
defineProps<{
  labels: Array<{ slug: string; name: string }>;
  activeSlug?: string | null;
}>();

defineEmits<{
  select: [slug: string];
}>();
</script>

<template>
  <nav class="yfm-sidebar" aria-label="Mailbox labels">
    <button
      v-for="label in labels"
      :key="label.slug"
      type="button"
      class="yfm-sidebar__item"
      :class="{ 'is-active': activeSlug === label.slug }"
      @click="$emit('select', label.slug)"
    >
      {{ label.name }}
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
</style>
