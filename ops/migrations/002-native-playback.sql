ALTER TABLE video_assets DROP CONSTRAINT IF EXISTS video_assets_kind_check;
ALTER TABLE video_assets ADD CONSTRAINT video_assets_kind_check
  CHECK (kind IN ('original', 'playback', 'poster', 'native'));
