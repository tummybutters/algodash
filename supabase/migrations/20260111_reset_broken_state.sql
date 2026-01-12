-- RESET SCRIPT: Run this FIRST if your DB is in a broken state
-- This cleans up partial migrations before running the main migration
-- Safe to run multiple times (idempotent)

BEGIN;

-- Drop all dependent objects unconditionally
DROP VIEW IF EXISTS newsletter_items_view CASCADE;
DROP VIEW IF EXISTS videos_list CASCADE;
DROP INDEX IF EXISTS idx_videos_analysis_pending;
DROP INDEX IF EXISTS idx_videos_status;

-- Clean up any stale enum types from failed migrations
DO $$
DECLARE
    col_type text;
BEGIN
    -- Check what type the column currently uses
    SELECT udt_name INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'status';

    RAISE NOTICE 'Current videos.status type: %', COALESCE(col_type, 'column not found');

    -- Scenario 1: video_status_old exists (migration completed but didn't clean up)
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_old') THEN
        RAISE NOTICE 'Found video_status_old - cleaning up';
        DROP TYPE video_status_old CASCADE;
    END IF;

    -- Scenario 2: Both video_status and video_status_new exist
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_new') THEN
        IF col_type = 'video_status_new' THEN
            -- Column migrated to new type, but swap didn't happen
            RAISE NOTICE 'Column uses video_status_new - completing swap';
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status') THEN
                DROP TYPE video_status CASCADE;
            END IF;
            ALTER TYPE video_status_new RENAME TO video_status;
            -- Reset the default to use correct type name
            ALTER TABLE videos ALTER COLUMN status SET DEFAULT 'new'::video_status;
        ELSE
            -- Column still uses old type, drop unused new type
            RAISE NOTICE 'Column still uses video_status - dropping video_status_new';
            DROP TYPE video_status_new CASCADE;
        END IF;
    END IF;

    -- Scenario 3: Only video_status_new exists (video_status was dropped)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status')
       AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_new') THEN
        RAISE NOTICE 'Only video_status_new exists - renaming to video_status';
        ALTER TYPE video_status_new RENAME TO video_status;
        IF col_type IS NOT NULL THEN
            ALTER TABLE videos ALTER COLUMN status SET DEFAULT 'new'::video_status;
        END IF;
    END IF;
END$$;

-- Verify final state
DO $$
DECLARE
    col_type text;
    enum_labels text[];
BEGIN
    SELECT udt_name INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'status';

    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
    INTO enum_labels
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'video_status';

    RAISE NOTICE 'Final state - Column type: %, Enum labels: %', col_type, enum_labels;

    -- Verify we don't have leftover types
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_new') THEN
        RAISE WARNING 'video_status_new still exists - may need manual cleanup';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_old') THEN
        RAISE WARNING 'video_status_old still exists - may need manual cleanup';
    END IF;
END$$;

-- Recreate the basic videos_list view (will be properly created by main migration)
-- This ensures the app works even if main migration hasn't run
CREATE OR REPLACE VIEW videos_list AS
SELECT
    v.id,
    v.youtube_video_id,
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

-- Recreate the videos.status index
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos (status);

COMMIT;
