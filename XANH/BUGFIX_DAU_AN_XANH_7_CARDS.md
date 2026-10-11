# Bản sửa lỗi cấu hình 7 thẻ Dấu ấn xanh

## Nguyên nhân

Giao diện Admin trước đây dựng các thẻ bằng cách lặp trực tiếp qua những bản ghi `/api/admin/impact-display` trả về. Nếu D1 chỉ trả về 3 cấu hình đã tồn tại, modal chỉ tạo 3 thẻ, dù luồng lưu lại yêu cầu đủ 7.

## Sửa trong bản này

- API hoàn thiện phản hồi thành đủ 7 cấu hình được duyệt, dùng mặc định chỉ cho các khóa chưa có.
- Giao diện Admin cũng có fallback riêng, vì vậy không còn phụ thuộc việc API cũ trả đủ hàng hay không.
- Cấu hình đã lưu của Admin luôn được ưu tiên; fallback không ghi vào D1 và không ghi đè nội dung đã chỉnh.
- Các mục chưa có giá trị vẫn có `manual_value: null` và xuất hiện dấu `—`; không tự tạo số liệu thành tích.
- Khi Admin bấm Lưu, API hiện hữu kiểm tra đủ 7 khóa và ghi bằng UPSERT, nên các cấu hình thiếu được lưu bền vững trong D1.
- Public Impact endpoint cũng trả đủ 7 cấu hình, nhưng giá trị không có nguồn đáng tin cậy vẫn là `null`.

## Kiểm tra thực hiện

- `npm test`: 43/43 bài test đạt.
- `npm run check`: qua kiểm tra cấu trúc source.
- `node --check`: app.js, API và helper mới không có lỗi cú pháp.
- Chạy các migration 0001–0009 trên SQLite sạch: thành công, 7 cấu hình được duyệt tồn tại; `community_reached` vẫn được giữ lịch sử và tắt hiển thị.

## Giới hạn

Đây là sửa mã nguồn trong ZIP, chưa tự triển khai lên `xanh.skyfirst.io.vn`. Cần deploy source này để bản sửa có hiệu lực trên website đang chạy. Sau deploy cần đăng nhập Admin, mở Dấu ấn xanh và kiểm tra lưu → tải lại → trang công khai với D1 production.
