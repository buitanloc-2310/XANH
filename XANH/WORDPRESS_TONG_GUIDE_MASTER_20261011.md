# Hướng dẫn WordPress Tổng — Xanh Sky First

> Tên “WordPress Tổng” là workspace CMS trong hệ thống hiện tại. Dự án dùng CMS tự xây dựng; không phải WordPress cài riêng.

## Mở workspace

1. Đăng nhập Admin bằng tài khoản đã được cấp quyền.
2. Vào **WordPress Tổng**.
3. Dùng các tab trong cùng workspace: Tổng quan; Trang & Trang chủ; Bài viết & nội dung; Menu & Footer; Media · Giao diện · SEO; Dấu ấn xanh · Biểu mẫu. Vai trò chỉ thấy khu vực được mở theo quyền đã cấp.

## Chỉnh trang hoặc bài viết

1. Mở tab tương ứng, tìm nội dung.
2. Chọn **Sửa** để mở trình soạn thảo từ workspace.
3. Chỉnh nội dung, ảnh, metadata hoặc SEO ở những trường được hỗ trợ.
4. Xem trước mà không đóng mất trình soạn thảo.
5. Lưu bản nháp hoặc xuất bản theo chức năng có sẵn. Khi thông báo lỗi, giữ nội dung, đọc lỗi và thử lại; không coi dữ liệu là đã lưu nếu API không xác nhận.
6. Sau khi triển khai môi trường thật, tải lại và mở URL công khai để xác nhận dữ liệu.

## Design System

Trong khu Giao diện, chọn phạm vi toàn website hoặc trang cụ thể. Điều chỉnh các trường đang có như hệ màu, font đoạn văn/font tiêu đề, kích thước chữ, chiều rộng nội dung, khoảng cách section, bo góc, bóng đổ, overlay hero và các ảnh khu vực hỗ trợ. Logo và favicon chọn từ Media Library.

Phạm vi trang được lưu trong cấu hình hiện có; ưu tiên cấu hình trang khi được thiết lập, không cần sửa SQL. Không nên nhập giá trị cực đoan gây mất khả năng đọc. Preview trước khi xuất bản nếu có.

## Menu, Footer và Media

- Sửa nhãn/liên kết theo các mục được hỗ trợ và kiểm tra đường dẫn sau xuất bản.
- Dùng Media Library để chọn tài nguyên; alt text nên mô tả nội dung ảnh.
- Logo/favicon chọn theo tài nguyên Media thay vì dán URL không tin cậy.

## Page Builder — countdown

1. Mở trình quản lý khối của Trang chủ/trang CMS.
2. Thêm block **countdown**.
3. Đặt tiêu đề, thời điểm kết thúc; có thể đặt thời điểm bắt đầu; chọn múi giờ được hỗ trợ (Việt Nam, UTC, Bangkok, Singapore).
4. Cấu hình thông báo trước khi mở, lúc gần hạn, lúc hết hạn; đặt liên kết/nút khi cần.
5. Lưu bản nháp hoặc xuất bản theo luồng CMS có sẵn.
6. Countdown giao diện chỉ thông báo trạng thái. API kiểm tra thời hạn vẫn là nguồn thẩm quyền để chấp nhận hoặc từ chối hồ sơ.

## Form Builder — thời hạn hồ sơ

- Mở Form Builder, đặt `opens_at`/`closes_at`, timezone và cấu hình thông báo countdown.
- Không đặt giờ đóng trước giờ mở. Những ngày không hợp lệ phải sửa trước khi lưu.
- Trước khi đăng ký thật, thử URL khi chưa mở, trong thời gian mở và sau khi đóng; API không được nhận hồ sơ ngoài cửa sổ hợp lệ.

## Dấu ấn xanh

Mở Dấu ấn xanh để cấu hình bảy chỉ số chuẩn. Nếu không có số liệu xác minh, để giá trị trống để website hiển thị `—`; không nhập số minh họa như thành tích thực.

## Lưu ý dữ liệu

Không chỉnh D1 trực tiếp để cập nhật nội dung thường ngày. Admin là nơi quản trị. Trước mỗi lần deploy cần backup D1 production. Hiện tại phiên bàn giao chưa deploy hoặc xác minh với D1/R2 production.
