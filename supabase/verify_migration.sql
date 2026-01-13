-- Verification Script for Migration
-- Run this AFTER running the main migration script

-- Check if videos_list view exists
SELECT 
  CASE 
    WHEN to_regclass('public.videos_list') IS NOT NULL 
    THEN '✅ videos_list view exists'
    ELSE '❌ videos_list view MISSING'
  END AS view_status;

-- Check for required columns in videos table
SELECT 
  column_name,
  '✅ Column exists' AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'videos'
  AND column_name IN ('search_tsv', 'analysis_status', 'transcript_status')
ORDER BY column_name;

-- Check if we have any videos
SELECT 
  COUNT(*) AS total_videos,
  COUNT(*) FILTER (WHERE status = 'new') AS new_videos,
  COUNT(*) FILTER (WHERE status = 'favorited') AS favorited_videos,
  COUNT(*) FILTER (WHERE status = 'archived') AS archived_videos
FROM videos;

-- Check newsletter tables
SELECT 
  CASE 
    WHEN to_regclass('public.newsletter_issues') IS NOT NULL 
    THEN '✅ newsletter_issues table exists'
    ELSE '❌ newsletter_issues table MISSING'
  END AS issues_table_status;

SELECT 
  CASE 
    WHEN to_regclass('public.newsletter_items') IS NOT NULL 
    THEN '✅ newsletter_items table exists'
    ELSE '❌ newsletter_items table MISSING'
  END AS items_table_status;

SELECT 
  CASE 
    WHEN to_regclass('public.newsletter_items_view') IS NOT NULL 
    THEN '✅ newsletter_items_view exists'
    ELSE '❌ newsletter_items_view MISSING'
  END AS items_view_status;

-- Sample from videos_list (only if view exists)
DO $$
BEGIN
  IF to_regclass('public.videos_list') IS NOT NULL THEN
    RAISE NOTICE 'Testing videos_list view...';
    PERFORM * FROM videos_list LIMIT 1;
    RAISE NOTICE '✅ videos_list query successful';
  ELSE
    RAISE NOTICE '❌ videos_list view does not exist';
  END IF;
END$$;

-- Check video_status enum values
SELECT 
  enumlabel AS status_value,
  enumsortorder AS sort_order
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'video_status'
ORDER BY e.enumsortorder;
