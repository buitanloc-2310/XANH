# Security — Xanh Sky First

## Passwords

`PBKDF2-SHA256`, exactly `100000` iterations. Không có fallback cost khác. Password hash không được log hoặc trả ra API.

## Sessions

Session token ngẫu nhiên chỉ lưu hash trong D1. Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. Đổi/reset mật khẩu thu hồi session liên quan.

## First-time Setup

`SETUP_SECRET` chỉ tồn tại dưới dạng Cloudflare secret. Setup kiểm tra chưa tồn tại Root Admin trước khi tạo và khóa sau lần khởi tạo đầu tiên.

## RBAC

Quyền được kiểm tra tại backend API. Menu Admin chỉ là lớp UX, không phải biện pháp bảo mật. Root Admin quản lý user/role. Viewer chỉ đọc dashboard/audit. Content Editor và Project Manager bị giới hạn theo content type. Volunteer Coordinator chỉ xử lý form/hồ sơ/đăng ký theo phạm vi được cấp.

## Uploads

Media upload và form upload kiểm tra size, MIME, extension và chữ ký cho các định dạng quan trọng. SVG bị chặn nếu chứa script, event handler, `javascript:` hoặc `foreignObject`. Form uploads của người dùng được lưu trong bảng `form_uploads`, không đưa vào Media Library public và chỉ download qua endpoint admin đã xác thực.

## CSRF / Origin

Unsafe methods sử dụng same-origin checks và session cookie `SameSite=Lax`. Không cho phép cross-origin form/API mutation theo cấu hình hiện tại.

## Rate limiting

Các luồng login, setup, reset password, contact, newsletter, public form submit và public form upload có rate limit lưu trong D1 theo hash IP/window.

## Secrets

Không commit `SETUP_SECRET` hoặc `RESEND_API_KEY`. Cấu hình chúng trực tiếp trên Cloudflare. `EMAIL_FROM`, `EMAIL_REPLY_TO`, `APP_URL` là biến môi trường không bí mật nhưng vẫn nên quản lý tập trung.
