const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Resource-Policy': 'same-site',
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...BASE_HEADERS, ...extraHeaders },
  });
}

export function text(body, status = 200, extraHeaders = {}) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...BASE_HEADERS, ...extraHeaders } });
}

export async function readJson(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new HttpError(415, 'Content-Type phải là application/json.');
  try { return await request.json(); } catch { throw new HttpError(400, 'JSON không hợp lệ.'); }
}

export class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function assert(condition, status, message, details) {
  if (!condition) throw new HttpError(status, message, details);
}

export function errorResponse(error) {
  if (error instanceof HttpError) return json({ ok: false, error: error.message, details: error.details }, error.status);
  console.error(error);
  return json({ ok: false, error: 'Đã xảy ra lỗi hệ thống.' }, 500);
}

export function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

export function safeSlug(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 120);
}

export function cleanText(value, max = 10000) {
  return String(value ?? '').replace(/\0/g, '').trim().slice(0, max);
}

export function requireSameOrigin(request) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
  const origin = request.headers.get('Origin');
  if (!origin) return;
  const url = new URL(request.url);
  if (new URL(origin).host !== url.host) throw new HttpError(403, 'Yêu cầu khác nguồn bị từ chối.');
}
