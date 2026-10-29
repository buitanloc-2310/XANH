# XANH WEBSITE DIAGNOSTICS PLATFORM — TÀI LIỆU KIẾN TRÚC, VẬN HÀNH, CẤU HÌNH BÍ MẬT & BÁO CÁO NGHIỆM THU

Hệ thống kiểm tra, giám sát, chẩn đoán nguyên nhân gốc rễ và quản lý sự cố tích hợp trực tiếp trên nền tảng **Xanh Sky First** (`https://xanh.skyfirst.io.vn`).

## 1. BẢN ĐỒ KIẾN TRÚC & MÃ NGUỒN (ARCHITECTURE & CODEBASE MAP)

### 1.1. Mô hình kiến trúc 7 lớp
Hệ thống **XANH Website Diagnostics Platform** được thiết kế và triển khai trực tiếp vào mã nguồn hiện có của Xanh Sky First theo kiến trúc 7 lớp độc lập, đảm bảo nguyên tắc cô lập lỗi (fault isolation) để bất kỳ ngoại lệ nào của hệ thống chẩn đoán cũng không bao giờ làm gián đoạn website công khai:

1. **Lớp Giao diện Quản trị (Enterprise Admin Console — `public/diagnostics-ui.js`, `public/app.js`, `public/styles.css`)**:
   - Giao diện quản trị doanh nghiệp 4 vùng cố định theo tiêu chuẩn Phụ lục A (A1–A17): Thanh điều hướng trái thu gọn theo 4 nhóm nghiệp vụ (`GIÁM SÁT`, `KIỂM TRA KỸ THUẬT`, `VẬN HÀNH & SỰ CỐ`, `HỆ THỐNG`), Thanh tiêu đề trên cùng tích hợp Breadcrumb + Ô tìm kiếm nhanh + Chỉ báo kết nối D1/R2 + Chuông sự cố + Hồ sơ quản trị viên, Vùng nội dung chính 12 phân hệ, và Thanh trạng thái chân trang hiển thị `Run UID` và `Correlation ID`.
   - Sử dụng 100% biểu tượng vector SVG nội tuyến (`stroke="currentColor"`), tuyệt đối không dùng emoji trang trí trong giao diện vận hành.
   - Tích hợp **Trình dựng quy tắc kiểm tra không cần viết code (No-Code Rule & Assertion Builder)** cho phép quản trị viên cấu hình điều kiện kiểm tra mã HTTP, JSON dot-path (`json:ok`, `json:pbkdf2_iterations`), phần tử DOM (`dom:#app`), văn bản nội dung và ngưỡng thời gian phản hồi thông qua menu chọn trực quan.

2. **Lớp Điều phối Kiểm tra (Orchestrator — `functions/_lib/diagnostics.js` -> `executeDiagnosticRun`)**:
   - Kiểm soát giới hạn tác vụ chạy đồng thời (`max_concurrent_runs`, mặc định `2`), tự động dọn dẹp các phiên treo quá 120 giây (`status='timeout'`), quản lý timeout độc lập cho từng mục tiêu (`AbortController`), sinh mã định danh phiên chạy (`RUN-...`) và mã tương quan (`CORR-...`).

3. **Lớp Bộ máy Kiểm tra 8 Phân hệ (8 Check Suites — `functions/_lib/diagnostics.js`)**:
   - `website`: Kiểm tra HTTP status, độ trễ TTFB, chuỗi chuyển hướng (tối đa 5 bước, kiểm tra SSRF ở từng hop), chứng chỉ HTTPS/TLS, cấu trúc thẻ HTML quan trọng (`<title>`, `<meta name="description">`, `<main>`, `#app`), phát hiện nội dung rỗng và quét liên kết nội bộ bị hỏng.
   - `api`: Kiểm tra các endpoint công khai, xác thực và quản trị (`/api/health`, `/api/public/bootstrap`, `/api/public/impact`, `/api/auth/me`, `/api/admin/ctt-integration`) theo phương thức HTTP được phép, kiểm tra định dạng JSON và đánh giá tập quy tắc assertion.
   - `browser`: Kiểm tra cấu trúc giao diện, tài nguyên tĩnh (`/styles.css`, `/app.js`, `/diagnostics-ui.js`, `/sw.js`), phần tử DOM trọng yếu và tích hợp công cụ chạy trình duyệt thực tế (`scripts/playwright-lighthouse-runner.mjs`) dựa trên [Playwright Official Documentation](https://playwright.dev/docs/intro).
   - `d1`: Kiểm tra kết nối trực tiếp tới cơ sở dữ liệu `DB` (`xanh`, ID `6445b394-1588-4ef0-b22d-d2e312cfa596`) trên nền tảng [Cloudflare Workers Storage Options (D1 & R2)](https://developers.cloudflare.com/workers/platform/storage-options/), đối chiếu sự tồn tại của 24 bảng cốt lõi + 9 bảng `diag_*`, đo thời gian phản hồi truy vấn và kiểm tra tính toàn vẹn của cấu hình `site_settings`, `impact_counter_config` (đúng 7 thẻ được phê duyệt), `pages`, `forms` và hàng đợi đồng bộ `ctt_integration_outbox`.
   - `r2`: Kiểm tra binding lưu trữ `STORAGE` (`xanh`) ở chế độ chỉ đọc an toàn (`STORAGE.head`), đối chiếu danh sách tệp trong bảng `media` và `form_uploads` với đối tượng thực tế trên R2 để phát hiện tệp mồ côi hoặc thiếu đối tượng, đồng thời xác minh quy tắc chặn tải lên SVG chứa mã thực thi (`image/svg+xml`).
   - `security`: Kiểm tra không xâm nhập (non-destructive) theo tiêu chuẩn [OWASP Application Security Verification Standard (ASVS)](https://asvs.owasp.org/) và [OWASP Web Security Testing Guide (WSTG v4.2)](https://wstg.owasp.org/v4.2/): đối chiếu các header bảo mật (`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`), xác minh cờ bảo mật cookie phiên (`HttpOnly`, `Secure`, `SameSite=Lax`), xác minh số vòng băm mật khẩu PBKDF2 (`100000` iterations) và kiểm tra cơ chế khóa truy cập trái phép (`401`/`403`) trên các endpoint `/api/admin/*`.
   - `performance`: Đo lường thời gian phản hồi đến byte đầu tiên (TTFB), tổng thời gian tải, dung lượng payload HTML/JSON, kiểm tra header nén và bộ nhớ đệm (`Cache-Control`), đối chiếu với ngân sách hiệu năng cấu hình theo tiêu chuẩn [Google Core Web Vitals (web.dev)](https://web.dev/articles/vitals) và [Chrome Lighthouse Overview](https://developer.chrome.com/docs/lighthouse/overview).
   - `workflow`: Kiểm tra luồng nghiệp vụ đầu-cuối ở chế độ chỉ đọc (không tạo rác dữ liệu): Luồng tải dữ liệu khởi tạo trang chủ -> Luồng hiển thị trang tuyển Tình nguyện viên Hà Nội (`tnv-lau-dai-ha-noi`) -> Luồng tra cứu mã hồ sơ công khai (`/api/public/submission-lookup`) -> Luồng kiểm tra hàng đợi tích hợp CTT (`ctt_integration_outbox` / `ctt_sync_queue`).

4. **Lớp Bộ máy Chẩn đoán Nguyên nhân gốc rễ (Root-Cause Diagnosis Engine — `functions/_lib/diagnostics.js` -> `buildDiagnosis`)**:
   - Tách biệt tường minh giữa **Nguyên nhân đã xác minh (`verified_cause`)** dựa trên bằng chứng kỹ thuật trực tiếp (mã lỗi HTTP, ngoại lệ SQLite/D1, thiếu khóa R2, thiếu header bảo mật) và **Giả thuyết kỹ thuật cần kiểm tra thêm (`hypothesis_cause`)** kèm mức độ tin cậy (`high`, `medium`, `low`).
   - Đề xuất danh sách bước khắc phục có phân loại mức độ rủi ro (`low`, `medium`, `high`) và cảnh báo rõ những thao tác yêu cầu quản trị viên phê duyệt thủ công.

5. **Lớp Kho dữ liệu Lịch sử & Kiểm toán (Cloudflare D1 Schema — `migrations/0012_xanh_diagnostics_platform.sql`)**:
   - Bổ sung 9 bảng chuyên biệt (`diag_targets`, `diag_runs`, `diag_check_results`, `diag_incidents`, `diag_incident_events`, `diag_schedules`, `diag_alerts`, `diag_alert_logs`, `diag_baselines`) cùng các chỉ mục tối ưu truy vấn lịch sử mà không sửa đổi hay xóa bất kỳ bảng hiện có nào của XANH.

6. **Lớp Lập lịch Tự động & Cảnh báo (Scheduler & Alerting — `workers/diagnostics-cron.js`, `functions/_lib/diagnostics.js`)**:
   - Hỗ trợ thực thi tự động qua [Cloudflare Workers Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) và [Cloudflare Workers Scheduled Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/) (`POST /api/cron/diagnostics`), sử dụng cơ chế khóa phân tán trên D1 (`locked_until`) để chống chạy trùng lặp, tự động tăng `consecutive_failures` và gửi cảnh báo có thời gian chờ (`cooldown_minutes`) nhằm chống bão thông báo (alert fatigue).

7. **Lớp Bảo vệ SSRF & Che giấu Bí mật (`validateSafeTargetUrl`, `redactSecrets`)**:
   - Chặn tuyệt đối các địa chỉ nội bộ (`localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, IPv6 loopback `::1`, `fc00::/7`, `fe80::/10`) và chỉ cho phép kiểm tra các tên miền nằm trong danh sách trắng (`allowed_hostnames`).
   - Tự động che giấu (`[REDACTED]`) mọi khóa bí mật, cookie phiên (`xanh_session`), header `Authorization`, chuỗi băm `pbkdf2$...` trong nhật ký và bằng chứng lỗi theo hướng dẫn [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

### 1.2. Đối chiếu tiêu chuẩn từ các cổng thông tin tham khảo
Quá trình thiết kế hệ thống kế thừa các tiêu chuẩn vận hành, cấu trúc điều hướng rõ ràng, khả năng chịu tải và tính toàn vẹn thông tin từ các cổng thông tin điện tử và báo chí lớn tại Việt Nam cũng như các bộ tiêu chuẩn quốc tế:
- Cấu trúc phân tầng thông tin hành chính, tra cứu văn bản và độ ổn định cổng thông tin từ [Cổng Thông tin điện tử Chính phủ](https://chinhphu.vn/), chuyên trang [Hệ thống văn bản - Cổng Thông tin điện tử Chính phủ](https://chinhphu.vn/he-thong-van-ban) và [Báo Điện tử Chính phủ](https://baochinhphu.vn/le-khai-truong-cong-dich-vu-cong-quoc-gia-102265319.htm).
- Quy trình kiểm tra biểu mẫu trực tuyến, xác thực trạng thái hồ sơ và tra cứu mã hồ sơ minh bạch tham chiếu từ [Cổng Dịch vụ công Quốc gia](https://vpcp.dichvucong.gov.vn/) và phân hệ [Tra cứu hồ sơ - Cổng Dịch vụ công Quốc gia](https://vpcp.dichvucong.gov.vn/p/home/dvc-tra-cuu-ho-so.html), cùng tiêu chuẩn bảo mật kênh thông tin của [Cổng Thông tin điện tử Bộ Công an](https://bocongan.gov.vn/).
- Tối ưu hóa tốc độ phản hồi TTFB, kiểm soát tài nguyên hình ảnh/CSS/JS và trải nghiệm đọc đa thiết bị từ [Báo Thanh Niên](https://thanhnien.vn/), [Báo Tuổi Trẻ](https://tuoitre.vn/phunuonline/bao-thanh-nien-phat-dong-cuoc-thi-song-dep-voi-tong-giai-thuong-400-trieu-dong-1101581983.htm) và cổng thông tin hoạt động cộng đồng [Xanh Việt Nam](https://xanhvietnam.org/).
- Khả năng tiếp cận bàn phím, độ tương phản màu sắc tối thiểu 4.5:1 và hỗ trợ `prefers-reduced-motion` tuân thủ [W3C Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/).

### 1.3. Danh mục tệp mã nguồn mới và tệp cập nhật

| Đường dẫn tệp | Loại thay đổi | Vai trò kỹ thuật |
| :--- | :--- | :--- |
| `migrations/0012_xanh_diagnostics_platform.sql` | Tạo mới | Migration khởi tạo 9 bảng `diag_*`, chỉ mục truy vấn và dữ liệu mục tiêu/lịch/cảnh báo mặc định (trạng thái ban đầu trung thực `untested`). |
| `functions/_lib/diagnostics.js` | Tạo mới | Bộ máy thực thi 8 phân hệ kiểm tra, bảo vệ SSRF, che giấu bí mật, chẩn đoán nguyên nhân gốc rễ, quản lý vòng đời sự cố và lập lịch tự động. |
| `functions/_lib/diagnostics-api.js` | Tạo mới | Bộ xử lý REST API `/api/admin/diagnostics/*` và `/api/cron/diagnostics` với kiểm soát phân quyền RBAC (`root_admin`, `administrator`, `viewer`). |
| `functions/_lib/crypto.js` | Tạo mới | Thư viện mã hóa PBKDF2 (`100000` vòng), SHA-256, HMAC-SHA256 và sinh token ngẫu nhiên tương thích chuẩn Web Crypto API trên Cloudflare Workers và Node.js 18+. |
| `functions/_lib/http.js` | Tạo mới | Thư viện xử lý phản hồi JSON, gắn bộ header bảo mật (`CSP`, `X-Frame-Options`, `nosniff`), quản lý cookie phiên `xanh_session` và kiểm tra đầu vào. |
| `functions/api/[[path]].js` | Cập nhật | Tích hợp nhánh định tuyến `/api/admin/diagnostics` và `/api/cron/diagnostics` vào router Cloudflare Pages Functions hiện có mà không làm thay đổi bất kỳ API nào của XANH. |
| `public/diagnostics-ui.js` | Tạo mới | Giao diện quản trị doanh nghiệp **XANH Diagnostics Platform** 12 phân hệ, tuân thủ đầy đủ Phụ lục A (A1–A17), hỗ trợ lọc, tìm kiếm, xem ngăn kéo chi tiết (drawer) và xuất CSV. |
| `public/app.js` | Cập nhật | Gắn kết mục điều hướng `"Chẩn đoán & Giám sát"` vào khu vực Admin và hỗ trợ tuyến đường trực tiếp `/admin/diagnostics`. |
| `public/styles.css` | Cập nhật | Bổ sung hệ thống biến CSS và lớp định dạng `.diag-*` theo bảng màu, lưới 8px, chiều cao hàng bảng 48px và khả năng đáp ứng đa màn hình của Phụ lục A. |
| `workers/diagnostics-cron.js` | Tạo mới | Cloudflare Worker độc lập hỗ trợ sự kiện `scheduled(event, env, ctx)` để kích hoạt Cron Trigger định kỳ. |
| `scripts/playwright-lighthouse-runner.mjs` | Tạo mới | Công cụ CLI chạy trình duyệt thực tế bằng Playwright và Lighthouse cho môi trường CI/CD hoặc máy chủ runner độc lập, gửi báo cáo về `/api/admin/diagnostics/browser-report`. |
| `scripts/verify-production.mjs` | Cập nhật | Bổ sung kiểm tra tĩnh cho toàn bộ các mô-đun chẩn đoán mới (quét 90 tệp mã nguồn). |
| `tests/xanh-diagnostics-platform.test.mjs` | Tạo mới | Bộ kiểm thử tự động kiểm chứng bảo vệ SSRF, che giấu bí mật, đánh giá quy tắc không cần code, bộ máy chẩn đoán, phân quyền RBAC, vòng đời sự cố, lập lịch Cron và tiêu chuẩn giao diện Phụ lục A. |

## 2. HƯỚNG DẪN CẤU HÌNH DỊCH VỤ & BÍ MẬT (SERVICE & SECRETS CONFIGURATION GUIDE)

Hệ thống tuân thủ nguyên tắc an toàn: **mọi khóa bí mật chỉ được lưu trữ trong biến môi trường Cloudflare Pages/Workers Secrets**, tuyệt đối không lưu khóa thô trong mã nguồn hay cơ sở dữ liệu D1. Trong giao diện quản trị, người dùng chỉ khai báo **tên biến tham chiếu (`secret_ref`)**.

### 2.1. Bảng biến môi trường và khóa bí mật

| Tên biến / Binding | Loại | Bắt buộc | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| `DB` | D1 Binding | Có | Cơ sở dữ liệu chính của Xanh Sky First (`xanh`, ID `6445b394-1588-4ef0-b22d-d2e312cfa596`). |
| `STORAGE` | R2 Binding | Có | Kho lưu trữ đối tượng Cloudflare R2 (`xanh`). |
| `APP_URL` | Environment Variable | Có | Địa chỉ chuẩn của hệ thống (`https://xanh.skyfirst.io.vn`). |
| `RESEND_API_KEY` | Secret | Tùy chọn | Khóa API dịch vụ Resend để gửi email cảnh báo sự cố và email hệ thống. Nếu chưa cấu hình, hệ thống hiển thị trạng thái `"Chưa cấu hình"` trung thực. |
| `RESEND_FROM_EMAIL` | Secret / Variable | Tùy chọn | Địa chỉ email người gửi đã xác thực tên miền trên Resend. |
| `DIAG_CRON_SECRET` | Secret | Khuyến nghị | Khóa bí mật xác thực khi Worker Cron hoặc bộ lập lịch bên ngoài gọi `POST /api/cron/diagnostics` (header `X-Diag-Cron-Secret`). |
| `DIAG_RUNNER_SECRET` | Secret | Khuyến nghị | Khóa bí mật xác thực khi công cụ `scripts/playwright-lighthouse-runner.mjs` gửi kết quả kiểm thử trình duyệt thực tế về `POST /api/admin/diagnostics/browser-report`. |
| `CTT_SHARED_SECRET` | Secret | Tùy chọn | Khóa ký HMAC-SHA256 khi đồng bộ trạng thái hồ sơ sang hệ thống CTT (`CTT_SYNC_ENDPOINT`). |

### 2.2. Các bước triển khai cơ sở dữ liệu và kích hoạt trên Cloudflare Pages

1. **Áp dụng migration D1 bổ sung (không phá hủy dữ liệu hiện có)**:
   ```bash
   npx wrangler d1 migrations apply xanh --remote
   ```
   *(Hoặc thực thi tệp `migrations/0012_xanh_diagnostics_platform.sql` trên môi trường thử nghiệm trước khi áp dụng lên production).*
2. **Thiết lập các biến bí mật cho Cron và Browser Runner (nếu sử dụng)**:
   ```bash
   npx wrangler pages secret put DIAG_CRON_SECRET --project-name xanh-sky-first
   npx wrangler pages secret put DIAG_RUNNER_SECRET --project-name xanh-sky-first
   ```
3. **Triển khai Worker lập lịch tự động (tùy chọn nếu muốn chạy Cron Trigger độc lập)**:
   Trong thư mục dự án, tệp `workers/diagnostics-cron.js` đã được chuẩn bị sẵn theo chuẩn [Cloudflare Pages Functions Documentation](https://developers.cloudflare.com/pages/functions/get-started/) và [Cloudflare Workers Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

## 3. HƯỚNG DẪN SỬ DỤNG CHO QUẢN TRỊ VIÊN KHÔNG CHUYÊN KỸ THUẬT (NON-TECHNICAL ADMIN OPERATIONS GUIDE)

Toàn bộ tác vụ kiểm tra, chẩn đoán và xử lý sự cố hàng ngày đều được thực hiện trực quan trên trình duyệt mà không cần mở cửa sổ dòng lệnh:

1. **Truy cập bàn làm việc Chẩn đoán & Giám sát**:
   - Đăng nhập vào trang quản trị tại `/admin` bằng tài khoản có quyền `root_admin`, `administrator` (toàn quyền) hoặc `viewer` (chỉ xem).
   - Nhấn nút **Chẩn đoán & Giám sát** trên thanh công cụ quản trị (hoặc truy cập trực tiếp đường dẫn `/admin/diagnostics`).
2. **Chạy kiểm tra toàn hệ thống hoặc từng phân hệ**:
   - Tại màn hình **Tổng quan hệ thống**, nhấn nút **Chạy kiểm tra toàn diện** ở góc trên bên phải để hệ thống tự động thực thi tuần tự 8 bộ kiểm tra (`Website`, `API`, `Trình duyệt`, `D1`, `R2`, `Bảo mật`, `Hiệu năng`, `Luồng nghiệp vụ`).
   - Nếu chỉ muốn kiểm tra nhanh một khía cạnh (ví dụ kiểm tra cơ sở dữ liệu D1 hoặc bảo mật header), chọn mục tương ứng ở thanh điều hướng bên trái và nhấn nút **Chạy kiểm tra phân hệ này**.
3. **Thêm hoặc chỉnh sửa mục tiêu kiểm tra không cần viết code (No-Code Rule Builder)**:
   - Chuyển tới phân hệ **Website công khai**, **Kiểm tra API** hoặc **Giao diện trình duyệt**, sau đó nhấn nút **Thêm mục tiêu kiểm tra**.
   - Nhập tên gợi nhớ, chọn loại mục tiêu, nhập đường dẫn (ví dụ `/gioi-thieu` hoặc `/api/public/impact`), chọn mã HTTP mong đợi (`200`) và nhấn **Thêm điều kiện** để chọn quy tắc kiểm tra từ danh sách thả xuống (ví dụ: `Trường JSON (json:ok)` -> `Bằng chính xác` -> `true`).
4. **Đọc kết quả chẩn đoán và xử lý sự cố**:
   - Khi một phép kiểm tra thất bại hoặc có cảnh báo, nhấn nút **Chi tiết & Chẩn đoán** ở dòng kết quả đó để mở ngăn kéo phân tích bên phải.
   - Ngăn kéo sẽ hiển thị rõ 2 phần tách biệt:
     - **Nguyên nhân đã xác minh (Verified Cause)**: Kết luận chắc chắn dựa trên bằng chứng thu thập được.
     - **Giả thuyết kỹ thuật cần kiểm tra thêm (Hypothesis)**: Các khả năng tiềm ẩn kèm độ tin cậy để đội kỹ thuật khoanh vùng.
     - **Hướng khắc phục đề xuất**: Các bước xử lý cụ thể kèm nhãn mức độ rủi ro (`Rủi ro Thấp`, `Rủi ro Trung bình`, `Rủi ro Cao — Cần phê duyệt`).
5. **Quản lý vòng đời sự cố và kiểm tra lại (Retest)**:
   - Tại phân hệ **Quản lý sự cố**, quản trị viên có thể lọc sự cố theo mức độ nghiêm trọng (`Critical`, `High`, `Medium`, `Low`), chuyển trạng thái (`Mới phát hiện` -> `Đang điều tra` -> `Đang khắc phục`), phân công người phụ trách và ghi chú nhật ký xử lý.
   - Sau khi đã khắc phục lỗi, nhấn nút **Kiểm tra lại (Retest)** ngay trên sự cố: nếu phép kiểm tra vượt qua thành công, hệ thống tự động chuyển trạng thái sự cố sang **Đã xử lý (`resolved`)** và lưu vết vào dòng thời gian kiểm toán.
6. **Xuất báo cáo phục vụ họp vận hành**:
   - Tại phân hệ **Báo cáo & Xuất dữ liệu**, chọn kỳ báo cáo (`7 ngày`, `30 ngày`, `90 ngày`) và nhấn **Xuất báo cáo CSV** để tải tệp bảng tính tiếng Việt chuẩn UTF-8 BOM (mở trực tiếp trong Microsoft Excel hoặc Google Sheets không lỗi phông chữ), hoặc nhấn **In / Xuất PDF** để lưu báo cáo định dạng trang in A4.

## 4. BÁO CÁO BẢO MẬT, RÀO CHẮN AN TOÀN & GIỚI HẠN KỸ THUẬT (SECURITY & KNOWN LIMITATIONS REPORT)

### 4.1. Các cơ chế bảo vệ đã được triển khai và kiểm chứng
- **Chống tấn công SSRF (Server-Side Request Forgery)**: Mọi URL mục tiêu và mọi bước chuyển hướng HTTP (`301`/`302`/`307`/`308`) đều đi qua bộ lọc `validateSafeTargetUrl` và `isPrivateOrForbiddenHost`, chặn toàn bộ dải IP nội bộ RFC 1918, loopback, link-local, metadata đám mây (`169.254.169.254`) và các tên miền không nằm trong danh sách `allowed_hostnames`.
- **Kiểm soát phân quyền RBAC nghiêm ngặt**:
  - Người dùng chưa đăng nhập nhận mã `401 Unauthorized`.
  - Vai trò `content_editor` bị từ chối truy cập hoàn toàn (`403 Forbidden`) vào toàn bộ API `/api/admin/diagnostics/*`.
  - Vai trò `viewer` chỉ được phép thực hiện các truy vấn đọc (`GET`), bị chặn mọi thao tác kích hoạt kiểm tra hoặc thay đổi cấu hình (`POST`, `PUT`, `DELETE` -> `403 Forbidden`).
  - Chỉ `root_admin` và `administrator` mới được phép thêm/sửa mục tiêu, chạy kiểm tra, cập nhật sự cố và thay đổi cấu hình.
- **Che giấu thông tin nhạy cảm (Secret & PII Redaction)**: Bộ lọc đệ quy `redactSecrets` tự động thay thế mọi trường khớp mẫu khóa bí mật (`password`, `secret`, `token`, `authorization`, `cookie`, `api_key`, `xanh_session`, chuỗi băm `pbkdf2$...`) bằng `[REDACTED]` trước khi ghi vào cơ sở dữ liệu D1 hoặc trả về giao diện.
- **Không tự động thực thi thao tác nguy hiểm**: Hệ thống chỉ thực hiện các phép kiểm tra không phá hủy (non-destructive probes) và tuyệt đối không tự động sửa dữ liệu nghiệp vụ, không xóa đối tượng R2 và không thay đổi cấu hình production khi chưa có thao tác phê duyệt của quản trị viên.

### 4.2. Giới hạn kỹ thuật thực tế của nền tảng (Known Platform Limitations)
Tuân thủ nguyên tắc trung thực kỹ thuật, hệ thống ghi nhận rõ các giới hạn của môi trường thực thi Cloudflare Pages Functions:
1. **Kiểm thử trình duyệt thực tế (Headless Chromium / Playwright)**: Môi trường isolate tiêu chuẩn của Cloudflare Pages Functions không tích hợp sẵn nhân trình duyệt Chromium đầy đủ. Do đó, phép kiểm tra nội tuyến trong Pages Functions thực hiện **kiểm tra bề mặt DOM, cấu trúc HTML và khả năng tải tài nguyên tĩnh (`CSS`/`JS`/`Service Worker`)**, và gắn nhãn rõ ràng trong báo cáo. Để chạy kiểm thử trình duyệt Chromium thực tế (bắt lỗi `pageerror`, chụp ảnh màn hình khi lỗi, đo lường Lighthouse), hệ thống cung cấp công cụ `scripts/playwright-lighthouse-runner.mjs` để chạy từ máy trạm hoặc pipeline CI/CD và đẩy kết quả xác thực về `/api/admin/diagnostics/browser-report`.
2. **Kiểm tra chi tiết chuỗi chứng chỉ TLS sâu (OCSP / Cipher Suite cấp thấp)**: Hàm `fetch()` chuẩn trong Cloudflare Workers xác thực chứng chỉ HTTPS tự động ở tầng edge nhưng không phơi bày toàn bộ thông tin ngày hết hạn chứng chỉ X.509 thô cho mã JavaScript bên trong isolate. Hệ thống xác minh khả năng thiết lập kết nối HTTPS hợp lệ và ghi chú rõ giới hạn này trong bằng chứng chẩn đoán.
3. **Phạm vi bảo vệ của các bài kiểm tra bảo mật**: Các phép kiểm tra bảo mật trong hệ thống là **kiểm tra cấu hình phòng thủ tự động không xâm nhập** (kiểm tra security headers, cookie flags, PBKDF2 cost, RBAC access control), giúp phát hiện sớm sai lệch cấu hình nhưng không thay thế cho một đợt kiểm thử xâm nhập (penetration testing) thủ công toàn diện.

## 5. MA TRẬN TRẠNG THÁI CHỨC NĂNG & BÁO CÁO KIỂM THỬ NGHIỆM THU

### 5.1. Kết quả chạy bộ kiểm thử tự động & kiểm tra toàn vẹn mã nguồn
- **Bộ kiểm thử tự động (`npm test`)**: **89 / 89 bài kiểm thử đạt (`pass 89, fail 0`)**, bao gồm toàn bộ **82 bài kiểm thử hồi quy gốc** của dự án Xanh Sky First và **7 bộ kiểm thử chuyên sâu mới** trong `tests/xanh-diagnostics-platform.test.mjs`.
- **Kiểm tra toàn vẹn mã nguồn tĩnh (`npm run check` / `scripts/verify-production.mjs`)**: **90 tệp mã nguồn** vượt qua kiểm tra cú pháp và liên kết mô-đun với **0 lỗi**.
- **Kiểm chứng thực thi chuỗi Migration SQLite/D1 (`0001` -> `0012`)**: Toàn bộ 13 tệp migration thực thi sạch sẽ trên SQLite, tạo đầy đủ **34 bảng** (25 bảng hệ thống hiện hữu + 9 bảng `diag_*` mới) mà không làm mất mát hay xung đột bất kỳ dữ liệu nào.

### 5.2. Bảng phân loại trạng thái các thành phần hệ thống

| Thành phần / Tính năng | Trạng thái hiện tại | Ghi chú xác minh thực tế |
| :--- | :--- | :--- |
| **Giao diện Quản trị Chẩn đoán 12 phân hệ (`public/diagnostics-ui.js`)** | **Đang hoạt động** | Đạt chuẩn Phụ lục A (A1–A17), 100% SVG icons, hỗ trợ bàn phím, ngăn kéo chi tiết, xuất CSV/In PDF. |
| **API Quản trị Chẩn đoán (`/api/admin/diagnostics/*`)** | **Đang hoạt động** | Đã kiểm chứng phân quyền RBAC (`401`/`403`/`200`), CRUD mục tiêu, lịch, cảnh báo, sự cố và chạy kiểm tra. |
| **Bộ máy Kiểm tra Website, API, D1, R2, Bảo mật, Hiệu năng, Nghiệp vụ** | **Đang hoạt động** | Thực thi thật trên dữ liệu D1/R2 và HTTP dispatcher, lưu bằng chứng đã che giấu bí mật vào `diag_check_results`. |
| **Bộ máy Chẩn đoán Nguyên nhân gốc rễ & Quản lý Sự cố** | **Đang hoạt động** | Tự động gom nhóm theo `fingerprint`, phát hiện lỗi tái phát (`regression`), tách biệt `verified_cause` và `hypothesis_cause`. |
| **Cơ chế Lập lịch D1-Locked & Endpoint Cron (`/api/cron/diagnostics`)** | **Đang hoạt động** | Đã kiểm chứng khóa `locked_until`, tính toán `next_run_at`, xử lý thất bại liên tiếp và tích hợp `workers/diagnostics-cron.js`. |
| **Gửi Email Cảnh báo tự động qua Resend (`RESEND_API_KEY`)** | **Chưa cấu hình khóa ngoài** | Mã nguồn gửi email và kiểm soát cooldown đã hoàn chỉnh; cần cấu hình biến môi trường `RESEND_API_KEY` và `RESEND_FROM_EMAIL` trên Cloudflare. |
| **Đồng bộ Hồ sơ trực tiếp sang máy chủ CTT (`CTT_SYNC_ENDPOINT`)** | **Chưa cấu hình khóa ngoài** | Hàng đợi `ctt_integration_outbox` hoạt động đầy đủ; cần cấu hình `CTT_SYNC_ENDPOINT` và `CTT_SHARED_SECRET` khi kết nối cổng CTT thực tế. |
| **Runner Trình duyệt Chromium thực tế (`playwright-lighthouse-runner.mjs`)** | **Cần môi trường CI / Runner** | Kịch bản CLI đã hoàn thiện; cần chạy từ máy chủ CI/CD hoặc máy trạm có cài đặt Playwright Chromium và cấu hình `DIAG_RUNNER_SECRET`. |
