import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import type { VideoFilters, VideoListItem, Video } from '@/types/database';

export const DEFAULT_DURATION_MAX_MINUTES = 240;

export type VideoFilterParams = Omit<VideoFilters, 'offset' | 'limit'>;

export type VideoDetail = Pick<
    Video,
    'transcript_text' | 'analysis_text' | 'notes' | 'transcript_error' | 'analysis_error'
>;

export function applyVideoListFilters<
    Query extends PostgrestFilterBuilder<any, any, any, any, any, any, any>
>(
    query: Query,
    filters: VideoFilterParams
): Query {
    let nextQuery = query;

    if (filters.channels?.length) {
        nextQuery = nextQuery.in('channel_id', filters.channels);
    }
    if (filters.statuses?.length) {
        nextQuery = nextQuery.in('status', filters.statuses);
    }
    if (filters.dateFrom) {
        nextQuery = nextQuery.gte('published_at', filters.dateFrom);
    }
    if (filters.dateTo) {
        nextQuery = nextQuery.lte('published_at', filters.dateTo);
    }
    if (typeof filters.durationMin === 'number' && filters.durationMin > 0) {
        nextQuery = nextQuery.gte('duration_seconds', filters.durationMin * 60);
    }
    if (
        typeof filters.durationMax === 'number'
        && filters.durationMax > 0
        && filters.durationMax < DEFAULT_DURATION_MAX_MINUTES
    ) {
        nextQuery = nextQuery.lte('duration_seconds', filters.durationMax * 60);
    }
    if (filters.search) {
        nextQuery = nextQuery.textSearch('search_tsv', filters.search, { type: 'websearch' });
    }

    return nextQuery;
}

export async function fetchVideoList(
    supabase: SupabaseClient,
    filters: VideoFilterParams,
    options: { offset: number; limit: number }
): Promise<{
    data: VideoListItem[] | null;
    error: Error | null;
    count: number | null;
}> {
    const query = applyVideoListFilters(
        supabase.from('videos_list').select('*', { count: 'exact' }),
        filters
    )
        .order('published_at', { ascending: false })
        .range(options.offset, options.offset + options.limit - 1);

    const { data, error, count } = await query;

    return {
        data: data as VideoListItem[] | null,
        error: error ? new Error(error.message) : null,
        count,
    };
}

export async function fetchVideoDetail(
    supabase: SupabaseClient,
    id: string
): Promise<{ data: VideoDetail | null; error: Error | null }> {
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
