'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { VideoStatus, ProcessStatus } from '@/types/database';

const TRANSCRIPT_API_URL = 'https://transcriptapi.com/api/v2/youtube/transcript';

export async function updateVideoStatus(id: string, status: VideoStatus) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('videos')
        .update({ status })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to update video status: ${error.message}`);
    }

    revalidatePath('/');
}

export async function toggleNewsletter(id: string, include: boolean) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('videos')
        .update({ include_in_newsletter: include })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to toggle newsletter: ${error.message}`);
    }

    revalidatePath('/');
}

export async function retryTranscript(id: string): Promise<{ status: ProcessStatus }> {
    const supabase = createServiceClient();

    const { data: video, error } = await supabase
        .from('videos')
        .select('youtube_video_id, transcript_attempts, transcript_status, transcript_text')
        .eq('id', id)
        .single();

    if (error || !video) {
        throw new Error(`Failed to load video for transcript: ${error?.message ?? 'Not found'}`);
    }

    if (video.transcript_status === 'success' && video.transcript_text) {
        return { status: 'success' };
    }

    const apiKey = process.env.TRANSCRIPT_API_KEY;
    const nextAttempts = (video.transcript_attempts ?? 0) + 1;

    if (!apiKey) {
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                transcript_status: 'failed',
                transcript_error: 'Missing TRANSCRIPT_API_KEY',
                transcript_attempts: nextAttempts,
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update transcript status: ${updateError.message}`);
        }

        revalidatePath('/');
        revalidatePath('/import');
        return { status: 'failed' };
    }

    const params = new URLSearchParams({
        video_url: video.youtube_video_id,
        format: 'json',
    });

    let response: Response;
    try {
        response = await fetch(`${TRANSCRIPT_API_URL}?${params.toString()}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            cache: 'no-store',
        });
    } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : 'Transcript request failed';
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                transcript_status: 'failed',
                transcript_error: message,
                transcript_attempts: nextAttempts,
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update transcript status: ${updateError.message}`);
        }

        revalidatePath('/');
        revalidatePath('/import');
        return { status: 'failed' };
    }

    let payload: unknown = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok) {
        const detail =
            typeof (payload as { detail?: unknown } | null)?.detail === 'string'
                ? (payload as { detail: string }).detail
                : `Transcript API error (${response.status})`;
        const status = response.status === 404 ? 'unavailable' : 'failed';

        const { error: updateError } = await supabase
            .from('videos')
            .update({
                transcript_status: status,
                transcript_error: detail,
                transcript_attempts: nextAttempts,
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update transcript status: ${updateError.message}`);
        }

        revalidatePath('/');
        revalidatePath('/import');
        return { status };
    }

    const transcriptPayload = (payload as { transcript?: unknown } | null)?.transcript;
    let transcriptText: string | null = null;

    if (Array.isArray(transcriptPayload)) {
        const lines = transcriptPayload
            .map((segment) => {
                if (segment && typeof segment === 'object' && 'text' in segment) {
                    const text = (segment as { text?: unknown }).text;
                    return typeof text === 'string' ? text.trim() : '';
                }
                return '';
            })
            .filter((line) => line.length > 0);
        transcriptText = lines.length > 0 ? lines.join('\n') : null;
    } else if (typeof transcriptPayload === 'string') {
        transcriptText = transcriptPayload.trim() || null;
    }

    if (!transcriptText) {
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                transcript_status: 'failed',
                transcript_error: 'Transcript payload missing text',
                transcript_attempts: nextAttempts,
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update transcript status: ${updateError.message}`);
        }

        revalidatePath('/');
        revalidatePath('/import');
        return { status: 'failed' };
    }

    const { error: updateError } = await supabase
        .from('videos')
        .update({
            transcript_text: transcriptText,
            transcript_json: payload,
            transcript_status: 'success',
            transcript_error: null,
            transcript_attempts: nextAttempts,
            transcript_fetched_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (updateError) {
        throw new Error(`Failed to update transcript: ${updateError.message}`);
    }

    revalidatePath('/');
    revalidatePath('/import');
    return { status: 'success' };
}

export async function retryAnalysis(id: string): Promise<{ status: ProcessStatus }> {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('videos')
        .update({
            analysis_status: 'pending',
            analysis_error: null,
        })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to retry analysis: ${error.message}`);
    }

    revalidatePath('/');
    revalidatePath('/import');
    return { status: 'pending' };
}

export async function updateVideoNotes(id: string, notes: string) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('videos')
        .update({ notes })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to update notes: ${error.message}`);
    }

    revalidatePath('/');
}

export async function upsertVideosManual(videos: Array<{
    youtube_video_id: string;
    channel_id: string | null;
    channel_youtube_id: string | null;
    title: string;
    description: string | null;
    published_at: string;
    duration_seconds: number | null;
    thumbnail_url: string | null;
    channel_name: string | null;
}>) {
    if (videos.length === 0) {
        return { count: 0 };
    }

    const supabase = createServiceClient();

    const channelYoutubeIds = Array.from(new Set(
        videos
            .map((video) => video.channel_youtube_id)
            .filter((id): id is string => Boolean(id))
    ));

    let channelsByYoutubeId = new Map<string, { id: string; name: string }>();

    if (channelYoutubeIds.length > 0) {
        const { data, error } = await supabase
            .from('channels')
            .select('id, youtube_channel_id, name')
            .in('youtube_channel_id', channelYoutubeIds);

        if (error) {
            throw new Error(`Failed to load channels: ${error.message}`);
        }

        (data || []).forEach((channel) => {
            channelsByYoutubeId.set(channel.youtube_channel_id, {
                id: channel.id,
                name: channel.name,
            });
        });
    }

    const missingChannelIds = channelYoutubeIds.filter((id) => !channelsByYoutubeId.has(id));
    if (missingChannelIds.length > 0) {
        const channelPayload = missingChannelIds.map((youtubeChannelId) => {
            const fallbackName = videos.find((video) => video.channel_youtube_id === youtubeChannelId)?.channel_name;
            return {
                youtube_channel_id: youtubeChannelId,
                name: fallbackName && fallbackName.trim().length > 0 ? fallbackName.trim() : youtubeChannelId,
                approved: true,
            };
        });

        const { error } = await supabase
            .from('channels')
            .upsert(channelPayload, { onConflict: 'youtube_channel_id' });

        if (error) {
            throw new Error(`Failed to create channels: ${error.message}`);
        }

        const { data, error: reloadError } = await supabase
            .from('channels')
            .select('id, youtube_channel_id, name')
            .in('youtube_channel_id', channelYoutubeIds);

        if (reloadError) {
            throw new Error(`Failed to load channels: ${reloadError.message}`);
        }

        channelsByYoutubeId = new Map(
            (data || []).map((channel) => [channel.youtube_channel_id, { id: channel.id, name: channel.name }])
        );
    }

    const preparedVideos = videos.map((video) => {
        const resolvedChannelId = video.channel_id
            || (video.channel_youtube_id ? channelsByYoutubeId.get(video.channel_youtube_id)?.id : null);

        if (!resolvedChannelId) {
            throw new Error('Missing channel mapping for one or more videos.');
        }

        return {
            youtube_video_id: video.youtube_video_id,
            channel_id: resolvedChannelId,
            title: video.title,
            description: video.description,
            published_at: video.published_at,
            duration_seconds: video.duration_seconds,
            thumbnail_url: video.thumbnail_url,
            channel_name: video.channel_name,
        };
    });

    const { data, error } = await supabase
        .from('videos')
        .upsert(preparedVideos, { onConflict: 'youtube_video_id' })
        .select('id');

    if (error) {
        throw new Error(`Failed to upsert videos: ${error.message}`);
    }

    revalidatePath('/');
    revalidatePath('/import');
    revalidatePath('/channels');

    return { count: data?.length ?? 0 };
}

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

function extractYouTubeId(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (YOUTUBE_ID_REGEX.test(trimmed)) return trimmed;

    try {
        const url = new URL(trimmed);
        const host = url.hostname.replace('www.', '');

        if (host === 'youtu.be') {
            const id = url.pathname.split('/').filter(Boolean)[0];
            return id && YOUTUBE_ID_REGEX.test(id) ? id : null;
        }

        if (host.endsWith('youtube.com')) {
            const queryId = url.searchParams.get('v');
            if (queryId && YOUTUBE_ID_REGEX.test(queryId)) return queryId;

            const parts = url.pathname.split('/').filter(Boolean);
            if (parts[0] === 'shorts' || parts[0] === 'embed') {
                const id = parts[1];
                return id && YOUTUBE_ID_REGEX.test(id) ? id : null;
            }
        }
    } catch {
        return null;
    }

    return null;
}

function normalizePublishDate(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return new Date(`${trimmed}T12:00:00Z`).toISOString();
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
}

export async function addManualVideo(input: {
    video_url: string;
    channel_id: string;
    published_at: string;
    title?: string | null;
    include_in_newsletter?: boolean;
}) {
    const supabase = createServiceClient();

    const youtubeVideoId = extractYouTubeId(input.video_url);
    if (!youtubeVideoId) {
        throw new Error('Enter a valid YouTube URL or ID.');
    }

    if (!input.channel_id) {
        throw new Error('Select a channel.');
    }

    const publishedAt = normalizePublishDate(input.published_at);
    if (!publishedAt) {
        throw new Error('Enter a valid publish date.');
    }

    let oembedTitle: string | null = null;
    let oembedThumbnail: string | null = null;

    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeVideoId}&format=json`;
        const response = await fetch(oembedUrl, { cache: 'no-store' });
        if (response.ok) {
            const data = await response.json();
            oembedTitle = typeof data?.title === 'string' ? data.title : null;
            oembedThumbnail = typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : null;
        }
    } catch {
        oembedTitle = null;
        oembedThumbnail = null;
    }

    const title = (input.title && input.title.trim().length > 0 ? input.title.trim() : oembedTitle);
    if (!title) {
        throw new Error('Title is required.');
    }

    const payload = {
        youtube_video_id: youtubeVideoId,
        channel_id: input.channel_id,
        title,
        description: null,
        published_at: publishedAt,
        duration_seconds: null,
        thumbnail_url: oembedThumbnail || `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`,
        include_in_newsletter: input.include_in_newsletter ?? true,
    };

    const { data, error } = await supabase
        .from('videos')
        .upsert(payload, { onConflict: 'youtube_video_id' })
        .select('id');

    if (error) {
        throw new Error(`Failed to add video: ${error.message}`);
    }

    revalidatePath('/');
    revalidatePath('/import');

    return { id: data?.[0]?.id ?? null };
}
