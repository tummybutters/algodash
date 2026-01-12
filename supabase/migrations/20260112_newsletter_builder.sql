-- Newsletter Builder Migration
-- Run this AFTER your base schema if you're adding newsletter features
-- 
-- This migration:
-- 1. Adds the new video_status enum values if needed
-- 2. Creates newsletter_issues and newsletter_items tables
-- 3. Adds necessary indexes and triggers

-- ============================================
-- STEP 1: Check/update video_status enum
-- ============================================
-- If your existing enum is (new, reviewed, selected, skipped, archived), 
-- you need to migrate to (new, favorited, archived)

-- First check what values exist:
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'video_status'::regtype;

-- If you have old values, migrate the data first:
UPDATE videos SET status = 'archived' WHERE status IN ('skipped', 'archived');
UPDATE videos SET status = 'favorited' WHERE status IN ('reviewed', 'selected');

-- Recreate the enum (requires dropping and recreating - use this approach):
-- NOTE: If your enum is already (new, favorited, archived), skip this section

-- Create new enum type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_new') THEN
        CREATE TYPE video_status_new AS ENUM ('new', 'favorited', 'archived');
    END IF;
END$$;

-- Alter column to use new type (if old type exists)
-- ALTER TABLE videos ALTER COLUMN status TYPE video_status_new USING status::text::video_status_new;
-- DROP TYPE video_status;
-- ALTER TYPE video_status_new RENAME TO video_status;

-- ============================================
-- STEP 2: Add newsletter enums (if not exist)
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
-- STEP 3: Create newsletter_issues table
-- ============================================
CREATE TABLE IF NOT EXISTS newsletter_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type newsletter_type NOT NULL,
  issue_date DATE NOT NULL,
  status issue_status NOT NULL DEFAULT 'draft',
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 4: Create newsletter_items table
-- ============================================
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

-- ============================================
-- STEP 5: Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_newsletter_items_issue_position 
  ON newsletter_items (issue_id, position);

CREATE INDEX IF NOT EXISTS idx_newsletter_issues_status_type 
  ON newsletter_issues (status, type);

-- Update videos index for new status workflow
CREATE INDEX IF NOT EXISTS idx_videos_favorited 
  ON videos (status) WHERE status = 'favorited';

-- ============================================
-- STEP 6: Add triggers (if not exist)
-- ============================================
-- Ensure update_updated_at function exists
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Add triggers
DROP TRIGGER IF EXISTS trg_newsletter_issues_updated_at ON newsletter_issues;
CREATE TRIGGER trg_newsletter_issues_updated_at
  BEFORE UPDATE ON newsletter_issues FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_newsletter_items_updated_at ON newsletter_items;
CREATE TRIGGER trg_newsletter_items_updated_at
  BEFORE UPDATE ON newsletter_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- STEP 7: Create view (if not exist)
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
-- STEP 8: Row Level Security (if using auth)
-- ============================================
ALTER TABLE newsletter_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read access" ON newsletter_issues
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON newsletter_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role full access
CREATE POLICY "Allow service role full access" ON newsletter_issues
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON newsletter_items
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Done! Now test by running:
-- SELECT * FROM newsletter_issues LIMIT 1;
-- ============================================
