# Xanh Sky First — Production Source

Source production cho `https://xanh.skyfirst.io.vn`, dùng Cloudflare Pages Functions + D1 + R2. Bản này tiếp tục trực tiếp trên source hiện có, giữ nguyên kiến trúc và bổ sung các phần còn thiếu của Management Center thay vì dựng một project mới.

## Hạ tầng

- D1 binding: `DB` → database `xanh`
- D1 database ID: `6445b394-1588-4ef0-b22d-d2e312cfa596`
- R2 binding: `STORAGE` → bucket `xanh`
- App URL: `https://xanh.skyfirst.io.vn`
- Resend: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`
- First-time setup: `SETUP_SECRET`

Không lưu API key/secret trong source hoặc ZIP.

## Mật khẩu

Toàn bộ password lifecycle dùng `PBKDF2-SHA256` với **exactly 100000 iterations**. Giá trị được hard-pin trong `functions/_lib/crypto.js` và áp dụng cho setup, tạo user, login verify, đổi mật khẩu và reset mật khẩu.

## Migrations

Chạy theo thứ tự:

```text
0001_initial.sql
0002_people_forms.sql
0003_production_hardening.sql
```

`0003` bổ sung content revisions, form upload riêng tư, timeline hồ sơ và các trang pháp lý CMS. Không sửa lịch sử migration đã có.

Cloudflare CLI:

```bash
npm install
npm run db:remote
```

Hoặc chạy từng migration trong D1 Console theo đúng thứ tự nếu đang quản lý database thủ công.

## First-time Setup

Truy cập `/setup`. Backend chỉ cho tạo Root Admin khi database chưa có Root Admin. Sau khi tạo thành công, endpoint setup tự khóa. Không tạo Root Admin bằng SQL nếu không có lý do phục hồi hệ thống được kiểm soát.

## Management Center

Truy cập `/admin` hoặc `/login`.

Các module có UI thực:

- Dashboard
- Trang & Page Builder
- Tin tức
- Dự án
- Hoạt động
- Cơ hội
- Sáng kiến
- Tài nguyên
- Con người Xanh
- Form Builder
- Hồ sơ trực tiếp + timeline
- Media Library R2
- Đơn đăng ký legacy
- Impact
- Liên hệ & Hợp tác
- Newsletter
- Users/Roles (Root Admin)
- Audit Log
- Settings

### Con người Xanh

`Thêm người / Chỉnh sửa người` có ảnh chân dung upload-first:

1. Chọn ảnh từ Media Library hoặc tải ảnh từ máy.
2. File được upload qua `/api/admin/media` vào R2 `xanh`.
3. Metadata lưu trong `media`.
4. Hồ sơ lưu `people.photo_media_id`.
5. Admin đọc lại ảnh từ `/api/media/:id`.
6. Public profile dùng `/con-nguoi/:slug`.
7. `is_public` và `allow_index` được kiểm soát độc lập.

Không yêu cầu quản trị viên nhập URL ảnh.

### Form Builder

Form Builder cho phép tạo/sửa form, thêm/đổi loại/nhân bản/xóa/sắp xếp field, required, options, deadline, capacity, cover, email xác nhận và yêu cầu consent. File upload của người gửi **không dùng bảng media công khai**; chúng được lưu trong `form_uploads`, R2 key riêng và chỉ tải về qua endpoint admin có kiểm tra quyền.

## Media

Allowlist hiện tại gồm JPEG, PNG, WebP, AVIF, GIF, SVG đã kiểm tra nội dung, PDF, TXT, CSV, DOCX, XLSX, PPTX, MP4 và WebM. Upload kiểm tra MIME, extension, một số file signatures và giới hạn 50 MB. Media Library hỗ trợ alt, caption, credit, focus point và ghi width/height khi trình duyệt đọc được kích thước ảnh.

## Routes public

Các route chính dùng pathname thật, hỗ trợ refresh/deep-link nhờ `public/_redirects`:

`/gioi-thieu`, `/con-nguoi`, `/du-an`, `/hoat-dong`, `/co-hoi`, `/tai-nguyen`, `/tin-tuc`, `/sang-kien`, `/tham-gia`, `/lien-he`, `/quyen-rieng-tu`, `/dieu-khoan`, `/chinh-sach-du-lieu`, `/accessibility`, `/sitemap`.

`/sitemap.xml` được sinh động từ dữ liệu public thực tế bằng Pages Function, bao gồm profile người chỉ khi `is_public=1` và `allow_index=1`.

## Kiểm tra trước deploy

```bash
npm test
npm run check
```

Sau deploy cần smoke-test trên Cloudflare thật các phần phụ thuộc binding/secrets: R2 upload, D1 write/read, Resend, route deep-link và First-time Setup.
