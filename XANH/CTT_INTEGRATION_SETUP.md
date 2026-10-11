# Liên thông Xanh Sky First → CTT

Xanh tiếp tục là nguồn dữ liệu gốc cho mã hồ sơ `XSF-*`. Khi hồ sơ được lưu, hệ thống ghi bản outbox và gửi metadata tới CTT qua HTTPS + HMAC-SHA256. Nếu CTT không sẵn sàng, hồ sơ Xanh vẫn được ghi nhận; trạng thái lỗi được lưu để quản trị viên gửi lại.

## Secret/config
- Đặt cùng một secret ngẫu nhiên tối thiểu 32 ký tự trong Cloudflare Secrets ở cả CTT và Xanh, tên `XANH_CTT_SHARED_SECRET`.
- Tuỳ chọn `XANH_CTT_ENDPOINT` cho Xanh; mặc định `https://ctt.skyfirst.io.vn/api/integrations/xanh/submissions`.
- Không đưa secret vào `wrangler.jsonc`, git hoặc ZIP.

## Migration/deploy
1. Sao lưu hai D1 database.
2. CTT: áp dụng `migrations/0007_xanh_external_submissions.sql`.
3. Xanh: áp dụng `migrations/0007_ctt_integration_outbox.sql`.
4. Cấu hình secret giống nhau ở hai môi trường; deploy CTT trước rồi Xanh.
5. Tạo hồ sơ thử; `ctt_sync: "sent"` nghĩa là CTT xác nhận nhận được.

Quản trị Xanh: `GET /api/admin/ctt-integration`; gửi lại bằng `POST /api/admin/ctt-integration/retry/{XSF-CODE}`. CTT: `GET /api/admin/xanh-submissions` với quyền `submission.view`.

Chỉ mã hồ sơ, tên, email, tên biểu mẫu, trạng thái, thời gian và URL theo dõi được gửi. Tệp đính kèm/câu trả lời chi tiết không chuyển. CTT lưu hồ sơ nguồn ngoài trong bảng riêng; không tự tạo hồ sơ nội bộ và không tự động cấp giấy chứng nhận.
