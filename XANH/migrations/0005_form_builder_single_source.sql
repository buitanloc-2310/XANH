-- Make Form Builder the single source of truth for the seeded Hanoi volunteer form.
-- Only upgrades the known original 15-field seed; it will NOT overwrite a form that an admin already changed.
UPDATE forms
SET fields_json =
  substr(json_array(
    json_object('id','full_name','type','text','label','Họ và tên','required',json('true')),
    json_object('id','email','type','email','label','Email','required',json('true')),
    json_object('id','phone','type','phone','label','Số điện thoại / Zalo','required',json('true'))
  ), 1, length(json_array(
    json_object('id','full_name','type','text','label','Họ và tên','required',json('true')),
    json_object('id','email','type','email','label','Email','required',json('true')),
    json_object('id','phone','type','phone','label','Số điện thoại / Zalo','required',json('true'))
  )) - 1) || ',' || substr(fields_json, 2),
  updated_at = datetime('now')
WHERE slug='tnv-lau-dai-ha-noi'
  AND json_valid(fields_json)=1
  AND json_array_length(fields_json)=15
  AND NOT EXISTS (
    SELECT 1 FROM json_each(fields_json)
    WHERE json_extract(value,'$.id') IN ('full_name','email','phone')
  );
