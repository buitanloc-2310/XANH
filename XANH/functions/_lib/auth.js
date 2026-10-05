import { randomToken, sha256Hex } from './crypto.js';
import { HttpError, parseCookies } from './http.js';

const COOKIE = 'xanh_session';
const SESSION_DAYS = 7;

export async function createSession(env, user, request) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  const ua = (request.headers.get('User-Agent') || '').slice(0, 500);
  const ip = (request.headers.get('CF-Connecting-IP') || '').slice(0, 100);
  await env.DB.prepare(`INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(user.id, tokenHash, expires.toISOString(), ua, ip, now.toISOString()).run();
  return { token, expires };
}

export function sessionCookie(token, expires) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires.toUTCString()}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function currentUser(env, request) {
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.status, s.id AS session_id, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
    LIMIT 1
  `).bind(tokenHash, new Date().toISOString()).first();
  return row || null;
}

export async function requireUser(env, request, roles = null) {
  const user = await currentUser(env, request);
  if (!user) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  if (roles && !roles.includes(user.role)) throw new HttpError(403, 'Bạn không có quyền thực hiện thao tác này.');
  return user;
}

export async function destroySession(env, request) {
  const token = parseCookies(request)[COOKIE];
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run();
}

export async function audit(env, userId, action, objectType, objectId = null, metadata = {}, request = null) {
  const ip = request ? (request.headers.get('CF-Connecting-IP') || '').slice(0, 100) : '';
  await env.DB.prepare(`INSERT INTO audit_logs (user_id, action, object_type, object_id, metadata_json, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(userId || null, action, objectType, objectId ? String(objectId) : null, JSON.stringify(metadata || {}), ip, new Date().toISOString()).run();
}
