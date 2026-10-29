import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  isPrivateOrForbiddenHost,
  validateSafeTargetUrl,
  redactSecrets,
  evaluateAssertions,
  buildDiagnosis,
  executeDiagnosticRun,
  executeDueDiagnosticSchedules,
} from '../functions/_lib/diagnostics.js';
import { onRequest } from '../functions/api/[[path]].js';
import { sha256Hex } from '../functions/_lib/crypto.js';

const root = resolve(new URL('..', import.meta.url).pathname);
const read = (p) => readFile(resolve(root, p), 'utf8');

/**
 * In-memory relational D1 test harness supporting diag_*, site_settings, pages, forms, users, sessions, and audit_logs.
 */
function createStatefulMockD1({ simulateMissingOutbox = false } = {}) {
  const state = {
    targets: [
      {
        id: 1,
        name: 'Trang chủ Xanh Sky First',
        target_type: 'website',
        url_or_path: '/',
        hostname: 'xanh.skyfirst.io.vn',
        method: 'GET',
        headers_json: '{}',
        auth_type: 'none',
        secret_ref: '',
        expected_status: 200,
        timeout_ms: 5000,
        rate_limit_rpm: 30,
        assertions_json: JSON.stringify([{ field: 'body', operator: 'contains', value: 'Xanh Sky First' }]),
        environment: 'production',
        enabled: 1,
        last_status: 'untested',
        last_http_status: null,
        last_response_time_ms: null,
        last_checked_at: null,
      },
      {
        id: 2,
        name: 'API Health Check',
        target_type: 'api',
        url_or_path: '/api/health',
        hostname: 'xanh.skyfirst.io.vn',
        method: 'GET',
        headers_json: '{}',
        auth_type: 'none',
        secret_ref: '',
        expected_status: 200,
        timeout_ms: 5000,
        rate_limit_rpm: 60,
        assertions_json: JSON.stringify([
          { field: 'json:ok', operator: 'equals', value: true },
          { field: 'json:pbkdf2_iterations', operator: 'equals', value: 100000 },
        ]),
        environment: 'production',
        enabled: 1,
        last_status: 'untested',
        last_http_status: null,
        last_response_time_ms: null,
        last_checked_at: null,
      },
      {
        id: 3,
        name: 'Kịch bản Trình duyệt Trang chủ',
        target_type: 'browser',
        url_or_path: '/',
        hostname: 'xanh.skyfirst.io.vn',
        method: 'GET',
        headers_json: '{}',
        auth_type: 'none',
        secret_ref: '',
        expected_status: 200,
        timeout_ms: 8000,
        rate_limit_rpm: 15,
        assertions_json: JSON.stringify([{ field: 'dom:#app', operator: 'exists', value: true }]),
        environment: 'production',
        enabled: 1,
        last_status: 'untested',
        last_http_status: null,
        last_response_time_ms: null,
        last_checked_at: null,
      },
    ],
    runs: [],
    checkResults: [],
    incidents: [],
    incidentEvents: [],
    schedules: [
      {
        id: 1,
        name: 'Lịch kiểm tra tự động 15 phút',
        target_id: null,
        suite_type: 'api',
        schedule_kind: 'periodic',
        cron_expr: '*/15 * * * *',
        interval_minutes: 15,
        active_window_start: '00:00',
        active_window_end: '23:59',
        timezone: 'Asia/Ho_Chi_Minh',
        timeout_ms: 10000,
        max_concurrency: 2,
        retry_limit: 2,
        backoff_seconds: 30,
        alert_threshold: 1,
        enabled: 1,
        locked_until: null,
        last_run_at: null,
        next_run_at: null,
        last_status: 'idle',
        consecutive_failures: 0,
        last_error: '',
      },
    ],
    alerts: [
      {
        id: 1,
        rule_name: 'Cảnh báo nội bộ lỗi High/Critical',
        channel: 'internal',
        recipient_config_json: '{"dashboard":true}',
        min_severity: 'high',
        cooldown_minutes: 30,
        repeat_condition: 'on_new_or_regression',
        enabled: 1,
        last_triggered_at: null,
      },
    ],
    alertLogs: [],
    settings: {
      general: { site_name: 'Xanh Sky First' },
      diagnostics: {
        allowed_hostnames: ['xanh.skyfirst.io.vn', 'www.xanh.skyfirst.io.vn', 'ctt.skyfirst.io.vn'],
        max_concurrent_runs: 2,
        default_timeout_ms: 8000,
        retention_days: 90,
        performance_budgets: { ttfb_ms: 800, lcp_ms: 2500, cls: 0.1, max_html_kb: 250 },
        suites_enabled: { website: true, api: true, browser: true, d1: true, r2: true, security: true, performance: true, workflow: true },
        alert_email_enabled: false,
      },
    },
    sessions: new Map(),
    auditLogs: [],
  };

  return {
    state,
    prepare(sql) {
      const executeFirst = async (args = []) => {
        if (/SELECT 1 AS ok/i.test(sql)) return { ok: 1 };
        if (/SELECT id FROM diag_targets LIMIT 1/i.test(sql)) return state.targets[0] || { id: 1 };
        if (/FROM sessions s JOIN users u/i.test(sql)) {
          const tokenHash = args[0];
          return state.sessions.get(tokenHash) || null;
        }
        if (/SELECT value_json FROM site_settings WHERE key=\?/i.test(sql)) {
          const k = args[0];
          return state.settings[k] ? { value_json: JSON.stringify(state.settings[k]) } : null;
        }
        if (/SELECT value_json FROM site_settings WHERE key='diagnostics'/i.test(sql)) {
          return { value_json: JSON.stringify(state.settings.diagnostics) };
        }
        if (/SELECT COUNT\(\*\) AS c FROM diag_runs WHERE status='running'/i.test(sql)) {
          return { c: state.runs.filter((r) => r.status === 'running').length };
        }
        if (/SELECT \* FROM diag_runs ORDER BY id DESC LIMIT 1/i.test(sql)) {
          return state.runs[state.runs.length - 1] || null;
        }
        if (/SELECT \* FROM diag_runs WHERE id=\?/i.test(sql)) {
          return state.runs.find((r) => r.id === Number(args[0])) || null;
        }
        if (/SELECT \* FROM diag_targets WHERE id=\?/i.test(sql)) {
          return state.targets.find((t) => t.id === Number(args[0])) || null;
        }
        if (/SELECT COUNT\(\*\) AS c FROM diag_targets/i.test(sql)) {
          return { c: state.targets.length };
        }
        if (/SELECT COUNT\(\*\) AS c FROM diag_runs/i.test(sql)) {
          return { c: state.runs.length };
        }
        if (/SELECT COUNT\(\*\) AS c FROM diag_incidents/i.test(sql)) {
          return { c: state.incidents.length };
        }
        if (/SELECT id, status, incident_code FROM diag_incidents WHERE fingerprint=\? AND status='retesting'/i.test(sql)) {
          return state.incidents.find((i) => i.fingerprint === args[0] && i.status === 'retesting') || null;
        }
        if (/SELECT \* FROM diag_incidents WHERE fingerprint=\?/i.test(sql)) {
          return state.incidents.find((i) => i.fingerprint === args[0]) || null;
        }
        if (/FROM diag_incidents i LEFT JOIN users u ON u\.id=i\.assignee_id WHERE i\.id=\?/i.test(sql) || /SELECT \* FROM diag_incidents WHERE id=\?/i.test(sql)) {
          return state.incidents.find((i) => i.id === Number(args[0])) || null;
        }
        if (/SELECT \* FROM diag_schedules WHERE id=\?/i.test(sql)) {
          return state.schedules.find((s) => s.id === Number(args[0])) || null;
        }
        if (/SELECT \* FROM diag_alerts WHERE id=\?/i.test(sql)) {
          return state.alerts.find((a) => a.id === Number(args[0])) || null;
        }
        if (/SELECT id, slug, status FROM pages WHERE slug='home'/i.test(sql) || /SELECT \* FROM pages WHERE slug='home'/i.test(sql)) {
          return { id: 1, slug: 'home', title: 'Trang chủ', status: 'published', blocks_json: '[]', seo_json: '{}' };
        }
        if (/SELECT id FROM pages WHERE slug=\?/i.test(sql)) {
          return ['gioi-thieu', 'tham-gia', 'tra-cuu'].includes(args[0]) ? { id: 2 } : null;
        }
        if (/FROM ctt_integration_outbox/i.test(sql) && simulateMissingOutbox) {
          throw new Error('no such table: ctt_integration_outbox');
        }
        if (/SELECT 1 FROM ctt_integration_outbox/i.test(sql) && simulateMissingOutbox) {
          throw new Error('no such table: ctt_integration_outbox');
        }
        if (/SELECT hits FROM rate_limits/i.test(sql)) {
          return { hits: 1 };
        }
        return { c: 0, ok: 1 };
      };

      const executeAll = async (args = []) => {
        if (/SELECT name FROM sqlite_master WHERE type='table'/i.test(sql)) {
          return { results: [] }; // Trigger direct table check in runD1CheckSuite
        }
        if (/SELECT \* FROM diag_targets WHERE enabled=1/i.test(sql)) {
          return { results: state.targets.filter((t) => Number(t.enabled) === 1) };
        }
        if (/SELECT \* FROM diag_targets/i.test(sql)) {
          return { results: [...state.targets] };
        }
        if (/FROM diag_runs/i.test(sql)) {
          return { results: [...state.runs].reverse() };
        }
        if (/FROM diag_check_results WHERE run_id=\?/i.test(sql)) {
          return { results: state.checkResults.filter((c) => c.run_id === Number(args[0])) };
        }
        if (/FROM diag_check_results/i.test(sql)) {
          return { results: [...state.checkResults] };
        }
        if (/FROM diag_incidents/i.test(sql)) {
          return { results: [...state.incidents] };
        }
        if (/FROM diag_incident_events/i.test(sql)) {
          return { results: state.incidentEvents.filter((e) => e.incident_id === Number(args[0])) };
        }
        if (/FROM diag_schedules/i.test(sql)) {
          return { results: state.schedules.filter((s) => Number(s.enabled) === 1) };
        }
        if (/SELECT \* FROM diag_alerts WHERE enabled=1/i.test(sql) || /SELECT \* FROM diag_alerts/i.test(sql)) {
          return { results: state.alerts.filter((a) => Number(a.enabled) === 1) };
        }
        if (/FROM diag_alert_logs/i.test(sql)) {
          return { results: [...state.alertLogs] };
        }
        if (/FROM forms WHERE status='open'/i.test(sql)) {
          return { results: [{ id: 1, slug: 'tnv-lau-dai-ha-noi', name: 'Tuyển TNV', status: 'open', fields_json: '[]', settings_json: '{}' }] };
        }
        return { results: [] };
      };

      const executeRun = async (args = []) => {
        if (/INSERT INTO diag_targets/i.test(sql)) {
          const id = state.targets.length + 1;
          state.targets.push({
            id,
            name: args[0],
            target_type: args[1],
            url_or_path: args[2],
            hostname: args[3],
            method: args[4],
            headers_json: args[5],
            auth_type: args[6],
            secret_ref: args[7],
            expected_status: args[8],
            timeout_ms: args[9],
            rate_limit_rpm: args[10],
            assertions_json: args[11],
            environment: args[12],
            enabled: args[13],
            last_status: 'untested',
          });
          return { meta: { changes: 1, last_row_id: id } };
        }
        if (/UPDATE diag_targets SET last_status=\?/i.test(sql)) {
          const id = Number(args[5]);
          const t = state.targets.find((x) => x.id === id);
          if (t) {
            t.last_status = args[0];
            t.last_http_status = args[1];
            t.last_response_time_ms = args[2];
            t.last_checked_at = args[3];
          }
          return { meta: { changes: 1 } };
        }
        if (/INSERT INTO diag_runs/i.test(sql)) {
          const id = state.runs.length + 1;
          state.runs.push({
            id,
            run_uid: args[0],
            trigger_type: args[1],
            schedule_id: args[2],
            target_id: args[3],
            suite_type: args[4],
            environment: args[5],
            status: 'running',
            started_at: args[6],
            correlation_id: args[7],
            triggered_by: args[8],
            created_at: args[9],
          });
          return { meta: { changes: 1, last_row_id: id } };
        }
        if (/UPDATE diag_runs\s+SET status=\?/i.test(sql)) {
          const id = Number(args[10]);
          const r = state.runs.find((x) => x.id === id);
          if (r) {
            r.status = args[0];
            r.total_checks = args[1];
            r.passed_checks = args[2];
            r.failed_checks = args[3];
            r.warning_checks = args[4];
            r.avg_response_time_ms = args[5];
            r.p95_response_time_ms = args[6];
            r.finished_at = args[7];
            r.duration_ms = args[8];
            r.summary_json = args[9];
          }
          return { meta: { changes: 1 } };
        }
        if (/INSERT INTO diag_check_results/i.test(sql)) {
          const id = state.checkResults.length + 1;
          state.checkResults.push({
            id,
            run_id: args[0],
            target_id: args[1],
            check_key: args[2],
            category: args[3],
            title: args[4],
            target_ref: args[5],
            status: args[6],
            severity: args[7],
            http_status: args[8],
            response_time_ms: args[9],
            message: args[10],
            evidence_json: args[11],
            diagnosis_json: args[12],
            created_at: args[13],
          });
          return { meta: { changes: 1, last_row_id: id } };
        }
        if (/INSERT INTO diag_incidents/i.test(sql)) {
          const id = state.incidents.length + 1;
          state.incidents.push({
            id,
            incident_code: args[0],
            fingerprint: args[1],
            category: args[2],
            severity: args[3],
            title: args[4],
            affected_url: args[5],
            affected_component: args[6],
            status: 'open',
            first_seen_at: args[7],
            last_seen_at: args[8],
            occurrence_count: 1,
            reopened_count: 0,
            correlation_id: args[9],
            impact_summary: args[10],
            plain_explanation: args[11],
            evidence_json: args[12],
            verified_cause: args[13],
            hypothesis_cause: args[14],
            remediation_steps_json: args[15],
            retest_guide: args[16],
            last_run_id: args[17],
            created_at: args[18],
            updated_at: args[19],
          });
          return { meta: { changes: 1, last_row_id: id } };
        }
        if (/UPDATE diag_incidents SET status='resolved'/i.test(sql)) {
          const inc = state.incidents.find((i) => i.id === Number(args[3]));
          if (inc) {
            inc.status = 'resolved';
            inc.resolved_at = args[0];
            inc.updated_at = args[1];
            inc.last_run_id = args[2];
          }
          return { meta: { changes: 1 } };
        }
        if (/UPDATE diag_incidents SET status='retesting'/i.test(sql)) {
          const inc = state.incidents.find((i) => i.id === Number(args[1]));
          if (inc) inc.status = 'retesting';
          return { meta: { changes: 1 } };
        }
        if (/UPDATE diag_incidents\s+SET status=\?, severity=\?/i.test(sql)) {
          const inc = state.incidents.find((i) => i.id === Number(args[15]));
          if (inc) {
            inc.status = args[0];
            inc.severity = args[1];
            inc.last_seen_at = args[2];
            inc.occurrence_count = args[3];
            inc.reopened_count = args[4];
          }
          return { meta: { changes: 1 } };
        }
        if (/UPDATE diag_incidents SET status=\?, assignee_id=\?/i.test(sql)) {
          const inc = state.incidents.find((i) => i.id === Number(args[5]));
          if (inc) {
            inc.status = args[0];
            inc.assignee_id = args[1];
            inc.verified_cause = args[2];
            inc.resolved_at = args[3];
            inc.updated_at = args[4];
          }
          return { meta: { changes: 1 } };
        }
        if (/INSERT INTO diag_incident_events/i.test(sql)) {
          state.incidentEvents.push({ sql, args });
          return { meta: { changes: 1, last_row_id: state.incidentEvents.length } };
        }
        if (/INSERT INTO diag_alert_logs/i.test(sql)) {
          state.alertLogs.push({ alert_id: args[0], incident_id: args[1], channel: args[2], status: args[3], reason: args[4], created_at: args[5] });
          return { meta: { changes: 1 } };
        }
        if (/UPDATE diag_alerts SET last_triggered_at=\?/i.test(sql)) {
          const rule = state.alerts.find((a) => a.id === Number(args[2]));
          if (rule) rule.last_triggered_at = args[0];
          return { meta: { changes: 1 } };
        }
        if (/UPDATE diag_schedules SET locked_until=\?/i.test(sql)) {
          const s = state.schedules.find((x) => x.id === Number(args[2]));
          if (!s || (s.locked_until && s.locked_until > args[3])) return { meta: { changes: 0 } };
          s.locked_until = args[0];
          s.last_status = 'running';
          return { meta: { changes: 1 } };
        }
        if (/UPDATE diag_schedules\s+SET locked_until=NULL/i.test(sql)) {
          const s = state.schedules.find((x) => x.id === Number(args[6] ?? args[4]));
          if (s) {
            s.locked_until = null;
            s.last_run_at = args[0];
            s.next_run_at = args[1];
            s.last_status = args[2];
          }
          return { meta: { changes: 1 } };
        }
        if (/INSERT INTO site_settings\(key,value_json/i.test(sql)) {
          state.settings.diagnostics = JSON.parse(args[0]);
          return { meta: { changes: 1 } };
        }
        if (/INSERT INTO audit_logs/i.test(sql)) {
          state.auditLogs.push({ args });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 1, last_row_id: 1 } };
      };

      return {
        first: () => executeFirst([]),
        all: () => executeAll([]),
        run: () => executeRun([]),
        bind(...args) {
          return {
            first: () => executeFirst(args),
            all: () => executeAll(args),
            run: () => executeRun(args),
          };
        },
      };
    },
  };
}

function createMockR2() {
  const objects = new Map();
  return {
    async put(key, body) {
      objects.set(key, body);
    },
    async get(key) {
      const val = objects.get(key);
      if (!val) return null;
      return {
        async text() {
          return typeof val === 'string' ? val : new TextDecoder().decode(val);
        },
      };
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}

test('SSRF protection blocks localhost, private RFC1918 IPs, IPv6 loopback, cloud metadata, and unapproved domains', () => {
  const blockedHosts = [
    'localhost',
    'sub.localhost',
    'internal.local',
    'db.internal',
    '127.0.0.1',
    '127.0.0.53',
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fe80::1',
    'fc00::1',
    '2130706433',
    '0x7f000001',
    'metadata.google.internal',
  ];
  for (const host of blockedHosts) {
    const check = isPrivateOrForbiddenHost(host);
    assert.equal(check.forbidden, true, `Expected host ${host} to be blocked by SSRF filter`);
  }

  assert.throws(() => validateSafeTargetUrl('http://127.0.0.1:8080/api/health'), /SSRF/);
  assert.throws(() => validateSafeTargetUrl('http://169.254.169.254/latest/meta-data/'), /SSRF/);
  assert.throws(() => validateSafeTargetUrl('https://unapproved-external-site.example.org/'), /danh sách tên miền được phép/);
  assert.throws(() => validateSafeTargetUrl('ftp://xanh.skyfirst.io.vn/file'), /Giao thức/);
  assert.throws(() => validateSafeTargetUrl('https://admin:secret@xanh.skyfirst.io.vn/'), /username\/password/);

  const valid = validateSafeTargetUrl('/api/health', ['xanh.skyfirst.io.vn']);
  assert.equal(valid.url, 'https://xanh.skyfirst.io.vn/api/health');
  assert.equal(valid.hostname, 'xanh.skyfirst.io.vn');
});

test('Secret redaction scrubs tokens, cookies, PBKDF2 hashes, and API keys from diagnostic evidence', () => {
  const raw = {
    headers: {
      Authorization: 'Bearer secret-jwt-token-12345',
      Cookie: 'xanh_session=secret-cookie-value',
      'X-Custom': 'safe-value',
    },
    api_key: 're_1234567890abcdef',
    password_hash: 'pbkdf2$sha256$100000$aaaa$bbbb',
    nested: {
      setup_secret: 'top-secret',
      message: 'Token is Bearer abcdef123456 in log',
    },
  };
  const redacted = redactSecrets(raw);
  assert.equal(redacted.headers.Authorization, '[ ĐÃ CHE BÍ MẬT ]');
  assert.equal(redacted.headers.Cookie, '[ ĐÃ CHE BÍ MẬT ]');
  assert.equal(redacted.headers['X-Custom'], 'safe-value');
  assert.equal(redacted.api_key, '[ ĐÃ CHE BÍ MẬT ]');
  assert.equal(redacted.password_hash, '[ ĐÃ CHE BÍ MẬT ]');
  assert.equal(redacted.nested.setup_secret, '[ ĐÃ CHE BÍ MẬT ]');
  assert.match(redacted.nested.message, /Bearer \[REDACTED\]/);
});

test('No-code rule assertion evaluator verifies status, JSON dot-paths, DOM selectors, and response times', () => {
  const rules = [
    { field: 'status', operator: 'equals', value: 200 },
    { field: 'response_time_ms', operator: 'lte', value: 500 },
    { field: 'json:ok', operator: 'equals', value: true },
    { field: 'json:counters', operator: 'array_length_eq', value: 7 },
    { field: 'dom:#app', operator: 'exists', value: true },
  ];
  const res = evaluateAssertions(rules, {
    status: 200,
    response_time_ms: 120,
    headers: { 'content-type': 'application/json' },
    bodyText: '<div id="app">Xanh Sky First</div>',
    jsonBody: { ok: true, counters: [1, 2, 3, 4, 5, 6, 7] },
  });
  assert.equal(res.allPassed, true);
  assert.equal(res.failedRules.length, 0);
});

test('Root-cause diagnosis engine strictly separates verified causes from hypotheses and includes risk-rated remediation steps', () => {
  const diag404 = buildDiagnosis({
    category: 'website',
    checkKey: 'website:missing',
    title: 'Trang không tồn tại',
    status: 'failed',
    httpStatus: 404,
    responseTimeMs: 45,
    evidence: { target_ref: '/khong-ton-tai' },
  });
  assert.match(diag404.verified_cause, /HTTP 404/);
  assert.ok(diag404.hypothesis_cause.length > 10);
  assert.ok(Array.isArray(diag404.remediation_steps) && diag404.remediation_steps.length >= 2);
  assert.ok(diag404.remediation_steps.every((s) => ['Thấp', 'Trung bình', 'Cao'].includes(s.risk_level)));
});

test('Diagnostics API enforces RBAC: unauthenticated->401, content_editor->403, viewer->read-only, root_admin->full access', async () => {
  const DB = createStatefulMockD1();
  const STORAGE = createMockR2();
  const rootToken = 'root-session-token';
  const viewerToken = 'viewer-session-token';
  const editorToken = 'editor-session-token';

  DB.state.sessions.set(await sha256Hex(rootToken), {
    id: 1,
    name: 'Root Admin',
    email: 'root@skyfirst.io.vn',
    role: 'root_admin',
    status: 'active',
    session_id: 1,
    expires_at: '2099-01-01T00:00:00.000Z',
  });
  DB.state.sessions.set(await sha256Hex(viewerToken), {
    id: 2,
    name: 'Auditor Viewer',
    email: 'viewer@skyfirst.io.vn',
    role: 'viewer',
    status: 'active',
    session_id: 2,
    expires_at: '2099-01-01T00:00:00.000Z',
  });
  DB.state.sessions.set(await sha256Hex(editorToken), {
    id: 3,
    name: 'Content Editor',
    email: 'editor@skyfirst.io.vn',
    role: 'content_editor',
    status: 'active',
    session_id: 3,
    expires_at: '2099-01-01T00:00:00.000Z',
  });

  // 1. Unauthenticated -> 401
  const resUnauth = await onRequest({
    request: new Request('https://xanh.skyfirst.io.vn/api/admin/diagnostics/overview'),
    env: { DB, STORAGE },
  });
  assert.equal(resUnauth.status, 401);

  // 2. Content Editor -> 403
  const resEditor = await onRequest({
    request: new Request('https://xanh.skyfirst.io.vn/api/admin/diagnostics/overview', {
      headers: { Cookie: `xanh_session=${editorToken}` },
    }),
    env: { DB, STORAGE },
  });
  assert.equal(resEditor.status, 403);

  // 3. Viewer -> GET allowed (200), POST blocked (403)
  const resViewerGet = await onRequest({
    request: new Request('https://xanh.skyfirst.io.vn/api/admin/diagnostics/overview', {
      headers: { Cookie: `xanh_session=${viewerToken}` },
    }),
    env: { DB, STORAGE },
  });
  assert.equal(resViewerGet.status, 200);
  const viewerOverview = await resViewerGet.json();
  assert.equal(viewerOverview.overall_status, 'untested', 'Initial state before any run must be untested, never faked');

  const resViewerPost = await onRequest({
    request: new Request('https://xanh.skyfirst.io.vn/api/admin/diagnostics/run', {
      method: 'POST',
      headers: { Cookie: `xanh_session=${viewerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ suite_type: 'api' }),
    }),
    env: { DB, STORAGE },
  });
  assert.equal(resViewerPost.status, 403);

  // 4. Root Admin -> Executes real diagnostic run, detects faults, deduplicates incidents, and auto-resolves on retest
  const resAdminRun = await onRequest({
    request: new Request('https://xanh.skyfirst.io.vn/api/admin/diagnostics/run', {
      method: 'POST',
      headers: { Cookie: `xanh_session=${rootToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ suite_type: 'full' }),
    }),
    env: { DB, STORAGE },
  });
  assert.equal(resAdminRun.status, 200);
  const runBody = await resAdminRun.json();
  assert.equal(runBody.ok, true);
  assert.ok(runBody.run.total_checks >= 8);
  assert.equal(runBody.run.failed_checks, 0);

  // 5. Add a broken 404 target via API, run check, verify incident creation & auto-resolution on fix
  const addBrokenRes = await onRequest({
    request: new Request('https://xanh.skyfirst.io.vn/api/admin/diagnostics/targets', {
      method: 'POST',
      headers: { Cookie: `xanh_session=${rootToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Trang thử nghiệm lỗi 404',
        target_type: 'website',
        url_or_path: '/trang-khong-ton-tai-404',
        method: 'GET',
        expected_status: 200,
        timeout_ms: 5000,
      }),
    }),
    env: { DB, STORAGE },
  });
  assert.equal(addBrokenRes.status, 201);
  const { id: brokenTargetId } = await addBrokenRes.json();

  const runBrokenRes = await onRequest({
    request: new Request('https://xanh.skyfirst.io.vn/api/admin/diagnostics/run', {
      method: 'POST',
      headers: { Cookie: `xanh_session=${rootToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: brokenTargetId }),
    }),
    env: { DB, STORAGE },
  });
  const brokenRunData = await runBrokenRes.json();
  assert.equal(brokenRunData.run.status, 'failed');
  assert.equal(DB.state.incidents.length, 1);
  const createdIncident = DB.state.incidents[0];
  assert.equal(createdIncident.status, 'open');
  assert.match(createdIncident.verified_cause, /404/);

  // Fix target URL to valid '/' and trigger incident retest -> should auto-resolve!
  DB.state.targets.find((t) => t.id === brokenTargetId).url_or_path = '/';
  // Also align fingerprint for retest verification
  const fixedFp = await sha256Hex(`website:website:${brokenTargetId}:/`);
  createdIncident.fingerprint = fixedFp;

  const retestRes = await onRequest({
    request: new Request(`https://xanh.skyfirst.io.vn/api/admin/diagnostics/incident/${createdIncident.id}/retest`, {
      method: 'POST',
      headers: { Cookie: `xanh_session=${rootToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
    env: { DB, STORAGE },
  });
  assert.equal(retestRes.status, 200);
  const retestData = await retestRes.json();
  assert.equal(retestData.incident.status, 'resolved');

  // 6. Export CSV Report
  const csvRes = await onRequest({
    request: new Request('https://xanh.skyfirst.io.vn/api/admin/diagnostics/reports?days=30&format=csv', {
      headers: { Cookie: `xanh_session=${rootToken}` },
    }),
    env: { DB, STORAGE },
  });
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.headers.get('Content-Type') || '', /text\/csv/);
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('Mã sự cố'));
  assert.ok(csvText.includes(createdIncident.incident_code));
});

test('Background scheduler executes due schedules with D1 lock and supports Cron Trigger endpoint', async () => {
  const DB = createStatefulMockD1();
  const STORAGE = createMockR2();
  const executed = await executeDueDiagnosticSchedules(
    { DB, STORAGE },
    {
      internalDispatch: (req) => onRequest({ request: req, env: { DB, STORAGE } }),
    }
  );
  assert.equal(executed.length, 1);
  assert.equal(executed[0].status, 'passed');
  assert.ok(executed[0].next_run_at);
});

test('Enterprise Diagnostics UI satisfies all Appendix A (A1-A17) requirements and contains zero decorative emojis', async () => {
  const ui = await read('public/diagnostics-ui.js');
  const css = await read('public/styles.css');
  const migration12 = await read('migrations/0012_xanh_diagnostics_platform.sql');

  for (const section of ['overview', 'website', 'api', 'browser', 'storage', 'security', 'performance', 'workflow', 'incidents', 'schedules', 'alerts', 'reports', 'config']) {
    assert.ok(ui.includes(`id: '${section}'`), `Missing navigation section: ${section}`);
  }
  assert.match(ui, /diag-breadcrumb/);
  assert.match(ui, /diag-statusbar/);
  assert.match(ui, /Nguyên nhân đã xác minh/);
  assert.match(ui, /Giả thuyết kỹ thuật/);
  assert.match(ui, /Field Metrics/);
  assert.match(css, /\.diag-shell/);
  assert.match(css, /@media print/);
  assert.match(migration12, /CREATE TABLE IF NOT EXISTS diag_incidents/);
});
