# Xanh Sky First — triển khai migration và kiểm thử kết nối CTT

## Phạm vi thay đổi

- Các thay đổi mã nguồn nằm trong dự án **Xanh Sky First**.
- Source CTT chỉ được đọc để xác định API tra cứu; không sửa source CTT và không chạy migration của Xanh trên cơ sở dữ liệu CTT.
- Migration `0007_appearance_ctt_case_sync.sql` chỉ chạy trên database D1 của Xanh (binding `DB`, database `xanh`).
- Xanh ghi hồ sơ chính vào database của Xanh. Sau đó, binding `CTT_DB` ghi bản ghi tối thiểu cần thiết vào bảng `submissions` và timeline an toàn trong `case_events` của CTT để API tra cứu hiện có tìm được hồ sơ bằng **mã + email đăng ký**.

## Điều kiện bắt buộc trước khi triển khai

1. Database D1 `sfn-app-db` của CTT phải nằm trong cùng Cloudflare account với dự án Xanh để binding `CTT_DB` truy cập được. ID được cấu hình trong `wrangler.jsonc`, nhưng việc truy cập thực tế cần được xác minh bằng Wrangler và màn hình Cài đặt sau deploy.
2. Xác nhận project `xanh-sky-first` đang dùng đúng database `xanh` (ID đã có trong `wrangler.jsonc`) và đúng bucket R2 `xanh`.
3. Sao lưu database Xanh trước khi chạy migration. Không chạy migration `0007` lên database CTT.
4. Các biểu mẫu đang mở phải có trường Email bắt buộc. CTT cần email khớp với mã hồ sơ để trả kết quả.

## Thứ tự triển khai

Chạy các lệnh từ thư mục gốc dự án Xanh, nơi có `wrangler.jsonc`:

```bash
npm install
npm test
npm run check
npx wrangler d1 migrations apply xanh --remote
npm run deploy
```

Nếu `CTT_DB` không truy cập được do khác Cloudflare account hoặc thiếu quyền, dừng ở bước xác minh; không coi kết nối là đã hoàn tất. Không cần và không được sửa/triển khai source CTT.

## Kiểm thử sau deploy

1. Đăng nhập Management Center của Xanh, mở **Cài đặt → Kết nối tra cứu CTT**.
2. Chỉ coi binding sẵn sàng khi trạng thái hiển thị kết nối sẵn sàng và kiểm tra schema thành công.
3. Tạo/kiểm tra một biểu mẫu thử nghiệm có trường Email bắt buộc, gửi hồ sơ kiểm thử bằng email do nhóm kiểm thử kiểm soát.
4. Kiểm tra phản hồi gửi hồ sơ: mã theo dạng `XXXX/MSH-XSK-MÃCT` và `ctt_synced=true`. Nếu trạng thái còn chờ đồng bộ, không coi mã đã có thể tra cứu; kiểm tra thông báo lỗi và dùng nút thử đồng bộ lại sau khi xử lý nguyên nhân.
5. Mở `https://ctt.skyfirst.io.vn/ho-so?code=<MÃ_HỒ_SƠ>`; nhập đúng email đã dùng khi đăng ký. Xác nhận CTT trả đúng mã, tên biểu mẫu/hồ sơ, trạng thái và timeline.
6. Đổi trạng thái hồ sơ trong Xanh, chờ đồng bộ, rồi kiểm tra lại timeline tại CTT.
7. Nhập sai email hoặc mã không tồn tại: CTT phải trả không tìm thấy; chức năng tra cứu giấy chứng nhận của CTT vẫn hoạt động như trước.
8. Sau khi thử nghiệm, xóa hồ sơ kiểm thử từ Management Center của Xanh để bản ghi mirror thuộc Xanh cũng được gỡ khỏi CTT; chỉ xóa những hồ sơ được nhận diện chính xác là do Xanh tạo.

## Lưu ý dữ liệu và mã

- Dãy bốn chữ số được lưu trong `case_code_registry` và không được tái sử dụng trong các mã mới do hệ thống này cấp.
- Các hồ sơ đã có trước migration được đánh dấu `legacy` và giữ nguyên mã; migration không tự tạo lại mã cho hồ sơ cũ.
- Bộ đếm Impact chọn được một trong hai nguồn: dữ liệu đã xác minh hoặc giá trị nhập tay. Nguồn được hiển thị công khai để người xem phân biệt; nếu không có dữ liệu xác minh/giá trị thủ công hợp lệ thì website hiển thị dấu gạch ngang thay vì tự tạo số.
- Chưa có triển khai production nào được thực hiện trong quá trình chuẩn bị source này. Kết nối production chỉ được xác nhận sau khi binding hoạt động thật và hoàn tất đầy đủ bước kiểm thử sau deploy.
