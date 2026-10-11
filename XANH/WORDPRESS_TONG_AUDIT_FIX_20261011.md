# Xanh Sky First — WordPress Tổng: kiểm kê và sửa đổi

Ngày: 11/10/2026

## Kết luận về nền tảng

Mã nguồn được kiểm tra là CMS tự xây dựng chạy trên Cloudflare Pages, API hiện có, D1 và R2. Không thấy nền tảng WordPress/PHP độc lập trong gói mã nguồn. Vì vậy bản sửa không cài thêm WordPress và không tạo nguồn nội dung thứ hai.

## Thay đổi trong bản này

- Thay trang WordPress Tổng kiểu danh mục liên kết bằng một khu làm việc CMS duy nhất, dùng các tab nội bộ trong URL `/admin/wordpress`.
- Tab Tổng quan hiển thị số lượng trang, bài viết, bản nháp, Media và biểu mẫu; có thao tác tạo trang/bài và sửa nhanh các trang/bài gần đây.
- Tab Trang & Trang chủ dùng Page Builder hiện tại, bao gồm nội dung theo block, trạng thái và SEO.
- Tab Bài viết & nội dung quản lý bài viết, dự án, hoạt động, cơ hội, sáng kiến và tài nguyên. Nút sửa mở editor trực tiếp và lưu qua API hiện có.
- Tab Menu & Footer dùng Navigation Manager hiện tại trong cùng khung WordPress; menu chính, menu con, liên kết CTA và footer được lưu qua endpoint hiện có.
- Tab Media dùng Media Library hiện tại, upload lên R2 và sửa metadata trong D1, trong cùng khu WordPress.
- Tab Giao diện & SEO sử dụng cài đặt giao diện dùng chung hiện có; SEO riêng của trang/bài được chỉnh từ editor của nội dung.
- Tab Dấu ấn xanh sử dụng cấu hình 7 thẻ và API hiện có.
- Tab Biểu mẫu dùng Form Builder hiện có.
- Tab SEO & đường dẫn liệt kê trang và mọi loại nội dung, nút sửa mở editor SEO tương ứng ngay tại khu WordPress.
- Sau khi lưu trang, bài viết, media, biểu mẫu, menu hoặc cấu hình Dấu ấn xanh, giao diện trở lại WordPress Tổng và giữ nguyên tab đang làm.
- Xem trước bài viết được chuyển thành xem trước nội tuyến để không đóng/đánh mất màn hình soạn thảo.
- Phiên bản cache service worker và query phiên bản CSS/JS được nâng lên để trình duyệt có thể nhận tài nguyên mới sau triển khai.

## Bảo toàn hệ thống

- Không thêm migration, bảng dữ liệu hoặc API backend mới.
- Không thay đổi schema D1, xác thực, đăng nhập hoặc luật phân quyền backend.
- Giữ quyền WordPress Tổng cho `root_admin` và `administrator`; cấu hình các vai trò khác trong `roleNav` được giữ nguyên.
- Thay đổi nội dung tiếp tục dùng endpoint CMS hiện tại; không ghi cứng dữ liệu quản trị vào mã frontend.

## Kiểm thử đã chạy

- `node --check public/app.js`: đạt.
- `node --test tests/*.test.mjs`: 45/45 đạt.
- `node scripts/verify-production.mjs`: đạt, quét 56 tệp.

## Giới hạn nghiệm thu

Các kiểm tra trên là kiểm tra mã nguồn trong môi trường cục bộ. Chúng không chứng minh deployment production đã cập nhật hoặc thao tác lưu thực tế đã qua D1/R2 production. Sau khi deploy cần đăng nhập Admin, mở `/admin/wordpress`, thử từng tab, lưu một thay đổi an toàn, tải lại, xác nhận dữ liệu còn nguyên và kiểm tra trang công khai ở zoom 100% trên desktop/điện thoại.
