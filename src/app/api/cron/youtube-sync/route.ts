import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { parseDuration } from '@/lib/utils/duration';

type YoutubeSearchResponse = {
    items?: Array<{ id?: { videoId?: string } }>;
};

type YoutubeVideoResponse = {
    items?: Array<{
        id?: string;
        snippet?: {
            title?: string;
            description?: string;
            publishedAt?: string;
            channelTitle?: string;
            thumbnails?: Record<string, { url?: string }>;
        };
        contentDetails?: { duration?: string };
    }>;
};

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

function getEnvNumber(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) ? value : fallback;
}

function pickThumbnail(thumbnails?: Record<string, { url?: string }>) {
    if (!thumbnails) return null;
    return (
        thumbnails.maxres?.url ||
        thumbnails.standard?.url ||
        thumbnails.high?.url ||
        thumbnails.medium?.url ||
        thumbnails.default?.url ||
        null
    );
}

async function fetchJson<T>(url: string) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`YouTube API ${response.status}: ${text}`);
    }
    return response.json() as Promise<T>;
}

export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    const url = new URL(request.url);
    const token = request.headers.get('x-cron-secret') || url.searchParams.get('secret');

    if (cronSecret && token !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing YOUTUBE_API_KEY' }, { status: 500 });
    }

    const minDurationMinutes = getEnvNumber('YOUTUBE_MIN_DURATION_MINUTES', 35);
    const lookbackDays = getEnvNumber('YOUTUBE_LOOKBACK_DAYS', 7);
    const maxResults = getEnvNumber('YOUTUBE_MAX_RESULTS', 5);
    const publishedAfter = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    const supabase = createServiceClient();
    const { data: channels, error } = await supabase
        .from('channels')
        .select('id, youtube_channel_id, name, approved')
        .eq('approved', true);

    if (error) {
        return NextResponse.json({ error: `Failed to load channels: ${error.message}` }, { status: 500 });
    }

    const summary = {
        channelsProcessed: 0,
        videosFound: 0,
        videosFiltered: 0,
        videosUpserted: 0,
        errors: [] as Array<{ channelId: string; error: string }>,
    };

    for (const channel of channels || []) {
        summary.channelsProcessed += 1;
        try {
            const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
            searchUrl.searchParams.set('part', 'snippet');
            searchUrl.searchParams.set('channelId', channel.youtube_channel_id);
            searchUrl.searchParams.set('publishedAfter', publishedAfter);
            searchUrl.searchParams.set('maxResults', String(maxResults));
            searchUrl.searchParams.set('order', 'date');
            searchUrl.searchParams.set('type', 'video');
            searchUrl.searchParams.set('key', apiKey);

            const searchData = await fetchJson<YoutubeSearchResponse>(searchUrl.toString());
            const videoIds = (searchData.items || [])
                .map((item) => item.id?.videoId)
                .filter((id): id is string => Boolean(id));

            if (videoIds.length === 0) {
                await supabase
                    .from('channels')
                    .update({ last_synced_at: new Date().toISOString() })
                    .eq('id', channel.id);
                continue;
            }

            const detailsUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
            detailsUrl.searchParams.set('part', 'snippet,contentDetails');
            detailsUrl.searchParams.set('id', videoIds.join(','));
            detailsUrl.searchParams.set('key', apiKey);

            const detailsData = await fetchJson<YoutubeVideoResponse>(detailsUrl.toString());
            const normalized = (detailsData.items || [])
                .map((item) => {
                    const durationSeconds = parseDuration(item.contentDetails?.duration || '');
                    if (!item.id || !item.snippet?.title || !item.snippet.publishedAt) return null;
                    return {
                        youtube_video_id: item.id,
                        channel_id: channel.id,
                        title: item.snippet.title,
                        description: item.snippet.description || null,
                        published_at: item.snippet.publishedAt,
                        duration_seconds: durationSeconds || null,
                        thumbnail_url: pickThumbnail(item.snippet.thumbnails),
                    };
                })
                .filter((item): item is NonNullable<typeof item> => Boolean(item));

            summary.videosFound += normalized.length;

            const filtered = normalized.filter(
                (video) => (video.duration_seconds || 0) >= minDurationMinutes * 60
            );

            summary.videosFiltered += filtered.length;

            if (filtered.length > 0) {
                const { data: upserted, error: upsertError } = await supabase
                    .from('videos')
                    .upsert(filtered, { onConflict: 'youtube_video_id' })
                    .select('id');

                if (upsertError) {
                    throw new Error(upsertError.message);
                }

                summary.videosUpserted += upserted?.length ?? 0;
            }

            const latestPublished = normalized.reduce<string | null>((latest, item) => {
                if (!item.published_at) return latest;
                if (!latest) return item.published_at;
                return new Date(item.published_at) > new Date(latest) ? item.published_at : latest;
            }, null);

            await supabase
                .from('channels')
                .update({
                    last_synced_at: new Date().toISOString(),
                    last_synced_video_published_at: latestPublished,
                })
                .eq('id', channel.id);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            summary.errors.push({ channelId: channel.youtube_channel_id, error: message });
        }
    }

    return NextResponse.json({ ok: true, summary });
}
