import { createClient } from './server';
import type { VideoFilters, VideoListItem, Video, Channel } from '@/types/database';

/**
 * Light query for triage list (no transcript/analysis content)
 */
export async function getVideosForTriage(filters: VideoFilters): Promise<{
    data: VideoListItem[] | null;
    error: Error | null;
    count: number | null;
}> {
    const supabase = await createClient();

    let query = supabase
        .from('videos_list')
        .select('*', { count: 'exact' });

    // Apply filters
    if (filters.channels?.length) {
        query = query.in('channel_id', filters.channels);
    }
    if (filters.statuses?.length) {
        query = query.in('status', filters.statuses);
    }
    if (filters.dateFrom) {
        query = query.gte('published_at', filters.dateFrom);
    }
    if (filters.dateTo) {
        query = query.lte('published_at', filters.dateTo);
    }
    if (filters.durationMin) {
        query = query.gte('duration_seconds', filters.durationMin * 60);
    }
    if (filters.durationMax) {
        query = query.lte('duration_seconds', filters.durationMax * 60);
    }
    if (filters.newsletterOnly) {
        query = query.eq('include_in_newsletter', true);
    }
    if (filters.search) {
        query = query.textSearch('search_tsv', filters.search, { type: 'websearch' });
    }

    query = query
        .order('published_at', { ascending: false })
        .range(filters.offset, filters.offset + filters.limit - 1);

    const { data, error, count } = await query;

    return {
        data: data as VideoListItem[] | null,
        error: error ? new Error(error.message) : null,
        count,
    };
}

/**
 * Full video detail (for expanded view)
 */
export async function getVideoDetail(id: string): Promise<{
    data: Pick<Video, 'transcript_text' | 'analysis_text' | 'notes' | 'transcript_error' | 'analysis_error'> | null;
    error: Error | null;
}> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('videos')
        .select('transcript_text, analysis_text, notes, transcript_error, analysis_error')
        .eq('id', id)
        .single();

    return {
        data,
        error: error ? new Error(error.message) : null,
    };
}

/**
 * Get all channels
 */
export async function getChannels(): Promise<{
    data: Channel[] | null;
    error: Error | null;
}> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('name');

    return {
        data,
        error: error ? new Error(error.message) : null,
    };
}

/**
 * Get approved channels only
 */
export async function getApprovedChannels(): Promise<{
    data: Channel[] | null;
    error: Error | null;
}> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('approved', true)
        .order('name');

    return {
        data,
        error: error ? new Error(error.message) : null,
    };
}
