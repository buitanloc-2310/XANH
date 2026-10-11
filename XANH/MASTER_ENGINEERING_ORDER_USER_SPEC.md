# MASTER ENGINEERING ORDER — XANH SKY FIRST

## FULL-SOURCE REENGINEERING · WORDPRESS TỔNG · VISUAL BUILDER · CMS · ADMIN RBAC · PRODUCTION QUALITY ASSURANCE

**MỨC ĐỘ ƯU TIÊN: CRITICAL — BẮT BUỘC THỰC HIỆN TOÀN DIỆN**

**ĐỐI TƯỢNG:** Toàn bộ mã nguồn ZIP Xanh Sky First hiện tại, bao gồm website công khai, toàn bộ trang và route, WordPress Tổng, CMS, Page Builder, Admin, API, dữ liệu, Media, hệ thống phân quyền, giao diện, tài nguyên tĩnh, cấu hình và các chức năng liên quan.

**PHƯƠNG THỨC:** REENGINEERING IN-PLACE — kiểm kê, tái cấu trúc và hoàn thiện trực tiếp trên nền tảng hiện có; không dựng một website khác để thay thế, không tạo giao diện minh họa độc lập và không thực hiện một đợt chỉnh CSS mang tính đối phó.

**KẾT QUẢ CUỐI CÙNG:** Một hệ thống Xanh Sky First thống nhất, hiện đại, minh bạch, responsive, có CMS thực sự, WordPress Tổng quản trị tập trung, Page Builder bằng khối nội dung, khả năng điều chỉnh giao diện sâu và hệ thống Admin vận hành ổn định.

**NGUYÊN TẮC CAO NHẤT:** Không được đánh đồng việc mã nguồn biên dịch thành công với việc website hoạt động đúng. Không được tuyên bố hoàn thành nếu chưa kiểm tra các luồng nghiệp vụ thực tế, dữ liệu lưu trữ, khả năng hiển thị và hành vi của giao diện.

---

# PHẦN I. PHẠM VI VÀ CÁC ĐIỀU KIỆN KHÔNG THỂ THƯƠNG LƯỢNG

## 1. Kiểm kê trước khi sửa

Bắt buộc giải nén và kiểm tra toàn bộ ZIP đầu vào. Lập danh mục đầy đủ:

- Tất cả trang công khai, route, trang chi tiết và trang hệ thống.
- Toàn bộ khu vực Admin, menu quản trị, phân hệ và chức năng.
- WordPress Tổng hiện có cùng mọi tab, trình soạn thảo và luồng thao tác.
- CMS, Page Builder, Form Builder, SEO, Media và các chức năng xuất bản.
- API, middleware xác thực, phân quyền, xác thực dữ liệu và xử lý lỗi.
- Các bảng D1, migration, truy vấn, dữ liệu khởi tạo và cơ chế lưu trữ R2 nếu có.
- CSS, JavaScript, thư viện, ảnh, font chữ, banner, logo và tài nguyên giao diện.
- Các chức năng đang hoạt động, đang lỗi, chưa hoàn thiện hoặc chỉ là giao diện giả.

Phải lập bảng kiểm kê theo từng thành phần, xác định tệp phụ trách, quan hệ phụ thuộc, trạng thái và phương án sửa. Không được bỏ qua những phần không nằm ngay trên trang chủ.

## 2. Bảo toàn hệ thống hiện hữu

- Giữ nguyên thương hiệu Xanh Sky First và những nghiệp vụ đang hoạt động.
- Giữ nguyên dữ liệu, mã hồ sơ, định danh, cấu hình bảo mật và cơ chế xác thực hiện có, trừ khi có phương án nâng cấp được xác minh an toàn.
- Không tự ý đổi tên bảng, xóa dữ liệu, làm mất lịch sử, đổi mã hồ sơ cũ hoặc phá vỡ API tương thích.
- Không cài đặt một WordPress độc lập để thay thế CMS tự xây dựng hiện tại.
- Không tự ý thay đổi cơ chế vai trò đang có; phải kiểm tra và nâng cấp quyền trên nền tảng hiện hữu.
- Không chỉnh sửa source Cổng Thông tin số Sky First (CTT). Mọi công việc thuộc phạm vi này chỉ áp dụng cho Xanh Sky First.
- Không xóa cấu hình production, biến môi trường, secrets, bindings hoặc các thiết lập triển khai chỉ vì chúng chưa được hiểu rõ.

Nếu phát hiện vấn đề đòi hỏi thay đổi kiến trúc, phải nêu rõ nguyên nhân, tác động, phương án tương thích và cách khôi phục trước khi thực hiện.

## 3. Không được thực hiện các cách làm đối phó

Nghiêm cấm:

- Chỉ chỉnh vài dòng CSS rồi tuyên bố đã nâng cấp toàn website.
- Chỉ thay trang chủ nhưng bỏ qua trang con, trang chi tiết và Admin.
- Tạo nút bấm không có hành động thực tế.
- Dùng dữ liệu giả để làm cho thống kê, CMS hoặc dashboard có vẻ hoàn chỉnh.
- Tạo các tab chỉ đổi tiêu đề nhưng không có nội dung chức năng.
- Thay đổi giao diện mà không kết nối với dữ liệu và cơ chế lưu thực tế.
- Chỉ làm cho một trường hợp kiểm thử hoạt động rồi bỏ qua các trường hợp còn lại.
- Tự động quay về đầu trang, tải lại toàn bộ giao diện hoặc làm mất nội dung đang nhập khi thao tác trong Admin.
- Xóa chức năng cũ để che giấu lỗi thay vì xác định và sửa nguyên nhân.
- Báo “đã hoàn tất”, “production-ready” hoặc “đã kiểm thử đầy đủ” khi chưa có bằng chứng tương ứng.

---

# PHẦN II. TÁI THIẾT KẾ TOÀN BỘ WEBSITE

## 1. Ngôn ngữ thiết kế thống nhất

Thiết kế lại toàn bộ website theo định hướng **Xanh Sky First — hiện đại, minh bạch, cao cấp, giàu tính giáo dục và phát triển bền vững**.

Ngôn ngữ thiết kế lấy cảm hứng trực tiếp từ các hình ảnh tham chiếu đã cung cấp:

- Nền sáng, thoáng, có chiều sâu và độ tương phản tốt.
- Màu xanh dương, xanh da trời, cyan và xanh lá làm hệ màu chủ đạo.
- Gradient xanh dương – cyan – xanh lá sử dụng có kiểm soát.
- Hình ảnh thiên nhiên, môi trường, hành tinh, cộng đồng và các hoạt động thực tế.
- Các dải chuyển động mềm, đường cong, họa tiết lá và hiệu ứng ánh sáng tinh tế.
- Tiêu đề lớn, phân cấp rõ, kiểu chữ tiếng Việt dễ đọc.
- Khối nội dung có khoảng thở, căn chỉnh chuẩn và hệ thống lưới nhất quán.
- Nút hành động dễ nhận diện, trạng thái tương tác rõ ràng.
- Hiệu ứng chuyển động vừa phải, không gây rối mắt hoặc ảnh hưởng hiệu năng.

Không sao chép máy móc từng ảnh thành một website tĩnh. Phải chuyển tinh thần thiết kế trong ảnh thành hệ thống giao diện thực tế, responsive, có dữ liệu động và chỉnh sửa được trong Admin.

Không sử dụng hình ảnh AI chung chung làm vật thay thế cho hình ảnh thật đang có. Ưu tiên tài nguyên thương hiệu, hình ảnh hoạt động có nguồn gốc rõ ràng và thư viện Media do quản trị viên kiểm soát.

## 2. Phạm vi tái thiết kế

Bắt buộc rà soát và nâng cấp:

- Header, logo, menu, menu con và trạng thái menu đang chọn.
- Hero, banner, ảnh nền và các vùng giới thiệu.
- Trang chủ và tất cả khối trên trang chủ.
- Trang giới thiệu, con người, chương trình, dự án, hoạt động và tin tức.
- Trang chi tiết nội dung, trang danh sách và trang tìm kiếm nếu có.
- Trang cơ hội, sáng kiến, hợp tác, liên hệ và đăng ký.
- Các trang chính sách, quyền riêng tư, điều khoản, dữ liệu và khả năng tiếp cận.
- Trang biểu mẫu, trạng thái gửi, xác nhận và tra cứu thuộc phạm vi Xanh.
- Header, footer, menu, thanh thông tin và các thành phần dùng chung.
- Toàn bộ giao diện Admin, WordPress Tổng, CMS và các trình chỉnh sửa.
- Các trạng thái tải dữ liệu, rỗng dữ liệu, lỗi, thành công và không có quyền.

Mọi trang phải dùng cùng Design System. Không chấp nhận tình trạng trang chủ đẹp nhưng trang con cũ kỹ, lệch màu, vỡ bố cục hoặc còn thông báo “Nội dung chưa được xuất bản trong CMS” do thiếu nội dung cấu hình.

Với những trang chưa có nội dung thực tế, phải xây dựng cấu trúc hoàn chỉnh và thông báo trạng thái rõ ràng; không bịa nội dung, số liệu, dự án hoặc thành tích.

## 3. Responsive bắt buộc

Kiểm tra ít nhất ở các kích thước đại diện:

- Mobile: 360 px, 390 px và 430 px.
- Tablet: khoảng 768 px và 1024 px.
- Desktop: 1280 px, 1440 px và màn hình rộng hơn.

Phải bảo đảm:

- Không tràn ngang ngoài chủ đích.
- Không bị che nội dung, nút, menu hoặc biểu mẫu.
- Không vỡ chữ tiếng Việt, lỗi dấu, tách chữ bất thường.
- Không có tiêu đề chồng lên ảnh hoặc thành phần khác.
- Không có khoảng trắng khổng lồ không chủ đích.
- Ảnh đúng tỷ lệ, không méo và không bị cắt mất nội dung quan trọng.
- Menu và các thao tác Admin dùng được trên thiết bị hỗ trợ.
- Khoảng cách, cỡ chữ và số cột thích ứng theo kích thước màn hình.

Không được coi việc hiển thị được trên một máy tính là đã đạt tiêu chuẩn responsive.

---

# PHẦN III. HỆ THỐNG THIẾT KẾ CÓ THỂ CHỈNH SỬA TỪ ADMIN

Xây dựng khu vực **Quản trị giao diện tổng thể** để người có quyền điều chỉnh thiết kế website mà không cần sửa trực tiếp mã nguồn cho những thuộc tính đã được hệ thống hỗ trợ.

## 1. Màu sắc

Cho phép chỉnh:

- Màu thương hiệu chính, phụ và màu nhấn.
- Màu nền trang, nền khối, nền thẻ và nền biểu mẫu.
- Màu chữ chính, chữ phụ, liên kết và tiêu đề.
- Màu nút chính, nút phụ, đường viền, trạng thái hover và focus.
- Màu header, footer, menu, banner và các khu vực đặc biệt.
- Gradient, độ trong suốt, bóng đổ và màu phân cách.

Có bộ chọn màu, nhập mã HEX/RGB, xem trước, lưu bản nháp, xuất bản và khôi phục cấu hình trước.

## 2. Kiểu chữ

Cho phép điều chỉnh:

- Phông chữ chính, phông tiêu đề và phông dự phòng.
- Cỡ chữ cơ sở, H1–H6, đoạn văn, nhãn, nút và chú thích.
- Độ đậm, chiều cao dòng, khoảng cách chữ và căn chỉnh.
- Chiều rộng vùng nội dung và giới hạn độ dài dòng.
- Cỡ chữ, khoảng cách riêng theo desktop, tablet và mobile khi phù hợp.

Bắt buộc kiểm soát hiển thị tiếng Việt, dấu câu, xuống dòng và khả năng đọc. Không áp dụng quy tắc CSS toàn cục có thể phá vỡ bố cục hoặc giao diện biểu mẫu.

## 3. Bố cục và khoảng cách

Cho phép chỉnh:

- Chiều rộng vùng nội dung.
- Chiều cao và chiều rộng khối.
- Padding, margin và khoảng cách giữa các khối.
- Khoảng cách giữa tiêu đề, nội dung, ảnh và nút.
- Số cột, tỷ lệ cột và khoảng cách giữa cột.
- Căn trái, giữa, phải và căn chỉnh theo trục.
- Bo góc, đường viền, bóng đổ và lớp nền.
- Giới hạn chiều rộng, chiều cao và cách xử lý nội dung tràn.

Có trường nhập giá trị và điều khiển trực quan phù hợp. Phải giới hạn giá trị nguy hiểm, tránh phá vỡ toàn bộ website khi chỉnh một thuộc tính.

## 4. Quản lý ảnh và nền

Cho phép:

- Thay logo, favicon, banner và ảnh nền.
- Chọn ảnh từ thư viện Media.
- Tải lên ảnh mới.
- Chỉnh vị trí ảnh, tỷ lệ, kích thước và cách hiển thị.
- Chọn màu phủ, độ trong suốt và mức tương phản trên ảnh nền.
- Thay ảnh theo từng khối hoặc từng trang.
- Xem trước trên desktop/mobile.
- Lưu, xuất bản và khôi phục phiên bản trước.

Việc thay ảnh phải cập nhật đúng vị trí đã chọn, không tự động thay tất cả ảnh cùng loại ngoài phạm vi yêu cầu. Có cảnh báo khi ảnh đang được nhiều trang sử dụng.

## 5. Phạm vi tác động và tính nhất quán

Mỗi cấu hình phải xác định rõ thuộc một trong ba phạm vi:

1. Toàn website.
2. Nhóm trang hoặc mẫu trang.
3. Một trang hoặc một khối cụ thể.

Phải có cơ chế ưu tiên rõ ràng: cấu hình riêng chỉ ghi đè cấu hình toàn cục khi được thiết lập có chủ đích. Không để các chỉnh sửa chồng chéo gây ra kết quả khó dự đoán.

---

# PHẦN IV. WORDPRESS TỔNG — WORKSPACE QUẢN TRỊ TẬP TRUNG

WordPress Tổng đã được định hướng thành một khu vực quản trị tập trung. Phải kế thừa, kiểm tra và hoàn thiện chức năng này trong source hiện tại.

**Không được biến WordPress Tổng trở lại thành một trang tổng quan chỉ chứa các nút dẫn sang nhiều mục quản trị rời rạc.**

## 1. Workspace tập trung

Tổ chức các phân hệ ngay trong cùng khu vực:

- Tổng quan.
- Trang & Trang chủ.
- Bài viết & nội dung.
- Menu & Footer.
- Media · Giao diện · SEO.
- Dấu ấn xanh · Biểu mẫu.

Có thể bổ sung các phân hệ liên quan nếu thực sự cần thiết, nhưng không được làm mất những phân hệ nêu trên.

## 2. Tổng quan

Hiển thị số liệu được truy vấn từ nguồn dữ liệu thực tế:

- Số trang.
- Số bài viết.
- Số bản nháp.
- Số nội dung đã xuất bản.
- Số tài nguyên Media.
- Các thao tác tạo mới và sửa nhanh.

Mỗi chỉ số phải xác định được nguồn dữ liệu. Không tạo số liệu mẫu để lấp đầy dashboard.

## 3. Trang & Trang chủ

Từ WordPress Tổng, người dùng có quyền phải mở được trình soạn thảo để:

- Chỉnh tiêu đề và nội dung.
- Quản lý các khối nội dung.
- Thay ảnh, ảnh nền và nút hành động.
- Điều chỉnh bố cục.
- Chỉnh trạng thái bản nháp/xuất bản.
- Chỉnh SEO.
- Xem trước nội dung.
- Lưu và tiếp tục chỉnh sửa.

Phải bảo toàn dữ liệu chưa lưu khi mở bảng cài đặt, chuyển tab hoặc xem trước.

## 4. Bài viết & nội dung

Quản lý nội dung đang được hệ thống hỗ trợ, bao gồm bài viết, dự án, hoạt động, cơ hội, sáng kiến và tài nguyên.

Hỗ trợ:

- Tạo mới, chỉnh sửa, nhân bản khi phù hợp.
- Bản nháp, xuất bản và trạng thái nội dung.
- Tiêu đề, nội dung, ảnh đại diện và danh mục.
- SEO, slug và đường dẫn.
- Xem trước nội dung.
- Tìm kiếm, lọc và phân trang.

Không được làm mất kiểu nội dung hoặc dữ liệu hiện có khi tái cấu trúc.

## 5. Menu & Footer

Chỉnh sửa ngay trong workspace:

- Mục menu, thứ tự và liên kết.
- Mục menu con và nhóm điều hướng.
- Nút “Cùng hành động”.
- Nội dung footer, cột liên kết và thông tin liên hệ.
- Trạng thái hiển thị và cấu hình giao diện liên quan.

Sau khi lưu và xuất bản, phải kiểm tra menu/footer trên các trang thực sự sử dụng cấu hình đó.

## 6. Media · Giao diện · SEO

Quản lý tập trung:

- Thư viện ảnh và tài nguyên.
- Metadata, văn bản thay thế và liên kết tài nguyên.
- Cấu hình Design System.
- Cấu hình ảnh nền, logo và banner.
- SEO của trang và bài viết.
- Slug, metadata và đường dẫn trong phạm vi hệ thống hỗ trợ.

Không được chỉ tạo giao diện quản lý mà không kết nối với dữ liệu thực tế.

## 7. Dấu ấn xanh · Biểu mẫu

Kế thừa và hoàn thiện khả năng chỉnh cấu hình 7 thẻ Dấu ấn xanh cùng Form Builder hiện có.

- Không tự ý thay đổi ý nghĩa hoặc đơn vị của số liệu.
- Phân biệt số liệu đã xác minh với giá trị do quản trị viên nhập.
- Cho phép bật/tắt, sắp xếp và chỉnh nội dung các thẻ.
- Kiểm tra cách số liệu hiển thị trên website công khai.
- Biểu mẫu phải lưu và xử lý dữ liệu theo nghiệp vụ thực tế.

## 8. Quy tắc thao tác trong WordPress Tổng

Khi bấm Sửa, mở trình soạn thảo trong workspace theo luồng đã thống nhất. Sau khi lưu thành công, trở lại đúng tab và trạng thái làm việc trước đó.

Nút xem trước phải hiển thị bản xem trước mà không làm mất nội dung đang sửa hoặc đóng trình soạn thảo ngoài ý muốn.

Nếu xảy ra lỗi lưu, giữ nội dung người dùng đã nhập, hiển thị thông báo rõ và cho phép thử lại.

---

# PHẦN V. SỬA TRIỆT ĐỂ LỖI NHẢY VỀ ĐẦU TRANG TRONG ADMIN

Đây là lỗi ưu tiên cao, không được xử lý bằng cách thêm một vài đoạn CSS hoặc chỉ khôi phục vị trí cuộn sau khi giao diện đã bị tải lại.

## 1. Hành vi lỗi phải loại bỏ

Trong Admin, khi thực hiện các thao tác như:

- Chuyển tab.
- Mở hoặc đóng trình soạn thảo.
- Bấm Sửa, Lưu, Xem trước.
- Thêm, xóa, nhân bản hoặc kéo thả khối.
- Mở bảng cấu hình màu sắc, ảnh nền hoặc kiểu chữ.
- Chọn ảnh trong Media.
- Chỉnh khoảng cách và kích thước.
- Thao tác trên biểu mẫu có nhiều trường.
- Lưu cấu hình giao diện hoặc nội dung.

Trang không được tự nhảy về đầu, làm mất vị trí đang thao tác, tải lại toàn bộ document không cần thiết hoặc xóa nội dung chưa lưu.

## 2. Điều tra nguyên nhân gốc

Phải kiểm tra thực tế các nguyên nhân có thể xảy ra:

- Liên kết có `href="#"` hoặc điều hướng không cần thiết.
- Nút mặc định submit form ngoài ý muốn.
- Sự kiện click bị gắn lặp hoặc lan truyền sai.
- Component bị unmount/remount sau khi thay đổi state.
- Render lại toàn bộ workspace thay vì cập nhật phần cần thiết.
- Điều hướng route hoặc tải lại document sau thao tác lưu.
- Khóa định danh component không ổn định.
- Modal, drawer hoặc tab thay đổi vị trí scroll container.
- CSS overflow, scroll anchoring hoặc container có chiều cao không ổn định.
- Phần tử đang thao tác bị thay thế trong DOM.
- Logic lưu/xử lý lỗi tự đưa giao diện về trạng thái khởi tạo.

Không được đoán nguyên nhân rồi chèn một bản vá chung cho toàn bộ trang.

## 3. Tiêu chuẩn sửa

- Sửa tại nguyên nhân gây lỗi.
- Phân biệt rõ vùng cuộn của trang và vùng cuộn bên trong workspace.
- Giữ nguyên tab đang chọn khi lưu và khi xảy ra lỗi.
- Giữ vị trí cuộn khi cập nhật dữ liệu không yêu cầu điều hướng.
- Giữ trạng thái mở của trình soạn thảo khi thao tác cần tiếp tục chỉnh sửa.
- Không tự động gọi `window.scrollTo(0, 0)` trong các luồng cập nhật nội dung thông thường.
- Không dùng `preventDefault()` tràn lan làm hỏng liên kết hoặc biểu mẫu.
- Không lưu vị trí cuộn bằng giải pháp tạm thời để che giấu việc toàn bộ giao diện đang bị tải lại.
- Nếu người dùng chủ động điều hướng sang trang khác, hành vi điều hướng bình thường vẫn phải hoạt động.

## 4. Bộ kiểm thử chống tái phát

Thử nghiệm tối thiểu 20 chu kỳ thao tác liên tiếp trên mỗi luồng quan trọng: sửa nội dung, lưu, xem trước, chuyển tab, thêm khối, kéo thả, đổi ảnh và lưu giao diện.

Đặt vị trí cuộn ở đầu, giữa và gần cuối workspace. Thực hiện thao tác tại mỗi vị trí.

Đạt yêu cầu khi:

- Không có cú nhảy cuộn ngoài ý muốn.
- Không mất nội dung chưa lưu.
- Không đổi tab ngoài ý muốn.
- Không nhân đôi thao tác hoặc tạo bản ghi trùng.
- Không có lỗi JavaScript mới.
- Sau khi tải lại chủ động, dữ liệu đã lưu vẫn được khôi phục chính xác.

---

# PHẦN VI. KHỐI ĐẾM NGƯỢC VÀ HẠN ĐĂNG KÝ HỒ SƠ

Xây dựng khả năng tạo, cấu hình, đặt vị trí và xuất bản khối đếm ngược trực tiếp từ WordPress Tổng/Page Builder.

## 1. Cấu hình

Mỗi bộ đếm cần hỗ trợ:

- Tên chương trình hoặc hồ sơ.
- Tiêu đề, mô tả và nội dung hướng dẫn.
- Thời điểm bắt đầu và kết thúc.
- Ngày, giờ, phút và múi giờ.
- Nội dung hiển thị trước thời hạn.
- Nội dung khi sắp hết hạn.
- Nội dung khi đã hết hạn.
- Liên kết đến trang thông tin hoặc biểu mẫu.
- Nút hành động và trạng thái nút.
- Kiểu hiển thị, màu sắc, cỡ chữ, khoảng cách và bố cục.
- Trang/khối áp dụng.
- Trạng thái bản nháp, xuất bản, tạm ẩn và lưu trữ.

## 2. Hành vi

- Bộ đếm cập nhật thời gian chính xác theo thời điểm kết thúc đã lưu.
- Thời gian phải được xử lý nhất quán theo múi giờ đã cấu hình.
- Khi hết hạn, tự chuyển sang nội dung hậu thời hạn đã thiết lập.
- Không tiếp tục hiển thị nút đăng ký như thể hồ sơ còn hạn nếu nghiệp vụ đã đóng.
- Không cho phép ngày kết thúc không hợp lệ hoặc khoảng thời gian mâu thuẫn.
- Nếu thời hạn thay đổi, mọi nơi đang sử dụng cùng bộ đếm phải cập nhật đúng phạm vi.
- Bộ đếm phải hoạt động trên desktop/mobile và hỗ trợ người dùng sử dụng công nghệ hỗ trợ ở mức phù hợp.

**Quan trọng:** Bộ đếm giao diện không thay thế kiểm tra hạn ở máy chủ. Nếu hồ sơ thực sự đóng đăng ký khi hết hạn, API xử lý hồ sơ phải kiểm tra thời hạn ở phía máy chủ để ngăn gửi hồ sơ sau hạn. Không được chỉ ẩn nút bằng JavaScript.

## 3. Khả năng tái sử dụng

Có thể tạo nhiều bộ đếm cho các chương trình khác nhau, mỗi bộ có cấu hình độc lập, nhưng không được tạo mã JavaScript riêng thủ công cho từng bộ đếm.

---

# PHẦN VII. ADMIN VÀ PHÂN QUYỀN THEO VAI TRÒ

Hoàn thiện Admin theo nguyên tắc quyền tối thiểu cần thiết.

## 1. Phạm vi quyền

Rà soát và ánh xạ quyền hiện có cho các nhóm chức năng:

- Xem dashboard và dữ liệu tổng quan.
- Quản lý trang và nội dung.
- Chỉnh sửa và xuất bản bài viết.
- Quản lý Media.
- Chỉnh giao diện và Design System.
- Quản lý menu và footer.
- Quản lý biểu mẫu và hồ sơ.
- Quản lý SEO.
- Xem nhật ký hoạt động.
- Quản lý người dùng và phân quyền.
- Quản lý cấu hình hệ thống.

Đây là danh mục quyền chức năng, không phải yêu cầu tự ý tạo thêm vai trò mới hoặc thay đổi toàn bộ cơ chế hiện hữu mà chưa kiểm tra.

## 2. Nguyên tắc bảo mật

- Kiểm tra quyền ở cả giao diện lẫn API.
- Không coi việc ẩn nút là cơ chế bảo mật.
- Không cho phép gọi trực tiếp API trái quyền.
- Kiểm tra quyền sở hữu/phạm vi dữ liệu khi cần thiết.
- Không để tài khoản biên tập nội dung tự cấp quyền cao hơn.
- Các thao tác xuất bản, xóa, thay đổi cấu hình quan trọng và quản trị tài khoản phải có kiểm tra quyền tương ứng.
- Ghi nhật ký cho các thao tác quan trọng: người thực hiện, thời gian, đối tượng và kết quả.
- Không ghi secrets hoặc dữ liệu nhạy cảm vào log.
- Xử lý phiên hết hạn và truy cập trái phép đúng cách.

## 3. Trải nghiệm Admin

- Nhóm chức năng theo nhiệm vụ.
- Có tiêu đề, mô tả và trạng thái rõ ràng.
- Có trạng thái đang tải, lưu thành công, lưu thất bại và không có quyền.
- Không hiển thị tab rỗng hoặc nút không có tác dụng.
- Không lộ lỗi kỹ thuật thô cho người dùng cuối.
- Có xác nhận trước các thao tác khó hoàn tác.
- Không yêu cầu người dùng phải hiểu tên bảng dữ liệu hoặc cấu trúc API mới sử dụng được CMS.

---

# PHẦN VIII. CMS, API VÀ CƠ CHẾ LƯU TRỮ

## 1. Một nguồn dữ liệu có thẩm quyền

Xác định rõ nguồn dữ liệu chính thức cho:

- Trang và nội dung.
- Trạng thái bản nháp/xuất bản.
- Cấu hình giao diện.
- Các khối nội dung và thứ tự khối.
- Menu và footer.
- Media và metadata.
- SEO.
- Bộ đếm thời gian.
- Biểu mẫu và các dữ liệu liên quan.

Không tạo hai nguồn dữ liệu mâu thuẫn cho cùng một cấu hình. Không để giao diện đọc một giá trị mặc định nhưng Admin lại ghi vào một nơi khác.

## 2. Quy trình lưu

Mỗi thao tác lưu phải có quy trình:

1. Kiểm tra dữ liệu đầu vào.
2. Kiểm tra xác thực và quyền.
3. Ghi dữ liệu vào nguồn lưu trữ đúng.
4. Xác nhận kết quả ghi.
5. Cập nhật trạng thái giao diện.
6. Hiển thị thông báo chính xác.
7. Đọc lại dữ liệu để xác minh trong các luồng quan trọng.
8. Cập nhật website công khai hoặc trạng thái bản nháp đúng theo lựa chọn.

Không được hiển thị “Đã lưu thành công” nếu API trả lỗi hoặc chưa xác nhận ghi dữ liệu.

## 3. Khả năng tương thích

Trước khi sửa API hoặc schema, kiểm tra tất cả nơi sử dụng. Nếu bắt buộc thay đổi cấu trúc dữ liệu:

- Ưu tiên migration tương thích ngược.
- Có phương án xử lý dữ liệu hiện có.
- Có kiểm tra trước/sau migration.
- Có kế hoạch phục hồi.
- Không xóa dữ liệu production chỉ để phù hợp với code mới.

Nếu không cần thay đổi schema, không thêm migration hoặc bảng mới một cách tùy tiện.

---

# PHẦN IX. BẢN NHÁP, XEM TRƯỚC, XUẤT BẢN VÀ PHỤC HỒI

Phân biệt rõ trạng thái nội dung:

- Bản nháp.
- Đã xuất bản.
- Đã ẩn hoặc lưu trữ nếu nghiệp vụ hỗ trợ.

Xem trước phải thể hiện đúng nội dung sắp xuất bản nhưng không vô tình thay đổi bản công khai.

Khi xuất bản, hệ thống phải xác nhận thành công trước khi báo hoàn tất. Nếu xuất bản thất bại, giữ bản nháp và thông báo lỗi.

Với cấu hình giao diện, ảnh nền, menu và footer, cần có lịch sử thay đổi hoặc bản khôi phục an toàn. Tránh để một chỉnh sửa sai làm hỏng toàn bộ website.

---

# PHẦN X. HIỆU NĂNG, ỔN ĐỊNH VÀ KHẢ NĂNG TIẾP CẬN

Bắt buộc:

- Loại bỏ lỗi JavaScript gây trắng trang.
- Xử lý lỗi API, dữ liệu rỗng và lỗi tài nguyên.
- Không để một lỗi không nghiêm trọng làm toàn bộ website ngừng render.
- Tối ưu kích thước ảnh và tải tài nguyên hợp lý.
- Tránh tải lặp các thư viện hoặc truy vấn không cần thiết.
- Hạn chế layout shift gây nhảy nội dung.
- Có thông báo lỗi dễ hiểu và log kỹ thuật đủ để chẩn đoán.
- Bảo đảm điều hướng bằng bàn phím ở các chức năng quan trọng.
- Có focus state rõ ràng, nhãn biểu mẫu và văn bản thay thế cho ảnh cần thiết.
- Không dùng màu sắc làm tín hiệu duy nhất cho trạng thái.
- Tôn trọng cài đặt giảm chuyển động khi phù hợp.

Không được dùng hiệu ứng đồ họa nặng để đánh đổi tốc độ tải và khả năng sử dụng.

---

# PHẦN XI. KIỂM THỬ VÀ NGHIỆM THU BẮT BUỘC

## 1. Kiểm tra source

- Toàn bộ tệp JavaScript phải vượt qua kiểm tra cú pháp.
- Chạy toàn bộ bài kiểm thử hiện có.
- Bổ sung kiểm thử cho các lỗi đã sửa.
- Chạy kiểm tra cấu trúc production.
- Kiểm tra tính toàn vẹn ZIP.
- Kiểm tra các import, đường dẫn, tài nguyên và phụ thuộc.
- Kiểm tra các API quan trọng và quyền truy cập.
- Không được bỏ qua test thất bại mà không giải thích và xử lý.

Nếu công cụ kiểm thử yêu cầu môi trường hoặc secrets chưa có, phải nêu rõ giới hạn, không giả lập kết quả thành đạt.

## 2. Kiểm thử chức năng CMS

Phải thực hiện các luồng đầu-cuối:

**Trang:** mở → sửa → lưu nháp → tải lại → nội dung vẫn còn → xuất bản → website công khai hiển thị đúng.

**Bài viết:** tạo mới → thêm nội dung/ảnh → chỉnh SEO → lưu → xem trước → xuất bản → kiểm tra trang chi tiết.

**Giao diện:** đổi màu → đổi font → thay ảnh nền → điều chỉnh khoảng cách → xem trước → xuất bản → tải lại → xác nhận cấu hình vẫn tồn tại.

**Khối nội dung:** thêm → sửa → nhân bản → kéo thả → lưu → tải lại → kiểm tra thứ tự và dữ liệu.

**Bộ đếm:** tạo → cấu hình hạn → xuất bản → kiểm tra trước hạn → kiểm tra thời điểm hết hạn → xác minh API từ chối hồ sơ sau hạn nếu nghiệp vụ yêu cầu.

**Phân quyền:** thử tài khoản có quyền và không có quyền; kiểm tra cả giao diện và gọi API trực tiếp.

**Cuộn trang:** thao tác ở đầu, giữa và cuối workspace; xác minh không nhảy vị trí và không mất nội dung.

## 3. Kiểm thử production

Chỉ xác nhận production khi đã triển khai trên môi trường thực và có bằng chứng kiểm tra:

- Trang chủ và trang con tải bình thường.
- Admin đăng nhập được.
- Workspace WordPress Tổng hoạt động.
- Dữ liệu thực sự lưu được và đọc lại được.
- Cấu hình giao diện phản ánh đúng trên website công khai.
- Media mới hiển thị đúng.
- Quyền truy cập được thực thi ở API.
- Không phát sinh lỗi console hoặc lỗi mạng nghiêm trọng trong các luồng đã kiểm thử.

Không được lấy bài test chạy trên source cục bộ làm bằng chứng thay thế kiểm thử D1/R2 production.

---

# PHẦN XII. CÁC SẢN PHẨM BÀN GIAO BẮT BUỘC

Bàn giao đầy đủ:

1. **ZIP source Xanh Sky First đã hoàn thiện**, có thể giải nén và sử dụng để triển khai theo hướng dẫn.
2. Báo cáo kiểm kê toàn bộ source trước/sau.
3. Danh sách tệp đã sửa và lý do sửa.
4. Danh sách chức năng đã hoàn thành, chưa hoàn thành và giới hạn còn tồn tại.
5. Báo cáo kiểm thử thực tế, bao gồm test đạt, test thất bại và các mục chưa thể kiểm tra.
6. Hướng dẫn triển khai, cấu hình môi trường và quy trình rollback.
7. Hướng dẫn sử dụng WordPress Tổng, Page Builder, Media, Design System và bộ đếm.
8. Danh sách thay đổi database/migration nếu thực sự cần.
9. Các câu lệnh SQL hoặc migration đầy đủ, đúng thứ tự, nếu có thay đổi dữ liệu.
10. Danh sách các bước cần thực hiện thủ công trong môi trường production.

Không được chỉ gửi ảnh chụp giao diện, mã giả, đoạn CSS rời rạc hoặc một bản báo cáo mà thiếu ZIP source tương ứng.

Không được cung cấp liên kết tải chưa tồn tại hoặc chưa được xác minh.

---

# PHẦN XIII. ĐIỀU KIỆN CHỐT NGHIỆM THU

Chỉ được đánh dấu hoàn thành khi đáp ứng toàn bộ điều kiện sau:

- [ ] Đã kiểm kê toàn bộ source ZIP.
- [ ] Đã tái thiết kế tất cả khu vực thuộc phạm vi.
- [ ] Design System có thể điều chỉnh từ Admin và lưu được thực tế.
- [ ] Ảnh nền, banner, logo và Media có thể thay đổi đúng phạm vi.
- [ ] WordPress Tổng là workspace tập trung có chức năng thật.
- [ ] Page Builder quản lý được các khối nội dung đã cam kết.
- [ ] Có thể tạo và cấu hình bộ đếm ngược/hạn đăng ký.
- [ ] Lỗi tự nhảy về đầu trang đã được xác định nguyên nhân và kiểm thử chống tái phát.
- [ ] Phân quyền được kiểm tra ở cả giao diện và API.
- [ ] Dữ liệu được lưu, tải lại và xuất bản chính xác.
- [ ] Không còn lỗi cú pháp JavaScript.
- [ ] Các kiểm thử bắt buộc đã chạy và có báo cáo trung thực.
- [ ] Responsive đã được kiểm tra ở các kích thước đại diện.
- [ ] Source CTT không bị sửa.
- [ ] ZIP bàn giao tồn tại, toàn vẹn và đúng là phiên bản đã kiểm thử.
- [ ] Mọi giới hạn liên quan đến production được công khai rõ ràng.

## LỆNH CUỐI CÙNG

Thực hiện theo đúng thứ tự: **KIỂM KÊ → XÁC ĐỊNH NGUYÊN NHÂN → TÁI CẤU TRÚC → TÍCH HỢP CMS → HOÀN THIỆN ADMIN → KIỂM THỬ → ĐÓNG GÓI → BÀN GIAO.**

Không được bỏ qua hạng mục khó, không được tự thu hẹp phạm vi, không được thay chức năng thật bằng giao diện minh họa và không được tuyên bố đạt nghiệm thu khi chưa có bằng chứng.

Nếu một chức năng chưa thể hoàn thành vì thiếu môi trường, quyền truy cập, dữ liệu hoặc dịch vụ phụ thuộc, phải nêu rõ chức năng nào, nguyên nhân nào, bằng chứng nào và điều kiện cần để hoàn thành. Không được che giấu giới hạn bằng cách đánh dấu hoàn thành.

**Mục tiêu không phải là làm cho website trông đẹp trong một ảnh chụp. Mục tiêu là xây dựng một website hoàn chỉnh, có thể quản trị, có thể thay đổi giao diện, có dữ liệu thật, vận hành ổn định và có thể kiểm chứng từng chức năng.**