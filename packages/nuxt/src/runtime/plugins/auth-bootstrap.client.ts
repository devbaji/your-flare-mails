/**
 * Restore session before the first page paints so logged-in users never flash /login.
 * Must run after `yfm-api` so `$yfmApi` exists (otherwise `api.me` throws and wipes the session).
 */
export default defineNuxtPlugin({
  name: 'yfm-auth-bootstrap',
  dependsOn: ['yfm-api'],
  parallel: false,
  async setup(nuxtApp) {
    if (!import.meta.client) return;
    if (!nuxtApp.$yfmApi) return;
    const { ensureSession } = useAuth();
    await ensureSession();
  },
});
