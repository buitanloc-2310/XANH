# Báo cáo chỉnh sửa giao diện theo ảnh tham chiếu

## Phạm vi của bản này
- Tái dựng bố cục giao diện bằng HTML/CSS responsive thay vì chèn ảnh tham chiếu làm nền hoặc biến ảnh thành trang web.
- Các khu vực dự án và hoạt động có cấu trúc nội dung thật; dữ liệu bài viết tiếp tục lấy từ API/CMS.
- Minh họa dự án dạng khối, cây và lịch hoạt động được dựng bằng CSS.
- Dấu ấn xanh, CTA và chân trang dùng nền gradient/họa tiết CSS.
- Không đưa ảnh người do AI tạo vào giao diện.
- Không đóng gói các ảnh tham chiếu làm tài nguyên website; ảnh thật tùy chọn có thể được quản trị viên cung cấp qua Media Library.
- Giữ API, backend, xác thực, phân quyền và schema/migrations hiện có; không tạo migration mới.

## Kiểm tra đã chạy
- `npm test`: 18/18 bài kiểm thử đạt.
- `npm run check`: production verification đạt, 37 tệp được quét.
- Kiểm tra cú pháp JavaScript: đạt.
- Kiểm tra ZIP: thực hiện sau khi đóng gói.

## Giới hạn chưa xác minh
- Chưa triển khai lên Cloudflare production.
- Chưa xác minh kết nối D1/R2 production hoặc chạy browser end-to-end trên các kích thước màn hình thực tế.
- Chưa áp dụng thay đổi nào lên cơ sở dữ liệu production.
