# FINAL ACCEPTANCE — Xanh Sky First

Ngày rà source: 2026-10-05.

Quy ước:
- **PASS**: có thể kiểm tra trực tiếp trong source/local runtime tại thời điểm đóng gói.
- **NOT TESTABLE LOCALLY**: phụ thuộc Cloudflare production binding, secret, domain hoặc trình duyệt production nên không tự tuyên bố PASS.
- **FAIL**: chưa đạt và không được che giấu.

## 25 tiêu chí nghiệm thu

| # | Tiêu chí | Kết quả | Kiểm tra |
|---|---|---|---|
| 1 | Build/source JavaScript không syntax error | PASS | `node --check` toàn bộ JS/MJS và test suite |
| 2 | Không syntax error | PASS | `node --check` |
| 3 | Không còn mức PBKDF2 cũ vượt 100000; PBKDF2 = 100000 | PASS | test crypto + verify script |
| 4 | Route public refresh/deep-link | NOT TESTABLE LOCALLY | `_redirects` đã cấu hình SPA fallback; cần smoke test trên Pages domain |
| 5 | Menu/Footer không dùng hash route chính | PASS | route pathname thật trong `public/app.js` |
| 6 | 5 trang pháp lý/Sitemap có nội dung thật | PASS | migration `0003` seed 5 trang CMS; `/sitemap` có UI riêng |
| 7 | Tạo người + upload ảnh + lưu photo_media_id + public profile | NOT TESTABLE LOCALLY | UI/API/R2 flow đã nối đủ; cần D1+R2 production để test end-to-end |
| 8 | Media upload thực sự đi R2 | NOT TESTABLE LOCALLY | API gọi `env.STORAGE.put`; cần binding production để xác minh |
| 9 | Form Builder tạo form mới | NOT TESTABLE LOCALLY | UI + API + schema có đủ; cần browser+D1 smoke test |
| 10 | Form public submit ghi D1 | NOT TESTABLE LOCALLY | API ghi `form_submissions`; cần D1 production |
| 11 | Hồ sơ xuất hiện trong Admin | NOT TESTABLE LOCALLY | Admin đọc `/api/admin/submissions`; cần D1 production |
| 12 | RBAC kiểm tra backend | PASS | feature/type permission enforced trong API, không chỉ ẩn menu |
| 13 | Content Editor không quản trị user | PASS | `/api/admin/users` chỉ Root Admin |
| 14 | Viewer không sửa dữ liệu | PASS | Viewer chỉ có dashboard/audit GET |
| 15 | Draft/Preview/Publish content | NOT TESTABLE LOCALLY | UI/editor/API đã có; cần browser smoke test |
| 16 | Sitemap/robots | PASS | `functions/sitemap.xml.js` động + `public/robots.txt` |
| 17 | SEO metadata | PASS | client cập nhật title/description/canonical/OG/robots; sitemap động |
| 18 | Mobile responsive | NOT TESTABLE LOCALLY | CSS breakpoints có; cần visual QA trên thiết bị/browser |
| 19 | Admin không hard-reload khi chuyển module/lưu | PASS | History API + fetch; document không reload cho thao tác chính |
| 20 | Không có `href="#"`/Coming soon trong luồng production chính | PASS | verify/search source |
| 21 | Không seed số liệu/người/dự án/thành tích giả | PASS | chỉ seed nội dung giới thiệu và chính sách; dữ liệu thực dùng empty state |
| 22 | Resend dùng `EMAIL_FROM` + `EMAIL_REPLY_TO` | PASS | backend đọc đúng tên biến production |
| 23 | Setup chỉ chạy khi chưa có Root Admin | PASS | backend kiểm tra `setupStatus()` trước insert |
| 24 | Setup không tạo Root Admin thứ hai | PASS | trả 409 khi đã có Root Admin |
| 25 | Password PBKDF2-SHA256/100000 | PASS | unit test hash/verify |

## Bổ sung production-hardening đã làm

- Migration `0003_production_hardening.sql` áp dụng thành công trên SQLite local sau `0001` và `0002`.
- Content revisions và page revisions.
- Private form uploads lưu R2 nhưng không expose qua `/api/media/:id`; chỉ admin có quyền hồ sơ mới tải được.
- Submission timeline + status update + email tùy chọn.
- Media picker dùng chung cho ảnh người, cover form và cover/content blocks.
- Dynamic XML sitemap lấy content/profile/form/page public thật.
- Service worker cung cấp shell fallback khi mạng lỗi; admin/API không cache.
- 403/404/500 UI states.
- `prefers-reduced-motion`, focus-visible, keyboard command palette (`Ctrl/Cmd + K`).
- Reset-password dùng pathname thật `/reset-password?token=...`, không hash route.

## Những phần không được tuyên bố là đã xác minh production

Không thể từ ZIP/local source tự xác minh: secret Cloudflare, quyền R2 thật, Resend domain verification, custom domain, D1 production state, cache/CDN và hành vi browser trên mọi thiết bị. Sau deploy phải smoke-test các luồng đó trước khi coi là go-live hoàn toàn.
