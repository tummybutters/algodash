# AGENTS.md

This project uses Supabase (Postgres). The schema below reflects the current DB. Do not assume migrations exist; treat this as the source of truth for app logic.

## Core Tables

### channels
- id (uuid, PK)
- youtube_channel_id (text, unique, required)
- name (text, required)
- thumbnail_url (text, nullable)
- approved (boolean, default true)
- last_synced_at (timestamptz)
- last_synced_video_published_at (timestamptz)
- created_at, updated_at (timestamptz)

### videos
- id (uuid, PK)
- youtube_video_id (text, unique, required)
- youtube_channel_id (text, required)
- channel_id (uuid, FK -> channels.id, required)
- title (text, required)
- description (text, nullable)
- published_at (timestamptz, required)
- duration_seconds (int, nullable)
- thumbnail_url (text, nullable)
- video_url (text, generated from youtube_video_id)
- channel_name (text, nullable)
- transcript_* fields (text/jsonb/status/attempts/timestamps)
- analysis_* fields (text/jsonb/status/attempts/timestamps)
- status (video_status enum, default 'new')
- include_in_newsletter (boolean, default false)
- notes (text, nullable)
- created_at, updated_at (timestamptz)
- search_tsv (tsvector)

### newsletter_issues
- id (uuid, PK)
- type (newsletter_type enum)
- issue_date (date)
- status (issue_status enum, default 'draft')
- title, subject, preview_text (text, nullable)
- scheduled_at (timestamptz, nullable)
- esp_campaign_id (text, nullable)
- created_at, updated_at (timestamptz)

### newsletter_items
- id (uuid, PK)
- issue_id (uuid, FK -> newsletter_issues.id)
- video_id (uuid, FK -> videos.id)
- position (int, default 0)
- fields (jsonb, default {})
- created_at, updated_at (timestamptz)
- unique(issue_id, video_id)

### sync_runs
- id (uuid, PK)
- started_at (timestamptz, default now)
- finished_at (timestamptz)
- status (text, default 'running')
- channels_processed, videos_found, videos_new, videos_updated,
  videos_skipped, transcripts_fetched, transcripts_failed (int)
- error (text)

## Expectations
- Any video ingest must supply `youtube_video_id` and `youtube_channel_id`.
- `channel_id` is required and must reference an existing `channels` row.
- If you want automatic channel creation from incoming video payloads, implement
  it at the API layer (server-side) before inserting into `videos`.
- Use `videos_list` view for list/triage queries (see schema in Supabase).

