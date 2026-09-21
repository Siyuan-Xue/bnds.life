-- Additive and safe for the existing uploader: inserts that omit the column
-- receive false, and existing videos are never selected automatically.
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
