ALTER TABLE videos
    ADD COLUMN IF NOT EXISTS youtube_channel_id TEXT;

UPDATE videos v
SET youtube_channel_id = c.youtube_channel_id
FROM channels c
WHERE v.channel_id = c.id
  AND v.youtube_channel_id IS NULL;

ALTER TABLE videos
    ALTER COLUMN youtube_channel_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_videos_youtube_channel
    ON videos (youtube_channel_id);

DROP VIEW IF EXISTS videos_list;

CREATE OR REPLACE VIEW videos_list AS
SELECT
    v.id,
    v.youtube_video_id,
    v.youtube_channel_id,
    v.title,
    v.channel_name,
    v.channel_id,
    v.published_at,
    v.duration_seconds,
    v.thumbnail_url,
    v.video_url,
    v.status,
    v.transcript_status,
    v.analysis_status,
    v.created_at,
    v.search_tsv
FROM videos v
ORDER BY v.published_at DESC;

CREATE OR REPLACE FUNCTION ensure_video_channel() RETURNS TRIGGER AS $$
DECLARE
    resolved_id UUID;
    resolved_youtube_id TEXT;
BEGIN
    IF NEW.channel_id IS NOT NULL THEN
        SELECT youtube_channel_id INTO resolved_youtube_id
        FROM channels
        WHERE id = NEW.channel_id;

        IF resolved_youtube_id IS NOT NULL THEN
            NEW.youtube_channel_id := resolved_youtube_id;
        END IF;
    END IF;

    IF NEW.channel_id IS NULL AND NEW.youtube_channel_id IS NOT NULL THEN
        INSERT INTO channels (youtube_channel_id, name)
        VALUES (
            NEW.youtube_channel_id,
            COALESCE(NULLIF(NEW.channel_name, ''), NEW.youtube_channel_id)
        )
        ON CONFLICT (youtube_channel_id) DO UPDATE
        SET name = COALESCE(EXCLUDED.name, channels.name);

        SELECT id INTO resolved_id
        FROM channels
        WHERE youtube_channel_id = NEW.youtube_channel_id;

        NEW.channel_id := resolved_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_videos_channel_ensure ON videos;
CREATE TRIGGER trg_videos_channel_ensure
    BEFORE INSERT OR UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION ensure_video_channel();
