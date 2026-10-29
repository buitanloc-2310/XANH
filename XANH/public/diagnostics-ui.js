/**
 * XANH WEBSITE DIAGNOSTICS PLATFORM — Enterprise Administration & No-Code Diagnostics UI
 *
 * Implements the 4-region enterprise layout (Sidebar, Header with Breadcrumb & Notifications,
 * Main Content Workspace, and Footer Status Bar), 12 operational modules, No-Code Test & Rule
 * Builders, Dual-Layer Root Cause Diagnostics, Incident Workflow, Visual Scheduler, and CSV/Report
 * Exports. Uses 100% vector SVG icons (zero decorative emojis).
 */

const DIAG_NAV_GROUPS = [
  {
    groupLabel: 'GIÁM SÁT & TỔNG QUAN',
    items: [
      { id: 'overview', label: 'Tổng quan', icon: 'activity', desc: 'Tình trạng tổng thể, chỉ số thực tế, biểu đồ xu hướng và sự cố ưu tiên.' },
    ],
  },
  {
    groupLabel: 'BỘ MÁY KIỂM TRA',
    items: [
      { id: 'website', label: 'Kiểm tra website', icon: 'globe', desc: 'Kiểm tra HTTP, HTTPS/TLS, redirect, liên kết nội bộ và tài nguyên trang công khai.' },
      { id: 'api', label: 'Kiểm tra API', icon: 'terminal', desc: 'Quản lý endpoint, phương thức, xác thực an toàn và điều kiện kiểm tra không cần viết code.' },
      { id: 'browser', label: 'Kiểm tra trình duyệt', icon: 'layout', desc: 'Xác minh cấu trúc DOM, tài nguyên CSS/JS, lỗi runtime và kết nối Playwright Runner.' },
      { id: 'storage', label: 'Dữ liệu và lưu trữ', icon: 'database', desc: 'Kiểm tra kết nối Cloudflare D1, bảng/cột bắt buộc, ràng buộc dữ liệu và probe R2.' },
      { id: 'security', label: 'Bảo mật', icon: 'shield', desc: 'Kiểm tra phòng thủ OWASP ASVS: HTTP Security Headers, Cookie, RBAC, CSRF và chống SSRF.' },
      { id: 'performance', label: 'Hiệu năng', icon: 'zap', desc: 'Đo lường TTFB Lab, dung lượng tải, tài nguyên chặn hiển thị và tiêu chuẩn tiếp cận WCAG 2.2.' },
      { id: 'workflow', label: 'Biểu mẫu & Nghiệp vụ', icon: 'check-square', desc: 'Kiểm tra luồng biểu mẫu công khai, xác thực tra cứu hồ sơ, email Resend và hàng đợi CTT.' },
    ],
  },
  {
    groupLabel: 'SỰ CỐ & VẬN HÀNH',
    items: [
      { id: 'incidents', label: 'Sự cố', icon: 'alert-triangle', desc: 'Quản lý vòng đời sự cố, bằng chứng kỹ thuật, nguyên nhân gốc và hướng dẫn khắc phục.' },
      { id: 'schedules', label: 'Lịch kiểm tra', icon: 'clock', desc: 'Lập lịch kiểm tra định kỳ với giới hạn đồng thời, chống chạy trùng và tự động thử lại.' },
      { id: 'alerts', label: 'Cảnh báo', icon: 'bell', desc: 'Cấu hình quy tắc cảnh báo theo ngưỡng nghiêm trọng, thời gian tạm lắng và nhật ký gửi.' },
      { id: 'reports', label: 'Báo cáo', icon: 'file-text', desc: 'Xem trước báo cáo vận hành theo bộ lọc và xuất tệp CSV tiêu chuẩn.' },
    ],
  },
  {
    groupLabel: 'QUẢN TRỊ HỆ THỐNG',
    items: [
      { id: 'config', label: 'Cấu hình hệ thống', icon: 'settings', desc: 'Quản lý tên miền cho phép, ngân sách hiệu năng, lưu trữ lịch sử, tích hợp và từ điển thuật ngữ.' },
    ],
  },
];

export function diagIcon(name, cls = 'diag-svg-icon') {
  const paths = {
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>',
    globe: '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>',
    terminal: '<polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
    'check-square': '<polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>',
    'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    play: '<polygon points="5 3 19 12 5 21 5 3"></polygon>',
    refresh: '<polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
    search: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>',
    check: '<polyline points="20 6 9 17 4 12"></polyline>',
    x: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
    sidebar: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line>',
    info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
    trash: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>',
  };
  return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.activity}</svg>`;
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtNum = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? 'Chưa có dữ liệu' : new Intl.NumberFormat('vi-VN').format(Number(n)));

const fmtDate = (s) => {
  if (!s) return 'Chưa kiểm tra';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? 'Chưa kiểm tra' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(d);
};

export function diagStatusBadge(status) {
  const key = String(status || 'untested').toLowerCase();
  const map = {
    passed: { label: 'Thành công', cls: 'diag-badge-passed', icon: 'check' },
    healthy: { label: 'Hoạt động tốt', cls: 'diag-badge-passed', icon: 'check' },
    resolved: { label: 'Đã khắc phục', cls: 'diag-badge-passed', icon: 'check' },
    sent: { label: 'Đã gửi', cls: 'diag-badge-passed', icon: 'check' },
    connected: { label: 'Đã kết nối', cls: 'diag-badge-passed', icon: 'check' },
    configured: { label: 'Đã cấu hình', cls: 'diag-badge-passed', icon: 'check' },
    failed: { label: 'Thất bại', cls: 'diag-badge-failed', icon: 'x' },
    critical: { label: 'Nghiêm trọng', cls: 'diag-badge-failed', icon: 'alert-triangle' },
    interrupted: { label: 'Bị gián đoạn', cls: 'diag-badge-failed', icon: 'alert-triangle' },
    timeout: { label: 'Quá thời gian (Timeout)', cls: 'diag-badge-warning', icon: 'clock' },
    warning: { label: 'Cảnh báo', cls: 'diag-badge-warning', icon: 'alert-triangle' },
    degraded: { label: 'Cần chú ý', cls: 'diag-badge-warning', icon: 'alert-triangle' },
    open: { label: 'Mới phát hiện', cls: 'diag-badge-failed', icon: 'alert-triangle' },
    investigating: { label: 'Đang điều tra', cls: 'diag-badge-warning', icon: 'search' },
    fixing: { label: 'Đang khắc phục', cls: 'diag-badge-info', icon: 'settings' },
    retesting: { label: 'Chờ kiểm tra lại', cls: 'diag-badge-info', icon: 'refresh' },
    running: { label: 'Đang thực thi…', cls: 'diag-badge-info', icon: 'refresh' },
    idle: { label: 'Sẵn sàng', cls: 'diag-badge-neutral', icon: 'clock' },
    untested: { label: 'Chưa kiểm tra', cls: 'diag-badge-neutral', icon: 'clock' },
    unconfigured: { label: 'Chưa cấu hình', cls: 'diag-badge-neutral', icon: 'info' },
    not_configured: { label: 'Chưa cấu hình', cls: 'diag-badge-neutral', icon: 'info' },
    using_builtin_dom_verifier: { label: 'Dùng DOM Verifier tích hợp', cls: 'diag-badge-info', icon: 'layout' },
    using_builtin_lab_metrics: { label: 'Dùng bộ đo Lab tích hợp', cls: 'diag-badge-info', icon: 'zap' },
    suppressed_cooldown: { label: 'Tạm lắng (Cooldown)', cls: 'diag-badge-neutral', icon: 'clock' },
    ignored: { label: 'Đã bỏ qua', cls: 'diag-badge-neutral', icon: 'info' },
  };
  const cfg = map[key] || { label: status || 'Chưa rõ', cls: 'diag-badge-neutral', icon: 'info' };
  return `<span class="diag-badge ${cfg.cls}" title="${esc(cfg.label)}">${diagIcon(cfg.icon, 'diag-badge-icon')}<span>${esc(cfg.label)}</span></span>`;
}

export function diagSeverityBadge(sev) {
  const key = String(sev || 'info').toLowerCase();
  const map = {
    critical: { label: 'Nghiêm trọng (Critical)', cls: 'diag-sev-critical' },
    high: { label: 'Cao (High)', cls: 'diag-sev-high' },
    medium: { label: 'Trung bình (Medium)', cls: 'diag-sev-medium' },
    low: { label: 'Thấp (Low)', cls: 'diag-sev-low' },
    info: { label: 'Thông tin (Info)', cls: 'diag-sev-info' },
  };
  const cfg = map[key] || map.info;
  return `<span class="diag-sev-pill ${cfg.cls}">${esc(cfg.label)}</span>`;
}

const CATEGORY_LABELS = {
  full: 'Toàn bộ hệ thống (8 bộ kiểm tra)',
  website: 'Website công khai',
  api: 'API Backend',
  browser: 'Giao diện Trình duyệt',
  d1: 'Cơ sở dữ liệu D1',
  r2: 'Lưu trữ R2',
  security: 'Bảo mật (OWASP)',
  performance: 'Hiệu năng & WCAG 2.2',
  workflow: 'Biểu mẫu & Nghiệp vụ',
};

const GLOSSARY_TERMS = [
  { term: 'HTTP Status Code (Mã trạng thái HTTP)', desc: 'Con số máy chủ trả về khi truy cập trang: 200 là bình thường, 301/302 là chuyển hướng, 401/403 là không có quyền, 404 là không tìm thấy trang, 500/503 là lỗi máy chủ.' },
  { term: 'TTFB (Time to First Byte)', desc: 'Thời gian từ lúc trình duyệt gửi yêu cầu đến khi nhận được byte dữ liệu đầu tiên từ máy chủ (đơn vị: mili-giây, nên ≤ 800 ms).' },
  { term: 'SSRF (Server-Side Request Forgery)', desc: 'Tấn công giả mạo yêu cầu từ phía máy chủ nhằm truy cập trái phép vào mạng nội bộ hoặc localhost. Hệ thống XANH tự động chặn mọi địa chỉ nội bộ.' },
  { term: 'Lab Metrics vs Field Metrics', desc: 'Lab Metrics là số liệu đo trong môi trường kiểm thử chuẩn hóa; Field Metrics là dữ liệu thu thập từ người dùng thật (CrUX/RUM). Không được trộn lẫn hai loại số liệu này.' },
  { term: 'Cloudflare D1 & R2', desc: 'D1 là cơ sở dữ liệu SQL phân tán lưu bài viết, hồ sơ, cấu hình và lịch sử kiểm tra; R2 là kho lưu trữ tệp ảnh Media Library và tệp đính kèm biểu mẫu.' },
  { term: 'Cooldown (Thời gian tạm lắng cảnh báo)', desc: 'Khoảng thời gian chờ tối thiểu giữa hai lần gửi cảnh báo cho cùng một lỗi, giúp quản trị viên không bị ngập thư thông báo trùng lặp.' },
];

export const diagState = {
  subview: 'overview',
  sidebarCollapsed: false,
  range: '7d',
  running: false,
  activeIncidentCount: 0,
  overviewData: null,
  lastSyncAt: null,
  selectedTargets: new Set(),
  targetFilters: { q: '', status: '', page: 1 },
  incidentFilters: { q: '', status: '', severity: '', category: '', page: 1 },
  reportFilters: { days: 30, category: '', severity: '', status: '' },
  selectedIncidentId: null,
  selectedRunId: null,
  selectedTargetId: null,
};

function findNavMeta(subview) {
  for (const g of DIAG_NAV_GROUPS) {
    for (const item of g.items) {
      if (item.id === subview) return { ...item, groupLabel: g.groupLabel };
    }
  }
  return { id: 'overview', label: 'Tổng quan', icon: 'activity', groupLabel: 'GIÁM SÁT & TỔNG QUAN', desc: '' };
}

function renderRunHistoryChart(series = []) {
  if (!Array.isArray(series) || series.length === 0) {
    return `<div class="diag-chart-empty">${diagIcon('info')}<span>Chưa có lịch sử phiên chạy trong khoảng thời gian chọn. Nhấn <b>"Kiểm tra ngay"</b> để thực thi phép đo đầu tiên từ dữ liệu thật.</span></div>`;
  }
  const maxTotal = Math.max(1, ...series.map((s) => Number(s.passed_checks || 0) + Number(s.failed_checks || 0) + Number(s.warning_checks || 0)));
  const maxRt = Math.max(100, ...series.map((s) => Number(s.avg_response_time_ms || 0)));

  return `
    <div class="diag-chart-bars" role="list" aria-label="Biểu đồ lịch sử phiên kiểm tra">
      ${series
        .map((item) => {
          const passed = Number(item.passed_checks || 0);
          const failed = Number(item.failed_checks || 0);
          const warn = Number(item.warning_checks || 0);
          const total = Math.max(1, passed + failed + warn);
          const heightPct = Math.max(18, Math.round((total / maxTotal) * 100));
          const rtMs = Number(item.avg_response_time_ms || 0);
          const barCls = failed > 0 ? 'has-fail' : warn > 0 ? 'has-warn' : 'all-pass';
          return `
            <button type="button" class="diag-bar-col ${barCls}" data-diag-open-run="${esc(item.run_uid)}" title="Phiên ${esc(item.run_uid)} · ${fmtDate(item.started_at)} · Đạt: ${passed}, Lỗi: ${failed}, Cảnh báo: ${warn} · TB: ${rtMs} ms">
              <span class="diag-bar-rt">${rtMs}ms</span>
              <span class="diag-bar-track" style="height:${heightPct}%">
                ${failed > 0 ? `<i class="diag-bar-seg fail" style="flex:${failed}"></i>` : ''}
                ${warn > 0 ? `<i class="diag-bar-seg warn" style="flex:${warn}"></i>` : ''}
                ${passed > 0 ? `<i class="diag-bar-seg pass" style="flex:${passed}"></i>` : ''}
              </span>
              <small class="diag-bar-label">${esc(String(item.started_at || '').slice(11, 16) || item.run_uid.slice(-4))}</small>
            </button>
          `;
        })
        .join('')}
    </div>
    <div class="diag-chart-legend">
      <span><i class="dot pass"></i> Thành công</span>
      <span><i class="dot warn"></i> Cảnh báo</span>
      <span><i class="dot fail"></i> Thất bại</span>
      <small>Nhấn vào cột bất kỳ để xem danh sách sự cố và kết quả tương ứng (Độ trễ đỉnh: ${maxRt} ms).</small>
    </div>
  `;
}

function renderSeverityBreakdown(dist = {}, categoryFailures = {}) {
  const totalSev = Number(dist.critical || 0) + Number(dist.high || 0) + Number(dist.medium || 0) + Number(dist.low || 0);
  const sevRows = [
    { key: 'critical', label: 'Nghiêm trọng (Critical)', count: Number(dist.critical || 0), cls: 'crit' },
    { key: 'high', label: 'Cao (High)', count: Number(dist.high || 0), cls: 'high' },
    { key: 'medium', label: 'Trung bình (Medium)', count: Number(dist.medium || 0), cls: 'med' },
    { key: 'low', label: 'Thấp (Low)', count: Number(dist.low || 0), cls: 'low' },
  ];

  const catEntries = Object.entries(categoryFailures || {}).map(([cat, count]) => ({
    cat,
    label: CATEGORY_LABELS[cat] || cat,
    count: Number(count || 0),
  }));

  return `
    <div class="diag-dist-grid">
      <div>
        <h4>Phân bố theo mức độ nghiêm trọng</h4>
        ${
          totalSev === 0
            ? `<p class="diag-muted-note">Hiện có 0 sự cố đang mở.</p>`
            : sevRows
                .map((r) => {
                  const pct = totalSev > 0 ? Math.round((r.count / totalSev) * 100) : 0;
                  return `
                    <button type="button" class="diag-dist-row" data-diag-filter-sev="${r.key}">
                      <span class="diag-dist-name">${esc(r.label)}</span>
                      <span class="diag-dist-bar"><i class="${r.cls}" style="width:${Math.max(r.count > 0 ? 8 : 0, pct)}%"></i></span>
                      <strong>${r.count}</strong>
                    </button>
                  `;
                })
                .join('')
        }
      </div>
      <div>
        <h4>Phân bố lỗi theo thành phần</h4>
        <div class="diag-cat-chips">
          ${catEntries
            .map(
              (c) => `
            <button type="button" class="diag-cat-chip ${c.count > 0 ? 'has-issue' : ''}" data-diag-filter-cat="${esc(c.cat)}">
              <span>${esc(c.label)}</span>
              <b>${c.count}</b>
            </button>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

async function renderOverviewSubview(api, canWrite) {
  const d = await api(`/api/admin/diagnostics/overview?range=${encodeURIComponent(diagState.range)}`);
  diagState.overviewData = d;
  diagState.lastSyncAt = new Date().toISOString();
  diagState.activeIncidentCount = Number(d.metrics?.active_incidents_count || 0);

  const m = d.metrics || {};
  const rangeLabel = { '24h': '24 giờ qua', '7d': '7 ngày qua', '30d': '30 ngày qua' }[d.range] || '7 ngày qua';

  return `
    <div class="diag-page-header">
      <div>
        <span class="diag-kicker">XANH WEBSITE DIAGNOSTICS PLATFORM</span>
        <h1>Tổng quan hệ thống</h1>
        <p>Giám sát thời gian thực, đối chiếu lịch sử kiểm tra và chẩn đoán nguyên nhân lỗi dựa trên dữ liệu thực tế từ Cloudflare Pages, D1 và R2.</p>
      </div>
      <div class="diag-header-controls">
        <div class="diag-range-group" role="group" aria-label="Khoảng thời gian thống kê">
          ${[
            ['24h', '24 giờ'],
            ['7d', '7 ngày'],
            ['30d', '30 ngày'],
          ]
            .map(
              ([val, label]) =>
                `<button type="button" class="diag-range-btn ${d.range === val ? 'active' : ''}" data-diag-range="${val}">${label}</button>`
            )
            .join('')}
        </div>
        ${
          canWrite
            ? `
          <div class="diag-run-group">
            <select id="diag-quick-suite" aria-label="Chọn phạm vi kiểm tra">
              <option value="full">Toàn bộ hệ thống (8 bộ kiểm tra)</option>
              <option value="website">Chỉ kiểm tra Website công khai</option>
              <option value="api">Chỉ kiểm tra API Backend</option>
              <option value="browser">Chỉ kiểm tra Giao diện Trình duyệt</option>
              <option value="d1">Chỉ kiểm tra Cơ sở dữ liệu D1</option>
              <option value="r2">Chỉ kiểm tra Lưu trữ R2</option>
              <option value="security">Chỉ kiểm tra Bảo mật (OWASP)</option>
              <option value="performance">Chỉ kiểm tra Hiệu năng & WCAG 2.2</option>
              <option value="workflow">Chỉ kiểm tra Biểu mẫu & Nghiệp vụ</option>
            </select>
            <button type="button" class="diag-btn diag-btn-primary" id="diag-run-now-btn" ${diagState.running ? 'disabled' : ''}>
              ${diagIcon('play')}
              <span>${diagState.running ? 'Đang thực thi kiểm tra…' : 'Kiểm tra ngay'}</span>
            </button>
          </div>
        `
            : ''
        }
      </div>
    </div>

    <div id="diag-live-progress" class="diag-live-progress" ${diagState.running ? '' : 'hidden'} role="status" aria-live="polite">
      <div class="diag-spinner"></div>
      <div>
        <b>Bộ điều phối kiểm tra đang thực thi các phép kiểm tra thực tế trên backend…</b>
        <p>Hệ thống đang thu thập bằng chứng HTTP, D1, R2, bảo mật và hiệu năng. Bạn có thể chờ vài giây hoặc chuyển sang mục khác rồi quay lại xem kết quả.</p>
      </div>
    </div>

    <section class="diag-kpi-strip" aria-label="Chỉ số vận hành chính">
      <article class="diag-kpi-card">
        <div class="diag-kpi-top">
          <span>Tình trạng tổng thể</span>
          ${diagStatusBadge(d.overall_status)}
        </div>
        <strong class="diag-kpi-val">${
          d.overall_status === 'untested'
            ? 'Chưa kiểm tra'
            : d.overall_status === 'healthy'
            ? 'Hoạt động ổn định'
            : d.overall_status === 'degraded'
            ? 'Có cảnh báo'
            : 'Cần xử lý ngay'
        }</strong>
        <small>Kiểm tra gần nhất: ${d.last_run ? fmtDate(d.last_run.started_at) : 'Chưa kiểm tra'} · ${m.healthy_targets || 0}/${m.enabled_targets || 0} mục tiêu đạt</small>
      </article>

      <article class="diag-kpi-card ${m.critical_open_incidents > 0 ? 'is-alert' : ''}">
        <div class="diag-kpi-top">
          <span>Lỗi nghiêm trọng chưa xử lý</span>
          <span class="diag-unit">sự cố</span>
        </div>
        <strong class="diag-kpi-val">${fmtNum(m.critical_open_incidents)}</strong>
        <small>Tổng sự cố đang mở: ${fmtNum(m.active_incidents_count)} · Tái phát: ${fmtNum(m.recurring_incidents_count)}</small>
      </article>

      <article class="diag-kpi-card">
        <div class="diag-kpi-top">
          <span>Lỗi mới phát hiện</span>
          <span class="diag-unit">${esc(rangeLabel)}</span>
        </div>
        <strong class="diag-kpi-val">${fmtNum(m.new_incidents_count)}</strong>
        <small>Endpoint đang gặp vấn đề: ${fmtNum(m.failing_targets)}</small>
      </article>

      <article class="diag-kpi-card">
        <div class="diag-kpi-top">
          <span>Tỷ lệ kiểm tra thành công</span>
          <span class="diag-unit">${esc(rangeLabel)}</span>
        </div>
        <strong class="diag-kpi-val">${m.pass_rate_percent !== null ? `${m.pass_rate_percent}%` : 'Chưa có dữ liệu'}</strong>
        <small>${m.total_checks > 0 ? `${fmtNum(m.passed_checks)} đạt / ${fmtNum(m.failed_checks)} lỗi (${fmtNum(m.total_runs)} phiên chạy)` : 'Chưa có phiên kiểm tra nào được lưu'}</small>
      </article>

      <article class="diag-kpi-card">
        <div class="diag-kpi-top">
          <span>Thời gian phản hồi (Trung vị / P95)</span>
          <span class="diag-unit">ms · ${esc(rangeLabel)}</span>
        </div>
        <strong class="diag-kpi-val">${
          m.median_response_time_ms !== null ? `${m.median_response_time_ms} / ${m.p95_response_time_ms} ms` : 'Chưa có dữ liệu'
        }</strong>
        <small>Ngưỡng ngân sách TTFB: ≤ ${d.settings?.performance_budgets?.ttfb_ms || 800} ms</small>
      </article>
    </section>

    <div class="diag-two-col">
      <section class="diag-panel">
        <div class="diag-panel-head">
          <div>
            <h2>Xu hướng kết quả & Thời gian phản hồi</h2>
            <p>Thống kê thực tế từ các phiên kiểm tra (${esc(rangeLabel)}). Nhấn vào cột để mở chi tiết phiên chạy.</p>
          </div>
          <button type="button" class="diag-link-btn" data-diag-nav="reports">Mở báo cáo chi tiết →</button>
        </div>
        ${renderRunHistoryChart(d.charts?.run_history || [])}
      </section>

      <section class="diag-panel">
        <div class="diag-panel-head">
          <div>
            <h2>Phân bố sự cố & Thành phần gặp lỗi</h2>
            <p>Nhấn vào mức độ hoặc thành phần để lọc trực tiếp danh sách sự cố tương ứng.</p>
          </div>
          <button type="button" class="diag-link-btn" data-diag-nav="incidents">Xem tất cả sự cố →</button>
        </div>
        ${renderSeverityBreakdown(d.charts?.severity_distribution, d.charts?.category_failures)}
      </section>
    </div>

    <div class="diag-two-col">
      <section class="diag-panel">
        <div class="diag-panel-head">
          <div>
            <h2>Trạng thái D1, R2 & Các tích hợp hệ thống</h2>
            <p>Chỉ hiển thị trạng thái thực tế của các binding và dịch vụ đã cấu hình.</p>
          </div>
          <button type="button" class="diag-link-btn" data-diag-nav="config">Quản lý cấu hình →</button>
        </div>
        <div class="diag-int-grid">
          <div class="diag-int-item">
            <div><b>Cloudflare D1 Database</b><small>Binding: DB · Database: xanh</small></div>
            ${diagStatusBadge(d.integrations?.d1_database?.status)}
          </div>
          <div class="diag-int-item">
            <div><b>Cloudflare R2 Storage</b><small>Binding: STORAGE · Bucket: xanh</small></div>
            ${diagStatusBadge(d.integrations?.r2_storage?.status)}
          </div>
          <div class="diag-int-item">
            <div><b>Dịch vụ Email (Resend API)</b><small>Biến: RESEND_API_KEY</small></div>
            ${diagStatusBadge(d.integrations?.resend_email?.status)}
          </div>
          <div class="diag-int-item">
            <div><b>Đồng bộ Cổng CTT</b><small>Biến: XANH_CTT_SHARED_SECRET</small></div>
            ${diagStatusBadge(d.integrations?.ctt_sync?.status)}
          </div>
          <div class="diag-int-item">
            <div><b>Kiểm thử Trình duyệt</b><small>DOM Verifier + Playwright Runner</small></div>
            ${diagStatusBadge(d.integrations?.playwright_runner?.status)}
          </div>
          <div class="diag-int-item">
            <div><b>Đo lường Hiệu năng</b><small>Lab Metrics + WCAG 2.2</small></div>
            ${diagStatusBadge(d.integrations?.lighthouse_runner?.status)}
          </div>
        </div>
      </section>

      <section class="diag-panel">
        <div class="diag-panel-head">
          <div>
            <h2>Lịch kiểm tra tiếp theo & Endpoint cần chú ý</h2>
            <p>Các lịch chạy nền định kỳ (${d.schedules_summary?.enabled || 0}/${d.schedules_summary?.total || 0} đang bật).</p>
          </div>
          <button type="button" class="diag-link-btn" data-diag-nav="schedules">Quản lý lịch chạy →</button>
        </div>
        ${
          d.next_schedule
            ? `
          <div class="diag-sched-banner">
            <div>
              <span class="diag-kicker">LỊCH TIẾP THEO</span>
              <h3>${esc(d.next_schedule.name)}</h3>
              <p>Chu kỳ: mỗi ${d.next_schedule.interval_minutes} phút (${esc(d.next_schedule.cron_expr)}) · Múi giờ: ${esc(d.next_schedule.timezone)}</p>
              <small>Lần chạy gần nhất: ${fmtDate(d.next_schedule.last_run_at)} · Dự kiến tiếp theo: ${fmtDate(d.next_schedule.next_run_at)}</small>
            </div>
            ${diagStatusBadge(d.next_schedule.last_status)}
          </div>
        `
            : `<div class="diag-empty-box">Chưa có lịch kiểm tra nào đang bật.</div>`
        }
        <h4 style="margin:16px 0 8px">Endpoint đang gặp vấn đề (${(d.failing_endpoints || []).length})</h4>
        ${
          (d.failing_endpoints || []).length
            ? `<div class="diag-mini-list">
                ${d.failing_endpoints
                  .map(
                    (ep) => `
                  <div class="diag-mini-row">
                    <div><b>${esc(ep.name)}</b><small>${esc(ep.url_or_path)} · HTTP ${ep.last_http_status || '—'} · ${ep.last_response_time_ms || 0} ms</small></div>
                    ${diagStatusBadge(ep.last_status)}
                  </div>
                `
                  )
                  .join('')}
              </div>`
            : `<p class="diag-muted-note">Không có endpoint nào đang báo lỗi ở lần kiểm tra gần nhất.</p>`
        }
      </section>
    </div>

    <section class="diag-panel">
      <div class="diag-panel-head">
        <div>
          <h2>Sự cố đang xử lý & Lỗi mới nhất</h2>
          <p>Ưu tiên sắp xếp theo mức độ ảnh hưởng (Critical → High → Medium → Low) và thời gian phát hiện.</p>
        </div>
        <button type="button" class="diag-btn diag-btn-secondary" data-diag-nav="incidents">Mở Quản lý sự cố</button>
      </div>
      <div class="diag-table-wrap">
        <table class="diag-table">
          <thead>
            <tr>
              <th>Mã sự cố</th>
              <th>Mức độ</th>
              <th>Tiêu đề lỗi</th>
              <th>Thành phần</th>
              <th>Tái diễn</th>
              <th>Trạng thái</th>
              <th>Người phụ trách</th>
              <th>Thời gian</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${
              (d.recent_incidents || []).length
                ? d.recent_incidents
                    .map(
                      (inc) => `
                <tr>
                  <td><code class="diag-code">${esc(inc.incident_code)}</code></td>
                  <td>${diagSeverityBadge(inc.severity)}</td>
                  <td><b>${esc(inc.title)}</b><br><small class="diag-muted">${esc(inc.affected_url)}</small></td>
                  <td>${esc(CATEGORY_LABELS[inc.category] || inc.affected_component)}</td>
                  <td>${fmtNum(inc.occurrence_count)} lần${inc.reopened_count > 0 ? ` <span class="diag-reopen-tag">(Mở lại ${inc.reopened_count})</span>` : ''}</td>
                  <td>${diagStatusBadge(inc.status)}</td>
                  <td>${esc(inc.assignee_name || 'Chưa phân công')}</td>
                  <td>${fmtDate(inc.last_seen_at)}</td>
                  <td><button type="button" class="diag-link-btn" data-diag-open-incident="${inc.id}">Chẩn đoán & Xử lý →</button></td>
                </tr>
              `
                    )
                    .join('')
                : `<tr><td colspan="9" class="diag-empty-cell">Chưa có sự cố nào đang mở. Khi phát hiện lỗi trong các lần chạy kiểm tra, hệ thống sẽ tự động phân tích nguyên nhân và hiển thị tại đây.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

async function renderTargetsSubview(api, canWrite, suiteFilter = 'website') {
  const f = diagState.targetFilters;
  const query = new URLSearchParams({
    type: suiteFilter,
    ...(f.status ? { status: f.status } : {}),
    ...(f.q ? { q: f.q } : {}),
    page: String(f.page || 1),
    page_size: '20',
  });
  const d = await api(`/api/admin/diagnostics/targets?${query.toString()}`);
  const items = d.items || [];
  const isApi = suiteFilter === 'api';

  return `
    <div class="diag-page-header">
      <div>
        <span class="diag-kicker">${isApi ? 'API HEALTH & SCHEMA VERIFICATION' : 'PUBLIC WEBSITE MONITORING'}</span>
        <h1>${isApi ? 'Kiểm tra API' : 'Kiểm tra website công khai'}</h1>
        <p>${
          isApi
            ? 'Quản lý danh sách endpoint, phương thức HTTP, xác thực an toàn và trình xây dựng quy tắc xác minh phản hồi không cần viết code.'
            : 'Kiểm tra trạng thái HTTP, chứng chỉ HTTPS/TLS, vòng lặp redirect, liên kết nội bộ và tài nguyên tĩnh trên các tên miền được phép.'
        }</p>
      </div>
      <div class="diag-header-controls">
        ${
          canWrite
            ? `
          <button type="button" class="diag-btn diag-btn-secondary" id="diag-add-target-btn" data-target-type="${esc(suiteFilter)}">
            ${diagIcon('plus')}<span>${isApi ? 'Thêm Endpoint API' : 'Thêm mục tiêu Website'}</span>
          </button>
          <button type="button" class="diag-btn diag-btn-primary" data-diag-run-suite="${esc(suiteFilter)}">
            ${diagIcon('play')}<span>Chạy kiểm tra ${isApi ? 'API' : 'Website'}</span>
          </button>
        `
            : ''
        }
      </div>
    </div>

    <div class="diag-filter-bar">
      <div class="diag-search-box">
        ${diagIcon('search')}
        <input type="search" id="diag-target-search" value="${esc(f.q)}" placeholder="Tìm theo tên mục tiêu, đường dẫn hoặc hostname..." aria-label="Tìm mục tiêu">
      </div>
      <select id="diag-target-status" aria-label="Lọc theo trạng thái">
        <option value="">Tất cả trạng thái</option>
        <option value="passed" ${f.status === 'passed' ? 'selected' : ''}>Thành công (Passed)</option>
        <option value="failed" ${f.status === 'failed' ? 'selected' : ''}>Thất bại (Failed)</option>
        <option value="warning" ${f.status === 'warning' ? 'selected' : ''}>Cảnh báo (Warning)</option>
        <option value="timeout" ${f.status === 'timeout' ? 'selected' : ''}>Timeout</option>
        <option value="untested" ${f.status === 'untested' ? 'selected' : ''}>Chưa kiểm tra</option>
      </select>
      ${
        f.q || f.status
          ? `<button type="button" class="diag-btn diag-btn-ghost" id="diag-clear-target-filters">${diagIcon('x')}<span>Xóa bộ lọc</span></button>`
          : ''
      }
      ${
        canWrite
          ? `<button type="button" class="diag-btn diag-btn-secondary" id="diag-retest-selected-btn" ${diagState.selectedTargets.size === 0 ? 'disabled' : ''}>
              ${diagIcon('refresh')}<span>Kiểm tra lại mục đã chọn (${diagState.selectedTargets.size})</span>
            </button>`
          : ''
      }
    </div>

    <section class="diag-panel">
      <div class="diag-table-wrap">
        <table class="diag-table">
          <thead>
            <tr>
              <th style="width:38px"><input type="checkbox" id="diag-select-all-targets" aria-label="Chọn tất cả"></th>
              <th>Tên mục tiêu</th>
              ${isApi ? '<th>Phương thức</th>' : ''}
              <th>Hostname / Đường dẫn</th>
              <th>Điều kiện xác minh</th>
              <th>Trạng thái gần nhất</th>
              <th>Mã HTTP</th>
              <th>Thời gian phản hồi</th>
              <th>Lần kiểm tra gần nhất</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            ${
              items.length
                ? items
                    .map(
                      (t) => `
                <tr>
                  <td><input type="checkbox" class="diag-target-check" value="${t.id}" ${diagState.selectedTargets.has(Number(t.id)) ? 'checked' : ''} aria-label="Chọn ${esc(t.name)}"></td>
                  <td><b>${esc(t.name)}</b><br><small class="diag-muted">Môi trường: ${esc(t.environment)} · Timeout: ${t.timeout_ms}ms</small></td>
                  ${isApi ? `<td><span class="diag-method-pill method-${esc(String(t.method).toLowerCase())}">${esc(t.method)}</span></td>` : ''}
                  <td><code class="diag-code">${esc(t.url_or_path)}</code><br><small class="diag-muted">${esc(t.hostname)} · Xác thực: ${esc(t.auth_type)}</small></td>
                  <td><span class="diag-rule-count">${(t.assertions || []).length} quy tắc</span> · HTTP ${t.expected_status}</td>
                  <td>${diagStatusBadge(t.last_status)}</td>
                  <td>${t.last_http_status ?? '—'}</td>
                  <td>${t.last_response_time_ms !== null && t.last_response_time_ms !== undefined ? `${t.last_response_time_ms} ms` : '—'}</td>
                  <td>${fmtDate(t.last_checked_at)}</td>
                  <td class="diag-actions-cell">
                    ${canWrite ? `<button type="button" class="diag-link-btn" data-diag-run-target="${t.id}">Chạy thử</button> · ` : ''}
                    <button type="button" class="diag-link-btn" data-diag-view-target="${t.id}">Chi tiết</button>
                    ${canWrite ? ` · <button type="button" class="diag-link-btn" data-diag-edit-target="${t.id}">Sửa</button> · <button type="button" class="diag-link-btn danger-link" data-diag-del-target="${t.id}" data-target-name="${esc(t.name)}">Xóa</button>` : ''}
                  </td>
                </tr>
              `
                    )
                    .join('')
                : `<tr><td colspan="${isApi ? 10 : 9}" class="diag-empty-cell">Không tìm thấy mục tiêu kiểm tra phù hợp với bộ lọc hiện tại.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div class="diag-pagination">
        <span>Hiển thị ${items.length} / ${d.total || 0} mục tiêu</span>
        <div>
          <button type="button" class="diag-btn diag-btn-ghost" data-diag-target-page="${Math.max(1, (d.page || 1) - 1)}" ${(d.page || 1) <= 1 ? 'disabled' : ''}>← Trang trước</button>
          <span class="diag-page-indicator">Trang ${d.page || 1}</span>
          <button type="button" class="diag-btn diag-btn-ghost" data-diag-target-page="${(d.page || 1) + 1}" ${(d.page || 1) * (d.page_size || 20) >= (d.total || 0) ? 'disabled' : ''}>Trang sau →</button>
        </div>
      </div>
    </section>
  `;
}

async function renderBrowserSubview(api, canWrite) {
  const [targetsRes, runsRes, configRes] = await Promise.all([
    api('/api/admin/diagnostics/targets?type=browser'),
    api('/api/admin/diagnostics/runs?suite=browser&page_size=15'),
    api('/api/admin/diagnostics/config'),
  ]);
  const targets = targetsRes.items || [];
  const runs = runsRes.items || [];
  const playwrightConfigured = Boolean(configRes.environment_info?.secrets_status?.DIAG_BROWSER_RUNNER_URL);

  let latestRunDetail = null;
  if (runs.length > 0) {
    try {
      latestRunDetail = await api(`/api/admin/diagnostics/run-detail/${runs[0].id}`);
    } catch {}
  }

  return `
    <div class="diag-page-header">
      <div>
        <span class="diag-kicker">BROWSER & DOM AUTOMATION</span>
        <h1>Kiểm tra giao diện bằng trình duyệt</h1>
        <p>Xác minh phần tử giao diện quan trọng (#app, #toast-root, #font-accessibility-tools), tài nguyên CSS/JS và kết nối Playwright Runner.</p>
      </div>
      <div class="diag-header-controls">
        ${
          canWrite
            ? `
          <button type="button" class="diag-btn diag-btn-secondary" id="diag-add-target-btn" data-target-type="browser">
            ${diagIcon('plus')}<span>Thêm kịch bản trình duyệt</span>
          </button>
          <button type="button" class="diag-btn diag-btn-primary" data-diag-run-suite="browser">
            ${diagIcon('play')}<span>Chạy kịch bản trình duyệt</span>
          </button>
        `
            : ''
        }
      </div>
    </div>

    <div class="diag-info-banner">
      ${diagIcon('info')}
      <div>
        <b>Minh bạch kiến trúc thực thi trình duyệt:</b>
        <p>Cloudflare Pages Functions hoạt động trên môi trường V8 Isolate không chứa sẵn binary trình duyệt Chromium nặng. Hệ thống cung cấp đồng thời: <b>(1) Bộ xác minh cấu trúc DOM, Module JS & Tài nguyên tĩnh trực tiếp</b> và <b>(2) Cầu nối an toàn tới Playwright Chromium Runner độc lập</b> (<code>scripts/playwright-lighthouse-runner.mjs</code> qua biến <code>DIAG_BROWSER_RUNNER_URL</code> — trạng thái hiện tại: <b>${playwrightConfigured ? 'Đã kết nối Playwright Runner' : 'Chưa cấu hình URL ngoài · Đang dùng DOM/Asset Verifier thực tế'}</b>). Hệ thống tuyệt đối không tạo ảnh chụp màn hình giả.</p>
      </div>
    </div>

    <div class="diag-two-col">
      <section class="diag-panel">
        <div class="diag-panel-head">
          <div>
            <h2>Kịch bản kiểm thử trình duyệt đã định nghĩa</h2>
            <p>Chọn kịch bản để chạy thử hoặc cấu hình các phần tử DOM bắt buộc.</p>
          </div>
        </div>
        <div class="diag-table-wrap">
          <table class="diag-table">
            <thead>
              <tr>
                <th>Kịch bản</th>
                <th>Đường dẫn</th>
                <th>Trạng thái</th>
                <th>Phản hồi</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${targets
                .map(
                  (t) => `
                <tr>
                  <td><b>${esc(t.name)}</b><br><small class="diag-muted">Môi trường: ${esc(t.environment)}</small></td>
                  <td><code class="diag-code">${esc(t.url_or_path)}</code></td>
                  <td>${diagStatusBadge(t.last_status)}</td>
                  <td>${t.last_response_time_ms ? `${t.last_response_time_ms} ms` : '—'}</td>
                  <td>
                    ${canWrite ? `<button type="button" class="diag-link-btn" data-diag-run-target="${t.id}">Chạy kịch bản</button> · ` : ''}
                    <button type="button" class="diag-link-btn" data-diag-view-target="${t.id}">Chi tiết</button>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="diag-panel">
        <div class="diag-panel-head">
          <div>
            <h2>Chi tiết các bước thực thi gần nhất</h2>
            <p>${latestRunDetail ? `Mã phiên: ${esc(latestRunDetail.run.run_uid)} · ${fmtDate(latestRunDetail.run.started_at)}` : 'Chưa có lần chạy kịch bản trình duyệt nào.'}</p>
          </div>
        </div>
        ${
          latestRunDetail && (latestRunDetail.results || []).length
            ? latestRunDetail.results
                .map((r) => {
                  const steps = r.evidence?.steps || [];
                  return `
                  <div class="diag-step-box">
                    <div class="diag-step-header">
                      <b>${esc(r.title)} (${esc(r.target_ref)})</b>
                      ${diagStatusBadge(r.status)}
                    </div>
                    <p class="diag-muted">${esc(r.message)}</p>
                    <ul class="diag-step-list">
                      ${steps
                        .map(
                          (s) => `
                        <li class="${s.passed ? 'pass' : 'fail'}">
                          ${diagIcon(s.passed ? 'check' : 'x')}
                          <div><b>${esc(s.step)}</b> — <span>${esc(s.detail)}</span></div>
                        </li>
                      `
                        )
                        .join('')}
                    </ul>
                  </div>
                `;
                })
                .join('')
            : `<div class="diag-empty-box">Nhấn <b>"Chạy kịch bản trình duyệt"</b> ở góc trên để thực thi và xem kết quả từng bước.</div>`
        }
      </section>
    </div>
  `;
}

async function renderSpecializedSuiteSubview(api, canWrite, suiteType) {
  const metaMap = {
    storage: {
      kicker: 'CLOUDFLARE D1 & R2 DIAGNOSTICS',
      title: 'Kiểm tra Dữ liệu (D1) & Lưu trữ (R2)',
      desc: 'Kiểm tra kết nối binding D1, đối chiếu 31 bảng bắt buộc, kiểm tra ràng buộc dữ liệu và xác minh đọc/ghi đối tượng probe trên R2 mà không liệt kê tệp riêng tư.',
      runSuite: 'd1',
      secondarySuite: 'r2',
    },
    security: {
      kicker: 'DEFENSIVE APPLICATION SECURITY (OWASP ASVS / WSTG)',
      title: 'Kiểm tra Bảo mật phòng thủ',
      desc: 'Kiểm tra HTTP Security Headers, cờ bảo mật Cookie/Session, kiểm soát truy cập API Admin (RBAC), chống CSRF và xác nhận bộ lọc chống SSRF.',
      runSuite: 'security',
    },
    performance: {
      kicker: 'SYNTHETIC LAB PERFORMANCE & WCAG 2.2 AA',
      title: 'Kiểm tra Hiệu năng & Khả năng tiếp cận',
      desc: 'Đo thời gian phản hồi TTFB Lab, kích thước HTML, tài nguyên chặn hiển thị và các tiêu chí tiếp cận WCAG 2.2. Phân biệt rõ số liệu đo Lab và dữ liệu người dùng thực tế (Field Metrics).',
      runSuite: 'performance',
    },
    workflow: {
      kicker: 'FORMS, SUBMISSIONS & CTT OUTBOX WORKFLOWS',
      title: 'Kiểm tra Biểu mẫu & Nghiệp vụ',
      desc: 'Kiểm tra các biểu mẫu công khai đang mở, quy tắc bảo vệ tra cứu mã hồ sơ, trạng thái dịch vụ email Resend và hàng đợi đồng bộ CTT.',
      runSuite: 'workflow',
    },
  };
  const cfg = metaMap[suiteType] || metaMap.security;

  const runsRes = await api(`/api/admin/diagnostics/runs?page_size=25`);
  const allRuns = runsRes.items || [];
  const matchingRun = allRuns.find((r) => r.suite_type === cfg.runSuite || r.suite_type === cfg.secondarySuite || r.suite_type === 'full');
  let detail = null;
  if (matchingRun) {
    try {
      detail = await api(`/api/admin/diagnostics/run-detail/${matchingRun.id}`);
    } catch {}
  }

  const relevantResults = (detail?.results || []).filter((r) =>
    suiteType === 'storage' ? ['d1', 'r2'].includes(r.category) : r.category === cfg.runSuite
  );

  return `
    <div class="diag-page-header">
      <div>
        <span class="diag-kicker">${esc(cfg.kicker)}</span>
        <h1>${esc(cfg.title)}</h1>
        <p>${esc(cfg.desc)}</p>
      </div>
      <div class="diag-header-controls">
        ${
          canWrite
            ? suiteType === 'storage'
              ? `
              <button type="button" class="diag-btn diag-btn-secondary" data-diag-run-suite="r2">${diagIcon('play')}<span>Kiểm tra R2 Storage</span></button>
              <button type="button" class="diag-btn diag-btn-primary" data-diag-run-suite="d1">${diagIcon('play')}<span>Kiểm tra Cơ sở dữ liệu D1</span></button>
            `
              : `<button type="button" class="diag-btn diag-btn-primary" data-diag-run-suite="${esc(cfg.runSuite)}">${diagIcon('play')}<span>Chạy ${esc(cfg.title)}</span></button>`
            : ''
        }
      </div>
    </div>

    ${
      suiteType === 'security'
        ? `<div class="diag-info-banner">${diagIcon('shield')}<div><b>Nguyên tắc đánh giá bảo mật trung thực:</b><p>Bộ kiểm tra thực hiện các bài kiểm tra phòng thủ không phá hoại theo tiêu chuẩn OWASP ASVS. Việc vượt qua toàn bộ phép kiểm tra dưới đây xác nhận các lớp phòng vệ cơ bản đang hoạt động đúng, nhưng <b>không bao giờ được hiểu là website "an toàn tuyệt đối"</b> trước mọi rủi ro mới.</p></div></div>`
        : suiteType === 'performance'
        ? `<div class="diag-info-banner">${diagIcon('zap')}<div><b>Phân biệt dữ liệu Lab và dữ liệu Field (Người dùng thực tế):</b><p>Các chỉ số TTFB, dung lượng tải và kiểm tra DOM dưới đây là <b>Phép đo Lab (Synthetic Measurement)</b> thực hiện trực tiếp từ bộ kiểm tra. Dữ liệu người dùng thực tế (Field Metrics / Chrome UX Report) được ghi nhận rõ trạng thái cấu hình và không bao giờ bị làm giả.</p></div></div>`
        : ''
    }

    <section class="diag-panel">
      <div class="diag-panel-head">
        <div>
          <h2>Kết quả xác minh thực tế gần nhất</h2>
          <p>${detail ? `Trích xuất từ phiên chạy ${esc(detail.run.run_uid)} (${fmtDate(detail.run.started_at)})` : 'Chưa có phiên kiểm tra nào cho phân hệ này.'}</p>
        </div>
      </div>
      ${
        relevantResults.length
          ? `<div class="diag-results-cards">
              ${relevantResults
                .map(
                  (r) => `
                <article class="diag-result-card status-${esc(r.status)}">
                  <header>
                    <div>
                      <span class="diag-kicker">${esc(CATEGORY_LABELS[r.category] || r.category)} · ${esc(r.check_key)}</span>
                      <h3>${esc(r.title)}</h3>
                    </div>
                    <div class="diag-result-badges">
                      ${diagSeverityBadge(r.severity)}
                      ${diagStatusBadge(r.status)}
                    </div>
                  </header>
                  <p class="diag-result-msg">${esc(r.message)}</p>
                  <div class="diag-result-meta">
                    <span>Đối tượng: <code>${esc(r.target_ref)}</code></span>
                    <span>HTTP: <b>${r.http_status ?? 'N/A'}</b></span>
                    <span>Thời gian thực thi: <b>${r.response_time_ms ?? 0} ms</b></span>
                  </div>
                  <details class="diag-evidence-details">
                    <summary>Xem bằng chứng kỹ thuật & Chẩn đoán chi tiết</summary>
                    <div class="diag-evidence-grid">
                      <div>
                        <b>Bằng chứng thu thập (Đã che thông tin nhạy cảm):</b>
                        <pre>${esc(JSON.stringify(r.evidence || {}, null, 2))}</pre>
                      </div>
                      <div>
                        <b>Kết luận chẩn đoán:</b>
                        <p>${esc(r.diagnosis?.plain_explanation || 'Hoạt động bình thường.')}</p>
                        ${r.diagnosis?.verified_cause ? `<p><b>Nguyên nhân xác minh:</b> ${esc(r.diagnosis.verified_cause)}</p>` : ''}
                        ${r.diagnosis?.hypothesis_cause ? `<p><b>Giả thuyết:</b> ${esc(r.diagnosis.hypothesis_cause)}</p>` : ''}
                      </div>
                    </div>
                  </details>
                </article>
              `
                )
                .join('')}
            </div>`
          : `<div class="diag-empty-box">Chưa có dữ liệu kiểm tra cho phân hệ này. Hãy nhấn nút <b>"Chạy kiểm tra"</b> ở góc trên bên phải để thực thi phép kiểm tra thật.</div>`
      }
    </section>
  `;
}

async function renderIncidentsSubview(api, canWrite) {
  const f = diagState.incidentFilters;
  const query = new URLSearchParams({
    ...(f.status ? { status: f.status } : {}),
    ...(f.severity ? { severity: f.severity } : {}),
    ...(f.category ? { category: f.category } : {}),
    ...(f.q ? { q: f.q } : {}),
    page: String(f.page || 1),
    page_size: '20',
  });
  const d = await api(`/api/admin/diagnostics/incidents?${query.toString()}`);
  const items = d.items || [];

  return `
    <div class="diag-page-header">
      <div>
        <span class="diag-kicker">INCIDENT MANAGEMENT & ROOT-CAUSE DIAGNOSTICS</span>
        <h1>Sự cố & Chẩn đoán lỗi</h1>
        <p>Tự động gộp lỗi trùng lặp, phát hiện lỗi tái phát, phân tách nguyên nhân đã xác minh với giả thuyết và hướng dẫn khắc phục từng bước.</p>
      </div>
      <div class="diag-header-controls">
        <button type="button" class="diag-btn diag-btn-secondary" data-diag-nav="reports">${diagIcon('download')}<span>Xuất báo cáo sự cố</span></button>
      </div>
    </div>

    <div class="diag-filter-bar">
      <div class="diag-search-box">
        ${diagIcon('search')}
        <input type="search" id="diag-inc-search" value="${esc(f.q)}" placeholder="Tìm theo mã sự cố (INC-...), tiêu đề, URL hoặc thành phần..." aria-label="Tìm sự cố">
      </div>
      <select id="diag-inc-severity" aria-label="Lọc theo mức độ">
        <option value="">Mọi mức độ</option>
        <option value="critical" ${f.severity === 'critical' ? 'selected' : ''}>Nghiêm trọng (Critical)</option>
        <option value="high" ${f.severity === 'high' ? 'selected' : ''}>Cao (High)</option>
        <option value="medium" ${f.severity === 'medium' ? 'selected' : ''}>Trung bình (Medium)</option>
        <option value="low" ${f.severity === 'low' ? 'selected' : ''}>Thấp (Low)</option>
      </select>
      <select id="diag-inc-status" aria-label="Lọc theo trạng thái xử lý">
        <option value="">Mọi trạng thái xử lý</option>
        <option value="open" ${f.status === 'open' ? 'selected' : ''}>Mới phát hiện (Open)</option>
        <option value="investigating" ${f.status === 'investigating' ? 'selected' : ''}>Đang điều tra</option>
        <option value="fixing" ${f.status === 'fixing' ? 'selected' : ''}>Đang khắc phục</option>
        <option value="retesting" ${f.status === 'retesting' ? 'selected' : ''}>Chờ kiểm tra lại</option>
        <option value="resolved" ${f.status === 'resolved' ? 'selected' : ''}>Đã khắc phục (Resolved)</option>
        <option value="ignored" ${f.status === 'ignored' ? 'selected' : ''}>Đã bỏ qua</option>
      </select>
      <select id="diag-inc-category" aria-label="Lọc theo thành phần">
        <option value="">Mọi thành phần</option>
        ${Object.entries(CATEGORY_LABELS)
          .filter(([k]) => k !== 'full')
          .map(([k, label]) => `<option value="${k}" ${f.category === k ? 'selected' : ''}>${esc(label)}</option>`)
          .join('')}
      </select>
      ${
        f.q || f.status || f.severity || f.category
          ? `<button type="button" class="diag-btn diag-btn-ghost" id="diag-clear-inc-filters">${diagIcon('x')}<span>Xóa bộ lọc</span></button>`
          : ''
      }
    </div>

    <section class="diag-panel">
      <div class="diag-table-wrap">
        <table class="diag-table">
          <thead>
            <tr>
              <th>Mã sự cố</th>
              <th>Mức độ nghiêm trọng</th>
              <th>Tiêu đề lỗi</th>
              <th>Thành phần bị ảnh hưởng</th>
              <th>Thời điểm phát hiện</th>
              <th>Số lần tái diễn</th>
              <th>Trạng thái xử lý</th>
              <th>Người phụ trách</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${
              items.length
                ? items
                    .map(
                      (inc) => `
                <tr>
                  <td><code class="diag-code">${esc(inc.incident_code)}</code><br><small class="diag-muted">${esc(inc.correlation_id)}</small></td>
                  <td>${diagSeverityBadge(inc.severity)}</td>
                  <td><b>${esc(inc.title)}</b><br><small class="diag-muted">${esc(inc.plain_explanation.slice(0, 110))}</small></td>
                  <td><b>${esc(CATEGORY_LABELS[inc.category] || inc.category)}</b><br><code class="diag-code">${esc(inc.affected_url)}</code></td>
                  <td>Đầu tiên: ${fmtDate(inc.first_seen_at)}<br><small class="diag-muted">Gần nhất: ${fmtDate(inc.last_seen_at)}</small></td>
                  <td><b>${fmtNum(inc.occurrence_count)}</b> lần${inc.reopened_count > 0 ? `<br><span class="diag-reopen-tag">Tái phát: ${inc.reopened_count} lần</span>` : ''}</td>
                  <td>${diagStatusBadge(inc.status)}</td>
                  <td>${esc(inc.assignee_name || 'Chưa phân công')}</td>
                  <td><button type="button" class="diag-btn diag-btn-secondary diag-btn-sm" data-diag-open-incident="${inc.id}">Chi tiết & Chẩn đoán</button></td>
                </tr>
              `
                    )
                    .join('')
                : `<tr><td colspan="9" class="diag-empty-cell">Không có sự cố nào khớp với điều kiện lọc hiện tại.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div class="diag-pagination">
        <span>Tổng số: ${d.total || 0} sự cố</span>
        <div>
          <button type="button" class="diag-btn diag-btn-ghost" data-diag-inc-page="${Math.max(1, (d.page || 1) - 1)}" ${(d.page || 1) <= 1 ? 'disabled' : ''}>← Trang trước</button>
          <span class="diag-page-indicator">Trang ${d.page || 1}</span>
          <button type="button" class="diag-btn diag-btn-ghost" data-diag-inc-page="${(d.page || 1) + 1}" ${(d.page || 1) * (d.page_size || 20) >= (d.total || 0) ? 'disabled' : ''}>Trang sau →</button>
        </div>
      </div>
    </section>
  `;
}

async function renderSchedulesSubview(api, canWrite) {
  const [schedRes, targetsRes] = await Promise.all([
    api('/api/admin/diagnostics/schedules'),
    api('/api/admin/diagnostics/targets?page_size=100'),
  ]);
  const schedules = schedRes.items || [];
  const targets = targetsRes.items || [];

  return `
    <div class="diag-page-header">
      <div>
        <span class="diag-kicker">AUTOMATED SCHEDULER & CONCURRENCY GUARD</span>
        <h1>Lịch kiểm tra tự động</h1>
        <p>Thiết lập lịch chạy định kỳ hoặc theo sự kiện, có cơ chế khóa chống chạy trùng trên D1, giới hạn đồng thời và backoff tự động khi gặp lỗi.</p>
      </div>
      <div class="diag-header-controls">
        ${
          canWrite
            ? `<button type="button" class="diag-btn diag-btn-primary" id="diag-new-schedule-btn">${diagIcon('plus')}<span>Tạo lịch kiểm tra</span></button>`
            : ''
        }
      </div>
    </div>

    <div class="diag-info-banner">
      ${diagIcon('clock')}
      <div>
        <b>Cơ chế thực thi nền thực sự:</b>
        <p>Các lịch kiểm tra được lưu trong bảng <code>diag_schedules</code> trên Cloudflare D1 và được thực thi bởi bộ điều phối nền (<code>workers/diagnostics-cron.js</code> qua Cloudflare Cron Triggers hoặc endpoint <code>POST /api/cron/diagnostics</code>), không phụ thuộc vào việc quản trị viên có đang mở trình duyệt hay không.</p>
      </div>
    </div>

    <section class="diag-panel">
      <div class="diag-table-wrap">
        <table class="diag-table">
          <thead>
            <tr>
              <th>Tên lịch kiểm tra</th>
              <th>Bộ kiểm tra / Mục tiêu</th>
              <th>Chu kỳ & Khung giờ</th>
              <th>Giới hạn & Retry</th>
              <th>Trạng thái gần nhất</th>
              <th>Lần chạy gần nhất / Tiếp theo</th>
              <th>Bật / Tắt</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${
              schedules.length
                ? schedules
                    .map(
                      (s) => `
                <tr>
                  <td>
                    <b>${esc(s.name)}</b>
                    ${s.last_error ? `<br><small class="diag-error-text">Lỗi gần nhất: ${esc(s.last_error)}</small>` : ''}
                  </td>
                  <td>${esc(CATEGORY_LABELS[s.suite_type] || s.suite_type)}<br><small class="diag-muted">${esc(s.target_name || 'Toàn bộ mục tiêu trong nhóm')}</small></td>
                  <td>Mỗi <b>${s.interval_minutes} phút</b> (<code>${esc(s.cron_expr)}</code>)<br><small class="diag-muted">${esc(s.active_window_start)} – ${esc(s.active_window_end)} (${esc(s.timezone)})</small></td>
                  <td>Đồng thời tối đa: ${s.max_concurrency}<br><small class="diag-muted">Retry: ${s.retry_limit} lần · Backoff: ${s.backoff_seconds}s · Timeout: ${s.timeout_ms}ms</small></td>
                  <td>${diagStatusBadge(s.last_status)}</td>
                  <td>Gần nhất: ${fmtDate(s.last_run_at)}<br><small class="diag-muted">Tiếp theo: ${s.enabled ? fmtDate(s.next_run_at) : 'Đã tạm dừng'}</small></td>
                  <td>${s.enabled ? '<span class="diag-badge diag-badge-passed">Đang bật</span>' : '<span class="diag-badge diag-badge-neutral">Tạm dừng</span>'}</td>
                  <td class="diag-actions-cell">
                    ${
                      canWrite
                        ? `
                      <button type="button" class="diag-link-btn" data-diag-trigger-schedule="${s.id}">Chạy ngay</button> ·
                      <button type="button" class="diag-link-btn" data-diag-toggle-schedule="${s.id}" data-enabled="${s.enabled ? '1' : '0'}">${s.enabled ? 'Tạm dừng' : 'Bật lại'}</button> ·
                      <button type="button" class="diag-link-btn danger-link" data-diag-del-schedule="${s.id}" data-sched-name="${esc(s.name)}">Xóa</button>
                    `
                        : '—'
                    }
                  </td>
                </tr>
              `
                    )
                    .join('')
                : `<tr><td colspan="8" class="diag-empty-cell">Chưa có lịch kiểm tra nào.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
    
  `;
}

async function renderAlertsSubview(api, canWrite) {
  const d = await api('/api/admin/diagnostics/alerts');
  const rules = d.rules || [];
  const logs = d.logs || [];

  return `
    <div class="diag-page-header">
      <div>
        <span class="diag-kicker">ALERTING & DEDUPLICATION COOLDOWN</span>
        <h1>Cảnh báo & Nhật ký thông báo</h1>
        <p>Thiết lập ngưỡng cảnh báo, cơ chế chống gửi lặp (cooldown) và điều kiện gửi lại khi có lỗi mới hoặc lỗi tái phát.</p>
      </div>
      <div class="diag-header-controls">
        ${
          canWrite
            ? `<button type="button" class="diag-btn diag-btn-primary" id="diag-new-alert-btn">${diagIcon('plus')}<span>Thêm quy tắc cảnh báo</span></button>`
            : ''
        }
      </div>
    </div>

    <div class="diag-two-col">
      <section class="diag-panel">
        <div class="diag-panel-head">
          <div>
            <h2>Quy tắc cảnh báo đang cấu hình</h2>
            <p>Hệ thống không gửi email thật khi chưa cấu hình RESEND_API_KEY và chưa bật cho phép trong Cấu hình hệ thống.</p>
          </div>
        </div>
        <div class="diag-table-wrap">
          <table class="diag-table">
            <thead>
              <tr>
                <th>Tên quy tắc</th>
                <th>Kênh</th>
                <th>Ngưỡng tối thiểu</th>
                <th>Tạm lắng (Cooldown)</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${rules
                .map(
                  (r) => `
                <tr>
                  <td><b>${esc(r.rule_name)}</b><br><small class="diag-muted">Điều kiện: ${esc(r.repeat_condition)}</small></td>
                  <td>${esc(r.channel.toUpperCase())}</td>
                  <td>${diagSeverityBadge(r.min_severity)}</td>
                  <td>${r.cooldown_minutes} phút</td>
                  <td>${r.enabled ? diagStatusBadge('passed') : diagStatusBadge('unconfigured')}</td>
                  <td>
                    ${
                      canWrite
                        ? `<button type="button" class="diag-link-btn" data-diag-toggle-alert="${r.id}" data-enabled="${r.enabled ? '1' : '0'}">${r.enabled ? 'Tắt' : 'Bật'}</button>`
                        : '—'
                    }
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="diag-panel">
        <div class="diag-panel-head">
          <div>
            <h2>Nhật ký cảnh báo gần đây</h2>
            <p>Ghi nhận mọi lần kích hoạt cảnh báo hoặc tạm lắng chống gửi lặp.</p>
          </div>
        </div>
        <div class="diag-table-wrap">
          <table class="diag-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Quy tắc / Sự cố</th>
                <th>Kênh</th>
                <th>Trạng thái</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              ${
                logs.length
                  ? logs
                      .map(
                        (l) => `
                  <tr>
                    <td>${fmtDate(l.created_at)}</td>
                    <td><b>${esc(l.incident_code || 'Hệ thống')}</b><br><small class="diag-muted">${esc(l.rule_name || '')}</small></td>
                    <td>${esc(l.channel)}</td>
                    <td>${diagStatusBadge(l.status)}</td>
                    <td>${esc(l.reason)}</td>
                  </tr>
                `
                      )
                      .join('')
                  : `<tr><td colspan="5" class="diag-empty-cell">Chưa có nhật ký cảnh báo nào.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

async function renderReportsSubview(api) {
  const f = diagState.reportFilters;
  const query = new URLSearchParams({
    days: String(f.days || 30),
    ...(f.category ? { category: f.category } : {}),
    ...(f.severity ? { severity: f.severity } : {}),
    ...(f.status ? { status: f.status } : {}),
  });
  const d = await api(`/api/admin/diagnostics/reports?${query.toString()}`);
  const csvUrl = `/api/admin/diagnostics/reports?${query.toString()}&format=csv`;

  return `
    <div class="diag-page-header">
      <div>
        <span class="diag-kicker">OPERATIONAL REPORTING & EXPORT</span>
        <h1>Báo cáo vận hành & Xuất dữ liệu</h1>
        <p>Tổng hợp kết quả kiểm tra, sự cố đáng chú ý, lỗi đã khắc phục, lỗi còn tồn tại và những hạng mục chưa cấu hình hoặc chưa kiểm tra.</p>
      </div>
      <div class="diag-header-controls">
        <button type="button" class="diag-btn diag-btn-secondary" id="diag-print-report-btn">${diagIcon('file-text')}<span>In / Lưu PDF</span></button>
        <a class="diag-btn diag-btn-primary" href="${esc(csvUrl)}" download>${diagIcon('download')}<span>Xuất CSV tiêu chuẩn</span></a>
      </div>
    </div>

    <div class="diag-filter-bar">
      <select id="diag-rep-days" aria-label="Khoảng thời gian báo cáo">
        <option value="7" ${Number(f.days) === 7 ? 'selected' : ''}>7 ngày gần nhất</option>
        <option value="30" ${Number(f.days) === 30 ? 'selected' : ''}>30 ngày gần nhất</option>
        <option value="90" ${Number(f.days) === 90 ? 'selected' : ''}>90 ngày gần nhất</option>
      </select>
      <select id="diag-rep-category" aria-label="Nhóm kiểm tra">
        <option value="">Tất cả nhóm kiểm tra</option>
        ${Object.entries(CATEGORY_LABELS)
          .filter(([k]) => k !== 'full')
          .map(([k, label]) => `<option value="${k}" ${f.category === k ? 'selected' : ''}>${esc(label)}</option>`)
          .join('')}
      </select>
      <select id="diag-rep-severity" aria-label="Mức độ nghiêm trọng">
        <option value="">Tất cả mức độ</option>
        <option value="critical" ${f.severity === 'critical' ? 'selected' : ''}>Nghiêm trọng (Critical)</option>
        <option value="high" ${f.severity === 'high' ? 'selected' : ''}>Cao (High)</option>
        <option value="medium" ${f.severity === 'medium' ? 'selected' : ''}>Trung bình (Medium)</option>
        <option value="low" ${f.severity === 'low' ? 'selected' : ''}>Thấp (Low)</option>
      </select>
      <select id="diag-rep-status" aria-label="Trạng thái sự cố">
        <option value="">Tất cả trạng thái</option>
        <option value="open" ${f.status === 'open' ? 'selected' : ''}>Đang mở (Open)</option>
        <option value="resolved" ${f.status === 'resolved' ? 'selected' : ''}>Đã khắc phục (Resolved)</option>
      </select>
    </div>

    <section class="diag-panel diag-report-sheet">
      <div class="diag-report-banner">
        <div>
          <span class="diag-kicker">BÁO CÁO TỔNG HỢP CHẨN ĐOÁN WEBSITE XANH</span>
          <h2>Phạm vi: ${d.scope?.days || 30} ngày gần nhất · Nhóm: ${esc(CATEGORY_LABELS[d.scope?.category] || 'Toàn bộ hệ thống')}</h2>
          <p>Thời điểm tạo báo cáo: ${fmtDate(d.generated_at)}</p>
        </div>
        <div class="diag-report-stats">
          <div><span>Tổng phiên chạy</span><strong>${fmtNum(d.summary?.total_runs)}</strong></div>
          <div><span>Phiên đạt</span><strong>${fmtNum(d.summary?.passed_runs)}</strong></div>
          <div><span>Sự cố còn mở</span><strong>${fmtNum(d.summary?.open_incidents)}</strong></div>
          <div><span>Đã khắc phục</span><strong>${fmtNum(d.summary?.resolved_incidents)}</strong></div>
        </div>
      </div>

      <div class="diag-two-col">
        <div>
          <h3>1. Các lỗi còn tồn tại (${(d.open_list || []).length})</h3>
          ${
            (d.open_list || []).length
              ? `<ul class="diag-report-list">
                  ${d.open_list
                    .map(
                      (i) =>
                        `<li><b>[${esc(i.incident_code)}] ${esc(i.title)}</b> (${esc(i.severity.toUpperCase())}) — Đường dẫn: <code>${esc(i.affected_url)}</code> · Tái diễn: ${i.occurrence_count} lần.</li>`
                    )
                    .join('')}
                </ul>`
              : `<p class="diag-muted-note">Không có lỗi nào đang tồn đọng trong phạm vi lọc.</p>`
          }

          <h3 style="margin-top:20px">2. Những vấn đề đã khắc phục (${(d.resolved_list || []).length})</h3>
          ${
            (d.resolved_list || []).length
              ? `<ul class="diag-report-list">
                  ${d.resolved_list
                    .map(
                      (i) =>
                        `<li><b>[${esc(i.incident_code)}] ${esc(i.title)}</b> — Đã khắc phục lúc ${fmtDate(i.resolved_at)}.</li>`
                    )
                    .join('')}
                </ul>`
              : `<p class="diag-muted-note">Chưa có sự cố nào ở trạng thái đã khắc phục trong phạm vi này.</p>`
          }
        </div>

        <div>
          <h3>3. Mục tiêu chưa kiểm tra (${(d.summary?.untested_targets || []).length})</h3>
          ${
            (d.summary?.untested_targets || []).length
              ? `<ul class="diag-report-list">
                  ${d.summary.untested_targets.map((t) => `<li><b>${esc(t.name)}</b> (<code>${esc(t.url_or_path)}</code>) — Trạng thái: Chưa kiểm tra.</li>`).join('')}
                </ul>`
              : `<p class="diag-muted-note">Toàn bộ mục tiêu giám sát đã được thực thi kiểm tra ít nhất một lần.</p>`
          }

          <h3 style="margin-top:20px">4. Hạng mục chưa cấu hình hoặc giới hạn môi trường</h3>
          <ul class="diag-report-list">
            ${(d.summary?.unconfigured_items || []).map((item) => `<li>${esc(item)}</li>`).join('')}
          </ul>
        </div>
      </div>
    </section>
  `;
}

async function renderConfigSubview(api, canWrite, user) {
  const d = await api('/api/admin/diagnostics/config');
  const cfg = d.config || {};
  const envInfo = d.environment_info || {};
  const secrets = envInfo.secrets_status || {};
  const suites = cfg.suites_enabled || {};
  const budgets = cfg.performance_budgets || {};

  return `
    <div class="diag-page-header">
      <div>
        <span class="diag-kicker">SYSTEM CONFIGURATION & GOVERNANCE</span>
        <h1>Cấu hình hệ thống & Trợ giúp kỹ thuật</h1>
        <p>Quản lý danh sách tên miền cho phép (chống SSRF), bật/tắt từng bộ kiểm tra, ngưỡng hiệu năng, chính sách lưu trữ log và tra cứu thuật ngữ.</p>
      </div>
    </div>

    <form id="diag-config-form" class="diag-config-grid">
      <section class="diag-panel">
        <h2>1. Mục tiêu giám sát & Tên miền được phép (SSRF Allowlist)</h2>
        <p class="diag-muted">Hệ thống chỉ cho phép quét các tên miền nằm trong danh sách này. Mọi địa chỉ localhost, IP nội bộ (10.x, 172.16-31.x, 192.168.x, 127.x) và cloud metadata (169.254.169.254) luôn bị chặn cứng.</p>
        <label>Danh sách tên miền được phép (cách nhau bởi dấu phẩy)
          <input name="allowed_hostnames" value="${esc((cfg.allowed_hostnames || []).join(', '))}" ${canWrite ? '' : 'disabled'} required>
        </label>
        <div class="diag-form-two">
          <label>Số tiến trình chạy đồng thời tối đa
            <input type="number" name="max_concurrent_runs" min="1" max="10" value="${Number(cfg.max_concurrent_runs || 2)}" ${canWrite ? '' : 'disabled'}>
          </label>
          <label>Timeout mặc định (ms)
            <input type="number" name="default_timeout_ms" min="1000" max="30000" step="500" value="${Number(cfg.default_timeout_ms || 8000)}" ${canWrite ? '' : 'disabled'}>
          </label>
        </div>
      </section>

      <section class="diag-panel">
        <h2>2. Bật / Tắt từng bộ kiểm tra</h2>
        <p class="diag-muted">Chọn các bộ kiểm tra được phép chạy khi thực thi kiểm tra toàn diện hoặc theo lịch.</p>
        <div class="diag-Checks-grid">
          ${Object.entries(CATEGORY_LABELS)
            .filter(([k]) => k !== 'full')
            .map(
              ([k, label]) => `
            <label class="diag-check-toggle">
              <input type="checkbox" name="suite_${k}" ${suites[k] !== false ? 'checked' : ''} ${canWrite ? '' : 'disabled'}>
              <span>${esc(label)}</span>
            </label>
          `
            )
            .join('')}
        </div>
      </section>

      <section class="diag-panel">
        <h2>3. Ngưỡng ngân sách hiệu năng & Lưu trữ lịch sử</h2>
        <p class="diag-muted">Khi kết quả đo Lab vượt ngưỡng này, hệ thống sẽ gắn cờ Cảnh báo (Warning).</p>
        <div class="diag-form-two">
          <label>Ngưỡng TTFB tối đa (ms)
            <input type="number" name="budget_ttfb_ms" min="100" max="10000" value="${Number(budgets.ttfb_ms || 800)}" ${canWrite ? '' : 'disabled'}>
          </label>
          <label>Ngưỡng LCP mục tiêu (ms)
            <input type="number" name="budget_lcp_ms" min="500" max="15000" value="${Number(budgets.lcp_ms || 2500)}" ${canWrite ? '' : 'disabled'}>
          </label>
          <label>Kích thước HTML tối đa (KB)
            <input type="number" name="budget_max_html_kb" min="20" max="5000" value="${Number(budgets.max_html_kb || 250)}" ${canWrite ? '' : 'disabled'}>
          </label>
          <label>Thời gian lưu trữ lịch sử (Ngày)
            <input type="number" name="retention_days" min="7" max="365" value="${Number(cfg.retention_days || 90)}" ${canWrite ? '' : 'disabled'}>
          </label>
        </div>
      </section>

      <section class="diag-panel">
        <h2>4. Cảnh báo Email & Trạng thái Secrets</h2>
        <p class="diag-muted">Các khóa bí mật được quản lý qua biến môi trường Cloudflare Secrets, tuyệt đối không lưu văn bản thuần trong D1 hay gửi về trình duyệt.</p>
        <label class="diag-check-toggle">
          <input type="checkbox" name="alert_email_enabled" ${cfg.alert_email_enabled ? 'checked' : ''} ${canWrite ? '' : 'disabled'}>
          <span>Cho phép gửi email cảnh báo thực tế qua Resend khi có sự cố nghiêm trọng</span>
        </label>
        <label>Email nhận cảnh báo mặc định
          <input type="email" name="alert_recipient_email" value="${esc(cfg.alert_recipient_email || 'support@skyfirst.io.vn')}" ${canWrite ? '' : 'disabled'}>
        </label>
        <div class="diag-secrets-list">
          ${Object.entries(secrets)
            .map(
              ([key, configured]) => `
            <div class="diag-secret-row">
              <code>${esc(key)}</code>
              ${configured ? '<span class="diag-badge diag-badge-passed">Đã cấu hình (Đã ẩn giá trị)</span>' : '<span class="diag-badge diag-badge-neutral">Chưa cấu hình</span>'}
            </div>
          `
            )
            .join('')}
        </div>
      </section>

      ${
        canWrite
          ? `<div class="diag-config-actions">
              <button type="submit" class="diag-btn diag-btn-primary">${diagIcon('check')}<span>Lưu cấu hình hệ thống</span></button>
            </div>`
          : ''
      }
    </form>

    <div class="diag-two-col" style="margin-top:20px">
      <section class="diag-panel">
        <h2>5. Phân quyền truy cập (RBAC)</h2>
        <p class="diag-muted">Hệ thống tích hợp trực tiếp với phiên đăng nhập của Xanh Sky First:</p>
        <ul class="diag-report-list">
          <li><b>Root Admin & Administrator:</b> Toàn quyền xem, chạy kiểm tra, thêm/sửa/xóa mục tiêu, quản lý sự cố, lập lịch và thay đổi cấu hình.</li>
          <li><b>Viewer / Auditor:</b> Quyền chỉ đọc (Read-only) để giám sát Dashboard, xem chi tiết sự cố và xuất báo cáo CSV.</li>
          <li><b>Các vai trò biên tập khác:</b> Bị chặn ở cả giao diện lẫn API backend (HTTP 403).</li>
          <li><b>Tài khoản hiện tại:</b> <b>${esc(user?.name)}</b> (${esc(user?.role)}) · Cập nhật cấu hình gần nhất: ${fmtDate(cfg.updated_at)}.</li>
        </ul>
      </section>

      <section class="diag-panel">
        <h2>6. Trợ giúp giải thích thuật ngữ kỹ thuật</h2>
        <div class="diag-glossary-list">
          ${GLOSSARY_TERMS.map((g) => `<div class="diag-glossary-item"><b>${esc(g.term)}</b><p>${esc(g.desc)}</p></div>`).join('')}
        </div>
      </section>
    </div>
  `;
}

export async function renderDiagnosticsWorkspace({ api, user, subview = 'overview' }) {
  if (subview && DIAG_NAV_GROUPS.some((g) => g.items.some((i) => i.id === subview))) {
    diagState.subview = subview;
  }
  const currentSubview = diagState.subview || 'overview';
  const navMeta = findNavMeta(currentSubview);
  const canWrite = ['root_admin', 'administrator'].includes(user?.role);

  let mainContent = '';
  try {
    if (currentSubview === 'overview') {
      mainContent = await renderOverviewSubview(api, canWrite);
    } else if (currentSubview === 'website') {
      mainContent = await renderTargetsSubview(api, canWrite, 'website');
    } else if (currentSubview === 'api') {
      mainContent = await renderTargetsSubview(api, canWrite, 'api');
    } else if (currentSubview === 'browser') {
      mainContent = await renderBrowserSubview(api, canWrite);
    } else if (['storage', 'security', 'performance', 'workflow'].includes(currentSubview)) {
      mainContent = await renderSpecializedSuiteSubview(api, canWrite, currentSubview);
    } else if (currentSubview === 'incidents') {
      mainContent = await renderIncidentsSubview(api, canWrite);
    } else if (currentSubview === 'schedules') {
      mainContent = await renderSchedulesSubview(api, canWrite);
    } else if (currentSubview === 'alerts') {
      mainContent = await renderAlertsSubview(api, canWrite);
    } else if (currentSubview === 'reports') {
      mainContent = await renderReportsSubview(api);
    } else if (currentSubview === 'config') {
      mainContent = await renderConfigSubview(api, canWrite, user);
    } else {
      mainContent = await renderOverviewSubview(api, canWrite);
    }
  } catch (err) {
    mainContent = `
      <div class="diag-error-panel" role="alert">
        ${diagIcon('alert-triangle')}
        <div>
          <h2>Không thể tải dữ liệu phân hệ "${esc(navMeta.label)}"</h2>
          <p>${esc(err?.message || 'Đã xảy ra lỗi khi kết nối tới API chẩn đoán.')}</p>
          <button type="button" class="diag-btn diag-btn-secondary" id="diag-retry-view-btn">${diagIcon('refresh')}<span>Thử tải lại</span></button>
        </div>
      </div>
    `;
  }

  return `
    <div class="diag-shell ${diagState.sidebarCollapsed ? 'is-collapsed' : ''}" data-diag-subview="${esc(currentSubview)}">
      <aside class="diag-sidebar" aria-label="Điều hướng Hệ thống Chẩn đoán XANH">
        <div class="diag-sidebar-brand">
          <img src="/assets/xanh-sky-first-logo.png" alt="XANH">
          <div class="diag-brand-text">
            <strong>XANH DIAGNOSTICS</strong>
            <small>Website Diagnostics Platform</small>
          </div>
          <button type="button" class="diag-collapse-btn" id="diag-sidebar-toggle" title="Thu gọn / Mở rộng thanh điều hướng" aria-label="Thu gọn hoặc mở rộng menu">
            ${diagIcon('sidebar')}
          </button>
        </div>

        <nav class="diag-sidebar-nav">
          ${DIAG_NAV_GROUPS.map(
            (group) => `
            <div class="diag-nav-section">
              <span class="diag-nav-group-title">${esc(group.groupLabel)}</span>
              ${group.items
                .map(
                  (item) => `
                <button type="button" class="diag-nav-item ${currentSubview === item.id ? 'active' : ''}" data-diag-nav="${item.id}" title="${esc(item.label)} — ${esc(item.desc)}" aria-current="${currentSubview === item.id ? 'page' : 'false'}">
                  ${diagIcon(item.icon)}
                  <span class="diag-nav-label">${esc(item.label)}</span>
                  ${item.id === 'incidents' && diagState.activeIncidentCount > 0 ? `<b class="diag-nav-badge">${diagState.activeIncidentCount}</b>` : ''}
                </button>
              `
                )
                .join('')}
            </div>
          `
          ).join('')}
        </nav>
      </aside>

      <div class="diag-workspace-main">
        <header class="diag-topbar">
          <nav class="diag-breadcrumb" aria-label="Breadcrumb">
            <span>XANH</span>
            <span aria-hidden="true">/</span>
            <span>${esc(navMeta.groupLabel)}</span>
            <span aria-hidden="true">/</span>
            <strong>${esc(navMeta.label)}</strong>
          </nav>

          <div class="diag-topbar-right">
            <div class="diag-Quick-jump">
              ${diagIcon('search')}
              <input type="search" id="diag-global-jump" placeholder="Chuyển nhanh tới phân hệ (VD: API, D1, Sự cố)..." aria-label="Tìm nhanh chức năng chẩn đoán">
            </div>

            <span class="diag-conn-pill" title="Trạng thái kết nối cơ sở dữ liệu D1 và bộ máy chẩn đoán">
              <i class="diag-conn-dot"></i> D1 & Engine: Sẵn sàng
            </span>

            <button type="button" class="diag-notif-btn" id="diag-notif-open-btn" aria-label="Xem sự cố đang mở">
              ${diagIcon('bell')}
              ${diagState.activeIncidentCount > 0 ? `<b>${diagState.activeIncidentCount}</b>` : ''}
            </button>

            <div class="diag-user-chip">
              <span>${esc(user?.name || 'Admin')}</span>
              <small>${esc(user?.role || '')}</small>
            </div>
          </div>
        </header>

        <main class="diag-content-area" id="diag-content-area">
          ${mainContent}
        </main>

        <footer class="diag-statusbar">
          <div>
            <b>XANH Website Diagnostics Platform v1.0</b> · Kiến trúc Cloudflare Pages Functions + D1 + R2 · PBKDF2-SHA256 (100.000 iterations)
          </div>
          <div>
            Đồng bộ dữ liệu gần nhất: <b>${fmtDate(diagState.lastSyncAt || new Date().toISOString())}</b>
          </div>
        </footer>
      </div>
    </div>
  `;
}

function buildAssertionEditorRow(rule = {}, idx = 0) {
  const fields = [
    ['status', 'Mã trạng thái HTTP'],
    ['response_time_ms', 'Thời gian phản hồi (ms)'],
    ['body', 'Nội dung phản hồi (HTML/Text)'],
    ['header:content-type', 'Header: Content-Type'],
    ['json:ok', 'JSON: Trường "ok"'],
    ['json:counters', 'JSON: Danh sách "counters"'],
    ['json:items', 'JSON: Danh sách "items"'],
    ['dom:#app', 'DOM: Phần tử #app'],
    ['dom:#font-accessibility-tools', 'DOM: Thanh công cụ cỡ chữ'],
  ];
  const ops = [
    ['equals', 'Bằng (=)'],
    ['not_equals', 'Khác (!=)'],
    ['contains', 'Chứa chuỗi'],
    ['not_contains', 'Không chứa chuỗi'],
    ['exists', 'Tồn tại (Có dữ liệu)'],
    ['is_array', 'Là danh sách (Array)'],
    ['array_length_eq', 'Số phần tử bằng'],
    ['lte', 'Nhỏ hơn hoặc bằng (<=)'],
  ];
  const isCustomField = rule.field && !fields.some(([k]) => k === rule.field);

  return `
    <div class="diag-rule-row" data-rule-idx="${idx}">
      <select class="diag-rule-field" aria-label="Trường kiểm tra">
        ${fields.map(([val, label]) => `<option value="${val}" ${rule.field === val ? 'selected' : ''}>${label}</option>`).join('')}
        ${isCustomField ? `<option value="${esc(rule.field)}" selected>${esc(rule.field)}</option>` : ''}
      </select>
      <select class="diag-rule-op" aria-label="Điều kiện so sánh">
        ${ops.map(([val, label]) => `<option value="${val}" ${rule.operator === val ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <input class="diag-rule-val" value="${esc(rule.value ?? '')}" placeholder="Giá trị kỳ vọng (VD: 200, true, Xanh...)" aria-label="Giá trị kỳ vọng">
      <button type="button" class="diag-btn diag-btn-ghost diag-rule-del" title="Xóa quy tắc">${diagIcon('trash')}</button>
    </div>
  `;
}

export function wireDiagnosticsWorkspace({ root, api, toast, makeModal, closeModal, refresh }) {
  if (!root) return;

  // Sidebar collapse
  root.querySelector('#diag-sidebar-toggle')?.addEventListener('click', () => {
    diagState.sidebarCollapsed = !diagState.sidebarCollapsed;
    root.querySelector('.diag-shell')?.classList.toggle('is-collapsed', diagState.sidebarCollapsed);
  });

  // Subview navigation
  root.querySelectorAll('[data-diag-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      diagState.subview = btn.dataset.diagNav;
      refresh();
    });
  });

  // Quick search jump
  const jumpInput = root.querySelector('#diag-global-jump');
  jumpInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = jumpInput.value.trim().toLowerCase();
      if (!q) return;
      for (const g of DIAG_NAV_GROUPS) {
        for (const item of g.items) {
          if (item.label.toLowerCase().includes(q) || item.id.includes(q)) {
            diagState.subview = item.id;
            refresh();
            return;
          }
        }
      }
      diagState.incidentFilters.q = jumpInput.value.trim();
      diagState.subview = 'incidents';
      refresh();
    }
  });

  // Notification button jumps to open incidents
  root.querySelector('#diag-notif-open-btn')?.addEventListener('click', () => {
    diagState.incidentFilters.status = 'open';
    diagState.subview = 'incidents';
    refresh();
  });

  // Retry button
  root.querySelector('#diag-retry-view-btn')?.addEventListener('click', () => refresh());

  // Range selector on Dashboard
  root.querySelectorAll('[data-diag-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      diagState.range = btn.dataset.diagRange;
      refresh();
    });
  });

  // Helper to execute a diagnostic run with live progress UI
  const runSuiteOrTarget = async ({ suite_type = 'full', target_id = null }) => {
    if (diagState.running) return;
    diagState.running = true;
    const progressEl = root.querySelector('#diag-live-progress');
    if (progressEl) progressEl.hidden = false;
    const runBtn = root.querySelector('#diag-run-now-btn');
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.innerHTML = `${diagIcon('refresh')}<span>Đang thực thi kiểm tra…</span>`;
    }
    try {
      const res = await api('/api/admin/diagnostics/run', {
        method: 'POST',
        body: { suite_type, target_id },
      });
      const r = res.run;
      toast(
        `Đã hoàn tất phiên ${r.run_uid}: ${r.passed_checks}/${r.total_checks} đạt (${r.duration_ms} ms).`,
        r.failed_checks > 0 ? 'error' : 'ok'
      );
    } catch (err) {
      toast(err.message || 'Không thể thực thi phiên kiểm tra.', 'error');
    } finally {
      diagState.running = false;
      refresh();
    }
  };

  root.querySelector('#diag-run-now-btn')?.addEventListener('click', () => {
    const suite = root.querySelector('#diag-quick-suite')?.value || 'full';
    runSuiteOrTarget({ suite_type: suite });
  });

  root.querySelectorAll('[data-diag-run-suite]').forEach((btn) => {
    btn.addEventListener('click', () => {
      runSuiteOrTarget({ suite_type: btn.dataset.diagRunSuite });
    });
  });

  root.querySelectorAll('[data-diag-run-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      runSuiteOrTarget({ target_id: Number(btn.dataset.diagRunTarget) });
    });
  });

  // Chart bar click -> open run details or incidents
  root.querySelectorAll('[data-diag-open-run]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const runUid = btn.dataset.diagOpenRun;
      const runs = (await api('/api/admin/diagnostics/runs?page_size=30')).items || [];
      const found = runs.find((r) => r.run_uid === runUid);
      if (!found) return;
      const detail = await api(`/api/admin/diagnostics/run-detail/${found.id}`);
      const m = makeModal(
        `<div class="modal-head">
          <div><span class="eyebrow">CHI TIẾT PHIÊN KIỂM TRA</span><h2>${esc(detail.run.run_uid)}</h2></div>
          <button type="button" class="icon-btn modal-close">×</button>
        </div>
        <p class="diag-muted">Thời điểm: ${fmtDate(detail.run.started_at)} · Thời lượng: ${detail.run.duration_ms || 0} ms · Kết quả: ${detail.run.passed_checks}/${detail.run.total_checks} đạt</p>
        <div class="diag-table-wrap">
          <table class="diag-table">
            <thead><tr><th>Phép kiểm tra</th><th>Đối tượng</th><th>Trạng thái</th><th>HTTP</th><th>Thời gian</th><th>Thông điệp</th></tr></thead>
            <tbody>
              ${(detail.results || [])
                .map(
                  (c) => `
                <tr>
                  <td><b>${esc(c.title)}</b></td>
                  <td><code class="diag-code">${esc(c.target_ref)}</code></td>
                  <td>${diagStatusBadge(c.status)}</td>
                  <td>${c.http_status ?? '—'}</td>
                  <td>${c.response_time_ms ?? 0} ms</td>
                  <td>${esc(c.message)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>`,
        true
      );
      m.querySelector('.modal-close').onclick = closeModal;
    });
  });

  // Filter clicks from dashboard charts
  root.querySelectorAll('[data-diag-filter-sev]').forEach((btn) => {
    btn.addEventListener('click', () => {
      diagState.incidentFilters.severity = btn.dataset.diagFilterSev;
      diagState.subview = 'incidents';
      refresh();
    });
  });
  root.querySelectorAll('[data-diag-filter-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      diagState.incidentFilters.category = btn.dataset.diagFilterCat;
      diagState.subview = 'incidents';
      refresh();
    });
  });

  // Target filters & batch selection
  const targetSearch = root.querySelector('#diag-target-search');
  targetSearch?.addEventListener('change', () => {
    diagState.targetFilters.q = targetSearch.value.trim();
    diagState.targetFilters.page = 1;
    refresh();
  });
  const targetStatus = root.querySelector('#diag-target-status');
  targetStatus?.addEventListener('change', () => {
    diagState.targetFilters.status = targetStatus.value;
    diagState.targetFilters.page = 1;
    refresh();
  });
  root.querySelector('#diag-clear-target-filters')?.addEventListener('click', () => {
    diagState.targetFilters = { q: '', status: '', page: 1 };
    refresh();
  });
  root.querySelectorAll('[data-diag-target-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      diagState.targetFilters.page = Number(btn.dataset.diagTargetPage);
      refresh();
    });
  });

  const selectAllTargets = root.querySelector('#diag-select-all-targets');
  selectAllTargets?.addEventListener('change', () => {
    root.querySelectorAll('.diag-target-check').forEach((cb) => {
      cb.checked = selectAllTargets.checked;
      const id = Number(cb.value);
      if (cb.checked) diagState.selectedTargets.add(id);
      else diagState.selectedTargets.delete(id);
    });
    const retestBtn = root.querySelector('#diag-retest-selected-btn');
    if (retestBtn) {
      retestBtn.disabled = diagState.selectedTargets.size === 0;
      retestBtn.querySelector('span').textContent = `Kiểm tra lại mục đã chọn (${diagState.selectedTargets.size})`;
    }
  });

  root.querySelectorAll('.diag-target-check').forEach((cb) => {
    cb.addEventListener('change', () => {
      const id = Number(cb.value);
      if (cb.checked) diagState.selectedTargets.add(id);
      else diagState.selectedTargets.delete(id);
      const retestBtn = root.querySelector('#diag-retest-selected-btn');
      if (retestBtn) {
        retestBtn.disabled = diagState.selectedTargets.size === 0;
        retestBtn.querySelector('span').textContent = `Kiểm tra lại mục đã chọn (${diagState.selectedTargets.size})`;
      }
    });
  });

  root.querySelector('#diag-retest-selected-btn')?.addEventListener('click', async () => {
    const ids = [...diagState.selectedTargets];
    if (!ids.length) return;
    for (const id of ids) {
      await runSuiteOrTarget({ target_id: id });
    }
    diagState.selectedTargets.clear();
    refresh();
  });

  // Target Create / Edit No-Code Modal
  const openTargetEditor = async (target = null, defaultType = 'website') => {
    const t = target || {
      name: '',
      target_type: defaultType,
      url_or_path: '/',
      method: 'GET',
      auth_type: 'none',
      expected_status: 200,
      timeout_ms: 8000,
      rate_limit_rpm: 30,
      environment: 'production',
      enabled: 1,
      assertions: [{ field: 'status', operator: 'equals', value: 200 }],
    };
    let assertions = Array.isArray(t.assertions) ? structuredClone(t.assertions) : [];

    const m = makeModal(
      `<div class="modal-head">
        <div><span class="eyebrow">TRÌNH TẠO BÀI KIỂM TRA KHÔNG CẦN VIẾT CODE</span><h2>${target ? 'Chỉnh sửa mục tiêu kiểm tra' : 'Thêm mục tiêu kiểm tra mới'}</h2></div>
        <button type="button" class="icon-btn modal-close">×</button>
      </div>
      <form id="diag-target-form">
        <div class="form-grid two">
          <label>Tên mục tiêu kiểm tra<input name="name" value="${esc(t.name)}" required placeholder="VD: Trang Đăng ký Tình nguyện viên"></label>
          <label>Nhóm kiểm tra
            <select name="target_type">
              <option value="website" ${t.target_type === 'website' ? 'selected' : ''}>Website công khai</option>
              <option value="api" ${t.target_type === 'api' ? 'selected' : ''}>Endpoint API</option>
              <option value="browser" ${t.target_type === 'browser' ? 'selected' : ''}>Giao diện Trình duyệt</option>
              <option value="performance" ${t.target_type === 'performance' ? 'selected' : ''}>Hiệu năng & WCAG 2.2</option>
            </select>
          </label>
          <label class="full">Đường dẫn hoặc URL (Chỉ cho phép tên miền thuộc quyền quản lý XANH)
            <input name="url_or_path" value="${esc(t.url_or_path)}" required placeholder="VD: /tham-gia hoặc /api/public/site">
          </label>
          <label>Phương thức HTTP
            <select name="method">
              ${['GET', 'HEAD', 'POST', 'OPTIONS'].map((mth) => `<option value="${mth}" ${t.method === mth ? 'selected' : ''}>${mth}</option>`).join('')}
            </select>
          </label>
          <label>Mã HTTP mong đợi
            <input type="number" name="expected_status" min="100" max="599" value="${Number(t.expected_status || 200)}" required>
          </label>
          <label>Thời gian chờ tối đa (Timeout ms)
            <input type="number" name="timeout_ms" min="500" max="30000" step="500" value="${Number(t.timeout_ms || 8000)}" required>
          </label>
          <label>Cơ chế xác thực an toàn
            <select name="auth_type">
              <option value="none" ${t.auth_type === 'none' ? 'selected' : ''}>Không cần xác thực (Công khai)</option>
              <option value="session" ${t.auth_type === 'session' ? 'selected' : ''}>Phiên đăng nhập Quản trị (Session Cookie)</option>
              <option value="bearer_secret" ${t.auth_type === 'bearer_secret' ? 'selected' : ''}>Bearer Token từ Cloudflare Secret</option>
              <option value="header_secret" ${t.auth_type === 'header_secret' ? 'selected' : ''}>Header Secret từ Cloudflare Secret</option>
            </select>
          </label>
          <label>Môi trường
            <select name="environment">
              <option value="production" ${t.environment === 'production' ? 'selected' : ''}>Production</option>
              <option value="staging" ${t.environment === 'staging' ? 'selected' : ''}>Staging</option>
              <option value="testing" ${t.environment === 'testing' ? 'selected' : ''}>Testing / Thử nghiệm</option>
            </select>
          </label>
          <label class="choice"><input type="checkbox" name="enabled" ${t.enabled !== 0 && t.enabled !== false ? 'checked' : ''}> Bật giám sát mục tiêu này</label>
        </div>

        <div class="diag-rules-builder">
          <div class="diag-rules-head">
            <div>
              <h3>Quy tắc xác minh phản hồi (Không cần viết code)</h3>
              <p class="diag-muted">Chọn trường dữ liệu, phép so sánh và giá trị mong đợi.</p>
            </div>
            <button type="button" class="diag-btn diag-btn-secondary diag-btn-sm" id="diag-add-rule-btn">${diagIcon('plus')}<span>Thêm điều kiện</span></button>
          </div>
          <div id="diag-rules-list"></div>
        </div>

        <div class="sticky-actions">
          <button type="button" class="btn glass modal-close2">Hủy</button>
          <button type="submit" class="btn primary">${target ? 'Lưu thay đổi' : 'Tạo mục tiêu kiểm tra'}</button>
        </div>
      </form>`,
      true
    );

    m.querySelector('.modal-close').onclick = m.querySelector('.modal-close2').onclick = closeModal;
    const rulesContainer = m.querySelector('#diag-rules-list');
    const syncRulesDom = () => {
      rulesContainer.innerHTML = assertions.length
        ? assertions.map((r, i) => buildAssertionEditorRow(r, i)).join('')
        : '<p class="diag-muted-note">Chưa có quy tắc bổ sung (Chỉ kiểm tra mã HTTP mong đợi).</p>';
      rulesContainer.querySelectorAll('.diag-rule-row').forEach((row) => {
        const idx = Number(row.dataset.ruleIdx);
        row.querySelector('.diag-rule-field').onchange = (e) => {
          assertions[idx].field = e.target.value;
        };
        row.querySelector('.diag-rule-op').onchange = (e) => {
          assertions[idx].operator = e.target.value;
        };
        row.querySelector('.diag-rule-val').oninput = (e) => {
          const raw = e.target.value;
          assertions[idx].value = raw === 'true' ? true : raw === 'false' ? false : /^-?\d+$/.test(raw) ? Number(raw) : raw;
        };
        row.querySelector('.diag-rule-del').onclick = () => {
          assertions.splice(idx, 1);
          syncRulesDom();
        };
      });
    };
    syncRulesDom();

    m.querySelector('#diag-add-rule-btn').onclick = () => {
      assertions.push({ field: 'status', operator: 'equals', value: 200 });
      syncRulesDom();
    };

    m.querySelector('#diag-target-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        name: fd.get('name'),
        target_type: fd.get('target_type'),
        url_or_path: fd.get('url_or_path'),
        method: fd.get('method'),
        expected_status: Number(fd.get('expected_status') || 200),
        timeout_ms: Number(fd.get('timeout_ms') || 8000),
        auth_type: fd.get('auth_type'),
        environment: fd.get('environment'),
        enabled: fd.has('enabled'),
        assertions,
      };
      try {
        if (target) {
          await api(`/api/admin/diagnostics/target/${target.id}`, { method: 'PUT', body: payload });
          toast('Đã cập nhật mục tiêu kiểm tra.');
        } else {
          await api('/api/admin/diagnostics/targets', { method: 'POST', body: payload });
          toast('Đã thêm mục tiêu kiểm tra mới.');
        }
        closeModal();
        refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  };

  root.querySelector('#diag-add-target-btn')?.addEventListener('click', (e) => {
    openTargetEditor(null, e.currentTarget.dataset.targetType || 'website');
  });

  root.querySelectorAll('[data-diag-edit-target]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const d = await api(`/api/admin/diagnostics/target/${btn.dataset.diagEditTarget}`);
      openTargetEditor(d.item);
    });
  });

  root.querySelectorAll('[data-diag-del-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.diagDelTarget;
      const name = btn.dataset.targetName;
      const m = makeModal(
        `<div class="modal-head"><h2>Xác nhận xóa mục tiêu giám sát</h2><button type="button" class="icon-btn modal-close">×</button></div>
         <p>Bạn có chắc chắn muốn xóa mục tiêu <b>"${esc(name)}"</b> khỏi danh sách giám sát?</p>
         <div class="sticky-actions">
           <button type="button" class="btn glass modal-close2">Hủy</button>
           <button type="button" class="btn danger" id="diag-confirm-del-target">Xác nhận xóa</button>
         </div>`
      );
      m.querySelector('.modal-close').onclick = m.querySelector('.modal-close2').onclick = closeModal;
      m.querySelector('#diag-confirm-del-target').onclick = async () => {
        try {
          await api(`/api/admin/diagnostics/target/${id}`, { method: 'DELETE' });
          closeModal();
          toast('Đã xóa mục tiêu giám sát.');
          refresh();
        } catch (err) {
          toast(err.message, 'error');
        }
      };
    });
  });

  // Target 5-Tab Detail Modal (Tổng quan, Lịch sử, Endpoint liên quan, Lỗi, Cấu hình)
  root.querySelectorAll('[data-diag-view-target]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const d = await api(`/api/admin/diagnostics/target/${btn.dataset.diagViewTarget}`);
      const t = d.item;
      const history = d.history || [];
      const incidents = d.incidents || [];
      const m = makeModal(
        `<div class="modal-head">
          <div><span class="eyebrow">CHI TIẾT MỤC TIÊU GIÁM SÁT</span><h2>${esc(t.name)}</h2></div>
          <button type="button" class="icon-btn modal-close">×</button>
        </div>
        <div class="diag-tabs-bar" role="tablist">
          <button type="button" class="diag-tab-btn active" data-tab="overview">1. Tổng quan</button>
          <button type="button" class="diag-tab-btn" data-tab="history">2. Lịch sử (${history.length})</button>
          <button type="button" class="diag-tab-btn" data-tab="incidents">3. Lỗi liên quan (${incidents.length})</button>
          <button type="button" class="diag-tab-btn" data-tab="config">4. Cấu hình & Quy tắc</button>
        </div>
        <div class="diag-tab-pane" data-pane="overview">
          <div class="diag-form-two">
            <div><b>Đường dẫn:</b> <code class="diag-code">${esc(t.url_or_path)}</code></div>
            <div><b>Hostname:</b> ${esc(t.hostname)}</div>
            <div><b>Trạng thái gần nhất:</b> ${diagStatusBadge(t.last_status)}</div>
            <div><b>HTTP Status / Thời gian:</b> ${t.last_http_status ?? '—'} · ${t.last_response_time_ms ?? '—'} ms</div>
            <div><b>Lần kiểm tra gần nhất:</b> ${fmtDate(t.last_checked_at)}</div>
            <div><b>Môi trường:</b> ${esc(t.environment)}</div>
          </div>
        </div>
        <div class="diag-tab-pane" data-pane="history" hidden>
          <div class="diag-table-wrap">
            <table class="diag-table">
              <thead><tr><th>Thời gian</th><th>Trạng thái</th><th>HTTP</th><th>Độ trễ</th><th>Thông điệp</th></tr></thead>
              <tbody>
                ${
                  history.length
                    ? history
                        .map(
                          (h) =>
                            `<tr><td>${fmtDate(h.created_at)}</td><td>${diagStatusBadge(h.status)}</td><td>${h.http_status ?? '—'}</td><td>${h.response_time_ms ?? 0} ms</td><td>${esc(h.message)}</td></tr>`
                        )
                        .join('')
                    : `<tr><td colspan="5" class="diag-empty-cell">Chưa có lịch sử kiểm tra.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="diag-tab-pane" data-pane="incidents" hidden>
          ${
            incidents.length
              ? incidents.map((inc) => `<div class="diag-mini-row"><div><b>[${esc(inc.incident_code)}] ${esc(inc.title)}</b><small>${fmtDate(inc.last_seen_at)}</small></div>${diagStatusBadge(inc.status)}</div>`).join('')
              : `<p class="diag-muted-note">Không có sự cố nào gắn với đường dẫn này.</p>`
          }
        </div>
        <div class="diag-tab-pane" data-pane="config" hidden>
          <pre>${esc(JSON.stringify({ method: t.method, auth_type: t.auth_type, timeout_ms: t.timeout_ms, expected_status: t.expected_status, assertions: t.assertions }, null, 2))}</pre>
        </div>`,
        true
      );
      m.querySelector('.modal-close').onclick = closeModal;
      m.querySelectorAll('.diag-tab-btn').forEach((tb) => {
        tb.onclick = () => {
          m.querySelectorAll('.diag-tab-btn').forEach((x) => x.classList.toggle('active', x === tb));
          m.querySelectorAll('.diag-tab-pane').forEach((p) => {
            p.hidden = p.dataset.pane !== tb.dataset.tab;
          });
        };
      });
    });
  });

  // Incident filters & 9-Section Detail Modal
  root.querySelector('#diag-inc-search')?.addEventListener('change', (e) => {
    diagState.incidentFilters.q = e.target.value.trim();
    diagState.incidentFilters.page = 1;
    refresh();
  });
  root.querySelector('#diag-inc-severity')?.addEventListener('change', (e) => {
    diagState.incidentFilters.severity = e.target.value;
    diagState.incidentFilters.page = 1;
    refresh();
  });
  root.querySelector('#diag-inc-status')?.addEventListener('change', (e) => {
    diagState.incidentFilters.status = e.target.value;
    diagState.incidentFilters.page = 1;
    refresh();
  });
  root.querySelector('#diag-inc-category')?.addEventListener('change', (e) => {
    diagState.incidentFilters.category = e.target.value;
    diagState.incidentFilters.page = 1;
    refresh();
  });
  root.querySelector('#diag-clear-inc-filters')?.addEventListener('click', () => {
    diagState.incidentFilters = { q: '', status: '', severity: '', category: '', page: 1 };
    refresh();
  });
  root.querySelectorAll('[data-diag-inc-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      diagState.incidentFilters.page = Number(btn.dataset.diagIncPage);
      refresh();
    });
  });

  // Open 9-Part Incident Detail Modal
  root.querySelectorAll('[data-diag-open-incident]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.diagOpenIncident);
      const d = await api(`/api/admin/diagnostics/incident/${id}`);
      const inc = d.item;
      const timeline = d.timeline || [];
      const assignees = d.assignees || [];

      const m = makeModal(
        `<div class="modal-head">
          <div>
            <span class="eyebrow">HỒ SƠ CHẨN ĐOÁN SỰ CỐ · ${esc(inc.incident_code)}</span>
            <h2>1. ${esc(inc.title)}</h2>
          </div>
          <button type="button" class="icon-btn modal-close">×</button>
        </div>

        <div class="diag-inc-detail-meta">
          ${diagSeverityBadge(inc.severity)}
          ${diagStatusBadge(inc.status)}
          <span>Thành phần: <b>${esc(inc.affected_component)}</b></span>
          <span>URL: <code>${esc(inc.affected_url)}</code></span>
          <span>Mã tương quan: <code>${esc(inc.correlation_id)}</code></span>
          <span>Tái diễn: <b>${inc.occurrence_count} lần</b> (Mở lại: ${inc.reopened_count})</span>
        </div>

        <div class="diag-inc-sections">
          <section class="diag-inc-box">
            <h3>3. Tóm tắt tác động & Giải thích dễ hiểu (Dành cho Quản trị viên)</h3>
            <p><b>Giải thích:</b> ${esc(inc.plain_explanation)}</p>
            <p><b>Ảnh hưởng dự kiến:</b> ${esc(inc.impact_summary)}</p>
          </section>

          <section class="diag-inc-box">
            <h3>6. Phân tích Nguyên nhân (Tách biệt Bằng chứng Xác minh & Giả thuyết)</h3>
            <div class="diag-cause-split">
              <div class="diag-cause-verified">
                <b>Nguyên nhân đã xác minh (Có bằng chứng trực tiếp):</b>
                <p>${esc(inc.verified_cause || 'Chưa có kết luận tuyệt đối; cần kiểm tra thêm từ bằng chứng kỹ thuật.')}</p>
              </div>
              <div class="diag-cause-hypothesis">
                <b>Giả thuyết kỹ thuật (Dấu hiệu gián tiếp):</b>
                <p>${esc(inc.hypothesis_cause || 'Không có giả thuyết bổ sung.')}</p>
              </div>
            </div>
          </section>

          <section class="diag-inc-box">
            <h3>7. Hướng xử lý đề xuất & Mức độ rủi ro</h3>
            <ol class="diag-remediation-list">
              ${(inc.remediation_steps || [])
                .map(
                  (s) => `
                <li>
                  <div>
                    <b>Bước ${s.step}: ${esc(s.action)}</b>
                    <span class="diag-risk-pill">Rủi ro: ${esc(s.risk_level || 'Thấp')}</span>
                  </div>
                  <small>${esc(s.note || '')}</small>
                </li>
              `
                )
                .join('')}
            </ol>
          </section>

          <section class="diag-inc-box">
            <h3>8. Hướng dẫn kiểm tra lại (Re-test)</h3>
            <p>${esc(inc.retest_guide)}</p>
            <button type="button" class="diag-btn diag-btn-primary" id="diag-inc-retest-btn">
              ${diagIcon('refresh')}<span>Chạy kiểm tra lại ngay ( Tự động đóng nếu Đạt )</span>
            </button>
          </section>

          <section class="diag-inc-box">
            <h3>4. Bằng chứng kỹ thuật (Dành cho Kỹ sư · Đã tự động che bí mật)</h3>
            <pre class="diag-evidence-pre">${esc(JSON.stringify(inc.evidence || {}, null, 2))}</pre>
          </section>

          <div class="diag-two-col">
            <section class="diag-inc-box">
              <h3>2 & 9. Cập nhật Trạng thái xử lý & Người phụ trách</h3>
              <form id="diag-inc-update-form">
                <label>Trạng thái xử lý
                  <select name="status">
                    ${[
                      ['open', 'Mới phát hiện (Open)'],
                      ['investigating', 'Đang điều tra (Investigating)'],
                      ['fixing', 'Đang khắc phục (Fixing)'],
                      ['retesting', 'Chờ kiểm tra lại (Retesting)'],
                      ['resolved', 'Đã khắc phục (Resolved)'],
                      ['ignored', 'Bỏ qua (Ignored)'],
                    ]
                      .map(([val, label]) => `<option value="${val}" ${inc.status === val ? 'selected' : ''}>${label}</option>`)
                      .join('')}
                  </select>
                </label>
                <label>Người phụ trách
                  <select name="assignee_id">
                    <option value="">— Chưa phân công —</option>
                    ${assignees.map((u) => `<option value="${u.id}" ${Number(inc.assignee_id) === Number(u.id) ? 'selected' : ''}>${esc(u.name)} (${esc(u.role)})</option>`).join('')}
                  </select>
                </label>
                <label>Cập nhật nguyên nhân đã xác minh (nếu có)
                  <input name="verified_cause" value="${esc(inc.verified_cause || '')}">
                </label>
                <label>Ghi chú xử lý
                  <textarea name="note" rows="2" placeholder="Ghi lại thao tác đã thực hiện..."></textarea>
                </label>
                <button type="submit" class="btn primary">Lưu trạng thái sự cố</button>
              </form>
            </section>

            <section class="diag-inc-box">
              <h3>5. Timeline diễn biến & Nhật ký trạng thái</h3>
              <div class="diag-timeline-list">
                ${timeline
                  .map(
                    (ev) => `
                  <div class="diag-timeline-item">
                    <div><b>${esc(ev.event_type)}</b> · <span>${fmtDate(ev.created_at)}</span></div>
                    <p>${esc(ev.old_status || '—')} → <b>${esc(ev.new_status || '—')}</b> (${esc(ev.actor_name || 'Hệ thống')})</p>
                    ${ev.note ? `<small>${esc(ev.note)}</small>` : ''}
                  </div>
                `
                  )
                  .join('')}
              </div>
            </section>
          </div>
        </div>`,
        true
      );

      m.querySelector('.modal-close').onclick = closeModal;
      m.querySelector('#diag-inc-retest-btn').onclick = async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        b.innerHTML = `${diagIcon('refresh')}<span>Đang kiểm tra lại…</span>`;
        try {
          const r = await api(`/api/admin/diagnostics/incident/${id}/retest`, { method: 'POST', body: {} });
          toast(
            r.incident?.status === 'resolved'
              ? `Phép kiểm tra lại ĐẠT! Sự cố ${inc.incident_code} đã tự động chuyển sang Đã khắc phục.`
              : `Đã chạy kiểm tra lại nhưng lỗi vẫn còn tồn tại.`,
            r.incident?.status === 'resolved' ? 'ok' : 'error'
          );
          closeModal();
          refresh();
        } catch (err) {
          b.disabled = false;
          toast(err.message, 'error');
        }
      };

      m.querySelector('#diag-inc-update-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await api(`/api/admin/diagnostics/incident/${id}`, {
            method: 'PUT',
            body: {
              status: fd.get('status'),
              assignee_id: fd.get('assignee_id') ? Number(fd.get('assignee_id')) : null,
              verified_cause: fd.get('verified_cause'),
              note: fd.get('note'),
            },
          });
          toast('Đã cập nhật trạng thái sự cố.');
          closeModal();
          refresh();
        } catch (err) {
          toast(err.message, 'error');
        }
      };
    });
  });

  // Schedules CRUD & Trigger
  root.querySelector('#diag-new-schedule-btn')?.addEventListener('click', () => {
    const m = makeModal(
      `<div class="modal-head">
        <div><span class="eyebrow">LẬP LỊCH GIÁM SÁT TỰ ĐỘNG</span><h2>Tạo lịch kiểm tra mới</h2></div>
        <button type="button" class="icon-btn modal-close">×</button>
      </div>
      <form id="diag-sched-form">
        <div class="form-grid two">
          <label class="full">Tên lịch kiểm tra<input name="name" required placeholder="VD: Kiểm tra định kỳ API & D1 mỗi 10 phút"></label>
          <label>Bộ kiểm tra
            <select name="suite_type">
              ${Object.entries(CATEGORY_LABELS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}
            </select>
          </label>
          <label>Chu kỳ lặp lại (phút)
            <input type="number" name="interval_minutes" min="1" max="1440" value="15" required>
          </label>
          <label>Khung giờ bắt đầu<input type="time" name="active_window_start" value="00:00"></label>
          <label>Khung giờ kết thúc<input type="time" name="active_window_end" value="23:59"></label>
          <label>Múi giờ
            <select name="timezone">
              <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (UTC+7)</option>
              <option value="UTC">UTC</option>
            </select>
          </label>
          <label>Timeout tối đa (ms)<input type="number" name="timeout_ms" min="1000" max="60000" value="15000"></label>
          <label>Số tác vụ đồng thời tối đa<input type="number" name="max_concurrency" min="1" max="10" value="2"></label>
          <label>Số lần thử lại (Retry)<input type="number" name="retry_limit" min="0" max="5" value="2"></label>
          <label>Thời gian chờ thử lại (Backoff giây)<input type="number" name="backoff_seconds" min="5" max="3600" value="30"></label>
          <label>Ngưỡng lỗi kích hoạt cảnh báo<input type="number" name="alert_threshold" min="1" max="10" value="1"></label>
          <label class="choice"><input type="checkbox" name="enabled" checked> Kích hoạt lịch chạy ngay sau khi lưu</label>
        </div>
        <div class="sticky-actions">
          <button type="button" class="btn glass modal-close2">Hủy</button>
          <button type="submit" class="btn primary">Xác nhận & Lưu lịch chạy</button>
        </div>
      </form>`,
      true
    );
    m.querySelector('.modal-close').onclick = m.querySelector('.modal-close2').onclick = closeModal;
    m.querySelector('#diag-sched-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('/api/admin/diagnostics/schedules', {
          method: 'POST',
          body: {
            name: fd.get('name'),
            suite_type: fd.get('suite_type'),
            interval_minutes: Number(fd.get('interval_minutes') || 15),
            active_window_start: fd.get('active_window_start'),
            active_window_end: fd.get('active_window_end'),
            timezone: fd.get('timezone'),
            timeout_ms: Number(fd.get('timeout_ms') || 15000),
            max_concurrency: Number(fd.get('max_concurrency') || 2),
            retry_limit: Number(fd.get('retry_limit') || 2),
            backoff_seconds: Number(fd.get('backoff_seconds') || 30),
            alert_threshold: Number(fd.get('alert_threshold') || 1),
            enabled: fd.has('enabled'),
          },
        });
        toast('Đã tạo lịch kiểm tra tự động.');
        closeModal();
        refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  });

  root.querySelectorAll('[data-diag-trigger-schedule]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.diagTriggerSchedule;
      btn.disabled = true;
      btn.textContent = 'Đang chạy…';
      try {
        const res = await api(`/api/admin/diagnostics/schedule/${id}/trigger`, { method: 'POST', body: {} });
        toast(`Đã thực thi lịch chạy (${res.run.run_uid}): ${res.run.passed_checks}/${res.run.total_checks} đạt.`);
        refresh();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Chạy ngay';
        toast(err.message, 'error');
      }
    });
  });

  root.querySelectorAll('[data-diag-toggle-schedule]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.diagToggleSchedule;
      const currentlyEnabled = btn.dataset.enabled === '1';
      try {
        await api(`/api/admin/diagnostics/schedule/${id}`, { method: 'PUT', body: { enabled: !currentlyEnabled } });
        toast(currentlyEnabled ? 'Đã tạm dừng lịch kiểm tra.' : 'Đã bật lại lịch kiểm tra.');
        refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  root.querySelectorAll('[data-diag-del-schedule]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.diagDelSchedule;
      try {
        await api(`/api/admin/diagnostics/schedule/${id}`, { method: 'DELETE' });
        toast('Đã xóa lịch kiểm tra.');
        refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  // Alerts handlers
  root.querySelector('#diag-new-alert-btn')?.addEventListener('click', () => {
    const m = makeModal(
      `<div class="modal-head"><h2>Thêm quy tắc cảnh báo</h2><button type="button" class="icon-btn modal-close">×</button></div>
      <form id="diag-alert-form">
        <label>Tên quy tắc<input name="rule_name" required placeholder="VD: Cảnh báo lỗi Database D1"></label>
        <label>Kênh thông báo
          <select name="channel">
            <option value="email">Email (Resend)</option>
            <option value="internal">Thông báo nội bộ trên Dashboard</option>
          </select>
        </label>
        <label>Ngưỡng mức độ tối thiểu
          <select name="min_severity">
            <option value="critical">Chỉ lỗi Nghiêm trọng (Critical)</option>
            <option value="high" selected>Từ mức Cao (High) trở lên</option>
            <option value="medium">Từ mức Trung bình (Medium) trở lên</option>
          </select>
        </label>
        <label>Thời gian tạm lắng chống gửi lặp (Cooldown phút)
          <input type="number" name="cooldown_minutes" min="1" max="1440" value="30">
        </label>
        <div class="sticky-actions">
          <button type="button" class="btn glass modal-close2">Hủy</button>
          <button type="submit" class="btn primary">Lưu quy tắc</button>
        </div>
      </form>`
    );
    m.querySelector('.modal-close').onclick = m.querySelector('.modal-close2').onclick = closeModal;
    m.querySelector('#diag-alert-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('/api/admin/diagnostics/alerts', {
          method: 'POST',
          body: {
            rule_name: fd.get('rule_name'),
            channel: fd.get('channel'),
            min_severity: fd.get('min_severity'),
            cooldown_minutes: Number(fd.get('cooldown_minutes') || 30),
            enabled: true,
          },
        });
        toast('Đã tạo quy tắc cảnh báo.');
        closeModal();
        refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  });

  root.querySelectorAll('[data-diag-toggle-alert]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.diagToggleAlert;
      const enabled = btn.dataset.enabled === '1';
      try {
        await api(`/api/admin/diagnostics/alert/${id}`, { method: 'PUT', body: { enabled: !enabled } });
        toast('Đã cập nhật trạng thái quy tắc cảnh báo.');
        refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  // Report filters & Print
  root.querySelector('#diag-rep-days')?.addEventListener('change', (e) => {
    diagState.reportFilters.days = Number(e.target.value);
    refresh();
  });
  root.querySelector('#diag-rep-category')?.addEventListener('change', (e) => {
    diagState.reportFilters.category = e.target.value;
    refresh();
  });
  root.querySelector('#diag-rep-severity')?.addEventListener('change', (e) => {
    diagState.reportFilters.severity = e.target.value;
    refresh();
  });
  root.querySelector('#diag-rep-status')?.addEventListener('change', (e) => {
    diagState.reportFilters.status = e.target.value;
    refresh();
  });
  root.querySelector('#diag-print-report-btn')?.addEventListener('click', () => {
    window.print();
  });

  // System Config Save
  root.querySelector('#diag-config-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const suites_enabled = {};
    for (const k of Object.keys(CATEGORY_LABELS).filter((x) => x !== 'full')) {
      suites_enabled[k] = fd.has(`suite_${k}`);
    }
    try {
      await api('/api/admin/diagnostics/config', {
        method: 'PUT',
        body: {
          allowed_hostnames: String(fd.get('allowed_hostnames') || '').split(',').map((s) => s.trim()).filter(Boolean),
          max_concurrent_runs: Number(fd.get('max_concurrent_runs') || 2),
          default_timeout_ms: Number(fd.get('default_timeout_ms') || 8000),
          retention_days: Number(fd.get('retention_days') || 90),
          alert_email_enabled: fd.has('alert_email_enabled'),
          alert_recipient_email: fd.get('alert_recipient_email'),
          performance_budgets: {
            ttfb_ms: Number(fd.get('budget_ttfb_ms') || 800),
            lcp_ms: Number(fd.get('budget_lcp_ms') || 2500),
            max_html_kb: Number(fd.get('budget_max_html_kb') || 250),
          },
          suites_enabled,
        },
      });
      toast('Đã lưu và áp dụng cấu hình hệ thống chẩn đoán.');
      refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
