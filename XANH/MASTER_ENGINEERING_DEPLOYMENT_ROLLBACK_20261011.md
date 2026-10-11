# Triển khai và rollback — Xanh Sky First

## Trạng thái trước deploy

- Source local đã qua 57/57 test, syntax check, production structure check và migration dry run trên SQLite sạch.
- Chưa triển khai production và chưa có quyền Cloudflare xác thực trong phiên xử lý này.
- Không cần áp dụng migration mới cho bản này.

## Chuẩn bị an toàn

1. Mở đúng Cloudflare Pages project hiện tại `xanh-sky-first` và xác nhận nhánh/build hiện dùng.
2. Sao lưu D1 production trước deploy theo quy trình của tổ chức. Không dùng database rỗng local thay thế D1 production.
3. Ghi nhận deployment hiện hành để rollback. Giữ nguyên bindings `DB`/`STORAGE`, environment variables, secrets, domain, redirect/header và project settings.
4. So sánh các biến môi trường với deployment hiện tại; không xóa hoặc đổi tên binding/secret vì chúng không nằm trong source diff.

## Deploy

Có thể dùng Cloudflare dashboard qua workflow hiện tại hoặc chạy trong môi trường đã xác thực và đúng project:

```bash
npm ci
npm test
npm run check
npx wrangler pages deploy public --project-name=xanh-sky-first
```

Không chạy `db:remote` cho bản này vì không có migration mới. Nếu CI đang có quy trình chuẩn khác, ưu tiên workflow đã được tổ chức phê duyệt.

## Kiểm thử sau deploy

1. Mở trang chủ, trang con và nội dung chi tiết; kiểm tra ảnh, sitemap, menu/footer và lỗi console/network.
2. Đăng nhập Admin bằng các vai trò kiểm thử được phê duyệt.
3. Trong WordPress Tổng, sửa một nội dung không nhạy cảm, lưu nháp, tải lại, kiểm tra còn dữ liệu; xuất bản có kiểm soát và mở URL công khai xác nhận nội dung.
4. Đổi một token màu nhỏ trong Design System, lưu, tải lại, kiểm tra ở trang đúng phạm vi; sau đó khôi phục giá trị ban đầu.
5. Tạo một trang/bài viết nháp và kiểm tra preview; xác nhận preview không làm mất nội dung đang sửa.
6. Kiểm tra countdown và Form Builder ở trạng thái chưa mở, đang mở và hết hạn. Xác minh server từ chối submit trước giờ mở/sau hạn.
7. Kiểm tra Dấu ấn xanh có 7 thẻ; giá trị trống hiển thị placeholder. Không dùng số giả cho test trên site công khai.
8. Thử truy cập API quản trị bằng vai trò không đủ quyền để xác nhận server-side RBAC.
9. Kiểm tra layout trực tiếp ở viewport 360, 390, 430, 768, 1024, 1280 và 1440 px, trình duyệt zoom 100%.

## Rollback

1. Nếu lỗi chức năng/giao diện nghiêm trọng, rollback deployment Pages về phiên bản trước trong Cloudflare dashboard.
2. Không xóa D1, R2, bindings hoặc secrets.
3. Vì không có migration mới, thông thường không cần khôi phục schema. Nếu người dùng đã thay đổi dữ liệu sau deploy, không restore toàn D1 mà chưa đánh giá tác động; sao lưu trạng thái hiện tại và xác định dữ liệu cần khôi phục trước.
4. Xác nhận lại trang công khai, Admin và API sau rollback.

**Không đánh dấu production nghiệm thu** cho đến khi tất cả luồng trên được thực hiện và lưu lại kết quả.
