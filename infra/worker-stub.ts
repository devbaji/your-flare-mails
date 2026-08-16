/**
 * Minimal Worker entry so Wrangler can load D1/R2 bindings for local migrate/seed.
 * Application Workers land in later phases — this file is not a production deploy target.
 */
export default {
  async fetch(): Promise<Response> {
    return new Response('your-flare-mails infra stub', { status: 200 });
  },
};
