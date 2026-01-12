-- Newsletter Builder Migration (COMPLETE FIX)
-- Handles: enum migration, dependent views/indexes, newsletter tables
-- Designed to work on: fresh DB, partially migrated DB, or already migrated DB

BEGIN;

-- ============================================
-- STEP 0: Extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- STEP 1: Drop ALL dependent objects on videos.status
-- This must happen before ANY enum changes
-- ============================================

-- Drop views that reference videos.status
DROP VIEW IF EXISTS newsletter_items_view CASCADE;
DROP VIEW IF EXISTS videos_list CASCADE;

-- Drop indexes that have partial predicates using videos.status
-- These embed the enum type in their definition
DROP INDEX IF EXISTS idx_videos_analysis_pending;
DROP INDEX IF EXISTS idx_videos_status;

-- ============================================
-- STEP 2: Clean up any leftover types from failed migrations
-- ============================================
DO $$
DECLARE
    col_type text;
BEGIN
    -- If video_status_old exists, we had a partial migration - clean it up
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_old') THEN
        DROP TYPE IF EXISTS video_status_old CASCADE;
    END IF;

    -- If video_status_new exists but video_status also exists,
    -- we're in a partial state - need to determine which is active
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_new')
       AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status') THEN

        SELECT udt_name INTO col_type
        FROM information_schema.columns
        WHERE table_name = 'videos' AND column_name = 'status';

        IF col_type = 'video_status_new' THEN
            -- Column uses new type, swap names
            DROP TYPE IF EXISTS video_status CASCADE;
            ALTER TYPE video_status_new RENAME TO video_status;
        ELSE
            -- Column uses old type, drop the unused new type
            DROP TYPE IF EXISTS video_status_new CASCADE;
        END IF;
    END IF;
END$$;

-- ============================================
-- STEP 3: Migrate video_status enum
-- ============================================
DO $$
DECLARE
    current_labels text[];
    target_labels text[] := ARRAY['new', 'favorited', 'archived'];
    needs_migration boolean := false;
    col_type text;
BEGIN
    -- Check what type the videos.status column currently uses
    SELECT udt_name INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'status';

    IF col_type IS NULL THEN
        -- Table or column doesn't exist yet, nothing to migrate
        -- Ensure enum exists for when table is created
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status') THEN
            CREATE TYPE video_status AS ENUM ('new', 'favorited', 'archived');
        END IF;
        RETURN;
    END IF;

    -- Get current enum labels
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status') THEN
        SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
        INTO current_labels
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'video_status';

        -- Check if migration is needed
        IF current_labels IS DISTINCT FROM target_labels THEN
            needs_migration := true;
        END IF;
    ELSE
        -- Type doesn't exist but column does - unusual state
        -- Create the type
        CREATE TYPE video_status AS ENUM ('new', 'favorited', 'archived');
        needs_migration := false; -- Let the ALTER TABLE below handle it
    END IF;

    IF needs_migration THEN
        RAISE NOTICE 'Migrating video_status enum from % to %', current_labels, target_labels;

        -- Create new enum type
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_new') THEN
            CREATE TYPE video_status_new AS ENUM ('new', 'favorited', 'archived');
        END IF;

        -- Drop default first to avoid cast issues
        ALTER TABLE videos ALTER COLUMN status DROP DEFAULT;

        -- Convert column with value mapping
        ALTER TABLE videos
            ALTER COLUMN status TYPE video_status_new
            USING (
                CASE
                    WHEN status::text IN ('reviewed', 'selected', 'favorited') THEN 'favorited'::video_status_new
                    WHEN status::text IN ('skipped', 'archived') THEN 'archived'::video_status_new
                    ELSE 'new'::video_status_new
                END
            );

        -- Restore default
        ALTER TABLE videos ALTER COLUMN status SET DEFAULT 'new'::video_status_new;

        -- Swap types
        ALTER TYPE video_status RENAME TO video_status_old;
        ALTER TYPE video_status_new RENAME TO video_status;

        -- Clean up old type (safe to fail if dependencies exist)
        DROP TYPE IF EXISTS video_status_old;

        RAISE NOTICE 'video_status enum migration complete';
    ELSE
        -- Ensure default is set correctly
        ALTER TABLE videos ALTER COLUMN status SET DEFAULT 'new'::video_status;
        RAISE NOTICE 'video_status enum already correct, no migration needed';
    END IF;
END$$;

-- ============================================
-- STEP 4: Recreate indexes on videos.status
-- ============================================
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos (status);

CREATE INDEX IF NOT EXISTS idx_videos_analysis_pending ON videos (analysis_status)
    WHERE analysis_status = 'pending'
      AND transcript_status = 'success'
      AND status = 'favorited'
      AND analysis_attempts < 3;

-- ============================================
-- STEP 5: Recreate videos_list view
-- ============================================
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

-- ============================================
-- STEP 6: Newsletter enums (idempotent)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'newsletter_type') THEN
        CREATE TYPE newsletter_type AS ENUM ('urgent', 'evergreen');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_status') THEN
        CREATE TYPE issue_status AS ENUM ('draft', 'scheduled', 'published', 'archived');
    END IF;
END$$;

-- ============================================
-- STEP 7: Newsletter tables (idempotent)
-- ============================================
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

-- Add columns if they don't exist (for existing tables)
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

-- ============================================
-- STEP 8: Newsletter indexes (idempotent)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_newsletter_items_issue_position
    ON newsletter_items (issue_id, position);

CREATE INDEX IF NOT EXISTS idx_newsletter_issues_status_type
    ON newsletter_issues (status, type);

-- ============================================
-- STEP 9: Triggers for updated_at
-- ============================================
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

-- ============================================
-- STEP 10: Newsletter items view
-- ============================================
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

-- ============================================
-- STEP 11: RLS Policies (COMMENTED OUT)
-- Enabling RLS can break anon/authenticated client writes.
-- Only enable if using service role or adding write policies.
-- ============================================

-- ALTER TABLE newsletter_issues ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE newsletter_items ENABLE ROW LEVEL SECURITY;

-- DO $$
-- BEGIN
--     DROP POLICY IF EXISTS "Allow authenticated read access" ON newsletter_issues;
--     DROP POLICY IF EXISTS "Allow authenticated read access" ON newsletter_items;
--     DROP POLICY IF EXISTS "Allow service role full access" ON newsletter_issues;
--     DROP POLICY IF EXISTS "Allow service role full access" ON newsletter_items;
--
--     CREATE POLICY "Allow authenticated read access" ON newsletter_issues
--         FOR SELECT USING (auth.role() = 'authenticated');
--     CREATE POLICY "Allow authenticated read access" ON newsletter_items
--         FOR SELECT USING (auth.role() = 'authenticated');
--     CREATE POLICY "Allow service role full access" ON newsletter_issues
--         FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
--     CREATE POLICY "Allow service role full access" ON newsletter_items
--         FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
-- END$$;

COMMIT;
