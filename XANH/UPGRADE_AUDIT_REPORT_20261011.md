# XANH SKY FIRST — BÁO CÁO KIỂM KÊ & NÂNG CẤP

**Ngày:** 11/10/2026  
**Phạm vi:** Bộ mã nguồn Xanh Sky First trong ZIP nguồn đã xác định.  
**Trạng thái:** Đã sửa các hạng mục có thể kiểm chứng cục bộ; chưa triển khai production.

## 1. Tóm tắt nghiệm thu

| Hạng mục | Kết quả | Bằng chứng / giới hạn |
|---|---|---|
| Test tự động | **PASS — 33/33** | `npm test` |
| Kiểm tra cấu trúc production | **PASS** | `npm run check` |
| Cú pháp JS frontend/helper/API/sitemap | **PASS** | `node --check` trên các tệp chính |
| Migrations | **PASS — 8/8 trên SQLite tạm** | Không kết nối hoặc ghi production |
| Migration nội dung không ghi đè nội dung CMS đã chỉnh | **PASS** | Thử chỉnh trang trước migration; nội dung và SEO cũ được giữ nguyên |
| Giữ danh tính các block trang chủ | **PASS** | So sánh ID block trước/sau migration |
| Kiểm thử giao diện trình duyệt | **BLOCKED** | Chromium bị môi trường chặn (`ERR_BLOCKED_BY_ADMINISTRATOR`) |
| Production, email, R2 và CTT đầu-cuối | **NOT TESTED** | Không có phiên xác minh production được cấp trong đợt này |
| Triển khai hoặc áp dụng migration từ xa | **NOT DONE** | Không deploy, không gọi `db:remote`, không ghi dữ liệu production |

Các kết quả PASS chỉ áp dụng cho những kiểm tra được nêu trong bảng. Không dùng kết quả test tự động để khẳng định toàn bộ hệ thống production đã được nghiệm thu.

## 2. Các thay đổi thực hiện

### 2.1. Điều hướng và xử lý lỗi website

- Sửa `/sitemap`: trước đây hàm dựng trang dùng biến `nav` không được khai báo, có thể khiến trang lỗi khi render. Bản mới lấy mục điều hướng từ cấu hình site hoặc menu mặc định, chỉ đưa đường dẫn cùng site vào danh sách và loại trùng.
- Tách `/hanh-dong` khỏi `/gioi-thieu`: trang hành động có nội dung và lộ trình riêng, không còn dùng cùng hàm giới thiệu.
- API lỗi khi tải danh sách, hồ sơ người, biểu mẫu và số liệu không còn bị biến thành trạng thái rỗng giả. Khi không tải được, website báo trạng thái cần thử lại; khi thực sự không có nội dung công khai, hiển thị empty state riêng.
- Trang CMS không có block nội dung được phân biệt với trang lỗi/không tìm thấy; nội dung thiếu chi tiết và trang tìm kiếm được đặt `noindex` phù hợp.
- Trang lỗi chung có thông báo thân thiện, nút thử tải lại và đường về trang chủ; không trình bày chi tiết lỗi máy chủ cho khách truy cập.

### 2.2. An toàn URL và ảnh từ CMS

- Thêm `public/ui-safety.js` với allow-list cho liên kết và nguồn ảnh.
- Liên kết nhận từ CMS được chuẩn hóa trước khi đưa vào HTML; các scheme không an toàn như `javascript:` hoặc `data:` không được dùng làm đường dẫn điều hướng.
- Ảnh được giới hạn ở tài nguyên nội bộ đã biết, `/api/media/{id}` hoặc nguồn Unsplash HTTPS được cho phép; ký tự có thể phá ngữ cảnh thuộc tính/CSS bị loại.
- Các ảnh trong Media Library, cover/form, hồ sơ con người và preview block/gallery được đưa qua hàm kiểm tra; ID media trong block editor phải là số nguyên dương trước khi tạo URL.
- Liên kết mở tab mới dùng `noopener noreferrer` ở các điểm đã cập nhật.

### 2.3. Admin / Management Center

- Bổ sung màn hình **Đồng bộ CTT** dùng các endpoint quản trị hiện có, giới hạn hiển thị theo các vai trò đã có quyền (`root_admin`, `administrator`). Màn hình cho xem trạng thái outbox, số lần thử, mã HTTP, lỗi gần nhất và thời điểm gửi; nút gửi lại có xác nhận và cảnh báo đây là thao tác gọi endpoint thật.
- Chuyển nhiều trạng thái nghiệp vụ thường dùng sang nhãn tiếng Việt ở badge và selector (bản nháp, đã xuất bản, đang mở, đã đóng, đang xem xét, cần bổ sung, đã gửi, gửi thất bại…). Giá trị máy/API vẫn giữ nguyên.
- Khi tải phân hệ Admin thất bại, UI không đưa thông tin lỗi kỹ thuật thô lên màn hình; có nút thử lại.
- Bổ sung focus nhìn thấy được cho điều hướng bàn phím, trạng thái thông báo và hỗ trợ `prefers-reduced-motion` trong CSS.

**Lưu ý:** Chưa thể xác nhận ma trận RBAC production đầy đủ hay luồng CTT đầu-cuối vì không chạy kiểm thử qua tài khoản/môi trường production. Vai trò và backend hiện hữu không được đổi trong đợt này.

### 2.4. Nội dung biên tập CMS

- Thêm migration `migrations/0008_content_editorial_refresh.sql` để làm mới copy mặc định ở **26 trang CMS đã xuất bản**, tính cả trang chủ.
- Nội dung mới dùng ngôn ngữ cụ thể hơn, giải thích bối cảnh, bước tiếp theo, trạng thái và giới hạn thông tin; tránh tự tạo số liệu, thành tích, đối tác hoặc cam kết chưa có căn cứ.
- Nội dung trang chủ được làm rõ về dự án, hoạt động, tài nguyên, cơ hội tham gia, dữ liệu tác động và bản tin.
- Migration **không thay schema**. Mỗi cập nhật chỉ chạy nếu slug, tiêu đề gốc, trạng thái `published`, `blocks_json` và `seo_json` vẫn trùng hoàn toàn với bản mặc định ban đầu. Trước khi cập nhật, nội dung phiên bản cũ được lưu vào `page_revisions` với `created_by = NULL` (phiên bản do migration hệ thống tạo).
- Nếu người quản trị đã sửa nội dung, đổi tiêu đề/SEO hoặc đổi trạng thái trang, migration bỏ qua trang đó và không ghi đè.
- Cập nhật metadata tiêu đề và mô tả trang chủ trong `public/index.html` để mô tả đúng nội dung website thay vì chỉ dùng khẩu hiệu.

**Các trang chủ động không thay nội dung trong migration:** `accessibility`, `chinh-sach-du-lieu`, `dieu-khoan`, `quyen-rieng-tu`, `sitemap`. Đây là các nội dung pháp lý/chính sách hoặc trang đặc thù; cần chủ sở hữu nội dung xác nhận trước khi biên tập lại.

## 3. Kiểm kê URL và chức năng

Các tuyến được phát hiện trong router nguồn, gồm (đây là danh mục code, không phải tuyên bố mọi URL đã được thử trên production):

- Công khai: `/`, `/gioi-thieu`, `/hanh-dong`, `/con-nguoi`, `/con-nguoi/:slug`, `/du-an`, `/du-an/:slug`, `/hoat-dong`, `/hoat-dong/:slug`, `/co-hoi`, `/co-hoi/:slug`, `/tai-nguyen`, `/tai-nguyen/:slug`, `/tin-tuc`, `/tin-tuc/:slug`, `/sang-kien`, `/sang-kien/:slug`, `/tham-gia`, `/tham-gia/:slug`, `/tra-cuu`, `/noi-dung/:slug`, `/tim-kiem`, `/lien-he`, `/quyen-rieng-tu`, `/dieu-khoan`, `/chinh-sach-du-lieu`, `/accessibility`, `/sitemap`.
- Xác thực/quản trị: `/login`, `/setup`, `/reset-password`, `/admin`, `/admin/:module`.
- Tài nguyên liên quan: `public/sitemap.xml`, `functions/sitemap.xml.js`, `public/robots.txt`, `public/sw.js`.

Các module Admin được xác định từ source: dashboard, navigation, pages/Page Builder, articles, projects, activities, opportunities, initiatives, resources, people, forms, submissions, media, applications, impact, contacts, newsletter, CTT integration, users/roles, audit log và settings. Kiểm thử cục bộ xác nhận cấu trúc và đường dây chính đã được mã hóa; chưa chạy thao tác ghi/xóa với dữ liệu thật.

### Menu Admin theo vai trò trong frontend

| Vai trò | Phạm vi menu được cấu hình |
|---|---|
| `root_admin` | Tất cả module, bao gồm quản lý người dùng/quyền |
| `administrator` | Tất cả module quản trị ngoại trừ `users` |
| `content_editor` | Dashboard, Pages, Tin tức, Tài nguyên, Con người, Media |
| `project_manager` | Dashboard, Dự án, Hoạt động, Cơ hội, Sáng kiến, Impact, Media |
| `volunteer_coordinator` | Dashboard, Form Builder, Hồ sơ, Đơn đăng ký, Media |
| `viewer` | Dashboard và Audit Log |

Đây là menu frontend được khai báo trong mã nguồn; nó không thay cho phép thử từng endpoint backend. Kiểm thử truy cập trái phép theo mọi vai trò vẫn là hạng mục chưa xác minh trên môi trường thật.

## 4. Database và migration

- Đã chạy tuần tự 8 migration từ `0001` đến `0008` trên SQLite tạm.
- Bản seed thử nghiệm có 31 trang trước migration biên tập.
- Migration biên tập tạo 26 revision snapshot trong thử nghiệm, cập nhật các trang mặc định đủ điều kiện, đồng thời giữ nguyên ID 10 block trang chủ.
- Một thử nghiệm riêng sửa trước trang `gioi-thieu`; migration không thay nội dung hoặc SEO đã tùy chỉnh và không tạo revision cho chính trang đó.
- Không thực hiện thao tác với database remote. Kết quả SQLite tạm không chứng minh schema production giống hệt hoặc migration đã áp dụng nơi triển khai.

## 5. Các phần còn chưa xác minh

1. Kiểm thử trực quan qua trình duyệt desktop/mobile: bị chặn bởi môi trường chạy, cần thực hiện lại trên máy hoặc môi trường kiểm thử được phép.
2. Tải trực tiếp mọi URL, mọi deep-link và mọi tổ hợp slug/dữ liệu CMS ngoài production.
3. Mọi thao tác Admin theo từng vai trò trên API thực, đặc biệt quyền xem dữ liệu cá nhân, upload, xóa và khôi phục revision.
4. Gửi email thật, R2, đặt lại mật khẩu, retry CTT và việc nhận/xử lý dữ liệu ở đầu CTT.
5. Lighthouse/Core Web Vitals, quét liên kết trực tuyến toàn bộ, kiểm thử bằng trình đọc màn hình và pentest chuyên sâu.
6. Backup/restore và rollback tại Cloudflare production.

Các phần này không được đánh dấu PASS. Cần chạy sau khi có môi trường staging, tài khoản thử nghiệm và cấu hình phù hợp.

## 6. Hướng dẫn triển khai an toàn

1. Sao lưu D1 và lưu bản ZIP đang chạy trước khi phát hành.
2. Đọc lại `migrations/0008_content_editorial_refresh.sql`; migration chỉ thay copy mặc định chưa bị tùy chỉnh nhưng vẫn là thay đổi dữ liệu nội dung, nên cần duyệt nội dung trước khi áp dụng.
3. Chạy toàn bộ test và kiểm tra cấu hình trong môi trường staging.
4. Chỉ áp dụng migration ở môi trường đã chọn theo quy trình triển khai hiện có sau khi có backup và phê duyệt; không dùng lệnh remote một cách tự động.
5. Kiểm tra website, CMS, quyền, form, email và outbox CTT sau khi triển khai; có kế hoạch rollback code và phục hồi dữ liệu nếu có lỗi.

## 7. Những file chính đã thêm hoặc chỉnh

- `public/ui-safety.js` — helper cho URL và ảnh.
- `public/app.js` — trang hành động riêng, sitemap, xử lý lỗi, Admin CTT, trạng thái và an toàn URL/media.
- `public/styles.css` — trạng thái focus, reduced motion, responsive và trạng thái thông báo.
- `public/index.html` — metadata tiêu đề/mô tả.
- `public/sw.js` — tăng version cache và precache helper mới.
- `migrations/0008_content_editorial_refresh.sql` — nội dung CMS có điều kiện, có snapshot revision.
- `tests/ui-safety.test.mjs`, `tests/audit-upgrade.test.mjs` — kiểm tra bổ sung.
- `scripts/verify-production.mjs` — xác nhận các file bắt buộc, gồm helper và migration mới.

## 8. Kết luận

Bản nâng cấp cục bộ đã xử lý những lỗi cụ thể, làm rõ nội dung mặc định của nhiều trang, cải thiện trạng thái lỗi và Admin, đồng thời bổ sung bảo vệ URL/ảnh. Test tự động và migration rehearsal đã đạt trong môi trường tạm. Đây **chưa phải xác nhận production đã chạy bản mới hoặc toàn bộ website đã được kiểm thử trình duyệt**; các giới hạn đó được ghi rõ ở trên.
