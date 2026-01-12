-- Newsletter Builder Migration (ONE-CLICK FIX)
-- This version recreates the enum type to avoid the "unsafe use of new value" error.

-- ============================================
-- STEP 1: Handle video_status Enum Re-creation
-- ============================================
DO $$
BEGIN
    -- Create the new enum type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_new') THEN
        CREATE TYPE video_status_new AS ENUM ('new', 'favorited', 'archived');
    END IF;

    -- Update the table to use the new type
    -- (We map 'reviewed'/'selected' to 'favorited' and 'skipped' to 'archived' during conversion)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'status' 
        AND udt_name = 'video_status'
    ) THEN
        ALTER TABLE videos ALTER COLUMN status TYPE video_status_new 
            USING (
                CASE 
                    WHEN status::text IN ('reviewed', 'selected') THEN 'favorited'::video_status_new
                    WHEN status::text = 'skipped' THEN 'archived'::video_status_new
                    WHEN status::text = 'archived' THEN 'archived'::video_status_new
                    ELSE 'new'::video_status_new
                END
            );
        
        -- Drop the old type and rename the new one
        DROP TYPE video_status;
        ALTER TYPE video_status_new RENAME TO video_status;
    END IF;
END$$;

-- ============================================
-- STEP 2: Add newsletter enums
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
  
  -- Automation Metadata
  subject TEXT,
  preview_text TEXT,
  scheduled_at TIMESTAMPTZ,
  esp_campaign_id TEXT,
  
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

-- ============================================
-- STEP 6: Add triggers
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
-- STEP 7: Create view
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
-- STEP 8: Row Level Security
-- ============================================
ALTER TABLE newsletter_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated read access" ON newsletter_issues;
DROP POLICY IF EXISTS "Allow authenticated read access" ON newsletter_items;
DROP POLICY IF EXISTS "Allow service role full access" ON newsletter_issues;
DROP POLICY IF EXISTS "Allow service_role full access" ON newsletter_items;

-- Create policies
CREATE POLICY "Allow authenticated read access" ON newsletter_issues
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON newsletter_items
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow service role full access" ON newsletter_issues
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON newsletter_items
  FOR ALL USING (auth.role() = 'service_role');
