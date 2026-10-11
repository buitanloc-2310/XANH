# Xanh Sky First — Báo cáo kiểm thử kỹ thuật

Ngày kiểm tra: 11/10/2026

## Kết quả cục bộ

- `node --test tests/*.test.mjs`: **57 test, 57 đạt, 0 thất bại, 0 bỏ qua**.
- `node --check` cho các file `.js`/`.mjs` dưới `public`, `functions`, `scripts`, `tests`: đạt.
- `node scripts/verify-production.mjs`: `Production verification passed (57 files scanned)`.
- Các migration SQL `0001` đến `0009` chạy tuần tự trên SQLite in-memory: đạt; tạo 22 bảng, có 31 trang seed, 1 biểu mẫu và 4 `site_settings` trong database sạch. Đây là test migration local, không đọc/ghi D1 production.
- Không có migration mới; không có thay đổi schema trong patch này.
- ZIP sẽ được kiểm tra `unzip -t` và được trích xuất vào thư mục riêng rồi chạy lại test/syntax/production check trước bàn giao.

## Các cụm test có bằng chứng

1. Design System lưu cấu hình phạm vi site/trang; chọn font heading độc lập; chọn favicon từ Media; merge cấu hình hiện hữu.
2. Countdown Page Builder và Form Builder: deadline hợp lệ, timezone, giờ mở/đóng, form trong tương lai, hết hạn và guard phía máy chủ.
3. Admin scroll: không cuộn về đầu vô điều kiện và giữ workspace khi cập nhật.
4. WordPress Tổng: workspace tại chỗ, phần theo vai trò, luồng preview không thay modal sửa.
5. Dấu ấn xanh: 7 chỉ số, dữ liệu trống hiển thị placeholder, cấu hình thiếu, Admin controls và API persistence pattern.
6. Bảo mật/cấu hình: hàm xác thực, URL an toàn, binding production, Form Builder và CTT integration regression tests.
7. Route/sitemap/nội dung, tài nguyên và UI safety.

## Không thể coi là đã kiểm thử

- Không có trình duyệt automation hoạt động trong môi trường; lần thử mở browser local bị `ERR_BLOCKED_BY_ADMINISTRATOR`. Vì vậy không tuyên bố đã nhìn trực quan ở các kích thước viewport bắt buộc.
- Không có thông tin xác thực để deploy/đọc/ghi Cloudflare D1/R2 production. Không chạy E2E Admin live và không xác nhận lưu dữ liệu production.
- Không thực hiện kiểm tra console/network từ browser production sau deploy.

## Ý nghĩa

Các bài test tự động xác minh hợp đồng/source-level và một số logic xử lý, không chứng minh toàn bộ luồng nghiệp vụ trên production. Production acceptance cần thực hiện các luồng từ hướng dẫn triển khai, đặc biệt lưu → tải lại → kiểm tra public.
