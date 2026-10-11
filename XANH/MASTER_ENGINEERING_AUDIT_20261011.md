# Xanh Sky First — Master Engineering Audit

**Ngày:** 11/10/2026  
**Nguồn:** mã nguồn Xanh Sky First được bàn giao ở ZIP `XANH-Sky-First-WORDPRESS-TONG-INPLACE-20261011.zip`, được tái kiểm kê và chỉnh sửa in-place.  
**Kết luận:** source qua các kiểm tra tự động cục bộ trong báo cáo. **Chưa nghiệm thu production** vì không có quyền triển khai Cloudflare hoặc thông tin xác thực production trong phiên làm việc.

## 1. Kiểm kê source

Các phần chính đã kiểm tra:

| Vùng | Tệp / nguồn chính | Nội dung kiểm tra |
|---|---|---|
| Website công khai | `public/index.html`, `public/app.js`, `public/styles.css` | Route, nội dung động, trạng thái lỗi, bộ đếm, giao diện, responsive CSS, truy cập bàn phím/reduced motion |
| API và nghiệp vụ | `functions/api/[[path]].js` | Cài đặt website, cửa sổ mở/đóng biểu mẫu, xác thực dữ liệu, guard phía máy chủ và các API CMS hiện có |
| Thư viện server | `functions/_lib/auth.js`, `crypto.js`, `http.js`, `impact-config.js`, `media.js` | Xác thực, tiện ích HTTP, dữ liệu Dấu ấn xanh, media |
| Sitemap & tài nguyên | `functions/sitemap.xml.js`, `public/sitemap.xml`, `_headers`, `_redirects`, `robots.txt`, `sw.js`, `ui-safety.js` | Sitemap, header/redirect, tài nguyên và cache |
| Dữ liệu | `migrations/0001_initial.sql` đến `0009_impact_display_full_control.sql` | Chạy sạch trên SQLite; không có migration mới trong bản này |
| Cấu hình triển khai | `wrangler.jsonc`, `package.json`, `scripts/verify-production.mjs` | Bindings, lệnh kiểm tra và triển khai |
| Kiểm thử | `tests/*.test.mjs` | 57 test hiện hữu và mới, bao gồm CMS workspace, Dấu ấn xanh, bảo mật, Form Builder, countdown và Design System |

Các nhóm route công khai được định tuyến trong `public/app.js`: `/`, `/gioi-thieu`, `/hanh-dong`, danh sách/chi tiết con người, dự án, hoạt động, cơ hội, tài nguyên, tin tức, sáng kiến; `/tham-gia` và biểu mẫu theo slug; `/tra-cuu`, `/noi-dung/:slug`, `/tim-kiem`, `/lien-he`, các trang chính sách/điều khoản/khả năng tiếp cận, `/sitemap`; các route `/login`, `/setup`, `/reset-password` và `/admin/*`.

## 2. Các tệp thay đổi trong bản này

| Tệp | Lý do |
|---|---|
| `public/app.js` | Workspace WordPress Tổng và các tab theo quyền hiện có; luồng sửa/xem trước tại chỗ; giữ vùng cuộn Admin khi thao tác; Design System phạm vi site/trang; chọn logo/favicon từ Media; Page Builder có block countdown; chuyển múi giờ và trạng thái form tương lai/hết hạn; xử lý lưu/hiển thị lỗi |
| `public/styles.css` | CSS biến giao diện động; font nội dung/tiêu đề; màu sắc, overlay, chiều rộng, khoảng cách, bo góc, bóng đổ và các cấu hình giao diện hỗ trợ; giao diện countdown và workspace |
| `public/index.html` | Cập nhật query version cho CSS/JS để trình duyệt yêu cầu tài nguyên mới sau deploy |
| `public/sw.js` | Tăng cache key service worker để không cố giữ shell cũ |
| `functions/api/[[path]].js` | Xác thực cửa sổ mở/đóng Form Builder ở phía máy chủ; cung cấp trạng thái biểu mẫu chưa mở/hết hạn; guard gửi hồ sơ vẫn là nguồn thẩm quyền; sanitize cài đặt countdown |
| `tests/wordpress-hub.test.mjs` | Bổ sung/điều chỉnh test cho các tab, luồng tại chỗ và preview |
| `tests/master-engineering-order.test.mjs` | Test hồi quy cho các điều kiện trong yêu cầu kỹ thuật tổng thể |
| `MASTER_ENGINEERING_TEST_RESULTS_20261011.txt` | Kết quả kiểm thử nguồn cục bộ |

Các migration `0001`–`0009` được giữ nguyên. Không thêm bảng hay schema mới. Không thay `wrangler.jsonc`, `package.json`, `src/platform.js` hoặc các thư viện xác thực hiện có. `functions/api/[[path]].js` là router API dùng chung, nhưng thay đổi trong bản này giới hạn vào các nhánh biểu mẫu/hạn đăng ký; không viết lại luồng tích hợp CTT. Diff source không bao gồm bất kỳ tệp nguồn CTT độc lập nào.

## 3. Chức năng đã hoàn thiện ở mức source

- WordPress Tổng được tích hợp vào shell Admin hiện tại, không cài WordPress độc lập và không tạo kho dữ liệu thứ hai.
- Tab workspace được lọc theo các vai trò hiện có; API tiếp tục kiểm tra quyền như trước. Test source kiểm tra phạm vi tab; **chưa thay thế kiểm thử gọi API bằng tài khoản thật trên production**.
- Trang/bài viết có thể mở trình soạn thảo từ workspace, giữ khu vực đang làm; preview ở lại trong luồng soạn thảo.
- Design System lưu vào khóa `general` hiện có: màu thương hiệu và trạng thái, font nội dung/font tiêu đề, kích thước chữ, chiều rộng nội dung, khoảng cách section, bo góc, bóng đổ, overlay hero, các ảnh khu vực được hỗ trợ; cấu hình có phạm vi toàn site và trang trong schema cài đặt hiện có.
- Logo điều hướng và favicon chọn qua Media Library; việc chọn ảnh dùng ID Media hoặc nguồn ảnh cho phép.
- Page Builder hỗ trợ block countdown lưu cùng JSON của các khối CMS hiện có. Hỗ trợ thời gian bắt đầu/kết thúc, timezone, nội dung trước hạn/sắp hết hạn/hết hạn và CTA. Chưa tạo bảng/migration riêng.
- Form Builder cho cấu hình giờ mở/đóng, timezone và nội dung bộ đếm. Server xác thực thời hạn gửi hồ sơ; không chỉ dựa vào JavaScript ẩn nút.
- Đã bỏ hành vi cuộn về đầu trang vô điều kiện sau mỗi `route()`; điều hướng công khai chủ động vẫn có thể đưa về đầu trang.
- Dấu ấn xanh giữ đủ 7 cấu hình chuẩn, không tạo số liệu giả, đơn vị và giá trị giữ riêng; cấu hình thiếu được bổ sung ở giao diện/API theo logic hiện có.
- Tài nguyên có query version mới và service-worker cache key mới.

## 4. Những phần chưa nên tuyên bố hoàn tất

Các giới hạn sau còn tồn tại hoặc chưa đủ bằng chứng để đóng nghiệm thu:

1. Chưa deploy lên Cloudflare Pages production và chưa có quyền truy cập xác thực để thử ghi/đọc D1, Media R2 hoặc Admin live.
2. Chưa hoàn thành kiểm thử trực quan trên trình duyệt cho toàn bộ viewport 360/390/430/768/1024/1280/1440 px; môi trường kiểm thử hiện không cung cấp browser automation khả dụng và lần mở local browser bị chặn bởi môi trường (`ERR_BLOCKED_BY_ADMINISTRATOR`). CSS/unit tests không thay thế kiểm thử trực quan.
3. Chưa chạy E2E đăng nhập với từng vai trò trên production, kiểm tra API direct-call trái quyền, console/network sau deploy.
4. Design System cung cấp các thuộc tính toàn site/trang đã nêu trong UI và hỗ trợ; không phải mọi thuộc tính CSS bất kỳ hay mọi khoảng cách riêng cho mọi node đều được chỉnh trong giao diện.
5. Countdown được đóng gói cho Page Builder và Forms hiện có; chưa phải một sản phẩm lịch/scheduler tổng quát với mọi kiểu lịch lặp, trạng thái nhiều chiến dịch hoặc quản lý lịch sử phiên bản.
6. Không có bằng chứng live để xác minh tất cả trang công khai dùng dữ liệu CMS mới, mọi ảnh R2 hiển thị hoặc việc Admin → lưu → reload → public page hoạt động với dữ liệu production.

Không đánh dấu production acceptance khi các bước này chưa được chạy trong môi trường thật.

## 5. Bảo toàn và rollback

- Sao lưu D1 production trước deploy, dù bản này không yêu cầu migration.
- Giữ nguyên Cloudflare Pages project, D1/R2 bindings, environment variables và secrets hiện tại.
- Triển khai theo hướng dẫn riêng `MASTER_ENGINEERING_DEPLOYMENT_ROLLBACK_20261011.md`.
- Nếu có lỗi, rollback về deployment Pages trước đó; không xóa D1, không chạy migration mới và không xóa secrets/bindings.

## 6. Trạng thái nghiệm thu

| Mục | Trạng thái |
|---|---|
| Source ZIP mở được và các tệp kiểm tra được | Đạt cục bộ |
| 57/57 test source | Đạt cục bộ |
| JavaScript/MJS syntax | Đạt cục bộ |
| Production structure check | Đạt cục bộ |
| Migrations 0001–0009 trên SQLite sạch | Đạt cục bộ |
| Không thêm schema/migration | Đạt |
| Cloudflare production Admin→save→reload→public page | Chưa xác minh |
| Responsive trực quan trên các viewport bắt buộc | Chưa xác minh |
| Authenticated API/RBAC E2E trên production | Chưa xác minh |

**Kết luận trung thực:** Đây là bản source đã sửa và kiểm tra cục bộ, không phải bằng chứng website production đã cập nhật hoặc đã vượt qua toàn bộ nghiệm thu kỹ thuật.
