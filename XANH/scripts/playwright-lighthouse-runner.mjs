#!/usr/bin/env node
/**
 * XANH Website Diagnostics Platform — External Browser (Playwright) & Performance Runner.
 *
 * Why this runner exists:
 * Cloudflare Pages Functions run on the edge V8 isolate runtime, which does not bundle a local
 * Chromium binary. This standalone runner script executes real headless browser checks and
 * synthetic performance measurements in CI/CD, staging, or a dedicated container/VM and can
 * either serve as the `DIAG_BROWSER_RUNNER_URL` webhook or push verified results to XANH.
 */
import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.DIAG_RUNNER_PORT || 8799);
const RUNNER_SECRET = String(process.env.DIAG_RUNNER_SECRET || '');
const ALLOWED_HOSTS = new Set(
  String(process.env.DIAG_ALLOWED_HOSTS || 'xanh.skyfirst.io.vn,www.xanh.skyfirst.io.vn,ctt.skyfirst.io.vn')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

function isSafeUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const h = parsed.hostname.toLowerCase();
    if (h === 'localhost' || h.startsWith('127.') || h.startsWith('10.') || h.startsWith('192.168.') || h === '169.254.169.254') {
      return false;
    }
    return ALLOWED_HOSTS.has(h);
  } catch {
    return false;
  }
}

export async function runBrowserScenario({ target_url, timeout_ms = 12000 }) {
  const fullUrl = target_url.startsWith('/') ? `https://xanh.skyfirst.io.vn${target_url}` : target_url;
  if (!isSafeUrl(fullUrl)) {
    return {
      ok: false,
      http_status: 403,
      error: `URL không nằm trong danh sách tên miền được phép (${fullUrl}).`,
      steps: [],
      console_errors: [],
      failed_requests: [],
    };
  }

  const start = Date.now();
  // Attempt dynamic import of playwright if installed in the runner environment
  let playwright = null;
  try {
    playwright = await import('playwright');
  } catch {
    playwright = null;
  }

  if (playwright?.chromium) {
    const browser = await playwright.chromium.launch({ headless: true });
    const consoleErrors = [];
    const failedRequests = [];
    const steps = [];
    try {
      const page = await browser.newPage();
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => consoleErrors.push(String(err?.message || err)));
      page.on('requestfailed', (req) => failedRequests.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText || 'failed' }));

      const res = await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: timeout_ms });
      const status = res?.status() || 200;
      steps.push({ step: '1. Mở trang bằng Chromium & chờ networkidle', passed: status < 400, detail: `HTTP ${status}` });

      const hasApp = (await page.locator('#app').count()) > 0;
      steps.push({ step: '2. Kiểm tra phần tử #app hiển thị', passed: hasApp, detail: hasApp ? 'Tìm thấy #app' : 'Thiếu #app' });

      const hasFontWidget = (await page.locator('#font-accessibility-tools').count()) > 0;
      steps.push({ step: '3. Kiểm tra công cụ hỗ trợ tiếp cận (#font-accessibility-tools)', passed: hasFontWidget, detail: hasFontWidget ? 'Hiển thị' : 'Không tìm thấy' });

      const ok = status < 400 && hasApp && consoleErrors.length === 0 && failedRequests.length === 0;
      return {
        ok,
        http_status: status,
        duration_ms: Date.now() - start,
        message: ok ? 'Kịch bản trình duyệt Playwright Chromium thành công.' : 'Phát hiện lỗi runtime hoặc tài nguyên khi chạy Playwright.',
        steps,
        console_errors: consoleErrors,
        failed_requests: failedRequests,
      };
    } finally {
      await browser.close();
    }
  }

  return {
    ok: false,
    http_status: 501,
    duration_ms: Date.now() - start,
    error: 'Thư viện Playwright chưa được cài đặt trên máy chủ Runner này. Hệ thống sẽ dùng bộ kiểm tra DOM/Assets tích hợp.',
    steps: [],
    console_errors: [],
    failed_requests: [],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
      return;
    }
    if (RUNNER_SECRET && req.headers.authorization !== `Bearer ${RUNNER_SECRET}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized runner request' }));
      return;
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const payload = JSON.parse(body || '{}');
      const result = await runBrowserScenario(payload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }));
    }
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`XANH Playwright Diagnostics Runner listening on http://127.0.0.1:${PORT}`);
  });
}
