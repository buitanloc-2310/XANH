import { json, text, readJson, HttpError, assert, cleanText, asJson } from './http.js';
import { audit } from './auth.js';
import { onRequestGet as sitemapOnRequestGet } from '../sitemap.xml.js';
import {
  DIAG_SUITES,
  DIAG_TARGET_TYPES,
  DIAG_METHODS,
  DIAG_ENVIRONMENTS,
  DIAG_INCIDENT_STATUSES,
  DIAG_SEVERITIES,
  ensureDiagnosticsSchema,
  getDiagSettings,
  saveDiagSettings,
  validateSafeTargetUrl,
  redactSecrets,
  executeDiagnosticRun,
  executeDueDiagnosticSchedules,
} from './diagnostics.js';

const SPA_SHELL_HTML = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#23794F" />
  <meta name="description" content="Thông tin về dự án, hoạt động, sáng kiến và tài nguyên môi trường, cộng đồng. Tìm điều kiện tham gia và nội dung đã được công bố." />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="https://xanh.skyfirst.io.vn/" />
  <title>Xanh Sky First | Môi trường, cộng đồng và hành động thực tế</title>
  <link rel="icon" href="/assets/xanh-sky-first-logo.png" />
  <link rel="stylesheet" href="/styles.css?v=20261012-2" />
</head>
<body>
  <div id="app" aria-live="polite"><header><a href="/">Xanh Sky First</a><nav><a href="/gioi-thieu">Giới thiệu</a><a href="/du-an">Dự án</a><a href="/hoat-dong">Hoạt động</a><a href="/tham-gia">Tham gia</a><a href="/tra-cuu">Tra cứu</a></nav></header></div>
  <div id="toast-root" class="toast-root" aria-live="assertive"></div>
  <aside id="font-accessibility-tools" class="font-accessibility-tools" aria-label="Điều chỉnh cỡ chữ website">
    <span class="font-accessibility-label">Cỡ chữ</span>
    <button type="button" data-font-step="-1" aria-label="Giảm cỡ chữ">A−</button>
    <button type="button" data-font-step="0" aria-label="Đưa cỡ chữ về mặc định" aria-pressed="true">A</button>
    <button type="button" data-font-step="1" aria-label="Tăng cỡ chữ">A+</button>
    <span class="font-accessibility-status" aria-live="polite">Mặc định</span>
  </aside>
  <script type="module" src="/accessibility.js?v=20261012-1"></script>
  <script type="module" src="/app.js?v=20261012-4"></script>
</body>
</html>`;

const KNOWN_PUBLIC_PATHS = new Set([
  '/',
  '/gioi-thieu',
  '/hanh-dong',
  '/con-nguoi',
  '/du-an',
  '/hoat-dong',
  '/co-hoi',
  '/tai-nguyen',
  '/tin-tuc',
  '/sang-kien',
  '/tham-gia',
  '/tra-cuu',
  '/tim-kiem',
  '/lien-he',
  '/quyen-rieng-tu',
  '/dieu-khoan',
  '/chinh-sach-du-lieu',
  '/accessibility',
  '/sitemap',
  '/login',
  '/setup',
  '/reset-password',
  '/admin',
]);

export function createInternalDispatcher(env, apiOnRequest) {
  return async function internalDispatch(req) {
    const u = new URL(req.url);
    const pathname = u.pathname.replace(/\/$/, '') || '/';

    if (pathname.startsWith('/api/')) {
      return apiOnRequest({ request: req, env });
    }
    if (pathname === '/sitemap.xml') {
      return sitemapOnRequestGet({ env });
    }
    if (pathname === '/robots.txt') {
      return new Response('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\nSitemap: https://xanh.skyfirst.io.vn/sitemap.xml\n', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
      });
    }
    if (pathname.startsWith('/noi-dung/')) {
      const slug = pathname.slice('/noi-dung/'.length);
      const row = await env.DB.prepare(`SELECT id FROM pages WHERE slug=? AND status='published' LIMIT 1`).bind(slug).first().catch(() => null);
      if (!row) {
        return new Response('Không tìm thấy trang nội dung.', {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
        });
      }
      return new Response(SPA_SHELL_HTML, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      });
    }
    if (KNOWN_PUBLIC_PATHS.has(pathname) || pathname.startsWith('/admin/')) {
      return new Response(SPA_SHELL_HTML, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'Cross-Origin-Resource-Policy': 'same-site',
        },
      });
    }

    return new Response('Không tìm thấy trang (404).', {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  };
}

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s) || /^[=+\-@]/.test(s)) {
    const safeFormula = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safeFormula.replace(/"/g, '""')}"`;
  }
  return s;
}

function nowIso() {
  return new Date().toISOString();
}

export async function handleDiagnosticsAdmin(env, request, user, p, { apiOnRequest, sendMailFn, rateLimitFn } = {}) {
  const write = request.method !== 'GET';
  const canRead = ['root_admin', 'administrator', 'viewer'].includes(user.role);
  const canWrite = ['root_admin', 'administrator'].includes(user.role);
  assert(canRead, 403, 'Bạn không có quyền truy cập hệ thống chẩn đoán XANH.');
  if (write) assert(canWrite, 403, 'Chỉ Root Admin hoặc Administrator mới có quyền thực thi hoặc thay đổi cấu hình chẩn đoán.');

  await ensureDiagnosticsSchema(env);
  const u = new URL(request.url);
  const sub = p[2] || 'overview';
  const idPart = p[3] || null;
  const subAction = p[4] || null;

  // 1. OVERVIEW / DASHBOARD
  if (sub === 'overview' && request.method === 'GET') {
    const range = ['24h', '7d', '30d'].includes(u.searchParams.get('range')) ? u.searchParams.get('range') : '7d';
    const hours = range === '24h' ? 24 : range === '30d' ? 720 : 168;
    const cutoff = new Date(Date.now() - hours * 3600000).toISOString();

    const [
      lastRun,
      runsInWindow,
      resultsInWindow,
      openIncidents,
      targetsRows,
      schedulesRows,
      settings,
    ] = await Promise.all([
      env.DB.prepare(`SELECT * FROM diag_runs ORDER BY id DESC LIMIT 1`).first().catch(() => null),
      env.DB.prepare(`SELECT id, run_uid, suite_type, status, total_checks, passed_checks, failed_checks, warning_checks, avg_response_time_ms, p95_response_time_ms, started_at, duration_ms FROM diag_runs WHERE created_at >= ? ORDER BY id DESC LIMIT 100`).bind(cutoff).all().catch(() => ({ results: [] })),
      env.DB.prepare(`SELECT category, status, severity, response_time_ms, created_at FROM diag_check_results WHERE created_at >= ? ORDER BY id DESC LIMIT 500`).bind(cutoff).all().catch(() => ({ results: [] })),
      env.DB.prepare(`SELECT i.*, u.name AS assignee_name FROM diag_incidents i LEFT JOIN users u ON u.id=i.assignee_id ORDER BY CASE i.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, i.last_seen_at DESC LIMIT 50`).all().catch(() => ({ results: [] })),
      env.DB.prepare(`SELECT * FROM diag_targets ORDER BY id ASC`).all().catch(() => ({ results: [] })),
      env.DB.prepare(`SELECT * FROM diag_schedules ORDER BY enabled DESC, id ASC`).all().catch(() => ({ results: [] })),
      getDiagSettings(env),
    ]);

    const runs = runsInWindow.results || [];
    const checkRows = resultsInWindow.results || [];
    const allIncidents = openIncidents.results || [];
    const targets = targetsRows.results || [];
    const schedules = schedulesRows.results || [];

    const activeIncidents = allIncidents.filter((i) => !['resolved', 'ignored'].includes(i.status));
    const criticalOpen = activeIncidents.filter((i) => ['critical', 'high'].includes(i.severity)).length;
    const newIncidents = allIncidents.filter((i) => i.first_seen_at >= cutoff && i.status === 'open').length;
    const recurringIncidents = activeIncidents.filter((i) => Number(i.occurrence_count || 1) > 1 || Number(i.reopened_count || 0) > 0).length;
    const failingTargets = targets.filter((t) => t.enabled && ['failed', 'timeout'].includes(t.last_status));

    const totalRuns = runs.length;
    const passedRuns = runs.filter((r) => r.status === 'passed').length;
    const failedRuns = runs.filter((r) => ['failed', 'timeout'].includes(r.status)).length;

    const totalChecks = checkRows.length;
    const passedChecks = checkRows.filter((c) => c.status === 'passed').length;
    const failedChecks = checkRows.filter((c) => ['failed', 'timeout'].includes(c.status)).length;
    const passRatePercent = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 1000) / 10 : null;

    const times = checkRows.map((c) => Number(c.response_time_ms || 0)).filter((n) => n > 0).sort((a, b) => a - b);
    const medianResponseTimeMs = times.length ? times[Math.floor(times.length / 2)] : null;
    const p95ResponseTimeMs = times.length ? times[Math.min(times.length - 1, Math.floor(times.length * 0.95))] : null;

    let overallStatus = 'untested';
    if (lastRun) {
      if (criticalOpen > 0 || failingTargets.length > 0 || lastRun.status === 'failed' || lastRun.status === 'timeout') {
        overallStatus = 'critical';
      } else if (activeIncidents.length > 0 || lastRun.status === 'warning') {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'healthy';
      }
    }

    // Build honest chart data from real runs & incidents (empty array when no runs exist)
    const runHistorySeries = runs.slice(0, 20).reverse().map((r) => ({
      run_uid: r.run_uid,
      started_at: r.started_at,
      status: r.status,
      passed_checks: Number(r.passed_checks || 0),
      failed_checks: Number(r.failed_checks || 0),
      warning_checks: Number(r.warning_checks || 0),
      avg_response_time_ms: Number(r.avg_response_time_ms || 0),
      p95_response_time_ms: Number(r.p95_response_time_ms || 0),
    }));

    const severityDistribution = {
      critical: activeIncidents.filter((i) => i.severity === 'critical').length,
      high: activeIncidents.filter((i) => i.severity === 'high').length,
      medium: activeIncidents.filter((i) => i.severity === 'medium').length,
      low: activeIncidents.filter((i) => i.severity === 'low').length,
    };

    const categoryFailures = {};
    for (const cat of ['website', 'api', 'browser', 'd1', 'r2', 'security', 'performance', 'workflow']) {
      categoryFailures[cat] = activeIncidents.filter((i) => i.category === cat).length;
    }

    const enabledSchedules = schedules.filter((s) => Number(s.enabled) === 1);
    const nextSchedule = enabledSchedules.sort((a, b) => String(a.next_run_at || '9999').localeCompare(String(b.next_run_at || '9999')))[0] || null;

    return json({
      ok: true,
      range,
      overall_status: overallStatus,
      last_run: lastRun ? { ...lastRun, summary: asJson(lastRun.summary_json, {}) } : null,
      metrics: {
        has_data: totalRuns > 0,
        total_targets: targets.length,
        enabled_targets: targets.filter((t) => Number(t.enabled) === 1).length,
        healthy_targets: targets.filter((t) => t.last_status === 'passed').length,
        untested_targets: targets.filter((t) => t.last_status === 'untested').length,
        failing_targets: failingTargets.length,
        total_runs: totalRuns,
        passed_runs: passedRuns,
        failed_runs: failedRuns,
        total_checks: totalChecks,
        passed_checks: passedChecks,
        failed_checks: failedChecks,
        pass_rate_percent: passRatePercent,
        median_response_time_ms: medianResponseTimeMs,
        p95_response_time_ms: p95ResponseTimeMs,
        new_incidents_count: newIncidents,
        critical_open_incidents: criticalOpen,
        active_incidents_count: activeIncidents.length,
        recurring_incidents_count: recurringIncidents,
      },
      failing_endpoints: failingTargets.map((t) => ({
        id: t.id,
        name: t.name,
        target_type: t.target_type,
        url_or_path: t.url_or_path,
        last_status: t.last_status,
        last_http_status: t.last_http_status,
        last_response_time_ms: t.last_response_time_ms,
        last_checked_at: t.last_checked_at,
      })),
      charts: {
        run_history: runHistorySeries,
        severity_distribution: severityDistribution,
        category_failures: categoryFailures,
      },
      integrations: {
        d1_database: { configured: Boolean(env?.DB), binding: 'DB', database_name: 'xanh', status: env?.DB ? 'connected' : 'missing' },
        r2_storage: { configured: Boolean(env?.STORAGE), binding: 'STORAGE', bucket_name: 'xanh', status: env?.STORAGE ? 'connected' : 'not_bound_in_current_env' },
        resend_email: { configured: Boolean(env?.RESEND_API_KEY), status: env?.RESEND_API_KEY ? 'configured' : 'not_configured' },
        ctt_sync: { configured: Boolean(env?.XANH_CTT_SHARED_SECRET && String(env.XANH_CTT_SHARED_SECRET).length >= 32), status: env?.XANH_CTT_SHARED_SECRET ? 'configured' : 'not_configured' },
        playwright_runner: { configured: Boolean(env?.DIAG_BROWSER_RUNNER_URL), status: env?.DIAG_BROWSER_RUNNER_URL ? 'configured' : 'using_builtin_dom_verifier' },
        lighthouse_runner: { configured: Boolean(env?.DIAG_LIGHTHOUSE_RUNNER_URL), status: env?.DIAG_LIGHTHOUSE_RUNNER_URL ? 'configured' : 'using_builtin_lab_metrics' },
      },
      next_schedule: nextSchedule,
      schedules_summary: {
        total: schedules.length,
        enabled: enabledSchedules.length,
        interrupted: schedules.filter((s) => s.last_status === 'interrupted').length,
      },
      recent_incidents: activeIncidents.slice(0, 12).map((i) => ({
        id: i.id,
        incident_code: i.incident_code,
        category: i.category,
        severity: i.severity,
        title: i.title,
        affected_url: i.affected_url,
        affected_component: i.affected_component,
        status: i.status,
        occurrence_count: i.occurrence_count,
        reopened_count: i.reopened_count,
        last_seen_at: i.last_seen_at,
        assignee_id: i.assignee_id,
        assignee_name: i.assignee_name || null,
      })),
      settings,
    });
  }

  // 2. TARGETS LIST & CRUD
  if (sub === 'targets') {
    if (request.method === 'GET') {
      const type = cleanText(u.searchParams.get('type'), 30);
      const status = cleanText(u.searchParams.get('status'), 30);
      const q = cleanText(u.searchParams.get('q'), 120);
      const page = Math.max(1, Number(u.searchParams.get('page') || 1));
      const pageSize = Math.max(5, Math.min(100, Number(u.searchParams.get('page_size') || 25)));

      let where = `WHERE 1=1`;
      const binds = [];
      if (type && DIAG_TARGET_TYPES.has(type)) {
        where += ` AND target_type=?`;
        binds.push(type);
      }
      if (status) {
        where += ` AND last_status=?`;
        binds.push(status);
      }
      if (q) {
        where += ` AND (name LIKE ? OR url_or_path LIKE ? OR hostname LIKE ?)`;
        binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }

      const countRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM diag_targets ${where}`).bind(...binds).first();
      const total = Number(countRow?.c || 0);
      const offset = (page - 1) * pageSize;

      const rows = await env.DB.prepare(
        `SELECT * FROM diag_targets ${where} ORDER BY id ASC LIMIT ? OFFSET ?`
      ).bind(...binds, pageSize, offset).all();

      return json({
        ok: true,
        total,
        page,
        page_size: pageSize,
        items: (rows.results || []).map((t) => ({
          ...t,
          headers: redactSecrets(asJson(t.headers_json, {})),
          assertions: asJson(t.assertions_json, []),
          headers_json: undefined,
        })),
      });
    }

    if (request.method === 'POST') {
      const b = await readJson(request);
      const settings = await getDiagSettings(env);
      const name = cleanText(b.name, 180);
      assert(name.length >= 2, 400, 'Tên mục tiêu kiểm tra cần ít nhất 2 ký tự.');
      const targetType = DIAG_TARGET_TYPES.has(b.target_type) ? b.target_type : 'website';
      const validatedUrl = validateSafeTargetUrl(b.url_or_path, settings.allowed_hostnames, env?.APP_URL || 'https://xanh.skyfirst.io.vn');
      const method = DIAG_METHODS.has(String(b.method || 'GET').toUpperCase()) ? String(b.method || 'GET').toUpperCase() : 'GET';
      const expectedStatus = Math.max(100, Math.min(599, Number(b.expected_status || 200)));
      const timeoutMs = Math.max(500, Math.min(30000, Number(b.timeout_ms || 8000)));
      const rateLimitRpm = Math.max(1, Math.min(300, Number(b.rate_limit_rpm || 30)));
      const authType = ['none', 'session', 'bearer_secret', 'header_secret'].includes(b.auth_type) ? b.auth_type : 'none';
      const secretRef = cleanText(b.secret_ref || '', 80).replace(/[^A-Z0-9_]/g, '');
      const envName = DIAG_ENVIRONMENTS.has(b.environment) ? b.environment : 'production';
      const enabled = b.enabled === false || b.enabled === 0 ? 0 : 1;
      const assertions = Array.isArray(b.assertions) ? b.assertions.slice(0, 20) : [];
      const headers = b.headers && typeof b.headers === 'object' ? redactSecrets(b.headers) : {};

      const t = nowIso();
      const r = await env.DB.prepare(
        `INSERT INTO diag_targets(
          name, target_type, url_or_path, hostname, method, headers_json, auth_type, secret_ref,
          expected_status, timeout_ms, rate_limit_rpm, assertions_json, environment, enabled,
          last_status, created_by, updated_by, created_at, updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'untested',?,?,?,?)`
      )
        .bind(
          name,
          targetType,
          cleanText(b.url_or_path, 500),
          validatedUrl.hostname,
          method,
          JSON.stringify(headers),
          authType,
          secretRef,
          expectedStatus,
          timeoutMs,
          rateLimitRpm,
          JSON.stringify(assertions),
          envName,
          enabled,
          user.id,
          user.id,
          t,
          t
        )
        .run();

      await audit(env, user.id, 'diagnostics.target.create', 'diag_target', r.meta?.last_row_id, { name, targetType, url: b.url_or_path }, request);
      return json({ ok: true, id: r.meta?.last_row_id }, 201);
    }
  }

  if (sub === 'target' && idPart) {
    const id = Number(idPart);
    assert(Number.isSafeInteger(id) && id > 0, 400, 'ID mục tiêu không hợp lệ.');
    const existing = await env.DB.prepare(`SELECT * FROM diag_targets WHERE id=?`).bind(id).first();
    assert(existing, 404, 'Không tìm thấy mục tiêu kiểm tra.');

    if (request.method === 'GET') {
      const [history, incidents, baselines] = await Promise.all([
        env.DB.prepare(`SELECT * FROM diag_check_results WHERE target_id=? ORDER BY id DESC LIMIT 30`).bind(id).all().catch(() => ({ results: [] })),
        env.DB.prepare(`SELECT * FROM diag_incidents WHERE affected_url=? ORDER BY last_seen_at DESC LIMIT 20`).bind(existing.url_or_path).all().catch(() => ({ results: [] })),
        env.DB.prepare(`SELECT * FROM diag_baselines WHERE target_id=? ORDER BY updated_at DESC`).bind(id).all().catch(() => ({ results: [] })),
      ]);
      return json({
        ok: true,
        item: {
          ...existing,
          headers: redactSecrets(asJson(existing.headers_json, {})),
          assertions: asJson(existing.assertions_json, []),
          headers_json: undefined,
        },
        history: (history.results || []).map((h) => ({ ...h, evidence: redactSecrets(asJson(h.evidence_json, {})), diagnosis: asJson(h.diagnosis_json, {}) })),
        incidents: incidents.results || [],
        baselines: baselines.results || [],
      });
    }

    if (request.method === 'PUT') {
      const b = await readJson(request);
      const settings = await getDiagSettings(env);
      const name = cleanText(b.name ?? existing.name, 180);
      const rawUrl = b.url_or_path ?? existing.url_or_path;
      const validatedUrl = validateSafeTargetUrl(rawUrl, settings.allowed_hostnames, env?.APP_URL || 'https://xanh.skyfirst.io.vn');
      const targetType = DIAG_TARGET_TYPES.has(b.target_type) ? b.target_type : existing.target_type;
      const method = DIAG_METHODS.has(String(b.method || existing.method).toUpperCase()) ? String(b.method || existing.method).toUpperCase() : existing.method;
      const expectedStatus = Math.max(100, Math.min(599, Number(b.expected_status ?? existing.expected_status)));
      const timeoutMs = Math.max(500, Math.min(30000, Number(b.timeout_ms ?? existing.timeout_ms)));
      const rateLimitRpm = Math.max(1, Math.min(300, Number(b.rate_limit_rpm ?? existing.rate_limit_rpm)));
      const authType = ['none', 'session', 'bearer_secret', 'header_secret'].includes(b.auth_type) ? b.auth_type : existing.auth_type;
      const secretRef = b.secret_ref !== undefined ? cleanText(b.secret_ref, 80).replace(/[^A-Z0-9_]/g, '') : existing.secret_ref;
      const envName = DIAG_ENVIRONMENTS.has(b.environment) ? b.environment : existing.environment;
      const enabled = b.enabled !== undefined ? (b.enabled ? 1 : 0) : existing.enabled;
      const assertions = Array.isArray(b.assertions) ? b.assertions.slice(0, 20) : asJson(existing.assertions_json, []);
      const headers = b.headers && typeof b.headers === 'object' ? redactSecrets(b.headers) : asJson(existing.headers_json, {});

      await env.DB.prepare(
        `UPDATE diag_targets
         SET name=?, target_type=?, url_or_path=?, hostname=?, method=?, headers_json=?, auth_type=?, secret_ref=?,
             expected_status=?, timeout_ms=?, rate_limit_rpm=?, assertions_json=?, environment=?, enabled=?,
             updated_by=?, updated_at=?
         WHERE id=?`
      )
        .bind(
          name,
          targetType,
          cleanText(rawUrl, 500),
          validatedUrl.hostname,
          method,
          JSON.stringify(headers),
          authType,
          secretRef,
          expectedStatus,
          timeoutMs,
          rateLimitRpm,
          JSON.stringify(assertions),
          envName,
          enabled,
          user.id,
          nowIso(),
          id
        )
        .run();

      await audit(env, user.id, 'diagnostics.target.update', 'diag_target', id, { name, targetType, enabled }, request);
      return json({ ok: true });
    }

    if (request.method === 'DELETE') {
      await env.DB.prepare(`DELETE FROM diag_targets WHERE id=?`).bind(id).run();
      await audit(env, user.id, 'diagnostics.target.delete', 'diag_target', id, { name: existing.name }, request);
      return json({ ok: true });
    }
  }

  // 3. EXECUTE DIAGNOSTIC RUN
  if (sub === 'run' && request.method === 'POST') {
    if (typeof rateLimitFn === 'function') {
      await rateLimitFn(env, request, 'diag-run', 25, 60);
    }
    const b = await readJson(request);
    const suiteType = DIAG_SUITES.has(b.suite_type) ? b.suite_type : 'full';
    const targetId = b.target_id ? Number(b.target_id) : null;
    const environment = DIAG_ENVIRONMENTS.has(b.environment) ? b.environment : 'production';

    const internalDispatch = createInternalDispatcher(env, apiOnRequest);
    const runResult = await executeDiagnosticRun(env, {
      suiteType,
      targetId,
      triggerType: b.trigger_type === 'recheck' ? 'recheck' : 'manual',
      userId: user.id,
      environment,
      options: {
        internalDispatch,
        sessionCookieHeader: request.headers.get('Cookie') || '',
        sendMailFn,
        request,
      },
    });

    return json({ ok: true, run: runResult });
  }

  // 4. RUN HISTORY & RUN DETAILS
  if (sub === 'runs' && request.method === 'GET') {
    const suite = cleanText(u.searchParams.get('suite'), 30);
    const status = cleanText(u.searchParams.get('status'), 30);
    const page = Math.max(1, Number(u.searchParams.get('page') || 1));
    const pageSize = Math.max(5, Math.min(100, Number(u.searchParams.get('page_size') || 20)));

    let where = `WHERE 1=1`;
    const binds = [];
    if (suite && DIAG_SUITES.has(suite)) {
      where += ` AND suite_type=?`;
      binds.push(suite);
    }
    if (status) {
      where += ` AND status=?`;
      binds.push(status);
    }

    const countRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM diag_runs ${where}`).bind(...binds).first();
    const total = Number(countRow?.c || 0);
    const offset = (page - 1) * pageSize;

    const rows = await env.DB.prepare(
      `SELECT r.*, u.name AS triggered_by_name FROM diag_runs r LEFT JOIN users u ON u.id=r.triggered_by ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`
    ).bind(...binds, pageSize, offset).all();

    return json({
      ok: true,
      total,
      page,
      page_size: pageSize,
      items: (rows.results || []).map((r) => ({ ...r, summary: asJson(r.summary_json, {}) })),
    });
  }

  if (sub === 'run-detail' && idPart && request.method === 'GET') {
    const id = Number(idPart);
    const runRow = await env.DB.prepare(`SELECT * FROM diag_runs WHERE id=?`).bind(id).first();
    assert(runRow, 404, 'Không tìm thấy phiên chạy kiểm tra.');
    const checkRows = await env.DB.prepare(`SELECT * FROM diag_check_results WHERE run_id=? ORDER BY id ASC`).bind(id).all();
    return json({
      ok: true,
      run: { ...runRow, summary: asJson(runRow.summary_json, {}) },
      results: (checkRows.results || []).map((c) => ({
        ...c,
        evidence: redactSecrets(asJson(c.evidence_json, {})),
        diagnosis: asJson(c.diagnosis_json, {}),
      })),
    });
  }

  // 5. INCIDENTS LIST, DETAIL, STATUS WORKFLOW & RETEST
  if (sub === 'incidents' && request.method === 'GET') {
    const status = cleanText(u.searchParams.get('status'), 30);
    const severity = cleanText(u.searchParams.get('severity'), 30);
    const category = cleanText(u.searchParams.get('category'), 30);
    const q = cleanText(u.searchParams.get('q'), 120);
    const page = Math.max(1, Number(u.searchParams.get('page') || 1));
    const pageSize = Math.max(5, Math.min(100, Number(u.searchParams.get('page_size') || 25)));

    let where = `WHERE 1=1`;
    const binds = [];
    if (status && DIAG_INCIDENT_STATUSES.has(status)) {
      where += ` AND i.status=?`;
      binds.push(status);
    }
    if (severity && DIAG_SEVERITIES.has(severity)) {
      where += ` AND i.severity=?`;
      binds.push(severity);
    }
    if (category && DIAG_TARGET_TYPES.has(category)) {
      where += ` AND i.category=?`;
      binds.push(category);
    }
    if (q) {
      where += ` AND (i.incident_code LIKE ? OR i.title LIKE ? OR i.affected_url LIKE ? OR i.affected_component LIKE ?)`;
      binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const countRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM diag_incidents i ${where}`).bind(...binds).first();
    const total = Number(countRow?.c || 0);
    const offset = (page - 1) * pageSize;

    const rows = await env.DB.prepare(
      `SELECT i.*, u.name AS assignee_name
       FROM diag_incidents i LEFT JOIN users u ON u.id=i.assignee_id
       ${where}
       ORDER BY
         CASE WHEN i.status IN ('open','investigating','fixing','retesting') THEN 0 ELSE 1 END,
         CASE i.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         i.last_seen_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...binds, pageSize, offset).all();

    return json({
      ok: true,
      total,
      page,
      page_size: pageSize,
      items: (rows.results || []).map((i) => ({
        ...i,
        evidence: redactSecrets(asJson(i.evidence_json, {})),
        remediation_steps: asJson(i.remediation_steps_json, []),
        evidence_json: undefined,
        remediation_steps_json: undefined,
      })),
    });
  }

  if (sub === 'incident' && idPart) {
    const id = Number(idPart);
    assert(Number.isSafeInteger(id) && id > 0, 400, 'ID sự cố không hợp lệ.');
    const inc = await env.DB.prepare(
      `SELECT i.*, u.name AS assignee_name FROM diag_incidents i LEFT JOIN users u ON u.id=i.assignee_id WHERE i.id=?`
    ).bind(id).first();
    assert(inc, 404, 'Không tìm thấy sự cố.');

    if (subAction === 'retest' && request.method === 'POST') {
      const t = nowIso();
      await env.DB.prepare(`UPDATE diag_incidents SET status='retesting', updated_at=? WHERE id=?`).bind(t, id).run();
      await env.DB.prepare(
        `INSERT INTO diag_incident_events(incident_id, event_type, old_status, new_status, actor_user_id, note, created_at)
         VALUES(?, 'retest_triggered', ?, 'retesting', ?, 'Kích hoạt kiểm tra lại từ trang Chi tiết sự cố.', ?)`
      ).bind(id, inc.status, user.id, t).run();

      const internalDispatch = createInternalDispatcher(env, apiOnRequest);
      const runResult = await executeDiagnosticRun(env, {
        suiteType: inc.category || 'full',
        triggerType: 'recheck',
        userId: user.id,
        options: {
          internalDispatch,
          sessionCookieHeader: request.headers.get('Cookie') || '',
          sendMailFn,
          request,
        },
      });

      const updatedInc = await env.DB.prepare(`SELECT * FROM diag_incidents WHERE id=?`).bind(id).first();
      await audit(env, user.id, 'diagnostics.incident.retest', 'diag_incident', inc.incident_code, { new_status: updatedInc?.status, run_uid: runResult.run_uid }, request);
      return json({ ok: true, incident: updatedInc, run: runResult });
    }

    if (request.method === 'GET') {
      const [events, usersList] = await Promise.all([
        env.DB.prepare(
          `SELECT e.*, u.name AS actor_name FROM diag_incident_events e LEFT JOIN users u ON u.id=e.actor_user_id WHERE e.incident_id=? ORDER BY e.created_at DESC`
        ).bind(id).all().catch(() => ({ results: [] })),
        env.DB.prepare(`SELECT id, name, email, role FROM users WHERE status='active' ORDER BY name`).all().catch(() => ({ results: [] })),
      ]);

      return json({
        ok: true,
        item: {
          ...inc,
          evidence: redactSecrets(asJson(inc.evidence_json, {})),
          remediation_steps: asJson(inc.remediation_steps_json, []),
        },
        timeline: events.results || [],
        assignees: usersList.results || [],
      });
    }

    if (request.method === 'PUT') {
      const b = await readJson(request);
      const nextStatus = DIAG_INCIDENT_STATUSES.has(b.status) ? b.status : inc.status;
      const assigneeId = b.assignee_id === null || b.assignee_id === '' ? null : Number(b.assignee_id || inc.assignee_id) || null;
      const verifiedCause = b.verified_cause !== undefined ? cleanText(b.verified_cause, 1500) : inc.verified_cause;
      const note = cleanText(b.note || '', 1000);
      const t = nowIso();
      const resolvedAt = nextStatus === 'resolved' ? (inc.resolved_at || t) : nextStatus === 'open' ? null : inc.resolved_at;

      await env.DB.prepare(
        `UPDATE diag_incidents SET status=?, assignee_id=?, verified_cause=?, resolved_at=?, updated_at=? WHERE id=?`
      ).bind(nextStatus, assigneeId, verifiedCause, resolvedAt, t, id).run();

      await env.DB.prepare(
        `INSERT INTO diag_incident_events(incident_id, event_type, old_status, new_status, actor_user_id, note, created_at)
         VALUES(?, 'status_update', ?, ?, ?, ?, ?)`
      ).bind(id, inc.status, nextStatus, user.id, note || `Cập nhật trạng thái: ${inc.status} → ${nextStatus}`, t).run();

      await audit(env, user.id, 'diagnostics.incident.update', 'diag_incident', inc.incident_code, { from: inc.status, to: nextStatus, assignee_id: assigneeId }, request);
      return json({ ok: true, status: nextStatus });
    }
  }

  // 6. SCHEDULES MANAGEMENT & EXECUTION
  if (sub === 'schedules') {
    if (request.method === 'GET') {
      const rows = await env.DB.prepare(
        `SELECT s.*, t.name AS target_name FROM diag_schedules s LEFT JOIN diag_targets t ON t.id=s.target_id ORDER BY s.id ASC`
      ).all();
      return json({ ok: true, items: rows.results || [] });
    }
    if (request.method === 'POST') {
      const b = await readJson(request);
      const name = cleanText(b.name, 180);
      assert(name.length >= 2, 400, 'Tên lịch kiểm tra cần ít nhất 2 ký tự.');
      const suiteType = DIAG_SUITES.has(b.suite_type) ? b.suite_type : 'full';
      const targetId = b.target_id ? Number(b.target_id) : null;
      const scheduleKind = ['manual', 'periodic', 'event'].includes(b.schedule_kind) ? b.schedule_kind : 'periodic';
      const intervalMinutes = Math.max(1, Math.min(10080, Number(b.interval_minutes || 15)));
      const cronExpr = cleanText(b.cron_expr || `*/${Math.min(59, intervalMinutes)} * * * *`, 60);
      const activeStart = /^\d{2}:\d{2}$/.test(String(b.active_window_start || '')) ? b.active_window_start : '00:00';
      const activeEnd = /^\d{2}:\d{2}$/.test(String(b.active_window_end || '')) ? b.active_window_end : '23:59';
      const timezone = ['Asia/Ho_Chi_Minh', 'UTC', 'Asia/Bangkok', 'Asia/Singapore'].includes(b.timezone) ? b.timezone : 'Asia/Ho_Chi_Minh';
      const timeoutMs = Math.max(1000, Math.min(60000, Number(b.timeout_ms || 15000)));
      const maxConcurrency = Math.max(1, Math.min(10, Number(b.max_concurrency || 2)));
      const retryLimit = Math.max(0, Math.min(5, Number(b.retry_limit ?? 2)));
      const backoffSeconds = Math.max(5, Math.min(3600, Number(b.backoff_seconds || 30)));
      const alertThreshold = Math.max(1, Math.min(10, Number(b.alert_threshold || 1)));
      const enabled = b.enabled === false || b.enabled === 0 ? 0 : 1;
      const t = nowIso();
      const nextRunAt = new Date(Date.now() + intervalMinutes * 60000).toISOString();

      const r = await env.DB.prepare(
        `INSERT INTO diag_schedules(
          name, target_id, suite_type, schedule_kind, cron_expr, interval_minutes,
          active_window_start, active_window_end, timezone, timeout_ms, max_concurrency,
          retry_limit, backoff_seconds, alert_threshold, enabled, next_run_at,
          last_status, created_by, updated_by, created_at, updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'idle',?,?,?,?)`
      )
        .bind(
          name,
          targetId,
          suiteType,
          scheduleKind,
          cronExpr,
          intervalMinutes,
          activeStart,
          activeEnd,
          timezone,
          timeoutMs,
          maxConcurrency,
          retryLimit,
          backoffSeconds,
          alertThreshold,
          enabled,
          nextRunAt,
          user.id,
          user.id,
          t,
          t
        )
        .run();

      await audit(env, user.id, 'diagnostics.schedule.create', 'diag_schedule', r.meta?.last_row_id, { name, suiteType, intervalMinutes }, request);
      return json({ ok: true, id: r.meta?.last_row_id }, 201);
    }
  }

  if (sub === 'schedule' && idPart) {
    const id = Number(idPart);
    const sched = await env.DB.prepare(`SELECT * FROM diag_schedules WHERE id=?`).bind(id).first();
    assert(sched, 404, 'Không tìm thấy lịch kiểm tra.');

    if (subAction === 'trigger' && request.method === 'POST') {
      const internalDispatch = createInternalDispatcher(env, apiOnRequest);
      const runResult = await executeDiagnosticRun(env, {
        suiteType: sched.suite_type || 'full',
        targetId: sched.target_id || null,
        triggerType: 'schedule',
        scheduleId: sched.id,
        userId: user.id,
        options: {
          internalDispatch,
          sessionCookieHeader: request.headers.get('Cookie') || '',
          sendMailFn,
          request,
        },
      });
      const nextRunAt = new Date(Date.now() + Math.max(1, Number(sched.interval_minutes || 15)) * 60000).toISOString();
      await env.DB.prepare(
        `UPDATE diag_schedules SET last_run_at=?, next_run_at=?, last_status=?, consecutive_failures=?, last_error=?, updated_at=? WHERE id=?`
      )
        .bind(
          nowIso(),
          nextRunAt,
          runResult.status,
          runResult.status === 'failed' ? Number(sched.consecutive_failures || 0) + 1 : 0,
          runResult.status === 'failed' ? `Phát hiện ${runResult.failed_checks} lỗi.` : '',
          nowIso(),
          id
        )
        .run();
      return json({ ok: true, run: runResult });
    }

    if (request.method === 'PUT') {
      const b = await readJson(request);
      const name = cleanText(b.name ?? sched.name, 180);
      const suiteType = DIAG_SUITES.has(b.suite_type) ? b.suite_type : sched.suite_type;
      const targetId = b.target_id !== undefined ? (b.target_id ? Number(b.target_id) : null) : sched.target_id;
      const scheduleKind = ['manual', 'periodic', 'event'].includes(b.schedule_kind) ? b.schedule_kind : sched.schedule_kind;
      const intervalMinutes = Math.max(1, Math.min(10080, Number(b.interval_minutes ?? sched.interval_minutes)));
      const cronExpr = cleanText(b.cron_expr ?? sched.cron_expr, 60);
      const activeStart = /^\d{2}:\d{2}$/.test(String(b.active_window_start || '')) ? b.active_window_start : sched.active_window_start;
      const activeEnd = /^\d{2}:\d{2}$/.test(String(b.active_window_end || '')) ? b.active_window_end : sched.active_window_end;
      const timezone = ['Asia/Ho_Chi_Minh', 'UTC', 'Asia/Bangkok', 'Asia/Singapore'].includes(b.timezone) ? b.timezone : sched.timezone;
      const timeoutMs = Math.max(1000, Math.min(60000, Number(b.timeout_ms ?? sched.timeout_ms)));
      const maxConcurrency = Math.max(1, Math.min(10, Number(b.max_concurrency ?? sched.max_concurrency)));
      const retryLimit = Math.max(0, Math.min(5, Number(b.retry_limit ?? sched.retry_limit)));
      const backoffSeconds = Math.max(5, Math.min(3600, Number(b.backoff_seconds ?? sched.backoff_seconds)));
      const alertThreshold = Math.max(1, Math.min(10, Number(b.alert_threshold ?? sched.alert_threshold)));
      const enabled = b.enabled !== undefined ? (b.enabled ? 1 : 0) : sched.enabled;
      const nextRunAt = enabled ? new Date(Date.now() + intervalMinutes * 60000).toISOString() : null;

      await env.DB.prepare(
        `UPDATE diag_schedules
         SET name=?, target_id=?, suite_type=?, schedule_kind=?, cron_expr=?, interval_minutes=?,
             active_window_start=?, active_window_end=?, timezone=?, timeout_ms=?, max_concurrency=?,
             retry_limit=?, backoff_seconds=?, alert_threshold=?, enabled=?, next_run_at=?,
             updated_by=?, updated_at=?
         WHERE id=?`
      )
        .bind(
          name,
          targetId,
          suiteType,
          scheduleKind,
          cronExpr,
          intervalMinutes,
          activeStart,
          activeEnd,
          timezone,
          timeoutMs,
          maxConcurrency,
          retryLimit,
          backoffSeconds,
          alertThreshold,
          enabled,
          nextRunAt,
          user.id,
          nowIso(),
          id
        )
        .run();

      await audit(env, user.id, 'diagnostics.schedule.update', 'diag_schedule', id, { name, enabled, intervalMinutes }, request);
      return json({ ok: true });
    }

    if (request.method === 'DELETE') {
      await env.DB.prepare(`DELETE FROM diag_schedules WHERE id=?`).bind(id).run();
      await audit(env, user.id, 'diagnostics.schedule.delete', 'diag_schedule', id, { name: sched.name }, request);
      return json({ ok: true });
    }
  }

  // 7. ALERTS CONFIGURATION & LOGS
  if (sub === 'alerts') {
    if (request.method === 'GET') {
      const [rules, logs] = await Promise.all([
        env.DB.prepare(`SELECT * FROM diag_alerts ORDER BY id ASC`).all().catch(() => ({ results: [] })),
        env.DB.prepare(
          `SELECT l.*, a.rule_name, i.incident_code, i.title AS incident_title
           FROM diag_alert_logs l
           LEFT JOIN diag_alerts a ON a.id=l.alert_id
           LEFT JOIN diag_incidents i ON i.id=l.incident_id
           ORDER BY l.id DESC LIMIT 100`
        ).all().catch(() => ({ results: [] })),
      ]);
      return json({
        ok: true,
        rules: (rules.results || []).map((r) => ({ ...r, recipient_config: redactSecrets(asJson(r.recipient_config_json, {})) })),
        logs: logs.results || [],
      });
    }
    if (request.method === 'POST') {
      const b = await readJson(request);
      const ruleName = cleanText(b.rule_name, 160);
      assert(ruleName.length >= 2, 400, 'Tên quy tắc cảnh báo cần ít nhất 2 ký tự.');
      const channel = ['email', 'webhook', 'internal'].includes(b.channel) ? b.channel : 'email';
      const minSeverity = DIAG_SEVERITIES.has(b.min_severity) ? b.min_severity : 'high';
      const cooldown = Math.max(1, Math.min(10080, Number(b.cooldown_minutes || 30)));
      const repeatCond = ['on_new_only', 'on_new_or_regression', 'after_cooldown'].includes(b.repeat_condition) ? b.repeat_condition : 'on_new_or_regression';
      const enabled = b.enabled === false || b.enabled === 0 ? 0 : 1;
      const recipientCfg = b.recipient_config && typeof b.recipient_config === 'object' ? b.recipient_config : {};
      const t = nowIso();

      const r = await env.DB.prepare(
        `INSERT INTO diag_alerts(rule_name, channel, recipient_config_json, min_severity, cooldown_minutes, repeat_condition, enabled, updated_by, created_at, updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?)`
      ).bind(ruleName, channel, JSON.stringify(recipientCfg), minSeverity, cooldown, repeatCond, enabled, user.id, t, t).run();
      await audit(env, user.id, 'diagnostics.alert.create', 'diag_alert', r.meta?.last_row_id, { ruleName, channel }, request);
      return json({ ok: true, id: r.meta?.last_row_id }, 201);
    }
  }

  if (sub === 'alert' && idPart && request.method === 'PUT') {
    const id = Number(idPart);
    const old = await env.DB.prepare(`SELECT * FROM diag_alerts WHERE id=?`).bind(id).first();
    assert(old, 404, 'Không tìm thấy quy tắc cảnh báo.');
    const b = await readJson(request);
    const ruleName = cleanText(b.rule_name ?? old.rule_name, 160);
    const channel = ['email', 'webhook', 'internal'].includes(b.channel) ? b.channel : old.channel;
    const minSeverity = DIAG_SEVERITIES.has(b.min_severity) ? b.min_severity : old.min_severity;
    const cooldown = Math.max(1, Math.min(10080, Number(b.cooldown_minutes ?? old.cooldown_minutes)));
    const repeatCond = ['on_new_only', 'on_new_or_regression', 'after_cooldown'].includes(b.repeat_condition) ? b.repeat_condition : old.repeat_condition;
    const enabled = b.enabled !== undefined ? (b.enabled ? 1 : 0) : old.enabled;
    const recipientCfg = b.recipient_config && typeof b.recipient_config === 'object' ? b.recipient_config : asJson(old.recipient_config_json, {});

    await env.DB.prepare(
      `UPDATE diag_alerts SET rule_name=?, channel=?, recipient_config_json=?, min_severity=?, cooldown_minutes=?, repeat_condition=?, enabled=?, updated_by=?, updated_at=? WHERE id=?`
    ).bind(ruleName, channel, JSON.stringify(recipientCfg), minSeverity, cooldown, repeatCond, enabled, user.id, nowIso(), id).run();
    await audit(env, user.id, 'diagnostics.alert.update', 'diag_alert', id, { ruleName, enabled }, request);
    return json({ ok: true });
  }

  // 8. REPORTS & CSV EXPORT
  if (sub === 'reports' && request.method === 'GET') {
    const days = Math.max(1, Math.min(365, Number(u.searchParams.get('days') || 30)));
    const category = cleanText(u.searchParams.get('category'), 30);
    const severity = cleanText(u.searchParams.get('severity'), 30);
    const status = cleanText(u.searchParams.get('status'), 30);
    const format = u.searchParams.get('format') || 'json';
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();

    let incWhere = `WHERE created_at >= ?`;
    const incBinds = [cutoff];
    if (category && DIAG_TARGET_TYPES.has(category)) {
      incWhere += ` AND category=?`;
      incBinds.push(category);
    }
    if (severity && DIAG_SEVERITIES.has(severity)) {
      incWhere += ` AND severity=?`;
      incBinds.push(severity);
    }
    if (status && DIAG_INCIDENT_STATUSES.has(status)) {
      incWhere += ` AND status=?`;
      incBinds.push(status);
    }

    const [incidentsRows, runsRows, targetsRows] = await Promise.all([
      env.DB.prepare(`SELECT * FROM diag_incidents ${incWhere} ORDER BY last_seen_at DESC LIMIT 500`).bind(...incBinds).all().catch(() => ({ results: [] })),
      env.DB.prepare(`SELECT * FROM diag_runs WHERE created_at >= ? ORDER BY id DESC LIMIT 200`).bind(cutoff).all().catch(() => ({ results: [] })),
      env.DB.prepare(`SELECT * FROM diag_targets ORDER BY id ASC`).all().catch(() => ({ results: [] })),
    ]);

    const incidents = incidentsRows.results || [];
    const runs = runsRows.results || [];
    const targets = targetsRows.results || [];

    if (format === 'csv') {
      const headers = [
        'Mã sự cố',
        'Nhóm kiểm tra',
        'Mức độ nghiêm trọng',
        'Tiêu đề lỗi',
        'URL / Thành phần bị ảnh hưởng',
        'Trạng thái xử lý',
        'Số lần tái diễn',
        'Số lần mở lại',
        'Thời điểm phát hiện đầu tiên',
        'Lần xuất hiện gần nhất',
        'Nguyên nhân xác minh / Giả thuyết',
      ];
      const lines = [
        headers.map(csvEscape).join(','),
        ...incidents.map((inc) =>
          [
            inc.incident_code,
            inc.category,
            inc.severity,
            inc.title,
            inc.affected_url || inc.affected_component,
            inc.status,
            inc.occurrence_count,
            inc.reopened_count,
            inc.first_seen_at,
            inc.last_seen_at,
            inc.verified_cause || inc.hypothesis_cause || inc.plain_explanation,
          ]
            .map(csvEscape)
            .join(',')
        ),
      ];
      const csvBody = '\uFEFF' + lines.join('\r\n');
      return new Response(csvBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="xanh-diagnostics-report-${nowIso().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    return json({
      ok: true,
      generated_at: nowIso(),
      scope: { days, category: category || 'all', severity: severity || 'all', status: status || 'all' },
      summary: {
        total_runs: runs.length,
        passed_runs: runs.filter((r) => r.status === 'passed').length,
        failed_runs: runs.filter((r) => ['failed', 'timeout'].includes(r.status)).length,
        total_incidents: incidents.length,
        resolved_incidents: incidents.filter((i) => i.status === 'resolved').length,
        open_incidents: incidents.filter((i) => !['resolved', 'ignored'].includes(i.status)).length,
        untested_targets: targets.filter((t) => t.last_status === 'untested').map((t) => ({ id: t.id, name: t.name, target_type: t.target_type, url_or_path: t.url_or_path })),
        unconfigured_items: [
          ...(env?.RESEND_API_KEY ? [] : ['Dịch vụ gửi email Resend (RESEND_API_KEY) chưa cấu hình trên môi trường này']),
          ...(env?.XANH_CTT_SHARED_SECRET ? [] : ['Khóa tích hợp đồng bộ CTT (XANH_CTT_SHARED_SECRET) chưa cấu hình trên môi trường này']),
          ...(env?.DIAG_BROWSER_RUNNER_URL ? [] : ['Playwright Runner từ xa (DIAG_BROWSER_RUNNER_URL) chưa kết nối; đang dùng bộ xác minh DOM/Assets tích hợp']),
          ...(env?.DIAG_CRUX_API_KEY ? [] : ['Field Metrics người dùng thực tế (CrUX API) chưa kết nối; chỉ báo cáo số liệu đo Lab thực tế']),
        ],
      },
      notable_incidents: incidents.filter((i) => ['critical', 'high'].includes(i.severity)).slice(0, 20),
      resolved_list: incidents.filter((i) => i.status === 'resolved').slice(0, 30),
      open_list: incidents.filter((i) => !['resolved', 'ignored'].includes(i.status)).slice(0, 50),
      runs: runs.slice(0, 30),
    });
  }

  // 9. SYSTEM DIAGNOSTICS CONFIGURATION
  if (sub === 'config') {
    if (request.method === 'GET') {
      const settings = await getDiagSettings(env);
      return json({
        ok: true,
        config: settings,
        environment_info: {
          app_name: env?.APP_NAME || 'Xanh Sky First',
          app_url: env?.APP_URL || 'https://xanh.skyfirst.io.vn',
          d1_bound: Boolean(env?.DB),
          r2_bound: Boolean(env?.STORAGE),
          secrets_status: {
            SETUP_SECRET: Boolean(env?.SETUP_SECRET),
            RESEND_API_KEY: Boolean(env?.RESEND_API_KEY),
            XANH_CTT_SHARED_SECRET: Boolean(env?.XANH_CTT_SHARED_SECRET && String(env.XANH_CTT_SHARED_SECRET).length >= 32),
            DIAG_BROWSER_RUNNER_URL: Boolean(env?.DIAG_BROWSER_RUNNER_URL),
            DIAG_LIGHTHOUSE_RUNNER_URL: Boolean(env?.DIAG_LIGHTHOUSE_RUNNER_URL),
            DIAG_CRON_SECRET: Boolean(env?.DIAG_CRON_SECRET),
          },
        },
      });
    }
    if (request.method === 'PUT') {
      const b = await readJson(request);
      const saved = await saveDiagSettings(env, b);
      await audit(env, user.id, 'diagnostics.config.update', 'system', 'diagnostics', { allowed_hostnames: saved.allowed_hostnames }, request);
      return json({ ok: true, config: saved });
    }
  }

  throw new HttpError(404, 'Không tìm thấy endpoint API chẩn đoán.');
}

export async function handleDiagnosticsCron(env, request, apiOnRequest, sendMailFn) {
  if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const cronSecret = String(env?.DIAG_CRON_SECRET || '');
  assert(cronSecret.length >= 16, 503, 'DIAG_CRON_SECRET chưa được cấu hình để kích hoạt cron từ bên ngoài.');
  const authHeader = request.headers.get('Authorization') || '';
  assert(authHeader === `Bearer ${cronSecret}`, 403, 'Khóa xác thực Cron không hợp lệ.');

  const internalDispatch = createInternalDispatcher(env, apiOnRequest);
  const executed = await executeDueDiagnosticSchedules(env, {
    internalDispatch,
    sendMailFn,
    request,
  });
  return json({ ok: true, executed_count: executed.length, executed });
}
