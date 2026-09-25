-- Preserve the former mission text before reusing the field for hidden items.
UPDATE ideas SET highlight = CASE WHEN highlight = '' THEN '旧ミッション：' || mission ELSE highlight || char(10) || char(10) || '旧ミッション：' || mission END, mission = '' WHERE mission <> '';
