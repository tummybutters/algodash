-- Newsletter Builder Migration (SIMPLE FIX)
-- This version drops the default value before type conversion to avoid cast errors.

-- ============================================
-- STEP 1: Handle video_status Enum Re-creation
-- ============================================
DO $$
BEGIN
    -- Only run if we haven't already migrated (check for the old type)
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status') AND 
       NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_new') THEN

        -- 1. Create the new enum type
        CREATE TYPE video_status_new AS ENUM ('new', 'favorited', 'archived');

        -- 2. Drop the default value on the column (Fixes 42804 error)
        ALTER TABLE videos ALTER COLUMN status DROP DEFAULT;

        -- 3. Update the column to use the new type
        ALTER TABLE videos ALTER COLUMN status TYPE video_status_new 
            USING (
                CASE 
                    WHEN status::text IN ('reviewed', 'selected', 'favorited') THEN 'favorited'::video_status_new
                    WHEN status::text IN ('skipped', 'archived') THEN 'archived'::video_status_new
                    ELSE 'new'::video_status_new
                END
            );
        
        -- 4. Restore the default value using the new type
        ALTER TABLE videos ALTER COLUMN status SET DEFAULT 'new'::video_status_new;

        -- 5. Drop the old type and rename the new one
        DROP TYPE video_status;
        ALTER TYPE video_status_new RENAME TO video_status;
        
    END IF;
END$$;

-- ============================================
-- STEP 2: Add newsletter enums (Idempotent)
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
-- STEP 3: Create Tables (Idempotent)
-- ============================================

CREATE TABLE IF NOT EXISTS newsletter_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type newsletter_type NOT NULL,
  issue_date DATE NOT NULL,
  status issue_status NOT NULL DEFAULT 'draft',
  title TEXT,
  
  -- Automation Metadata
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

-- ============================================
-- STEP 4: Create Indexes (Idempotent)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_newsletter_items_issue_position 
  ON newsletter_items (issue_id, position);

CREATE INDEX IF NOT EXISTS idx_newsletter_issues_status_type 
  ON newsletter_issues (status, type);

-- ============================================
-- STEP 5: Add Triggers (Idempotent)
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_newsletter_issues_updated_at ON newsletter_issues;
CREATE TRIGGER trg_newsletter_issues_updated_at
  BEFORE UPDATE ON newsletter_issues FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_newsletter_items_updated_at ON newsletter_items;
CREATE TRIGGER trg_newsletter_items_updated_at
  BEFORE UPDATE ON newsletter_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- STEP 6: Create View (Idempotent)
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
-- STEP 7: RLS Policies (Idempotent)
-- ============================================

ALTER TABLE newsletter_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read access" ON newsletter_issues;
    DROP POLICY IF EXISTS "Allow authenticated read access" ON newsletter_items;
    DROP POLICY IF EXISTS "Allow service role full access" ON newsletter_issues;
    DROP POLICY IF EXISTS "Allow service role full access" ON newsletter_items;
    
    CREATE POLICY "Allow authenticated read access" ON newsletter_issues
      FOR SELECT USING (auth.role() = 'authenticated');
    CREATE POLICY "Allow authenticated read access" ON newsletter_items
      FOR SELECT USING (auth.role() = 'authenticated');
    CREATE POLICY "Allow service role full access" ON newsletter_issues
      FOR ALL USING (auth.role() = 'service_role');
    CREATE POLICY "Allow service role full access" ON newsletter_items
      FOR ALL USING (auth.role() = 'service_role');
END$$;
