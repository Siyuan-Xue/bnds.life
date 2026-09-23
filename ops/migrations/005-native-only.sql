-- Historical native rows were folded into playback before this migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM video_assets WHERE kind = 'native') THEN
    RAISE EXCEPTION 'Legacy native rows remain; migrate their playback asset first';
  END IF;
END $$;
ALTER TABLE video_assets DROP CONSTRAINT IF EXISTS video_assets_kind_check;
ALTER TABLE video_assets ADD CONSTRAINT video_assets_kind_check
  CHECK (kind IN ('original', 'playback', 'poster'));
