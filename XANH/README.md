# Xanh Sky First — Production Source

Production source cho **Xanh Sky First** tại `https://xanh.skyfirst.io.vn`. Hệ thống được thiết kế như một cổng thông tin + nền tảng hoạt động + CMS quản trị, không phải landing page tĩnh. Người quản trị vận hành nội dung bằng giao diện **Xanh Sky First Management Center**, dùng Media Library, block editor, page builder và workflow quản trị thay vì sửa HTML/code hằng ngày. Yêu cầu này bám theo MASTER SPEC: upload-first, không bắt nhập URL ảnh, quản lý dự án/hoạt động/cơ hội/đăng ký/impact và dữ liệu thật thay vì số liệu dựng. 

## Hạ tầng đã cấu hình

- Domain: `xanh.skyfirst.io.vn`
- Cloudflare D1 binding: `DB`
- D1 database: `xanh`
- D1 database ID: `6445b394-1588-4ef0-b22d-d2e312cfa596`
- Cloudflare R2 binding: `STORAGE`
- R2 bucket: `xanh`
- Trang tĩnh: `public/`
- Backend: Cloudflare Pages Functions trong `functions/`

## Bảo mật mật khẩu — bắt buộc 100.000

Toàn bộ password lifecycle dùng:

```text
PBKDF2-SHA256
Iterations: 100000
```

Giá trị được hard-pin trong `functions/_lib/crypto.js`. Không có fallback mức iteration cũ vượt 100000. Áp dụng cho First-time Setup, tạo tài khoản quản trị, đổi mật khẩu, reset mật khẩu và verify password. `npm test` và `npm run check` đều kiểm tra quy tắc này.

## Triển khai

1. Cài dependency:

```bash
npm install
```

2. Chạy migrations lên D1 production:

```bash
npm run db:remote
```

3. Tạo secrets trực tiếp trên Cloudflare. Không ghi secret vào source/ZIP:

```bash
npx wrangler secret put SETUP_SECRET
npx wrangler secret put RESEND_API_KEY
```

`RESEND_API_KEY` là tùy chọn nếu chưa dùng email transactional; `SETUP_SECRET` là bắt buộc trước khi tạo Root Admin.

4. Kiểm tra source:

```bash
npm test
npm run check
```

5. Deploy Pages theo project đã kết nối hoặc:

```bash
npm run deploy
```

6. Mở `https://xanh.skyfirst.io.vn/#login`. Nếu chưa có Root Admin, giao diện tự chuyển sang `#setup`. Nhập họ tên, email, mật khẩu và `SETUP_SECRET`. Sau khi tạo Root Admin thành công, setup bị khóa vì backend phát hiện hệ thống đã có Root Admin.

## Media & ảnh

Admin dùng **Tải lên / Chọn từ Media Library**. File được ghi vào R2 `xanh`; D1 chỉ lưu metadata/reference. API upload kiểm tra loại MIME, phần mở rộng, một số signature quan trọng, giới hạn 50 MB/file và chặn SVG có script/event handler/`javascript:`/`foreignObject`. CMS không bắt ảnh phải đúng một kích thước cố định; ảnh ngang, dọc, vuông và ảnh độ phân giải lớn được lưu bản gốc, còn cách trình bày do block/layout quyết định.

Định dạng allowlist hiện tại: JPEG, PNG, WebP, AVIF, GIF, SVG an toàn, PDF, TXT, CSV, DOCX, XLSX, PPTX, MP4 và WebM. Không chấp nhận executable chỉ vì phần mở rộng được đổi tên.

## Management Center

Các khu vực chính đã có trong source:

- Dashboard
- Website CMS / Page Builder
- Tin tức & bài viết
- Dự án
- Hoạt động & sự kiện
- Cơ hội
- Sáng kiến
- Thư viện/tài nguyên
- Media Library upload R2
- Mini CRM đăng ký/TNV
- Impact Data xác minh
- Users/RBAC
- Audit Log
- Website/System Settings
- Newsletter công khai
- Contact routing
- First-time Setup
- Login, logout, đổi/reset password API

## Dữ liệu tác động

`/api/public/impact` chỉ tổng hợp `impact_records.verified = 1`. Nếu chưa có dữ liệu xác minh, website public không dựng số để nhìn đẹp. Các counter count-up chỉ xuất hiện khi có số lớn hơn 0.

## Email routing

Cài đặt mặc định trong migration:

- Xanh: `xanh@skyfirst.io.vn`
- Hợp tác: `hoptac@skyfirst.io.vn`
- Truyền thông: `truyenthong@skyfirst.io.vn`
- Hỗ trợ: `support@skyfirst.io.vn`
- Hotline/Zalo: `0924 910 210`
- Fanpage: `https://fb.com/xanhskyfirst`
- Cộng đồng chung SFN: `https://fb.com/groups/sfn.network`

Các trường này có thể sửa từ Settings sau đăng nhập.

## Local development

```bash
npm run db:local
npm run dev
```

Cloudflare local bindings cần được Wrangler khởi tạo. Không sử dụng production secrets trong máy dev nếu không cần thiết.
