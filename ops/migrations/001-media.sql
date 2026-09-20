CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  story text,
  recorded_date text,
  status text NOT NULL DEFAULT 'draft' CONSTRAINT videos_status_check CHECK (status IN ('draft','published','hidden')),
  source_sha256 text NOT NULL UNIQUE,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS videos_browse_idx ON videos(status, recorded_date);
CREATE TABLE IF NOT EXISTS video_assets (
  id uuid PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  kind text NOT NULL CONSTRAINT video_assets_kind_check CHECK (kind IN ('original','playback','poster')),
  object_key text NOT NULL,
  original_filename text,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  sha256 text NOT NULL,
  width integer,
  height integer,
  duration_ms bigint,
  processing_method text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS video_assets_kind_idx ON video_assets(video_id,kind);
