# DEPLOYMENT STEPS — Xanh Sky First

Tài liệu này là checklist triển khai an toàn cho source Cloudflare Pages + D1 + R2. Không chạy migration production chỉ vì ZIP có migration mới; trước hết phải kiểm tra trạng thái database đang dùng.

## 1. Xác định project, binding và branch

Kiểm tra `wrangler.jsonc`, Cloudflare Pages project/production branch và các binding đang gắn với deployment. Source hiện cấu hình D1 binding `DB` (database `xanh`) và R2 binding `STORAGE` (bucket `xanh`). Xác minh đây đúng là database/bucket đang dùng cho website production; không dựa riêng vào tên.

Các secret/variables phải được cấu hình an toàn trên Cloudflare, không commit vào repository: `SETUP_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `APP_URL=https://xanh.skyfirst.io.vn` (xem thêm `CTT_INTEGRATION_SETUP.md` nếu tích hợp CTT được bật). Không in hoặc gửi giá trị secret trong log.

## 2. Sao lưu D1 và kiểm tra lịch sử migration

Trước mọi thay đổi schema hoặc nội dung, lưu bản sao D1 production vào nơi riêng tư, có kiểm soát truy cập. Ví dụ dùng Wrangler đã xác thực với đúng tài khoản/project:

```bash
mkdir -p backups
npx wrangler d1 export xanh --remote --output=./backups/xanh-before-rebuild.sql
npx wrangler d1 migrations list xanh --remote
```

Xác minh thủ công danh sách migration đã áp dụng trong Cloudflare khớp với `migrations/0001_initial.sql` đến `migrations/0009_impact_display_full_control.sql` và schema thật của DB. Nếu ledger không có, bị lệch, hoặc có migration từng chạy bằng SQL Console không được ghi nhận, **dừng lại** và đối chiếu schema/database trước khi tiếp tục. Không chạy lại migration đã áp dụng.

## 3. Áp dụng migration nếu và chỉ nếu cần

Sau khi bản sao lưu đã được xác minh, schema/migration ledger khớp và môi trường staging (nếu có) đã đạt kiểm tra, chạy qua Wrangler để giữ lịch sử migration:

```bash
npx wrangler d1 migrations apply xanh --remote
npx wrangler d1 migrations list xanh --remote
```

Chỉ tiếp tục nếu output cho thấy migration dự kiến đã áp dụng thành công và schema sau đó đúng như dự kiến. **Không** tự chạy nội dung file SQL bằng D1 Console rồi tiếp tục chạy `wrangler d1 migrations apply` cho cùng migration; cách đó có thể làm lặp `ALTER TABLE`. Nếu không chắc database production đã ở trạng thái nào, không chạy lệnh apply; hãy kiểm tra trên bản sao trước.

## 4. Kiểm tra local trước deploy

```bash
npm test
npm run check
```

Kết quả local chỉ xác nhận source/test tại máy, không tự xác nhận D1, R2 hoặc custom domain production.

## 5. Deploy source

Triển khai từ branch/commit đã được review lên đúng Cloudflare Pages project `xanh-sky-first` theo quy trình release của đội ngũ. Nếu triển khai bằng CLI đã đăng nhập và đúng project:

```bash
npm run deploy
```

Sau khi deploy, xác minh deployment/commit thực tế trên Cloudflare Dashboard và kiểm tra `https://xanh.skyfirst.io.vn`. Phiên bản CSS/JS và service worker đã được bump để trình duyệt có thể tải bản mới; nếu vẫn thấy bản cũ, xác minh deployment và cache thay vì yêu cầu người dùng giảm zoom.

## 6. Smoke test sau deploy

- `/api/health` phản hồi đúng; kiểm tra trạng thái database và cấu hình crypto theo kết quả API hiện tại.
- Đăng nhập `/login` bằng tài khoản được ủy quyền; xác nhận `/setup` không cho tạo Root Admin thứ hai khi đã có Root Admin.
- Mở Admin Tổng và WordPress Tổng; xác nhận trang/bài/media tải được và thông báo rõ nếu API lỗi.
- Thay đổi một giá trị thử an toàn trong CMS/Dấu ấn xanh → lưu → tải lại Admin → kiểm tra API → tải lại trang công khai; chỉ đánh dấu thành công khi giá trị bền vững và đúng. Khôi phục bản thử nếu cần.
- Nếu đổi giá trị từ D1, kiểm tra record nguồn và quy tắc thống kê; nếu đổi giá trị thủ công, kiểm tra `manual_value` đã được lưu. Không công bố số giả để lấp dữ liệu thiếu.
- Upload một media thử lên R2 và đọc lại file; không chỉ dựa vào toast “đã lưu”.
- Kiểm tra form public submit tới D1, status trong Admin, email nếu bật; kiểm tra outbox CTT nếu tích hợp được cấu hình.
- Kiểm tra `/sitemap.xml`, `/robots.txt`, các deep-link khi refresh, trang nội dung, menu con, footer và CTA.
- Thử vai trò bị giới hạn; yêu cầu sai quyền phải bị backend trả 403.
- Mở Chrome ở zoom 100% trên desktop rộng/hẹp, tablet và điện thoại; kiểm tra menu/CTA, 7 thẻ Dấu ấn xanh, chữ/đơn vị, ảnh, footer, các form và overflow ngang.

## 7. Trạng thái nghiệm thu

Xem `FINAL_ACCEPTANCE.md` và `FINAL_AUDIT_20261011.md`. Không tuyên bố đạt 100% production trước khi hoàn thành toàn bộ smoke test yêu cầu Cloudflare và kiểm tra trực quan trên trình duyệt thật.
