/**
 * Cloudflare Worker / Scheduled Handler for XANH Website Diagnostics Platform.
 * Executes periodic diagnostic schedules in the background via Cloudflare Cron Triggers
 * without relying on an administrator's open browser tab.
 *
 * Reference: https://developers.cloudflare.com/workers/configuration/cron-triggers/
 * Reference: https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
 */
import { executeDueDiagnosticSchedules } from '../functions/_lib/diagnostics.js';
import { onRequest as apiOnRequest } from '../functions/api/[[path]].js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return apiOnRequest({ request, env, ctx });
    }
    return new Response('XANH Diagnostics Worker Active', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    });
  },

  async scheduled(event, env, ctx) {
    const task = executeDueDiagnosticSchedules(env, {
      cronPattern: event?.cron || '*/15 * * * *',
      scheduledTime: event?.scheduledTime ? new Date(event.scheduledTime).toISOString() : new Date().toISOString(),
    });
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(task);
    } else {
      await task;
    }
  },
};
