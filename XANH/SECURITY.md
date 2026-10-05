# Security — Xanh Sky First

## Password hashing

**Bắt buộc:** PBKDF2-SHA256, chính xác **100,000 iterations**. Không dùng mức iteration cũ vượt 100.000 trong bất kỳ đường code nào. Hash lưu theo format:

`pbkdf2$sha256$100000$<salt-base64>$<hash-base64>`

Verify từ chối hash có iteration khác 100,000 thay vì âm thầm chạy cost không được runtime hỗ trợ.

## Secrets

Không commit hoặc đóng gói `SETUP_SECRET`, `RESEND_API_KEY` hay credential khác. Đặt bằng Cloudflare secrets. Source chỉ tham chiếu `env.SETUP_SECRET` và `env.RESEND_API_KEY`.

## Sessions

Session token ngẫu nhiên 256-bit. D1 chỉ lưu SHA-256 của token. Cookie dùng `HttpOnly; Secure; SameSite=Lax`. Logout xóa session phía server. Đổi mật khẩu xóa các session khác của người dùng.

## Request protection

- Mutating requests kiểm tra same-origin khi header `Origin` hiện diện.
- Login/setup/reset/contact/newsletter/apply có rate limiting bằng D1.
- Backend RBAC kiểm tra quyền thật.
- Dữ liệu hiển thị phía client được escape; rich content chỉ render block type cho phép.
- Security headers được đặt trong `public/_headers` và JSON responses.

## Upload security

- Allowlist MIME + extension.
- Kiểm tra signature với JPEG/PNG/GIF/WebP/PDF/OOXML.
- SVG được reject nếu phát hiện `script`, inline event handler, `javascript:` hoặc `foreignObject`.
- Giới hạn 50 MB/file.
- R2 object key do server tạo, không tin filename do client cung cấp.

## First-time setup

Setup chỉ được phép khi chưa tồn tại user `root_admin`, đồng thời bắt buộc `SETUP_SECRET`. Khi Root Admin đã tồn tại, endpoint setup trả conflict và không tạo thêm Root Admin qua quy trình first-run.

## Audit

Các thao tác setup, login/logout, password changes, page/content/media/settings/user/application/impact quan trọng được ghi Audit Log.
