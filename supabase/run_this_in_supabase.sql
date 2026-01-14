-- COPY AND PASTE THIS ENTIRE SCRIPT INTO SUPABASE SQL EDITOR
-- Then click "Run" or Cmd+Enter

-- ============================================
-- PART 1: CLEANUP BROKEN STATE
-- ============================================

-- Drop all dependent objects first
DROP VIEW IF EXISTS newsletter_items_view CASCADE;
DROP VIEW IF EXISTS videos_list CASCADE;
DROP INDEX IF EXISTS idx_videos_analysis_pending;
DROP INDEX IF EXISTS idx_videos_status;

-- Clean up stale enum types
DO $$
DECLARE
    col_type text;
BEGIN
    SELECT udt_name INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'status';

    RAISE NOTICE 'Current videos.status type: %', COALESCE(col_type, 'column not found');

    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_old') THEN
        RAISE NOTICE 'Dropping video_status_old';
        DROP TYPE video_status_old CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_new') THEN
        IF col_type = 'video_status_new' THEN
            RAISE NOTICE 'Completing type swap';
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status') THEN
                DROP TYPE video_status CASCADE;
            END IF;
            ALTER TYPE video_status_new RENAME TO video_status;
            ALTER TABLE videos ALTER COLUMN status SET DEFAULT 'new'::video_status;
        ELSE
            RAISE NOTICE 'Dropping unused video_status_new';
            DROP TYPE video_status_new CASCADE;
        END IF;
    END IF;
END$$;

-- ============================================
-- PART 2: MAIN MIGRATION
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migrate video_status enum if needed
DO $$
DECLARE
    current_labels text[];
    target_labels text[] := ARRAY['new', 'favorited', 'archived'];
    needs_migration boolean := false;
    col_type text;
BEGIN
    SELECT udt_name INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'status';

    IF col_type IS NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status') THEN
            CREATE TYPE video_status AS ENUM ('new', 'favorited', 'archived');
        END IF;
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status') THEN
        SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
        INTO current_labels
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'video_status';

        IF current_labels IS DISTINCT FROM target_labels THEN
            needs_migration := true;
        END IF;
    ELSE
        CREATE TYPE video_status AS ENUM ('new', 'favorited', 'archived');
        needs_migration := false;
    END IF;

    IF needs_migration THEN
        RAISE NOTICE 'Migrating video_status enum from % to %', current_labels, target_labels;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_new') THEN
            CREATE TYPE video_status_new AS ENUM ('new', 'favorited', 'archived');
        END IF;

        ALTER TABLE videos ALTER COLUMN status DROP DEFAULT;

        ALTER TABLE videos
            ALTER COLUMN status TYPE video_status_new
            USING (
                CASE
                    WHEN status::text IN ('reviewed', 'selected', 'favorited') THEN 'favorited'::video_status_new
                    WHEN status::text IN ('skipped', 'archived') THEN 'archived'::video_status_new
                    ELSE 'new'::video_status_new
                END
            );

        ALTER TABLE videos ALTER COLUMN status SET DEFAULT 'new'::video_status_new;

        ALTER TYPE video_status RENAME TO video_status_old;
        ALTER TYPE video_status_new RENAME TO video_status;

        DROP TYPE IF EXISTS video_status_old;

        RAISE NOTICE 'video_status enum migration complete';
    ELSE
        ALTER TABLE videos ALTER COLUMN status SET DEFAULT 'new'::video_status;
        RAISE NOTICE 'video_status enum already correct';
    END IF;
END$$;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos (status);
CREATE INDEX IF NOT EXISTS idx_videos_youtube_channel ON videos (youtube_channel_id);

CREATE INDEX IF NOT EXISTS idx_videos_analysis_pending ON videos (analysis_status)
    WHERE analysis_status = 'pending'
      AND transcript_status = 'success'
      AND status = 'favorited'
      AND analysis_attempts < 3;

-- Ensure youtube_channel_id is available on videos and auto-create channels
ALTER TABLE videos
    ADD COLUMN IF NOT EXISTS youtube_channel_id TEXT;

UPDATE videos v
SET youtube_channel_id = c.youtube_channel_id
FROM channels c
WHERE v.channel_id = c.id
  AND v.youtube_channel_id IS NULL;

ALTER TABLE videos
    ALTER COLUMN youtube_channel_id SET NOT NULL;

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

-- Recreate videos_list view
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

-- Newsletter enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'newsletter_type') THEN
        CREATE TYPE newsletter_type AS ENUM ('urgent', 'evergreen');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_status') THEN
        CREATE TYPE issue_status AS ENUM ('draft', 'scheduled', 'published', 'archived');
    END IF;
END$$;

-- Newsletter tables
CREATE TABLE IF NOT EXISTS newsletter_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type newsletter_type NOT NULL,
    issue_date DATE NOT NULL,
    status issue_status NOT NULL DEFAULT 'draft',
    title TEXT,
    subject TEXT,
    preview_text TEXT,
    scheduled_at TIMESTAMPTZ,
    esp_campaign_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS newsletter_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES newsletter_issues(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(issue_id, video_id)
);

-- Add columns if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'newsletter_issues' AND column_name = 'subject'
    ) THEN
        ALTER TABLE newsletter_issues ADD COLUMN subject TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'newsletter_issues' AND column_name = 'preview_text'
    ) THEN
        ALTER TABLE newsletter_issues ADD COLUMN preview_text TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'newsletter_issues' AND column_name = 'scheduled_at'
    ) THEN
        ALTER TABLE newsletter_issues ADD COLUMN scheduled_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'newsletter_issues' AND column_name = 'esp_campaign_id'
    ) THEN
        ALTER TABLE newsletter_issues ADD COLUMN esp_campaign_id TEXT;
    END IF;
END$$;

-- Newsletter indexes
CREATE INDEX IF NOT EXISTS idx_newsletter_items_issue_position
    ON newsletter_items (issue_id, position);

CREATE INDEX IF NOT EXISTS idx_newsletter_issues_status_type
    ON newsletter_issues (status, type);

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_newsletter_issues_updated_at ON newsletter_issues;
CREATE TRIGGER trg_newsletter_issues_updated_at
    BEFORE UPDATE ON newsletter_issues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_newsletter_items_updated_at ON newsletter_items;
CREATE TRIGGER trg_newsletter_items_updated_at
    BEFORE UPDATE ON newsletter_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Newsletter items view
CREATE OR REPLACE VIEW newsletter_items_view AS
SELECT
    ni.id,
    ni.issue_id,
    ni.video_id,
    ni.position,
    ni.fields,
    ni.created_at,
    ni.updated_at,
    i.type AS issue_type,
    i.issue_date,
    i.status AS issue_status,
    i.subject,
    i.preview_text,
    i.scheduled_at,
    i.esp_campaign_id,
    v.title,
    v.channel_name,
    v.thumbnail_url,
    v.video_url,
    v.duration_seconds,
    v.published_at
FROM newsletter_items ni
JOIN newsletter_issues i ON i.id = ni.issue_id
JOIN videos v ON v.id = ni.video_id;

-- Done!
SELECT 'Migration complete!' AS status;
