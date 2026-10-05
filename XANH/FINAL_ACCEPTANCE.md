# FINAL ACCEPTANCE — Xanh Sky First Production

## Cấu trúc bàn giao

```text
XANH.zip
└── XANH/
    ├── functions/
    ├── migrations/
    ├── public/
    ├── src/
    ├── scripts/
    ├── tests/
    ├── package.json
    ├── wrangler.jsonc
    ├── README.md
    ├── SECURITY.md
    └── FINAL_ACCEPTANCE.md
```

Không có tầng `XANH/XANH`.

## Acceptance checklist

- [x] Cloudflare Pages/Functions architecture.
- [x] D1 binding `DB`, database `xanh`, ID `6445b394-1588-4ef0-b22d-d2e312cfa596`.
- [x] R2 binding `STORAGE`, bucket `xanh`.
- [x] PBKDF2-SHA256 hard-pinned **100,000** iterations.
- [x] Không có `mức iteration cũ vượt 100000` trong production source.
- [x] First-time Setup dùng `SETUP_SECRET`, tự khóa sau khi có Root Admin.
- [x] Login/logout/session/đổi mật khẩu/reset-password backend.
- [x] RBAC và Audit Log backend.
- [x] Public homepage lấy CMS data từ D1.
- [x] Hero, giới thiệu, trụ cột, lĩnh vực, dynamic projects/opportunities/news, impact, newsletter, CTA, mega footer.
- [x] Nội dung mặc định không bịa số liệu, đối tác hay phạm vi hoạt động.
- [x] Dấu ấn Xanh count-up từ dữ liệu `verified` trong D1; không có số giả.
- [x] Website CMS và page block editor.
- [x] Drag/reorder section trong Page Builder.
- [x] Desktop/Tablet/Mobile preview trong page editor.
- [x] Content block editor cho bài viết/dự án/hoạt động/cơ hội/tài nguyên/sáng kiến.
- [x] Media Library lưu file lên R2.
- [x] Admin chọn ảnh qua Upload/Media Library, không phải nhập URL ảnh.
- [x] Chấp nhận ảnh nhiều tỷ lệ/kích thước; presentation tách khỏi kích thước file gốc.
- [x] Media metadata: alt, caption, credit, focus point.
- [x] Mini CRM cho đăng ký/TNV.
- [x] Impact Data workflow xác minh.
- [x] Newsletter opt-in và verification token.
- [x] Contact form route theo loại liên hệ.
- [x] Responsive public + admin.
- [x] Security headers, upload allowlist, validation và rate limits.
- [x] Logo Xanh Sky First do người dùng cung cấp được đóng gói tại `public/assets/xanh-sky-first-logo.png`.
- [x] Tests + production verification script.

## Trước khi go-live

Nhà vận hành vẫn phải thực hiện các bước hạ tầng không thể đóng sẵn trong ZIP: apply D1 migration vào account Cloudflare, tạo `SETUP_SECRET`, tùy chọn cấu hình Resend, kết nối domain/Pages project, sau đó chạy smoke test trên production. Không có secret thật nào được nhúng trong gói bàn giao.

## Upgrade 1–8 (2026-10-05)
- Public navigation uses real pathname routes; no homepage hash-only navigation.
- Supplied logo has transparent outer background for header/footer/login/admin presentation.
- Public People/Coordination profiles with stable slugs, photo media IDs and index controls.
- Privacy, Terms, Data Policy, Accessibility and HTML/XML sitemap routes are clickable.
- Green Technology visual system, reduced-motion support and responsive public UI.
- Role-aware Management Center navigation for six roles; API authorization remains server-side.
- Direct website Form Builder foundation and private form submissions in D1.
- Resend variables support EMAIL_FROM + EMAIL_REPLY_TO; PBKDF2 remains hard-pinned to 100000.
- Migration 0002_people_forms.sql must be applied to the production D1 before using People/Forms.
