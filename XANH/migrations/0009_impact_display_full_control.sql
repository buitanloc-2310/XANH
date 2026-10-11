-- Expand the existing impact display configuration for the seven approved cards.
-- Additive only: preserves the existing impact records and site settings structure.
ALTER TABLE impact_counter_config ADD COLUMN unit TEXT NOT NULL DEFAULT '';
ALTER TABLE impact_counter_config ADD COLUMN icon TEXT NOT NULL DEFAULT 'users';
ALTER TABLE impact_counter_config ADD COLUMN data_source TEXT NOT NULL DEFAULT 'd1';
ALTER TABLE impact_counter_config ADD COLUMN manual_value REAL;
ALTER TABLE impact_counter_config ADD COLUMN decimal_places INTEGER NOT NULL DEFAULT 0;

UPDATE impact_counter_config SET
  label='Tình nguyện viên tham gia',
  description='',
  unit='người', icon='users', data_source='manual', decimal_places=0,
  enabled=1, sort_order=1, updated_at=datetime('now')
WHERE metric_key='participants';

UPDATE impact_counter_config SET
  label='Hoạt động môi trường',
  description='',
  unit='hoạt động', icon='sprout', data_source='d1', decimal_places=0,
  enabled=1, sort_order=2, updated_at=datetime('now')
WHERE metric_key='completed_activities';

UPDATE impact_counter_config SET
  label='Rác thải thu gom',
  description='',
  unit='tấn', icon='recycle', data_source='d1', decimal_places=1,
  enabled=1, sort_order=3, updated_at=datetime('now')
WHERE metric_key='waste_tons';

-- Retire the rejected “Cộng đồng hưởng lợi” display card without deleting its
-- historical impact-record data. The card is no longer among the seven public metrics.
UPDATE impact_counter_config SET enabled=0, sort_order=99, updated_at=datetime('now')
WHERE metric_key='community_reached';

INSERT OR IGNORE INTO impact_counter_config
  (metric_key,label,description,start_value,duration_ms,delay_ms,hold_ms,enabled,sort_order,updated_at,unit,icon,data_source,manual_value,decimal_places)
VALUES
  ('completed_programs','Chương trình đã triển khai','',0,1900,180,0,1,4,datetime('now'),'chương trình','clipboard-check','manual',NULL,0),
  ('education_sessions','Hoạt động giáo dục môi trường','',0,2000,360,0,1,5,datetime('now'),'buổi','book-open','manual',NULL,0),
  ('green_points','Điểm xanh được kết nối','',0,2100,540,0,1,6,datetime('now'),'điểm','map-pin','manual',NULL,0),
  ('partner_units','Đơn vị đồng hành','',0,2200,720,0,1,7,datetime('now'),'đơn vị','handshake','manual',NULL,0);

-- Provide an editable intro for the homepage Impact block only when it is absent/empty.
-- Existing non-empty CMS copy is preserved.
UPDATE pages
SET blocks_json=json_set(
  blocks_json,
  '$[' || (
    SELECT CAST(j.key AS INTEGER) FROM json_each(pages.blocks_json) AS j
    WHERE json_extract(j.value,'$.type')='impact' LIMIT 1
  ) || '].body',
  'Những con số này được tổng hợp từ các hoạt động thực tế của Xanh Sky First cùng cộng đồng, thể hiện nỗ lực chung vì môi trường xanh và một tương lai bền vững.'
)
WHERE slug='home'
  AND json_valid(blocks_json)
  AND EXISTS (SELECT 1 FROM json_each(pages.blocks_json) AS j WHERE json_extract(j.value,'$.type')='impact')
  AND COALESCE((SELECT json_extract(j.value,'$.body') FROM json_each(pages.blocks_json) AS j WHERE json_extract(j.value,'$.type')='impact' LIMIT 1),'')='';

-- Align the seeded impact heading with the approved visual reference, but only
-- when the page still has the original seed copy (preserves later Admin edits).
UPDATE pages
SET blocks_json=json_set(
  blocks_json,
  '$[' || (SELECT CAST(j.key AS INTEGER) FROM json_each(pages.blocks_json) AS j WHERE json_extract(j.value,'$.type')='impact' LIMIT 1) || '].kicker',
  'DẤU ẤN XANH',
  '$[' || (SELECT CAST(j.key AS INTEGER) FROM json_each(pages.blocks_json) AS j WHERE json_extract(j.value,'$.type')='impact' LIMIT 1) || '].title',
  'Mỗi con số đại diện cho một hành động đã thực sự diễn ra.'
)
WHERE slug='home'
  AND json_valid(blocks_json)
  AND EXISTS (SELECT 1 FROM json_each(pages.blocks_json) AS j WHERE json_extract(j.value,'$.type')='impact')
  AND (SELECT json_extract(j.value,'$.kicker') FROM json_each(pages.blocks_json) AS j WHERE json_extract(j.value,'$.type')='impact' LIMIT 1)='DỮ LIỆU TÁC ĐỘNG'
  AND (SELECT json_extract(j.value,'$.title') FROM json_each(pages.blocks_json) AS j WHERE json_extract(j.value,'$.type')='impact' LIMIT 1)='Chỉ hiển thị số liệu có nguồn và trạng thái xác minh.';
