<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  loading?: boolean;
  placeholder?: string;
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
  <form class="yfm-search-bar" @submit.prevent="emit('submit')">
    <input
      type="search"
      :value="props.modelValue"
      :placeholder="placeholder ?? 'Search mail…'"
      autocomplete="off"
      @input="onInput"
    />
    <button type="submit" :disabled="loading">{{ loading ? '…' : 'Search' }}</button>
    <button v-if="modelValue" type="button" class="yfm-search-bar__clear" @click="emit('clear')">
      Clear
    </button>
  </form>
</template>

<style scoped>
.yfm-search-bar {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem 0.25rem;
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
  padding: 0.45rem 0.8rem;
  font: inherit;
  cursor: pointer;
}

.yfm-search-bar__clear {
  background: transparent !important;
  color: var(--yfm-fg-muted) !important;
}
</style>
