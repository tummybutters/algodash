export type VideoStatus = 'new' | 'reviewed' | 'selected' | 'skipped' | 'archived';
export type ProcessStatus = 'pending' | 'success' | 'failed' | 'unavailable';

export interface Channel {
    id: string;
    youtube_channel_id: string;
    name: string;
    thumbnail_url: string | null;
    approved: boolean;
    last_synced_at: string | null;
    last_synced_video_published_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface Video {
    id: string;
    youtube_video_id: string;
    channel_id: string;
    title: string;
    description: string | null;
    published_at: string;
    duration_seconds: number | null;
    thumbnail_url: string | null;
    video_url: string;
    channel_name: string | null;
    transcript_text: string | null;
    transcript_json: unknown | null;
    transcript_status: ProcessStatus;
    transcript_error: string | null;
    transcript_attempts: number;
    transcript_fetched_at: string | null;
    analysis_text: string | null;
    analysis_json: unknown | null;
    analysis_model: string | null;
    analysis_status: ProcessStatus;
    analysis_error: string | null;
    analysis_attempts: number;
    analysis_generated_at: string | null;
    status: VideoStatus;
    include_in_newsletter: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

// Light video for list views (no transcript/analysis content)
export interface VideoListItem {
    id: string;
    youtube_video_id: string;
    title: string;
    channel_name: string | null;
    channel_id: string;
    published_at: string;
    duration_seconds: number | null;
    thumbnail_url: string | null;
    video_url: string;
    status: VideoStatus;
    include_in_newsletter: boolean;
    transcript_status: ProcessStatus;
    analysis_status: ProcessStatus;
    created_at: string;
}

export interface SyncRun {
    id: string;
    started_at: string;
    finished_at: string | null;
    status: string;
    channels_processed: number | null;
    videos_found: number | null;
    videos_new: number | null;
    videos_updated: number | null;
    videos_skipped: number | null;
    transcripts_fetched: number | null;
    transcripts_failed: number | null;
    error: string | null;
}

export interface VideoFilters {
    channels?: string[];
    statuses?: VideoStatus[];
    dateFrom?: string;
    dateTo?: string;
    durationMin?: number;
    durationMax?: number;
    search?: string;
    newsletterOnly?: boolean;
    offset: number;
    limit: number;
}
