# MASTER REBUILD AUDIT — Xanh Sky First

Bản kiểm tra gần nhất: 2026-10-11. Báo cáo này không thay thế nghiệm thu trên Cloudflare production.

## Phạm vi source
- Website là ứng dụng Cloudflare Pages Functions với API, D1, R2 và CMS tự xây dựng. Không phát hiện một cài đặt WordPress độc lập; “WordPress Tổng” trong UI là trung tâm dùng chung các module CMS hiện có.
- Giữ nền tảng backend/API/D1/R2/auth/RBAC hiện tại, không tạo hệ quản trị hoặc database song song.
- Dấu ấn xanh cấu hình đúng bảy thẻ đã chốt; thẻ cũ “Cộng đồng hưởng lợi” bị ẩn chứ không xóa lịch sử impact. Dữ liệu thiếu không được thay bằng số demo.
- Admin có các module trang, nội dung, điều hướng, media, giao diện, Dấu ấn xanh, form, nhật ký và các module nghiệp vụ khác. WordPress Tổng điều hướng đến các module hiện có.
- Migration `0008` dùng điều kiện dựa trên nội dung seed để tránh ghi đè trang mà Admin đã thay đổi. Các migration production phải được kiểm tra against migration ledger và schema thật trước khi apply.

## Kiểm tra gần nhất
- `npm test`: 41/41 test đạt.
- `npm run check`: production source verification đạt.
- `node --check` trên các tệp JS/MJS trong source: đạt.
- Chuỗi migration `0001`–`0009` được chạy trên SQLite local sạch: đạt. Điều này không có nghĩa migration đã được chạy trên production.

## Còn phải nghiệm thu trên production
- Cloudflare deployment / commit, D1 migration ledger/schema và backup.
- Admin login theo vai trò, lưu→đọc lại→public reload qua D1 thật.
- R2 upload/serve, form submission, email/CTT nếu bật.
- Visual QA ở zoom 100% trên desktop nhiều độ rộng, tablet và điện thoại.

Xem `FINAL_ACCEPTANCE.md`, `FINAL_AUDIT_20261011.md` và `DEPLOYMENT_STEPS.md` để biết điều kiện hoàn tất. Không tuyên bố production đã cập nhật trước khi có bằng chứng trên domain thật.
