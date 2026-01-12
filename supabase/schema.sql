-- YouTube Newsletter Dashboard Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE video_status AS ENUM ('new', 'favorited', 'archived');
CREATE TYPE process_status AS ENUM ('pending', 'success', 'failed', 'unavailable');
CREATE TYPE newsletter_type AS ENUM ('urgent', 'evergreen');
CREATE TYPE issue_status AS ENUM ('draft', 'scheduled', 'published', 'archived');

-- ============================================
-- CHANNELS TABLE
-- ============================================
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_channel_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  approved BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  last_synced_video_published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- VIDEOS TABLE
-- ============================================
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id TEXT UNIQUE NOT NULL,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,

  -- Metadata (updated on re-sync)
  title TEXT NOT NULL,
  description TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER CHECK (duration_seconds >= 0),
  thumbnail_url TEXT,
  video_url TEXT GENERATED ALWAYS AS (
    'https://www.youtube.com/watch?v=' || youtube_video_id
  ) STORED,
  channel_name TEXT,

  -- Transcript
  transcript_text TEXT,
  transcript_json JSONB,
  transcript_status process_status NOT NULL DEFAULT 'pending',
  transcript_error TEXT,
  transcript_attempts INT NOT NULL DEFAULT 0,
  transcript_fetched_at TIMESTAMPTZ,

  -- AI Analysis (deferred until favorited)
  analysis_text TEXT,
  analysis_json JSONB,
  analysis_model TEXT,
  analysis_status process_status NOT NULL DEFAULT 'pending',
  analysis_error TEXT,
  analysis_attempts INT NOT NULL DEFAULT 0,
  analysis_generated_at TIMESTAMPTZ,

  -- Workflow state
  status video_status NOT NULL DEFAULT 'new',
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SYNC RUNS TABLE
-- ============================================
CREATE TABLE sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  channels_processed INT DEFAULT 0,
  videos_found INT DEFAULT 0,
  videos_new INT DEFAULT 0,
  videos_updated INT DEFAULT 0,
  videos_skipped INT DEFAULT 0,
  transcripts_fetched INT DEFAULT 0,
  transcripts_failed INT DEFAULT 0,
  error TEXT
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_videos_published ON videos (published_at DESC);
CREATE INDEX idx_videos_channel_published ON videos (channel_id, published_at DESC);
CREATE INDEX idx_videos_status ON videos (status);

-- Retry queue indexes (partial for efficiency)
CREATE INDEX idx_videos_transcript_pending ON videos (transcript_status)
  WHERE transcript_status = 'pending' AND transcript_attempts < 3;
CREATE INDEX idx_videos_analysis_pending ON videos (analysis_status)
  WHERE analysis_status = 'pending'
    AND transcript_status = 'success'
    AND status = 'favorited'
    AND analysis_attempts < 3;

-- Full-text search
ALTER TABLE videos ADD COLUMN search_tsv TSVECTOR GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(channel_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(analysis_text, '')), 'B')
) STORED;
CREATE INDEX idx_videos_search ON videos USING GIN (search_tsv);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_channels_updated_at 
  BEFORE UPDATE ON channels FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_videos_updated_at 
  BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Denormalize channel_name on insert/update
CREATE OR REPLACE FUNCTION sync_channel_name() RETURNS TRIGGER AS $$
BEGIN
  NEW.channel_name := (SELECT name FROM channels WHERE id = NEW.channel_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_videos_channel_name
  BEFORE INSERT OR UPDATE OF channel_id ON videos
  FOR EACH ROW EXECUTE FUNCTION sync_channel_name();

-- ============================================
-- VIEWS
-- ============================================

-- Light view for triage list (no transcript/analysis text)
CREATE VIEW videos_list AS
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
-- NEWSLETTER ISSUES + ITEMS
-- ============================================
CREATE TABLE newsletter_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type newsletter_type NOT NULL,
  issue_date DATE NOT NULL,
  status issue_status NOT NULL DEFAULT 'draft',
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE newsletter_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES newsletter_issues(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(issue_id, video_id)
);

CREATE INDEX idx_newsletter_items_issue_position ON newsletter_items (issue_id, position);

CREATE TRIGGER trg_newsletter_issues_updated_at
  BEFORE UPDATE ON newsletter_issues FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_newsletter_items_updated_at
  BEFORE UPDATE ON newsletter_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE VIEW newsletter_items_view AS
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
-- ROW LEVEL SECURITY (Optional - Enable for Auth)
-- ============================================
-- Uncomment these if using Supabase Auth:

-- ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow authenticated read access" ON channels
--   FOR SELECT USING (auth.role() = 'authenticated');
-- CREATE POLICY "Allow authenticated read access" ON videos
--   FOR SELECT USING (auth.role() = 'authenticated');
-- CREATE POLICY "Allow service role full access" ON channels
--   FOR ALL USING (auth.role() = 'service_role');
-- CREATE POLICY "Allow service role full access" ON videos
--   FOR ALL USING (auth.role() = 'service_role');
