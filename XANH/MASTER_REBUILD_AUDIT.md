# Xanh Sky First — cập nhật giao diện & quản trị

## Nguồn
- ZIP gốc: `XANH-Sky-First-REDESIGNED.zip`
- Phạm vi: cập nhật giao diện công khai, công cụ chỉnh giao diện, tài nguyên hình ảnh và kiểm thử.
- Không chỉnh sửa Cổng Thông tin số Sky First.
- Không áp dụng migration production và không thay đổi schema/bảng dữ liệu.

## Thay đổi
- Bổ sung các ảnh tham chiếu do người dùng cung cấp vào `public/assets/reference/` dưới định dạng WebP tối ưu.
- Tạo các ảnh cắt dùng riêng cho khu vực chương trình/dự án, hoạt động, dấu ấn xanh, kêu gọi hành động và chân trang; tránh dùng nguyên ảnh chụp giao diện làm nền văn bản.
- Áp dụng hình ảnh cho trang danh sách dự án/hoạt động, khối impact, CTA và chân trang.
- Bổ sung `applySiteTheme()` để đọc cấu hình giao diện từ nhóm cài đặt `general` hiện có, có giới hạn màu, cỡ chữ, bo góc, chiều rộng nội dung, phông chữ và đường dẫn ảnh.
- Bổ sung bảng điều khiển trong **Admin → Cài đặt & giao diện** để đổi màu chủ đạo, màu chữ, phông chữ, cỡ chữ cơ sở, tỷ lệ tiêu đề, bo góc, chiều rộng nội dung, ảnh các khu vực và nội dung CTA/chân trang.
- Dùng API cài đặt hiện có (`/api/admin/settings`) và cơ sở dữ liệu JSON settings hiện tại; không cần migration mới.
- Các trang, nội dung, dự án, hoạt động, tin tức, biểu mẫu và menu tiếp tục được quản trị qua các module CMS hiện có.

## Kiểm tra đã chạy
- `node --check public/app.js`: đạt.
- `npm test`: 18/18 bài kiểm thử đạt, gồm hai kiểm thử bổ sung cho quản trị giao diện và ảnh tham chiếu.
- `npm run check`: đạt; công cụ xác minh source production quét 45 tệp.
- Các ảnh tham chiếu được đóng gói trong ZIP.

## Giới hạn chưa xác minh
- Chưa chạy trình duyệt end-to-end hoặc kiểm tra trên Cloudflare production.
- Chưa xác minh tài khoản/quyền quản trị trên môi trường đang triển khai.
- Chưa kiểm tra thay đổi màu và ảnh sau khi ghi vào D1 production.
- Ảnh có sẵn là ảnh tham chiếu do người dùng cung cấp; admin có thể dùng đường dẫn nội bộ `/assets/...` hoặc `/api/media/{id}` để thay ảnh.
- Admin quản trị được các nội dung/cấu hình mà CMS hỗ trợ; không thể thay đổi tùy ý mã nguồn thực thi, hợp đồng API hoặc nghiệp vụ từ bảng giao diện cài đặt.
