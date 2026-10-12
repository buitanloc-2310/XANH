-- Xanh Sky First: lifecycle hardening and accessible visual defaults.
-- Additive migration only; existing form uploads and impact records are retained.
ALTER TABLE form_uploads ADD COLUMN expires_at TEXT;
ALTER TABLE impact_records ADD COLUMN recorded_by INTEGER;
ALTER TABLE media ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private'));

UPDATE form_uploads
SET expires_at=datetime(created_at, '+24 hours')
WHERE claimed_submission_id IS NULL AND expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_form_uploads_unclaimed_expiry
ON form_uploads(expires_at, created_at) WHERE claimed_submission_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_password_reset_user_state
ON password_reset_tokens(user_id, used_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window
ON rate_limits(window_start);

-- Update only the known starter palette; preserve administrator-defined custom colors.
UPDATE site_settings
SET value_json=json_set(
  value_json,
  '$.theme_primary', CASE WHEN json_extract(value_json,'$.theme_primary') IS NULL OR upper(json_extract(value_json,'$.theme_primary')) IN ('#0A66D8','#087FF5','#0878E8') THEN '#23794F' ELSE json_extract(value_json,'$.theme_primary') END,
  '$.theme_green', CASE WHEN json_extract(value_json,'$.theme_green') IS NULL OR upper(json_extract(value_json,'$.theme_green')) IN ('#17A673','#10AD83','#16A879') THEN '#329B65' ELSE json_extract(value_json,'$.theme_green') END,
  '$.theme_navy', CASE WHEN json_extract(value_json,'$.theme_navy') IS NULL OR upper(json_extract(value_json,'$.theme_navy')) IN ('#062B4F','#07366F','#052B4D','#123F70') THEN '#173B2D' ELSE json_extract(value_json,'$.theme_navy') END,
  '$.theme_bg', CASE WHEN json_extract(value_json,'$.theme_bg') IS NULL OR upper(json_extract(value_json,'$.theme_bg')) IN ('#F6FBFF','#F4F9FC','#F5FAF9') THEN '#F5F8F4' ELSE json_extract(value_json,'$.theme_bg') END,
  '$.theme_text', CASE WHEN json_extract(value_json,'$.theme_text') IS NULL OR upper(json_extract(value_json,'$.theme_text')) IN ('#123B70','#0A2034') THEN '#20332A' ELSE json_extract(value_json,'$.theme_text') END,
  '$.theme_font_family','be-vietnam-pro',
  '$.theme_heading_font_family','be-vietnam-pro'
), updated_at=datetime('now')
WHERE key='general' AND json_valid(value_json);

UPDATE site_settings
SET value_json=json_set(value_json,'$.body_font','Be Vietnam Pro','$.heading_font','Be Vietnam Pro'), updated_at=datetime('now')
WHERE key='appearance' AND json_valid(value_json);
