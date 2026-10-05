# DEPLOYMENT STEPS — Xanh Sky First

## 1. Kiểm tra trạng thái D1 trước khi chạy migration

Chạy truy vấn sau trong D1 Console:

```sql
SELECT name
FROM sqlite_master
WHERE type='table'
  AND name IN (
    'people','forms','form_submissions',
    'content_revisions','form_uploads','submission_events'
  )
ORDER BY name;
```

- Nếu **chưa có** `people`, `forms`, `form_submissions`: chạy `migrations/0002_people_forms.sql`, sau đó chạy `migrations/0003_production_hardening.sql`.
- Nếu đã có đủ ba bảng của `0002` nhưng chưa có ba bảng của `0003`: chỉ chạy `migrations/0003_production_hardening.sql`.
- Không xóa database và không tạo Root Admin bằng SQL chỉ để deploy source mới.

Sau migration, truy vấn trên phải trả về đủ:

```text
content_revisions
form_submissions
form_uploads
forms
people
submission_events
```

## 2. Bindings/variables production

Source đang dùng:

- D1 binding: `DB` → database `xanh`
- R2 binding: `STORAGE` → bucket `xanh`
- Secret: `SETUP_SECRET`
- Secret: `RESEND_API_KEY`
- Variable: `EMAIL_FROM`
- Variable: `EMAIL_REPLY_TO`
- Variable: `APP_URL=https://xanh.skyfirst.io.vn`

Không đưa secret vào repository.

## 3. Password

Toàn bộ password lifecycle dùng `PBKDF2-SHA256` với đúng **100000 iterations**.

## 4. Smoke test ngay sau deploy

Thực hiện theo thứ tự:

1. `/api/health` trả `pbkdf2_iterations: 100000`.
2. Nếu chưa có Root Admin, mở `/setup` và tạo tài khoản bằng `SETUP_SECRET`. Nếu đã có Root Admin, `/setup` phải từ chối khởi tạo lại.
3. Đăng nhập `/login` → `/admin`.
4. Media Library: upload một ảnh thử và xác nhận ảnh đọc lại được từ R2.
5. Con người Xanh: tạo hồ sơ → chọn/upload ảnh → lưu → mở `/con-nguoi/[slug]` → kiểm tra ảnh, public/index flags.
6. Form Builder: tạo form thử → mở URL public → submit → kiểm tra hồ sơ xuất hiện trong Admin.
7. Nếu bật email xác nhận, kiểm tra Resend gửi bằng `EMAIL_FROM` và reply-to đúng `EMAIL_REPLY_TO`.
8. Kiểm tra `/sitemap.xml`, `/robots.txt`, 5 trang pháp lý và một URL deep-link sau khi refresh.
9. Thử một tài khoản Viewer và Content Editor để xác nhận thao tác trái quyền trả `403` ở backend.
10. Kiểm tra mobile thực tế trước khi go-live.

Các mục cần Cloudflare/R2/D1/Resend thật không được coi là PASS chỉ dựa trên kiểm tra local; xem `FINAL_ACCEPTANCE.md`.
