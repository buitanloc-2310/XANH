-- XANH SKY FIRST - Production schema v1
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('root_admin','administrator','content_editor','project_manager','volunteer_coordinator','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token_hash);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  blocks_json TEXT NOT NULL DEFAULT '[]',
  seo_json TEXT NOT NULL DEFAULT '{}',
  published_at TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS page_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  blocks_json TEXT NOT NULL,
  seo_json TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_revisions_page ON page_revisions(page_id, created_at DESC);

CREATE TABLE IF NOT EXISTS content_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('article','project','activity','opportunity','resource','initiative')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body_json TEXT NOT NULL DEFAULT '[]',
  cover_media_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived','open','closed','completed','reviewing')),
  category TEXT,
  location TEXT,
  starts_at TEXT,
  ends_at TEXT,
  capacity INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  published_at TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(type, slug),
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_content_type_status ON content_items(type,status,published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_location ON content_items(location);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  alt_text TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  credit TEXT NOT NULL DEFAULT '',
  focus_x REAL NOT NULL DEFAULT 0.5,
  focus_y REAL NOT NULL DEFAULT 0.5,
  uploaded_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  reference_id INTEGER,
  code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','needs_info','approved','rejected','completed')),
  assignee_id INTEGER,
  internal_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(assignee_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status,created_at DESC);

CREATE TABLE IF NOT EXISTS impact_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER,
  locality TEXT,
  confirmed_participants INTEGER NOT NULL DEFAULT 0,
  volunteer_hours REAL NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  verified_by INTEGER,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(activity_id),
  FOREIGN KEY(activity_id) REFERENCES content_items(id) ON DELETE CASCADE,
  FOREIGN KEY(verified_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  preferences_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','unsubscribed')),
  verify_token_hash TEXT,
  unsubscribe_token_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','read','replied','closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(bucket,key_hash,window_start)
);

INSERT OR IGNORE INTO site_settings(key,value_json,updated_at) VALUES ('general','{"site_name": "Xanh Sky First", "site_url": "https://xanh.skyfirst.io.vn", "tagline": "Hành động hôm nay. Xanh ngày mai.", "email_main": "xanh@skyfirst.io.vn", "email_support": "support@skyfirst.io.vn", "email_partnership": "hoptac@skyfirst.io.vn", "email_media": "truyenthong@skyfirst.io.vn", "hotline": "0924910210", "facebook": "https://fb.com/xanhskyfirst", "community": "https://fb.com/groups/sfn.network", "footer_intro": "Xanh Sky First là không gian kết nối người trẻ, cộng đồng và những nguồn lực cùng quan tâm đến môi trường và phát triển bền vững. Thông qua giáo dục môi trường, hoạt động cộng đồng, tài nguyên mở, sáng kiến của người trẻ và những chương trình được phát triển từng bước, Xanh mong muốn giúp sự quan tâm có thể trở thành những hành động phù hợp với đời sống thực tế. Chúng tôi ưu tiên cách làm có mục tiêu, thông tin rõ ràng và kết quả có cơ sở ghi nhận; đồng thời tạo điều kiện để mỗi người có thể bắt đầu đóng góp từ khả năng của mình và tiếp tục hành trình đó theo cách bền vững hơn.", "logo_url": "/assets/xanh-sky-first-logo.png", "theme_primary": "#0A66D8", "theme_green": "#17A673", "theme_navy": "#062B4F"}',datetime('now'));
INSERT OR IGNORE INTO pages(slug,title,status,blocks_json,seo_json,published_at,created_at,updated_at)
VALUES ('home','Trang chủ','published','[{"id": "hero", "type": "hero", "eyebrow": "XANH SKY FIRST · MÔI TRƯỜNG & PHÁT TRIỂN BỀN VỮNG", "title": "HÀNH ĐỘNG HÔM NAY. XANH NGÀY MAI.", "body": "Xanh Sky First hướng đến việc kết nối người trẻ, cộng đồng, tri thức và những nguồn lực phù hợp để biến sự quan tâm dành cho môi trường thành những hành động có thể bắt đầu từ thực tế. Chúng tôi tin rằng thay đổi bền vững không nhất thiết phải khởi đầu bằng những điều thật lớn, mà có thể bắt đầu từ cách mỗi người hiểu một vấn đề, thay đổi một lựa chọn, chia sẻ một kiến thức hữu ích hoặc cùng những người xung quanh thực hiện một hành động cụ thể. Thông qua hoạt động cộng đồng, giáo dục môi trường, sáng kiến của người trẻ và những dự án được phát triển từng bước, Xanh Sky First mong muốn tạo ra một không gian để bất kỳ ai quan tâm cũng có thể tìm thấy cách tham gia phù hợp với mình.", "primary_label": "Khám phá Xanh", "primary_href": "#gioi-thieu", "secondary_label": "Cùng hành động", "secondary_href": "#tham-gia", "media_id": null, "visible": true}, {"id": "about", "type": "rich", "kicker": "VỀ XANH SKY FIRST", "title": "Một không gian để sự quan tâm trở thành hành động", "body": "Xanh Sky First được phát triển như một không gian dành cho môi trường, cộng đồng và phát triển bền vững trong hệ sinh thái Sky First. Xanh không giới hạn hoạt động ở một chiến dịch hoặc một hình thức tình nguyện duy nhất, mà hướng đến việc xây dựng một hành trình từ nhận thức đến hành động: tìm hiểu vấn đề, tiếp cận kiến thức, tham gia hoạt động, đóng góp chuyên môn, đề xuất sáng kiến và cùng phát triển những giải pháp phù hợp với thực tế. Trong quá trình phát triển, Xanh ưu tiên chất lượng của từng hoạt động, tính minh bạch của thông tin và khả năng tạo ra giá trị có thể tiếp tục sau khi một chương trình kết thúc, thay vì chạy theo những con số lớn hoặc những hoạt động chỉ có giá trị truyền thông trong thời gian ngắn.", "media_id": null, "layout": "split", "visible": true}, {"id": "pillars", "type": "cards", "kicker": "ĐIỀU XANH THEO ĐUỔI", "title": "Bốn nguyên tắc cho hành động có chiều sâu", "items": [{"title": "Hiểu đúng", "body": "Xanh lựa chọn bắt đầu từ việc hiểu vấn đề thay vì vội vàng tạo ra một hoạt động chỉ để có hình ảnh. Nội dung, tài nguyên và chương trình được định hướng để người tham gia có thể tiếp cận thông tin rõ ràng, phân biệt giữa thói quen tốt, giải pháp có cơ sở và những thông điệp dễ tạo cảm giác tích cực nhưng thiếu hiệu quả thực tế. Việc hiểu đúng cũng giúp mỗi người nhìn thấy mối liên hệ giữa môi trường, sức khỏe, cộng đồng, tiêu dùng và phát triển bền vững; từ đó đưa ra lựa chọn phù hợp với điều kiện của bản thân thay vì áp dụng một công thức duy nhất cho tất cả mọi người."}, {"title": "Hành động thật", "body": "Một hoạt động chỉ có ý nghĩa khi người tham gia biết mình đang làm gì, vì sao làm và kết quả được ghi nhận ra sao. Xanh ưu tiên những hành động có thể triển khai trong bối cảnh thực tế, có mục tiêu cụ thể, có người chịu trách nhiệm và có bước tổng kết sau khi kết thúc. Điều này có thể là một buổi chia sẻ, một hoạt động cộng đồng, một tài nguyên giáo dục hay một sáng kiến nhỏ tại địa phương. Quy mô không phải tiêu chí duy nhất; tính phù hợp, khả năng duy trì và mức độ tạo ra thay đổi tích cực mới là những yếu tố được đặt lên trước."}, {"title": "Kết nối cộng đồng", "body": "Nhiều vấn đề môi trường không thể được giải quyết bởi một cá nhân đơn lẻ. Xanh hướng đến việc tạo ra những điểm kết nối giữa người trẻ có mong muốn đóng góp, người có chuyên môn, nhóm cộng đồng, đơn vị đồng hành và các nguồn lực phù hợp. Việc kết nối không nhằm tạo ra một mạng lưới chỉ để gia tăng số lượng thành viên, mà để giúp những người có cùng mối quan tâm tìm thấy nhau, chia sẻ kinh nghiệm và cùng thực hiện những việc cụ thể. Mỗi kết nối tốt cần rõ mục tiêu, rõ vai trò và tôn trọng năng lực cũng như giới hạn của từng bên tham gia."}, {"title": "Tạo giá trị bền vững", "body": "Xanh không xem một chương trình là hoàn thành chỉ vì sự kiện đã kết thúc hoặc bài truyền thông đã được đăng. Những gì được tạo ra sau hoạt động — kinh nghiệm, tài liệu, dữ liệu, câu chuyện, mối quan hệ và khả năng tiếp tục hành động — đều là một phần của giá trị. Vì vậy, hệ thống được thiết kế để mỗi dự án có thể lưu lại tiến độ, tài liệu, kết quả và báo cáo; đồng thời những nội dung hữu ích có thể quay trở lại phục vụ cộng đồng. Tư duy này giúp Xanh phát triển từng bước, tránh chạy theo nhịp độ hoạt động dày nhưng thiếu chiều sâu và thiếu khả năng học hỏi từ chính những việc đã làm."}], "visible": true}, {"id": "fields", "type": "feature_grid", "kicker": "LĨNH VỰC HÀNH ĐỘNG", "title": "Năm hướng để bắt đầu", "items": ["Môi trường & không gian sống", "Giáo dục môi trường", "Lối sống & tiêu dùng bền vững", "Đổi mới & sáng kiến xanh", "Cộng đồng & phát triển bền vững"], "visible": true}, {"id": "projects", "type": "dynamic", "source": "project", "kicker": "CHƯƠNG TRÌNH & DỰ ÁN", "title": "Những việc đang được xây dựng và triển khai", "visible": true}, {"id": "impact", "type": "impact", "kicker": "DẤU ẤN XANH", "title": "Mỗi con số đại diện cho một hành động đã thực sự diễn ra.", "visible": true}, {"id": "opportunities", "type": "dynamic", "source": "opportunity", "kicker": "CƠ HỘI", "title": "Tìm một cách phù hợp để cùng hành động", "visible": true}, {"id": "news", "type": "dynamic", "source": "article", "kicker": "TIN TỨC & CÂU CHUYỆN", "title": "Nội dung mới từ Xanh", "visible": true}, {"id": "newsletter", "type": "newsletter", "kicker": "NEWSLETTER", "title": "Một chút Xanh trong hộp thư của bạn.", "body": "Chọn những nội dung bạn thực sự muốn nhận. Xanh không tự động đưa email từ các biểu mẫu khác vào danh sách newsletter và luôn cung cấp cách hủy đăng ký rõ ràng.", "visible": true}, {"id": "join", "type": "cta", "kicker": "THAM GIA XANH", "title": "Không cần bắt đầu bằng điều lớn. Chỉ cần bắt đầu bằng một điều bạn có thể làm.", "body": "Bạn có thể tham gia một hoạt động, trở thành tình nguyện viên, gửi một sáng kiến, đóng góp chuyên môn hoặc kết nối với Xanh để cùng phát triển một chương trình phù hợp với cộng đồng.", "label": "Cùng hành động", "href": "#tham-gia", "visible": true}]','{"title": "Xanh Sky First — Hành động hôm nay. Xanh ngày mai.", "description": "Không gian kết nối người trẻ, cộng đồng và hành động vì môi trường, phát triển bền vững."}',datetime('now'),datetime('now'),datetime('now'));
