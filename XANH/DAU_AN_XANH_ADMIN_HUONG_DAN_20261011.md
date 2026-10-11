# Xanh Sky First — Dấu ấn xanh & Admin Tổng

## Phạm vi đã chỉnh trong bộ mã nguồn

- Thêm migration `0009_impact_display_full_control.sql` (chỉ bổ sung cột vào bảng cấu hình hiển thị hiện có, không xoá bảng/nghiệp vụ).
- Chuyển cấu hình Dấu ấn xanh thành 7 thẻ đã duyệt: Tình nguyện viên tham gia, Hoạt động môi trường, Rác thải thu gom, Chương trình đã triển khai, Hoạt động giáo dục môi trường, Điểm xanh được kết nối, Đơn vị đồng hành.
- Không hiển thị thẻ “Cộng đồng hưởng lợi”; bản ghi lịch sử và cột database cũ được giữ lại, không bị xoá.
- Đưa tiêu đề/kicker về nội dung ảnh mẫu chỉ khi trang chủ vẫn giữ đúng nội dung seed cũ; nếu Admin đã tự sửa tiêu đề thì migration không ghi đè.
- Thêm đơn vị, biểu tượng, nguồn dữ liệu, giá trị thủ công, chữ số thập phân, thời gian chạy, độ trễ, thứ tự và bật/tắt thẻ vào cấu hình Admin.
- Nối dữ liệu `counters` từ API công khai vào trang chủ (trước đó client làm rơi mảng này).
- Giá trị thiếu/không được xác minh hiển thị `—`, không dùng số minh hoạ làm dữ liệu công bố.
- Hiệu ứng số đếm từ 0 đến giá trị cấu hình và dừng đúng số; đơn vị được đặt cạnh số.
- Chỉnh CSS cho header và hero ở zoom trình duyệt 100%, nút “Cùng hành động” không bị ép ngắt dòng; Dấu ấn xanh chuyển sang lưới 7 cột ở màn hình đủ rộng và tự đổi cột trên màn hình nhỏ.
- Thêm ảnh phong cảnh nền nội bộ `public/assets/dau-an-xanh-landscape.webp`.
- Chỉ Root Admin/Administrator được chỉnh cấu hình 7 thẻ; quyền ghi nhận hồ sơ Impact hiện tại vẫn giữ nguyên.

## Cách chỉnh sau khi triển khai

1. Đăng nhập Admin Tổng/Administrator.
2. Mở **Impact / Dấu ấn xanh & dữ liệu tác động**.
3. Chọn **Cấu hình 7 thẻ Dấu ấn xanh**.
4. Sửa tên, đơn vị, biểu tượng, nguồn D1/thủ công, giá trị, số chữ số thập phân, tốc độ, thứ tự hoặc bật/tắt thẻ.
5. Chọn “Lưu và áp dụng 7 thẻ”. Thành công chỉ được thông báo khi API lưu thành công.
6. Sửa tiêu đề và đoạn giới thiệu của Dấu ấn xanh trong Admin → Pages/Page Builder → Trang chủ → khối Impact.

## Nguồn dữ liệu

- `participants` mặc định là nhập thủ công, vì dữ liệu hiện có ghi số tham gia theo hoạt động và không đủ để khẳng định đó là số người duy nhất.
- Hoạt động môi trường / rác thu gom chỉ đọc hồ sơ Impact đã được xác minh. Khi chưa có hồ sơ xác minh, website hiển thị `—` thay vì số liệu bịa.
- Chương trình / hoạt động giáo dục có thể chọn D1 khi thoả điều kiện truy vấn hiện có; mặc định vẫn để thủ công cho đến khi Admin xác nhận cách thống kê phù hợp.
- Điểm xanh và đơn vị đồng hành chưa có nguồn D1 đủ tin cậy trong schema hiện tại; mặc định để thủ công và trống. Chỉ điền sau khi có căn cứ thực tế.
- Đơn vị là chuỗi hiển thị; nếu chuyển khối lượng sang tấn thì số liệu phải thực sự đã được quy đổi, không được chỉ đổi nhãn.

## Kiểm thử đã chạy trong môi trường làm việc

- `npm test`: 38/38 bài test đạt.
- `npm run check`: Production verification passed.
- Migration `0001`–`0009` chạy tuần tự trên SQLite thử nghiệm sạch; xác nhận bảy chỉ số, tiêu đề/kicker, dữ liệu đơn vị và thẻ cũ bị ẩn.
- Câu UPSERT có cùng số placeholder/bind parameters đã chạy thử trên SQLite.
- `node --check public/app.js` và `node --check functions/api/[[path]].js` đạt.

## Chưa thực hiện

- Chưa chạy migration trên Cloudflare D1 từ xa.
- Chưa deploy Cloudflare Pages và chưa có xác nhận từ website production.
- Chưa kiểm thử tương tác end-to-end với phiên đăng nhập Admin thật trên hosting production.

## Cách triển khai an toàn

1. Sao lưu D1 từ xa trước.
2. Kiểm tra/commit bộ mã nguồn này vào repo và triển khai qua pipeline hiện có.
3. Áp dụng migration qua quy trình migrations của dự án (`npm run db:remote`) sau khi xác nhận đúng môi trường/tên database; không sửa SQL trực tiếp từng dòng trên dashboard.
4. Deploy Pages theo workflow hiện tại.
5. Đăng nhập Admin, lưu thử một thay đổi có thể hoàn nguyên, mở website công khai, tải lại trang và kiểm tra nó vẫn hiển thị đúng.

**Lưu ý:** bộ ZIP này là mã nguồn đã chỉnh trong môi trường làm việc, không phải xác nhận website production đã được cập nhật.
