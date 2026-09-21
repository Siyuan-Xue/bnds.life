CREATE TABLE IF NOT EXISTS "user" (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, email_verified boolean NOT NULL DEFAULT false, image text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS user_one_official_idx ON "user" (is_official) WHERE is_official = true;
CREATE UNIQUE INDEX IF NOT EXISTS user_email_lower_idx ON "user" (lower(email));
CREATE TABLE IF NOT EXISTS session (id text PRIMARY KEY, expires_at timestamp NOT NULL, token text NOT NULL UNIQUE, created_at timestamp NOT NULL, updated_at timestamp NOT NULL, ip_address text, user_agent text, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS account (id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, access_token text, refresh_token text, id_token text, access_token_expires_at timestamp, refresh_token_expires_at timestamp, scope text, password text, created_at timestamp NOT NULL, updated_at timestamp NOT NULL);
CREATE TABLE IF NOT EXISTS verification (id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamp NOT NULL, created_at timestamp, updated_at timestamp);
CREATE TABLE IF NOT EXISTS video_comments (
 id uuid PRIMARY KEY,
 video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 parent_id uuid,
 body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
 created_at timestamptz(3) NOT NULL DEFAULT now(),
 UNIQUE(id,video_id),
 FOREIGN KEY (parent_id,video_id) REFERENCES video_comments(id,video_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS video_comments_browse_idx ON video_comments(video_id,parent_id,created_at);
CREATE INDEX IF NOT EXISTS video_comments_user_idx ON video_comments(user_id,created_at);
-- Match JavaScript cursor precision, including databases initialized by an earlier draft.
ALTER TABLE video_comments ALTER COLUMN created_at TYPE timestamptz(3);
