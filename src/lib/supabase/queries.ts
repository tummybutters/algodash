import { createClient } from './server';
import type { VideoFilters, VideoListItem, Video, Channel } from '@/types/database';
import { fetchVideoDetail, fetchVideoList } from './video-queries';

/**
 * Light query for triage list (no transcript/analysis content)
 */
export async function getVideosForTriage(filters: VideoFilters): Promise<{
    data: VideoListItem[] | null;
    error: Error | null;
    count: number | null;
}> {
    const supabase = await createClient();
    const { offset, limit, ...filterParams } = filters;

    return fetchVideoList(supabase, filterParams, { offset, limit });
}

/**
 * Full video detail (for expanded view)
 */
export async function getVideoDetail(id: string): Promise<{
    data: Pick<Video, 'transcript_text' | 'analysis_text' | 'notes' | 'transcript_error' | 'analysis_error'> | null;
    error: Error | null;
}> {
    const supabase = await createClient();
    return fetchVideoDetail(supabase, id);
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
