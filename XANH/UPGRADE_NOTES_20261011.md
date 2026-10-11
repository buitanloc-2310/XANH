# Ghi chú bàn giao — Xanh Sky First (11/10/2026)

## Nội dung chính

- Sửa lỗi render sitemap HTML và tách nội dung `/hanh-dong` khỏi `/gioi-thieu`.
- Cải thiện trạng thái lỗi/rỗng trên các trang công khai.
- Bổ sung kiểm tra liên kết, ảnh và URL media lấy từ CMS.
- Thêm giao diện theo dõi outbox đồng bộ CTT trong Admin bằng API hiện có; thao tác gửi lại gọi endpoint thật nên cần xác nhận trước khi dùng.
- Dịch nhãn trạng thái quản trị sang tiếng Việt mà không thay đổi giá trị nghiệp vụ gửi về API.
- Thêm migration `0008_content_editorial_refresh.sql` cho nội dung mặc định CMS chưa được chỉnh sửa.

## Trước khi triển khai

1. Sao lưu database D1 hiện có.
2. Xem lại `UPGRADE_AUDIT_REPORT_20261011.md`.
3. Dùng môi trường staging trước; không triển khai thẳng khi chưa test luồng đăng nhập, Admin, form, tệp, email và đồng bộ CTT.
4. Migration `0008` không thay schema, nhưng có cập nhật nội dung và tạo revision snapshot; chỉ áp dụng sau khi duyệt copy.
5. Không có lệnh remote database hoặc deploy nào được chạy trong quá trình bàn giao này.

## Kiểm thử đã chạy

- `npm test`: 33/33 đạt.
- `npm run check`: đạt.
- `node --check public/app.js`, `public/ui-safety.js`, `functions/api/[[path]].js`, `functions/sitemap.xml.js`: đạt.
- Chạy 8 migration trên SQLite tạm: đạt; đã thử xác nhận nội dung CMS được quản trị sửa trước đó không bị ghi đè.
- Kiểm thử trình duyệt Chromium bị chặn bởi môi trường chạy; cần kiểm tra lại trên trình duyệt/môi trường được phép.
