# FINAL ACCEPTANCE — Xanh Sky First

Ngày rà soát mã nguồn: 2026-10-11.

## Kết luận nghiệm thu

**Kết quả hiện tại: PASS ở kiểm tra mã nguồn cục bộ; CHƯA ĐỦ BẰNG CHỨNG để xác nhận production đạt 100%.** Gói này chưa được triển khai lên `xanh.skyfirst.io.vn`; không có thao tác nào trong lần rà soát này chạy migration hoặc sửa dữ liệu D1 production.

Quy ước: **PASS local** nghĩa là có test/kiểm tra source chạy được tại gói mã nguồn; **CHỜ PRODUCTION** là phải kiểm tra trong tài khoản Cloudflare, trên trình duyệt và dữ liệu thật; **CHƯA ĐẠT** là lỗi source đã biết, không che giấu.

## Ma trận nghiệm thu

| # | Tiêu chí | Kết quả | Bằng chứng/phần còn thiếu |
|---|---|---|---|
| 1 | JavaScript/MJS không lỗi cú pháp | PASS local | `node --check` toàn bộ tệp JS/MJS |
| 2 | Bộ kiểm thử tự động | PASS local | `npm test`: 41/41 test đạt |
| 3 | Kiểm tra cấu trúc production | PASS local | `node scripts/verify-production.mjs` |
| 4 | Bảo toàn backend/API/D1/R2/auth/RBAC hiện có | PASS theo source | Không viết lại backend; endpoint và cơ chế quyền đang có được tái sử dụng; cần kiểm tra lại trên deployment |
| 5 | WordPress thực sự hay CMS tự xây dựng | PASS theo source | Đây là Cloudflare Pages Functions + D1/R2 và CMS tự xây dựng, không phải một cài đặt WordPress độc lập; WordPress Tổng được dùng làm trung tâm đi đến module CMS hiện có |
| 6 | WordPress Tổng không nuốt lỗi API | PASS local | `Promise.allSettled`; phân hệ lỗi có cảnh báo rõ và bộ đếm không giả là 0 |
| 7 | Admin Tổng/WordPress Tổng giới hạn vai trò | PASS theo source | Điều hướng và endpoint áp dụng RBAC; phải kiểm tra đăng nhập theo vai trò thật sau deploy |
| 8 | 7 thẻ Dấu ấn xanh, không công bố số giả | PASS theo source/test | 7 cấu hình metric; dữ liệu thiếu hiển thị dấu chưa có dữ liệu; thẻ “Cộng đồng hưởng lợi” bị ẩn, dữ liệu lịch sử không bị xóa |
| 9 | Admin cấu hình nhãn, đơn vị, biểu tượng, nguồn, giá trị thủ công, thứ tự, hiển thị | PASS local/source | API cập nhật cấu hình hiện hữu và D1; phải smoke-test PUT → GET → public trong production |
| 10 | Quy đổi rác sang tấn | PASS theo source | API dùng trường dữ liệu đã được lưu theo tấn; xác minh nguồn gốc dữ liệu thật vẫn cần đối chiếu dữ liệu D1 |
| 11 | Hiệu ứng đếm và đơn vị đi cùng số | PASS theo source/test | IntersectionObserver, dừng tại đích, placeholder khi thiếu dữ liệu, unit no-wrap; cần xem trực quan trình duyệt thật |
| 12 | Responsive Dấu ấn xanh | PASS CSS/test cấu trúc | 7 cột ở màn hình rộng; 4 cột ở desktop hẹp/trung bình; 2 cột tablet/mobile và 1 cột màn hình rất hẹp |
| 13 | Menu/submenu/footer mặc định và route CMS | PASS local/test | Test các slug mặc định và cấu hình điều hướng; vẫn cần crawl URL thật sau deploy |
| 14 | Nội dung CMS, Preview, Draft/Publish, SEO | PASS theo source | UI/API có sẵn; luồng trình duyệt lưu → tải lại → public chưa chạy trên production |
| 15 | Giao diện/SEO chung, Media Library, biểu mẫu, nhật ký | PASS theo source | Tích hợp với API hiện hữu; quyền R2/D1 và luồng thực phải smoke-test |
| 16 | Zoom 100% và thiết bị thật | CHỜ PRODUCTION | Kiểm tra CSS và breakpoint tự động không thay thế screenshot/visual QA trên Chrome ở nhiều viewport và zoom 100% |
| 17 | Lưu Admin → dữ liệu bền vững → website công khai | CHỜ PRODUCTION | Cần tài khoản Admin và dữ liệu Cloudflare thật để cập nhật thử an toàn, tải lại Admin và trang công khai |
| 18 | Trạng thái D1/migration production | CHỜ PRODUCTION | Chưa đọc được migration ledger hoặc schema D1 từ tài khoản production; sao lưu trước khi apply |
| 19 | Upload/đọc lại media R2 | CHỜ PRODUCTION | Cần binding/permission R2 production |
| 20 | Login, RBAC, email và tích hợp ngoài | CHỜ PRODUCTION | Cần test tài khoản vai trò, Resend/CTT và secrets thật sau deploy |

## Đã chỉnh trong lần audit này

- WordPress Tổng không còn âm thầm biến lỗi tải API thành số 0 hoặc gạch ngang khó phân biệt; lỗi được nêu rõ và thống kê phân biệt trang/bài xuất bản cùng bản nháp.
- Trung tâm CMS có liên kết đến các module hiện hữu gồm trang, bài viết, menu/footer, media, giao diện, Dấu ấn xanh, biểu mẫu và nhật ký. Không tạo CMS/WordPress hay database thứ hai.
- Responsive Dấu ấn xanh dùng 4 cột trong dải desktop hẹp/trung bình để tránh ép bảy thẻ vào vùng quá chật; màn hình rộng vẫn dùng 7 cột, màn hình nhỏ chuyển lưới.
- Tăng phiên bản service-worker cache lên `xanh-shell-v13`, đồng thời đổi phiên bản query của CSS/JS và accessibility script sang `20261012-1` để yêu cầu trình duyệt lấy tài nguyên mới sau deploy.
- Bổ sung kiểm thử hồi quy cho thông báo lỗi WordPress Tổng.
- Hướng dẫn triển khai được sửa để yêu cầu backup D1, kiểm tra migration ledger và chỉ áp dụng migration theo trạng thái thật; không được chạy lặp SQL thủ công và Wrangler trên cùng migration.

## Kiểm tra local có thể chạy lại

```bash
npm test
npm run check
# Syntax check toàn bộ JS/MJS: chạy vòng lặp shell/Node phù hợp môi trường
```

Các migration `0001`–`0010` đã được chạy tuần tự trên SQLite local sạch trong vòng kiểm thử cập nhật; việc đó **không** chứng minh schema, dữ liệu hoặc migration ledger của D1 production đang giống hệt. Không có migration production nào được chạy trong lần audit này.

## Điều kiện bắt buộc trước khi đánh dấu hoàn thành 100%

1. Sao lưu D1 production và xác minh migration ledger trước khi chạy migration; nếu trạng thái không khớp thì dừng để đối chiếu, không áp dụng mù.
2. Deploy lên Cloudflare Pages đúng project/branch và xác minh binding `DB`, `STORAGE` cùng secrets/variables.
3. Đăng nhập tài khoản Admin được ủy quyền; thay đổi một trường kiểm thử an toàn trong nội dung hoặc Dấu ấn xanh; lưu, tải lại Admin, rồi xác nhận giá trị mới xuất hiện ở API và trang công khai. Khôi phục dữ liệu thử sau kiểm tra nếu cần.
4. Xác minh các giá trị D1 với nguồn nghiệp vụ; không nhập số liệu minh họa để thay dữ liệu thật.
5. Chụp/kiểm tra trang chủ, trang con, menu, footer và Dấu ấn xanh ở Chrome zoom 100% với viewport desktop rộng, desktop hẹp, tablet, điện thoại; không tràn ngang/chồng lấn.
6. Smoke-test đăng nhập và ít nhất các vai trò bị giới hạn, upload/đọc lại media R2, biểu mẫu, SEO/sitemap/deep-link và tích hợp ngoài đang bật.

**Không được coi ZIP, CSS, migrations local hoặc unit tests là bằng chứng website production đã được cập nhật.**


## Bản nâng cấp mã nguồn ngày 12/10/2026 — chưa triển khai production

### Đã thực hiện trên bản sao
- Sửa migration `0009` để không thêm trùng `manual_value`; bổ sung migration `0010_lifecycle_accessibility.sql`.
- Chuẩn hóa font Be Vietnam Pro, bổ sung công cụ A− / A / A+ với lưu tùy chọn và cập nhật nội dung động/modal, đồng thời tinh chỉnh hệ màu xanh rừng trên toàn website.
- Siết luồng reset mật khẩu, chống thao tác newsletter thay đổi trạng thái qua GET, xác thực nguồn gốc POST xác nhận, và hiển thị đúng tình trạng gửi email newsletter.
- Chặn SVG upload chủ động, thêm bảo vệ khi phục vụ SVG cũ, tách quyền media công khai/riêng tư và tránh để R2 object mồ côi khi ghi metadata D1 thất bại.
- Bổ sung thời hạn 24 giờ cho upload biểu mẫu chưa gửi hồ sơ, dọn dẹp theo lượt truy cập và kiểm tra thời hạn token trước khi nhận hồ sơ.
- Ràng buộc xác minh Dấu ấn xanh theo người ghi nhận khác, kiểm tra loại hoạt động, và không cho sửa số liệu ngay trong thao tác xác minh.
- Siết quyền audit metadata, sửa đường dẫn sitemap/CTT tracking, thêm cập nhật trạng thái CRM và cải thiện tính nhất quán khi kiểm tra sức chứa biểu mẫu.

### Kiểm thử cục bộ tại thời điểm cập nhật
- `npm test`: 70/70 đạt.
- `npm run check`: đạt, 79 tệp được quét.
- Kiểm tra cú pháp JS/MJS cho API, auth, sitemap, app và accessibility: đạt.
- Toàn bộ migration `0001`–`0010`: chạy tuần tự thành công trên SQLite sạch, gồm kiểm tra schema sau migration.

### Chưa được xác minh
Chưa deploy hoặc chạy smoke test trên Cloudflare Pages/D1/R2 production; chưa xác minh secrets, mail provider, custom domain, tích hợp CTT và cache thực tế. Chưa hoàn tất kiểm tra hình ảnh bằng trình duyệt desktop/mobile thật. Chỉ đánh dấu production-ready sau khi hoàn tất checklist triển khai ở `DEPLOYMENT_STEPS.md`.
