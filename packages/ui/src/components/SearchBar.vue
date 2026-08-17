<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  loading?: boolean;
  placeholder?: string;
  compact?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  submit: [];
  clear: [];
}>();

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
</script>

<template>
  <form class="yfm-search-bar" :class="{ 'is-compact': compact }" @submit.prevent="emit('submit')">
    <input
      type="search"
      :value="props.modelValue"
      :placeholder="placeholder ?? 'Search mail…'"
      autocomplete="off"
      enterkeyhint="search"
      @input="onInput"
    />
    <button type="submit" :disabled="loading" :aria-label="loading ? 'Searching' : 'Search'">
      <span class="yfm-search-bar__label">{{ loading ? '…' : 'Search' }}</span>
      <svg
        class="yfm-search-bar__icon"
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
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </button>
    <button
      v-if="modelValue"
      type="button"
      class="yfm-search-bar__clear"
      aria-label="Clear search"
      @click="emit('clear')"
    >
      Clear
    </button>
  </form>
</template>

<style scoped>
.yfm-search-bar {
  display: flex;
  gap: 0.4rem;
  padding: 0.65rem 0.75rem 0.25rem;
  min-width: 0;
  max-width: 100%;
}

.yfm-search-bar input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-bg-elevated);
  color: inherit;
  border-radius: var(--yfm-radius);
  padding: 0.55rem 0.75rem;
  font: inherit;
}

.yfm-search-bar button {
  appearance: none;
  border: 1px solid var(--yfm-border);
  background: var(--yfm-accent);
  color: var(--yfm-accent-fg);
  border-radius: var(--yfm-radius);
  padding: 0.45rem 0.7rem;
  font: inherit;
  cursor: pointer;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.yfm-search-bar__icon {
  display: none;
}

.yfm-search-bar__clear {
  background: transparent !important;
  color: var(--yfm-fg-muted) !important;
}

.yfm-search-bar.is-compact .yfm-search-bar__label,
.yfm-search-bar.is-compact .yfm-search-bar__clear {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.yfm-search-bar.is-compact button[type='submit'] {
  width: 2.4rem;
  padding: 0.45rem;
}

.yfm-search-bar.is-compact .yfm-search-bar__icon {
  display: block;
}

@media (max-width: 960px) {
  .yfm-search-bar:not(.is-compact) .yfm-search-bar__label {
    /* keep text on tablet if not compact */
  }
}
</style>
