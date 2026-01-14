import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { parseDuration } from '@/lib/utils/duration';

type RawVideo = Record<string, any>;

function isUuid(value: string) {
    return /^[0-9a-fA-F-]{36}$/.test(value);
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

function asArray(body: unknown): RawVideo[] {
    if (Array.isArray(body)) return body as RawVideo[];
    if (body && typeof body === 'object') {
        const container = body as { items?: RawVideo[]; videos?: RawVideo[] };
        if (Array.isArray(container.items)) return container.items;
        if (Array.isArray(container.videos)) return container.videos;
        return [body as RawVideo];
    }
    return [];
}

function getString(value: unknown) {
    return typeof value === 'string' ? value : null;
}

function getYoutubeVideoId(raw: RawVideo) {
    const id = raw.youtube_video_id ?? raw.youtubeVideoId ?? raw.videoId ?? raw.id;
    if (typeof id === 'string') return id;
    if (id && typeof id === 'object' && 'videoId' in id) {
        const nested = (id as { videoId?: unknown }).videoId;
        return typeof nested === 'string' ? nested : null;
    }
    return null;
}

function getDurationSeconds(raw: RawVideo) {
    const direct = raw.duration_seconds ?? raw.durationSeconds;
    if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
    const iso = raw.duration ?? raw.contentDetails?.duration;
    return typeof iso === 'string' ? parseDuration(iso) : null;
}

export async function POST(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    const url = new URL(request.url);
    const token = request.headers.get('x-cron-secret') || url.searchParams.get('secret');

    if (cronSecret && token !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const items = asArray(body);
    if (items.length === 0) {
        return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const youtubeChannelIds = new Set<string>();
    for (const item of items) {
        const fromPayload =
            getString(item.youtube_channel_id) ||
            getString(item.channelId) ||
            getString(item.snippet?.channelId);
        if (fromPayload) youtubeChannelIds.add(fromPayload);
    }

    const supabase = createServiceClient();
    const channelMap = new Map<string, string>();
    if (youtubeChannelIds.size > 0) {
        const { data: channels, error } = await supabase
            .from('channels')
            .select('id, youtube_channel_id')
            .in('youtube_channel_id', Array.from(youtubeChannelIds));

        if (error) {
            return NextResponse.json(
                { error: `Failed to load channels: ${error.message}` },
                { status: 500 }
            );
        }

        for (const channel of channels || []) {
            channelMap.set(channel.youtube_channel_id, channel.id);
        }
    }

    const prepared: Array<Record<string, unknown>> = [];
    const skipped: Array<{ id: string | null; reason: string }> = [];

    for (const item of items) {
        const youtubeVideoId = getYoutubeVideoId(item);
        const title = getString(item.title ?? item.snippet?.title);
        const publishedAt = getString(item.published_at ?? item.publishedAt ?? item.snippet?.publishedAt);

        const channelIdRaw = getString(item.channel_id);
        const channelId = channelIdRaw && isUuid(channelIdRaw) ? channelIdRaw : null;
        const youtubeChannelId =
            getString(item.youtube_channel_id) ||
            getString(item.channelId) ||
            getString(item.snippet?.channelId);
        const mappedChannelId = channelId || (youtubeChannelId ? channelMap.get(youtubeChannelId) : null);

        if (!youtubeVideoId || !title || !publishedAt || !mappedChannelId) {
            skipped.push({
                id: youtubeVideoId,
                reason: 'Missing required fields or unknown channel',
            });
            continue;
        }

        const durationSeconds = getDurationSeconds(item);
        const thumbnails = (item.thumbnails as Record<string, { url?: string }> | undefined) ??
            (item.snippet?.thumbnails as Record<string, { url?: string }> | undefined);

        prepared.push({
            youtube_video_id: youtubeVideoId,
            channel_id: mappedChannelId,
            title,
            description: getString(item.description ?? item.snippet?.description),
            published_at: publishedAt,
            duration_seconds: durationSeconds ?? null,
            thumbnail_url: getString(item.thumbnail_url) ?? pickThumbnail(thumbnails),
            channel_name: getString(item.channel_name ?? item.channelTitle),
        });
    }

    if (prepared.length === 0) {
        return NextResponse.json({ ok: true, summary: { received: items.length, upserted: 0, skipped } });
    }

    const { data: upserted, error: upsertError } = await supabase
        .from('videos')
        .upsert(prepared, { onConflict: 'youtube_video_id' })
        .select('id');

    if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        summary: {
            received: items.length,
            prepared: prepared.length,
            upserted: upserted?.length ?? 0,
            skipped,
        },
    });
}
