CREATE TABLE IF NOT EXISTS deleted_video_sources (
  source_sha256 text PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
-- Deliberately no videos FK: jobs and tombstones survive physical row deletion.
CREATE TABLE IF NOT EXISTS video_deletion_jobs (
  id uuid PRIMARY KEY,
  video_id uuid NOT NULL UNIQUE,
  video_title text NOT NULL DEFAULT '视频',
  source_sha256 text NOT NULL,
  requested_by text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CONSTRAINT video_deletion_jobs_status_check CHECK (status IN ('pending','running','complete','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE video_deletion_jobs ADD COLUMN IF NOT EXISTS video_title text NOT NULL DEFAULT '视频';
CREATE INDEX IF NOT EXISTS video_deletion_jobs_pending_idx ON video_deletion_jobs(status,created_at);
