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
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyMode(prefersDark ? 'dark' : 'light');
  }

  // Android WebViews often report 0 for env(safe-area-inset-*); edge-to-edge
  // still draws under the status bar — provide a CSS fallback.
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) {
    document.documentElement.style.setProperty('--yfm-safe-top-fallback', '36px');
    document.documentElement.style.setProperty('--yfm-safe-bottom-fallback', '20px');
  }
});
</script>

<template>
  <div class="yfm-root">
    <NuxtPage />
  </div>
</template>
