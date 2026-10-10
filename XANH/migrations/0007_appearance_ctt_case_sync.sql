-- Xanh Sky First: global appearance controls and traceable CTT case-code integration.
-- Additive migration: existing forms, submissions, IDs and codes are preserved.

ALTER TABLE form_submissions ADD COLUMN ctt_sync_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE form_submissions ADD COLUMN ctt_synced_at TEXT;
ALTER TABLE form_submissions ADD COLUMN ctt_sync_error TEXT NOT NULL DEFAULT '';

-- Preserve pre-integration records and their original codes without treating them as failed syncs.
UPDATE form_submissions SET ctt_sync_status='legacy', ctt_sync_error='Hồ sơ được tạo trước khi bật tích hợp tra cứu CTT.' WHERE ctt_sync_status='pending';

CREATE INDEX IF NOT EXISTS idx_form_submissions_ctt_sync
  ON form_submissions(ctt_sync_status, created_at);

-- A four-digit number is reserved globally and never reused, even if a submission is deleted.
CREATE TABLE IF NOT EXISTS case_code_registry (
  number INTEGER PRIMARY KEY CHECK(number BETWEEN 0 AND 9999),
  code TEXT NOT NULL UNIQUE,
  program_code TEXT NOT NULL,
  submission_id INTEGER UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY(submission_id) REFERENCES form_submissions(id) ON DELETE SET NULL
);

-- Failed cross-database writes remain visible to administrators and can be retried.
CREATE TABLE IF NOT EXISTS ctt_sync_queue (
  submission_id INTEGER PRIMARY KEY,
  case_code TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','synced','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  last_error TEXT NOT NULL DEFAULT '',
  ctt_synced_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(submission_id) REFERENCES form_submissions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ctt_sync_queue_state
  ON ctt_sync_queue(state, updated_at);

-- Website-level appearance values are editable from Management Center.
INSERT OR IGNORE INTO site_settings(key, value_json, updated_at)
VALUES (
  'appearance',
  '{"primary":"#0878E8","navy":"#123F70","green":"#099B77","background":"#F4F9FC","body_font":"Be Vietnam Pro","heading_font":"Georgia"}',
  datetime('now')
);

-- Impact counters can be sourced from verified records or explicitly marked manual values.
ALTER TABLE impact_counter_config ADD COLUMN value_mode TEXT NOT NULL DEFAULT 'verified' CHECK(value_mode IN ('verified','manual'));
ALTER TABLE impact_counter_config ADD COLUMN manual_value REAL;
ALTER TABLE impact_counter_config ADD COLUMN unit_suffix TEXT NOT NULL DEFAULT '';

-- Preserve the approved homepage copy and title emphasis while keeping other customized pages untouched.
UPDATE pages
SET blocks_json=json_set(
  blocks_json,
  '$[0].title','HÀNH ĐỘNG HÔM NAY, XANH NGÀY MAI.',
  '$[0].body','Xanh Sky First hướng đến việc kết nối người trẻ, cộng đồng, tri thức và những nguồn lực phù hợp để kiến tạo sự quan tâm, hành động và lan tỏa những giá trị tích cực cho môi trường, thiên nhiên và xã hội. Chúng tôi tin rằng thay đổi bền vững không nhất thiết phải khởi đầu bằng những điều thật lớn, mà có thể bắt đầu từ cách mỗi người hiểu, tôn trọng và lựa chọn sống xanh hơn mỗi ngày. Thông qua hoạt động cộng đồng, giáo dục môi trường, sáng kiến của người trẻ và những dự án được phát triển thực chất, Xanh Sky First mong muốn tạo ra một không gian để bất kỳ ai quan tâm cũng có thể tìm thấy cách tham gia phù hợp với mình.'
)
WHERE slug='home'
  AND json_extract(blocks_json,'$[0].type')='hero'
  AND json_extract(blocks_json,'$[0].title')='HÀNH ĐỘNG HÔM NAY. XANH NGÀY MAI.';
