/**
 * Restore session before the first page paints so logged-in users never flash /login.
 */
export default defineNuxtPlugin({
  name: 'yfm-auth-bootstrap',
  parallel: false,
  async setup() {
    if (!import.meta.client) return;
    const { ensureSession } = useAuth();
    await ensureSession();
  },
});
