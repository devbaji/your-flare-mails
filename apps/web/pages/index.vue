<script setup lang="ts">
// Prefer the mail shell; auth gate redirects anonymous users to /login
// after session bootstrap (avoids a login flash for signed-in users).
await navigateTo('/mail');
</script>
