-- The column is also a one-time migration marker: later ordinary comments
-- must never be reclassified when migrations are re-run.
DO $$
DECLARE old_root_ids uuid[];
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='video_comments' AND column_name='is_story') THEN
  ALTER TABLE video_comments ADD COLUMN is_story boolean NOT NULL DEFAULT false;
  ALTER TABLE video_comments DROP CONSTRAINT video_comments_body_check;
  SELECT array_agg(c.id) INTO old_root_ids FROM video_comments c JOIN "user" u ON u.id=c.user_id WHERE u.is_official AND c.parent_id IS NULL;
  -- Consolidate old official root posts without losing text. Replies become
  -- ordinary top-level comments because the story is now a read-only region.
  WITH old_stories AS (
   SELECT c.video_id,(array_agg(c.id ORDER BY c.created_at,c.id))[1] AS first_id,
          string_agg(c.body,E'\n\n' ORDER BY c.created_at,c.id) AS body
   FROM video_comments c JOIN "user" u ON u.id=c.user_id
   WHERE u.is_official AND c.parent_id IS NULL GROUP BY c.video_id
  )
  UPDATE video_comments c SET is_story=true,body=s.body FROM old_stories s WHERE c.id=s.first_id;
  UPDATE video_comments c SET parent_id=NULL
  WHERE c.parent_id=ANY(old_root_ids);
  DELETE FROM video_comments c WHERE c.id=ANY(old_root_ids) AND NOT c.is_story;
  INSERT INTO video_comments(id,video_id,user_id,body,is_story)
  SELECT gen_random_uuid(),v.id,u.id,trim(v.story),true
  FROM videos v CROSS JOIN "user" u
  WHERE u.is_official AND length(trim(coalesce(v.story,'')))>0
    AND NOT EXISTS (SELECT 1 FROM video_comments c WHERE c.video_id=v.id AND c.is_story);
  ALTER TABLE video_comments ADD CONSTRAINT video_comments_body_check CHECK (length(trim(body)) BETWEEN 1 AND CASE WHEN is_story THEN 100000 ELSE 5000 END);
  ALTER TABLE video_comments ADD CONSTRAINT video_comments_story_root_check CHECK (NOT is_story OR parent_id IS NULL);
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS video_comments_one_story_idx ON video_comments(video_id) WHERE is_story;
