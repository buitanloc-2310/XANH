-- XANH WEBSITE DIAGNOSTICS PLATFORM — Additive, non-destructive schema (v12)
-- Preserves all existing XANH tables, content, forms, submissions, media, and settings.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS diag_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('website','api','browser','d1','r2','security','performance','workflow')),
  url_or_path TEXT NOT NULL,
  hostname TEXT NOT NULL DEFAULT 'xanh.skyfirst.io.vn',
  method TEXT NOT NULL DEFAULT 'GET' CHECK(method IN ('GET','HEAD','POST','OPTIONS')),
  headers_json TEXT NOT NULL DEFAULT '{}',
  auth_type TEXT NOT NULL DEFAULT 'none' CHECK(auth_type IN ('none','session','bearer_secret','header_secret')),
  secret_ref TEXT NOT NULL DEFAULT '',
  expected_status INTEGER NOT NULL DEFAULT 200,
  timeout_ms INTEGER NOT NULL DEFAULT 8000 CHECK(timeout_ms BETWEEN 500 AND 30000),
  rate_limit_rpm INTEGER NOT NULL DEFAULT 30 CHECK(rate_limit_rpm BETWEEN 1 AND 300),
  assertions_json TEXT NOT NULL DEFAULT '[]',
  environment TEXT NOT NULL DEFAULT 'production' CHECK(environment IN ('production','staging','testing')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  last_status TEXT NOT NULL DEFAULT 'untested' CHECK(last_status IN ('untested','passed','failed','warning','timeout','unconfigured')),
  last_http_status INTEGER,
  last_response_time_ms INTEGER,
  last_checked_at TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_diag_targets_type_status ON diag_targets(target_type, enabled, last_status);
CREATE INDEX IF NOT EXISTS idx_diag_targets_hostname ON diag_targets(hostname);

CREATE TABLE IF NOT EXISTS diag_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_id INTEGER,
  suite_type TEXT NOT NULL DEFAULT 'full' CHECK(suite_type IN ('full','website','api','browser','d1','r2','security','performance','workflow')),
  schedule_kind TEXT NOT NULL DEFAULT 'periodic' CHECK(schedule_kind IN ('manual','periodic','event')),
  cron_expr TEXT NOT NULL DEFAULT '*/15 * * * *',
  interval_minutes INTEGER NOT NULL DEFAULT 15 CHECK(interval_minutes BETWEEN 1 AND 10080),
  active_window_start TEXT NOT NULL DEFAULT '00:00',
  active_window_end TEXT NOT NULL DEFAULT '23:59',
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  timeout_ms INTEGER NOT NULL DEFAULT 15000 CHECK(timeout_ms BETWEEN 1000 AND 60000),
  max_concurrency INTEGER NOT NULL DEFAULT 2 CHECK(max_concurrency BETWEEN 1 AND 10),
  retry_limit INTEGER NOT NULL DEFAULT 2 CHECK(retry_limit BETWEEN 0 AND 5),
  backoff_seconds INTEGER NOT NULL DEFAULT 30 CHECK(backoff_seconds BETWEEN 5 AND 3600),
  alert_threshold INTEGER NOT NULL DEFAULT 1 CHECK(alert_threshold BETWEEN 1 AND 10),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  locked_until TEXT,
  last_run_at TEXT,
  next_run_at TEXT,
  last_status TEXT NOT NULL DEFAULT 'idle' CHECK(last_status IN ('idle','running','passed','failed','warning','timeout','interrupted')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(target_id) REFERENCES diag_targets(id) ON DELETE SET NULL,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_diag_schedules_enabled_next ON diag_schedules(enabled, next_run_at);

CREATE TABLE IF NOT EXISTS diag_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_uid TEXT NOT NULL UNIQUE,
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK(trigger_type IN ('manual','schedule','cron','event','recheck')),
  schedule_id INTEGER,
  target_id INTEGER,
  suite_type TEXT NOT NULL DEFAULT 'full',
  environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','passed','failed','warning','timeout','cancelled','unconfigured')),
  total_checks INTEGER NOT NULL DEFAULT 0,
  passed_checks INTEGER NOT NULL DEFAULT 0,
  failed_checks INTEGER NOT NULL DEFAULT 0,
  warning_checks INTEGER NOT NULL DEFAULT 0,
  avg_response_time_ms INTEGER,
  p95_response_time_ms INTEGER,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  summary_json TEXT NOT NULL DEFAULT '{}',
  metrics_json TEXT NOT NULL DEFAULT '{}',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  correlation_id TEXT NOT NULL,
  triggered_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(schedule_id) REFERENCES diag_schedules(id) ON DELETE SET NULL,
  FOREIGN KEY(target_id) REFERENCES diag_targets(id) ON DELETE SET NULL,
  FOREIGN KEY(triggered_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_diag_runs_created ON diag_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diag_runs_suite_status ON diag_runs(suite_type, status, created_at DESC);

CREATE TABLE IF NOT EXISTS diag_check_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  target_id INTEGER,
  check_key TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('website','api','browser','d1','r2','security','performance','workflow')),
  title TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('passed','failed','warning','timeout','skipped','unconfigured')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('critical','high','medium','low','info')),
  http_status INTEGER,
  response_time_ms INTEGER,
  message TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  diagnosis_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(run_id) REFERENCES diag_runs(id) ON DELETE CASCADE,
  FOREIGN KEY(target_id) REFERENCES diag_targets(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_diag_results_run ON diag_check_results(run_id);
CREATE INDEX IF NOT EXISTS idx_diag_results_category_status ON diag_check_results(category, status, created_at DESC);

CREATE TABLE IF NOT EXISTS diag_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_code TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK(category IN ('website','api','browser','d1','r2','security','performance','workflow')),
  severity TEXT NOT NULL CHECK(severity IN ('critical','high','medium','low')),
  title TEXT NOT NULL,
  affected_url TEXT NOT NULL DEFAULT '',
  affected_component TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','investigating','fixing','retesting','resolved','ignored')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  resolved_at TEXT,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  reopened_count INTEGER NOT NULL DEFAULT 0,
  correlation_id TEXT NOT NULL DEFAULT '',
  impact_summary TEXT NOT NULL DEFAULT '',
  plain_explanation TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  verified_cause TEXT NOT NULL DEFAULT '',
  hypothesis_cause TEXT NOT NULL DEFAULT '',
  remediation_steps_json TEXT NOT NULL DEFAULT '[]',
  retest_guide TEXT NOT NULL DEFAULT '',
  assignee_id INTEGER,
  last_run_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(assignee_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(last_run_id) REFERENCES diag_runs(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_diag_incidents_status_sev ON diag_incidents(status, severity, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_diag_incidents_category ON diag_incidents(category, status);

CREATE TABLE IF NOT EXISTS diag_incident_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  actor_user_id INTEGER,
  note TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(incident_id) REFERENCES diag_incidents(id) ON DELETE CASCADE,
  FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_diag_inc_events_incident ON diag_incident_events(incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS diag_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK(channel IN ('email','webhook','internal')),
  recipient_config_json TEXT NOT NULL DEFAULT '{}',
  min_severity TEXT NOT NULL DEFAULT 'high' CHECK(min_severity IN ('critical','high','medium','low')),
  cooldown_minutes INTEGER NOT NULL DEFAULT 30 CHECK(cooldown_minutes BETWEEN 1 AND 10080),
  repeat_condition TEXT NOT NULL DEFAULT 'on_new_or_regression' CHECK(repeat_condition IN ('on_new_only','on_new_or_regression','after_cooldown')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  last_triggered_at TEXT,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS diag_alert_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id INTEGER,
  incident_id INTEGER,
  channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('sent','suppressed_cooldown','not_configured','failed')),
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(alert_id) REFERENCES diag_alerts(id) ON DELETE SET NULL,
  FOREIGN KEY(incident_id) REFERENCES diag_incidents(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_diag_alert_logs_created ON diag_alert_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS diag_baselines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER,
  baseline_key TEXT NOT NULL UNIQUE,
  baseline_type TEXT NOT NULL CHECK(baseline_type IN ('browser_dom','api_schema','performance_budget','security_headers')),
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  r2_key TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(target_id) REFERENCES diag_targets(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Seed default allowed targets and configuration for XANH (never fabricates run results or fake metrics; last_status starts as 'untested')
INSERT OR IGNORE INTO site_settings(key, value_json, updated_at)
VALUES (
  'diagnostics',
  '{"allowed_hostnames":["xanh.skyfirst.io.vn","www.xanh.skyfirst.io.vn","ctt.skyfirst.io.vn"],"max_concurrent_runs":2,"default_timeout_ms":8000,"retention_days":90,"performance_budgets":{"ttfb_ms":800,"lcp_ms":2500,"cls":0.1,"max_html_kb":250},"suites_enabled":{"website":true,"api":true,"browser":true,"d1":true,"r2":true,"security":true,"performance":true,"workflow":true},"alert_email_enabled":false}',
  datetime('now')
);

INSERT OR IGNORE INTO diag_targets(id, name, target_type, url_or_path, hostname, method, headers_json, auth_type, expected_status, timeout_ms, rate_limit_rpm, assertions_json, environment, enabled, last_status)
VALUES
  (1, 'Trang chủ Xanh Sky First', 'website', '/', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 8000, 30, '[{"field":"body","operator":"contains","value":"Xanh Sky First"},{"field":"header:content-type","operator":"contains","value":"text/html"}]', 'production', 1, 'untested'),
  (2, 'Trang Giới thiệu (/gioi-thieu)', 'website', '/gioi-thieu', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 8000, 30, '[{"field":"status","operator":"equals","value":200}]', 'production', 1, 'untested'),
  (3, 'Trang Tham gia & Biểu mẫu (/tham-gia)', 'website', '/tham-gia', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 8000, 30, '[{"field":"status","operator":"equals","value":200}]', 'production', 1, 'untested'),
  (4, 'Trang Tra cứu hồ sơ (/tra-cuu)', 'website', '/tra-cuu', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 8000, 30, '[{"field":"status","operator":"equals","value":200}]', 'production', 1, 'untested'),
  (5, 'Sitemap XML (/sitemap.xml)', 'website', '/sitemap.xml', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 8000, 30, '[{"field":"header:content-type","operator":"contains","value":"xml"},{"field":"body","operator":"contains","value":"<urlset"}]', 'production', 1, 'untested'),
  (6, 'API Health Check (/api/health)', 'api', '/api/health', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 5000, 60, '[{"field":"json:ok","operator":"equals","value":true},{"field":"json:pbkdf2_iterations","operator":"equals","value":100000}]', 'production', 1, 'untested'),
  (7, 'API Cấu hình Website Công khai (/api/public/site)', 'api', '/api/public/site', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 6000, 30, '[{"field":"json:ok","operator":"equals","value":true},{"field":"json:settings.site_name","operator":"exists","value":true}]', 'production', 1, 'untested'),
  (8, 'API Dấu ấn xanh (/api/public/impact)', 'api', '/api/public/impact', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 6000, 30, '[{"field":"json:ok","operator":"equals","value":true},{"field":"json:counters","operator":"array_length_eq","value":7}]', 'production', 1, 'untested'),
  (9, 'API Danh sách Biểu mẫu (/api/public/forms)', 'api', '/api/public/forms', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 6000, 30, '[{"field":"json:ok","operator":"equals","value":true},{"field":"json:items","operator":"is_array","value":true}]', 'production', 1, 'untested'),
  (10, 'API Kiểm soát Quyền Admin (/api/admin/settings)', 'api', '/api/admin/settings', 'xanh.skyfirst.io.vn', 'GET', '{}', 'session', 200, 6000, 30, '[{"field":"json:ok","operator":"equals","value":true},{"field":"json:groups.general","operator":"exists","value":true}]', 'production', 1, 'untested'),
  (11, 'Kịch bản Trình duyệt: Giao diện & Điều hướng công khai', 'browser', '/', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 12000, 15, '[{"field":"dom:#app","operator":"exists","value":true},{"field":"dom:#font-accessibility-tools","operator":"exists","value":true}]', 'production', 1, 'untested'),
  (12, 'Kiểm tra Cơ sở dữ liệu Cloudflare D1 (xanh)', 'd1', 'd1://xanh', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 5000, 30, '[{"field":"d1:tables","operator":"all_present","value":true}]', 'production', 1, 'untested'),
  (13, 'Kiểm tra Lưu trữ Cloudflare R2 (STORAGE)', 'r2', 'r2://xanh', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 6000, 20, '[{"field":"r2:probe","operator":"rw_ok","value":true}]', 'production', 1, 'untested'),
  (14, 'Kiểm tra Bảo mật phòng thủ (OWASP ASVS / Headers / RBAC)', 'security', '/api/health', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 8000, 20, '[{"field":"security:headers","operator":"pass","value":true},{"field":"security:rbac","operator":"pass","value":true}]', 'production', 1, 'untested'),
  (15, 'Kiểm tra Hiệu năng, Core Web Vitals (Lab) & WCAG 2.2', 'performance', '/', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 10000, 15, '[{"field":"perf:ttfb_ms","operator":"lte","value":800}]', 'production', 1, 'untested'),
  (16, 'Kiểm tra Luồng Biểu mẫu, Tra cứu & Tích hợp CTT', 'workflow', '/api/public/forms', 'xanh.skyfirst.io.vn', 'GET', '{}', 'none', 200, 8000, 20, '[{"field":"workflow:forms_and_ctt","operator":"pass","value":true}]', 'production', 1, 'untested');

INSERT OR IGNORE INTO diag_schedules(id, name, target_id, suite_type, schedule_kind, cron_expr, interval_minutes, active_window_start, active_window_end, timezone, timeout_ms, max_concurrency, retry_limit, backoff_seconds, alert_threshold, enabled, last_status)
VALUES
  (1, 'Giám sát định kỳ toàn diện hệ thống XANH (15 phút/lần)', NULL, 'full', 'periodic', '*/15 * * * *', 15, '00:00', '23:59', 'Asia/Ho_Chi_Minh', 20000, 2, 2, 30, 2, 1, 'idle'),
  (2, 'Kiểm tra nhanh API Health & Cơ sở dữ liệu D1 (5 phút/lần)', NULL, 'api', 'periodic', '*/5 * * * *', 5, '00:00', '23:59', 'Asia/Ho_Chi_Minh', 10000, 2, 1, 15, 1, 1, 'idle'),
  (3, 'Kiểm tra Bảo mật & R2 Storage hàng ngày', NULL, 'security', 'periodic', '0 2 * * *', 1440, '00:00', '06:00', 'Asia/Ho_Chi_Minh', 15000, 1, 2, 60, 1, 1, 'idle');

INSERT OR IGNORE INTO diag_alerts(id, rule_name, channel, recipient_config_json, min_severity, cooldown_minutes, repeat_condition, enabled)
VALUES
  (1, 'Cảnh báo sự cố Nghiêm trọng (Critical/High) qua Email Quản trị', 'email', '{"to":"support@skyfirst.io.vn"}', 'high', 30, 'on_new_or_regression', 1),
  (2, 'Ghi nhận thông báo nội bộ trên Trung tâm Chẩn đoán', 'internal', '{"dashboard_banner":true}', 'medium', 15, 'on_new_or_regression', 1);
