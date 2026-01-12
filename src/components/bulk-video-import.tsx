'use client';

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { AlertCircle, CheckCircle, Loader2, Upload } from 'lucide-react';
import type { Channel } from '@/types/database';
import { formatDuration, parseDuration } from '@/lib/utils/duration';
import { upsertVideosManual } from '@/lib/actions/videos';

type NormalizedVideo = {
    index: number;
    youtube_video_id: string | null;
    channel_id: string | null;
    channel_youtube_id: string | null;
    channel_name: string | null;
    channel_notice: string | null;
    title: string | null;
    description: string | null;
    published_at: string | null;
    duration_seconds: number | null;
    thumbnail_url: string | null;
    video_url: string | null;
    errors: string[];
};

type BulkVideoImportProps = {
    channels: Channel[];
};

function pickString(...values: unknown[]): string | null {
    for (const value of values) {
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }
    return null;
}

function pickNumber(...values: unknown[]): number | null {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim().length > 0) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return parsed;
        }
    }
    return null;
}

function parseTimecode(value: string): number | null {
    const cleaned = value.trim();
    if (!/^\d+:\d{2}(:\d{2})?$/.test(cleaned)) return null;

    const parts = cleaned.split(':').map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) return null;

    if (parts.length === 2) {
        const [minutes, seconds] = parts;
        return minutes * 60 + seconds;
    }

    if (parts.length === 3) {
        const [hours, minutes, seconds] = parts;
        return hours * 3600 + minutes * 60 + seconds;
    }

    return null;
}

function parseDurationSeconds(raw: Record<string, unknown>): number | null {
    const directSeconds = pickNumber(
        raw.duration_seconds,
        raw.durationSeconds,
        raw.length_seconds,
        raw.lengthSeconds
    );
    if (directSeconds !== null) return Math.round(directSeconds);

    const isoCandidate = pickString(raw.duration, (raw.contentDetails as Record<string, unknown> | undefined)?.duration);
    if (isoCandidate && isoCandidate.startsWith('PT')) {
        const parsedIso = parseDuration(isoCandidate);
        return parsedIso > 0 ? parsedIso : null;
    }

    const minutes = pickNumber(raw.duration_minutes, raw.durationMinutes);
    if (minutes !== null) return Math.round(minutes * 60);

    const timecodeCandidate = pickString(raw.duration);
    if (timecodeCandidate) {
        const parsedTimecode = parseTimecode(timecodeCandidate);
        if (parsedTimecode !== null) return parsedTimecode;
    }

    return null;
}

function normalizePublishedAt(raw: Record<string, unknown>): string | null {
    const rawValue = pickString(
        raw.published_at,
        raw.publishedAt,
        raw.published,
        (raw.snippet as Record<string, unknown> | undefined)?.publishedAt
    );

    if (rawValue) {
        const parsed = new Date(rawValue);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
        return null;
    }

    const numericValue = pickNumber(raw.published_at, raw.publishedAt);
    if (numericValue !== null) {
        const timestamp = numericValue > 1e12 ? numericValue : numericValue * 1000;
        const parsed = new Date(timestamp);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }

    return null;
}

function resolveThumbnail(raw: Record<string, unknown>): string | null {
    const direct = pickString(raw.thumbnail_url, raw.thumbnailUrl);
    if (direct) return direct;

    const thumbnails = raw.thumbnails as Record<string, unknown> | undefined;
    const snippetThumbs = (raw.snippet as Record<string, unknown> | undefined)?.thumbnails as Record<string, unknown> | undefined;
    const candidate = thumbnails || snippetThumbs;

    if (!candidate) return null;

    const orderedKeys = ['maxres', 'standard', 'high', 'medium', 'default'];
    for (const key of orderedKeys) {
        const entry = candidate[key] as Record<string, unknown> | undefined;
        const url = entry ? pickString(entry.url) : null;
        if (url) return url;
    }

    return null;
}

function extractArray(parsed: unknown): unknown[] {
    if (Array.isArray(parsed)) return parsed;

    if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.items)) return obj.items;
        if (Array.isArray(obj.videos)) return obj.videos;
        if (Array.isArray(obj.data)) return obj.data;
    }

    return parsed ? [parsed] : [];
}

function normalizeItem(
    raw: Record<string, unknown>,
    index: number,
    channelsById: Map<string, Channel>,
    channelsByYoutubeId: Map<string, Channel>,
    channelsByName: Map<string, Channel>,
    defaultChannelId: string | null
): NormalizedVideo {
    const youtubeVideoId = pickString(
        raw.youtube_video_id,
        raw.youtubeVideoId,
        raw.videoId,
        raw.video_id,
        raw.id,
        (raw.id as Record<string, unknown> | undefined)?.videoId
    );

    const rawChannelId = pickString(raw.channel_id);
    const channelYoutubeCandidate = pickString(
        raw.channelId,
        (raw.snippet as Record<string, unknown> | undefined)?.channelId,
        rawChannelId && rawChannelId.startsWith('UC') ? rawChannelId : null
    );

    const channelTitle = pickString(
        raw.channel_name,
        raw.channelTitle,
        raw.channelName,
        (raw.snippet as Record<string, unknown> | undefined)?.channelTitle
    );

    let resolvedChannel: Channel | null = null;
    let channelYoutubeId: string | null = null;
    const canAutoCreate = Boolean(channelYoutubeCandidate);

    if (rawChannelId) {
        resolvedChannel = channelsById.get(rawChannelId) || null;
    }

    if (!resolvedChannel && channelYoutubeCandidate) {
        resolvedChannel = channelsByYoutubeId.get(channelYoutubeCandidate) || null;
    }

    if (!resolvedChannel && channelTitle) {
        resolvedChannel = channelsByName.get(channelTitle.toLowerCase()) || null;
    }

    if (!resolvedChannel && defaultChannelId) {
        resolvedChannel = channelsById.get(defaultChannelId) || null;
    }

    channelYoutubeId = resolvedChannel?.youtube_channel_id || channelYoutubeCandidate || null;
    const channelDisplayName = resolvedChannel?.name || channelTitle || channelYoutubeId || rawChannelId || null;
    const title = pickString(raw.title, (raw.snippet as Record<string, unknown> | undefined)?.title);
    const description = pickString(raw.description, (raw.snippet as Record<string, unknown> | undefined)?.description);
    const publishedAt = normalizePublishedAt(raw);
    const durationSeconds = parseDurationSeconds(raw);
    const thumbnailUrl = resolveThumbnail(raw);
    const videoUrl = pickString(
        raw.video_url,
        raw.videoUrl
    ) || (youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : null);

    const errors: string[] = [];
    if (!youtubeVideoId) errors.push('Missing video id');
    if (!resolvedChannel && !canAutoCreate) errors.push('Missing channel mapping');
    if (!title) errors.push('Missing title');
    if (!publishedAt) errors.push('Missing published date');

    return {
        index,
        youtube_video_id: youtubeVideoId,
        channel_id: resolvedChannel?.id || null,
        channel_youtube_id: channelYoutubeId,
        channel_name: channelDisplayName,
        channel_notice: !resolvedChannel && canAutoCreate ? 'Will create channel' : null,
        title,
        description,
        published_at: publishedAt,
        duration_seconds: durationSeconds,
        thumbnail_url: thumbnailUrl,
        video_url: videoUrl,
        errors,
    };
}

export function BulkVideoImport({ channels }: BulkVideoImportProps) {
    const [rawInput, setRawInput] = useState('');
    const [rawItems, setRawItems] = useState<unknown[]>([]);
    const [parseError, setParseError] = useState<string | null>(null);
    const [showOnlyValid, setShowOnlyValid] = useState(false);
    const [defaultChannelId, setDefaultChannelId] = useState('');
    const [resultMessage, setResultMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const channelsById = useMemo(() => new Map(channels.map((channel) => [channel.id, channel])), [channels]);
    const channelsByYoutubeId = useMemo(
        () => new Map(channels.map((channel) => [channel.youtube_channel_id, channel])),
        [channels]
    );
    const channelsByName = useMemo(
        () => new Map(channels.map((channel) => [channel.name.toLowerCase(), channel])),
        [channels]
    );

    const normalizedItems = useMemo(() => {
        return rawItems
            .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
            .map((item, index) =>
                normalizeItem(
                    item as Record<string, unknown>,
                    index,
                    channelsById,
                    channelsByYoutubeId,
                    channelsByName,
                    defaultChannelId || null
                )
            );
    }, [rawItems, channelsById, channelsByYoutubeId, channelsByName, defaultChannelId]);

    const validItems = normalizedItems.filter((item) => item.errors.length === 0);
    const invalidItems = normalizedItems.filter((item) => item.errors.length > 0);
    const displayItems = showOnlyValid ? validItems : normalizedItems;

    const handleParse = () => {
        setResultMessage(null);
        setParseError(null);

        if (!rawInput.trim()) {
            setRawItems([]);
            setParseError('Paste JSON to preview.');
            return;
        }

        try {
            const parsed = JSON.parse(rawInput);
            const extracted = extractArray(parsed);
            if (extracted.length === 0) {
                setRawItems([]);
                setParseError('No items found in the JSON payload.');
                return;
            }
            setRawItems(extracted);
        } catch (error) {
            setRawItems([]);
            setParseError('Invalid JSON. Paste a valid JSON array or object.');
        }
    };

    const handleClear = () => {
        setRawInput('');
        setRawItems([]);
        setParseError(null);
        setResultMessage(null);
    };

    const handleUpsert = () => {
        if (validItems.length === 0) return;

        setResultMessage(null);
        startTransition(async () => {
            try {
                const payload = validItems.map((item) => ({
                    youtube_video_id: item.youtube_video_id as string,
                    channel_id: item.channel_id,
                    channel_youtube_id: item.channel_youtube_id,
                    title: item.title as string,
                    description: item.description,
                    published_at: item.published_at as string,
                    duration_seconds: item.duration_seconds,
                    thumbnail_url: item.thumbnail_url,
                    channel_name: item.channel_name,
                }));

                const result = await upsertVideosManual(payload);
                setResultMessage(`Upserted ${result.count} videos.`);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Upsert failed.';
                setResultMessage(message);
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="neo-panel p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="font-display text-2xl text-card-foreground">Bulk video import</h2>
                        <p className="text-sm text-muted-foreground">
                            Paste a JSON array (or an object with an <code>items</code> or <code>videos</code> array) and preview before upserting.
                        </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Payload size: {rawInput.length > 0 ? `${Math.round(rawInput.length / 1024)}kb` : '0kb'}
                    </div>
                </div>

                <textarea
                    value={rawInput}
                    onChange={(event) => setRawInput(event.target.value)}
                    placeholder="Paste JSON payload here..."
                    className="neo-input min-h-[220px]"
                />

                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                            Default channel
                        </label>
                        <select
                            value={defaultChannelId}
                            onChange={(event) => setDefaultChannelId(event.target.value)}
                            className="neo-input px-3 py-1.5 text-sm w-[180px]"
                        >
                            <option value="">No default</option>
                            {channels.map((channel) => (
                                <option key={channel.id} value={channel.id}>
                                    {channel.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleParse}
                        className="neo-button inline-flex items-center gap-2 px-4 py-1.5 text-sm"
                    >
                        <Upload size={14} />
                        Preview
                    </button>
                    <button
                        onClick={handleClear}
                        className="neo-button-ghost px-4 py-1.5 text-sm"
                    >
                        Clear
                    </button>
                </div>

                {parseError && (
                    <div className="flex items-center gap-2 text-sm text-red-500">
                        <AlertCircle size={16} />
                        {parseError}
                    </div>
                )}
            </div>

            {normalizedItems.length > 0 && (
                <div className="neo-panel p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">
                            Parsed {normalizedItems.length} items. {validItems.length} ready, {invalidItems.length} with issues.
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={showOnlyValid}
                                    onChange={(event) => setShowOnlyValid(event.target.checked)}
                                    className="accent-primary"
                                />
                                Show only valid
                            </label>
                            <button
                                onClick={handleUpsert}
                                disabled={isPending || validItems.length === 0}
                                className="neo-button inline-flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending && <Loader2 size={16} className="animate-spin" />}
                                Upsert {validItems.length}
                            </button>
                        </div>
                    </div>

                    {resultMessage && (
                        <div className="text-sm text-muted-foreground">{resultMessage}</div>
                    )}

                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {displayItems.map((item) => (
                            <div
                                key={`${item.youtube_video_id ?? 'missing'}-${item.index}`}
                                className="neo-card flex flex-col lg:flex-row gap-4 p-4"
                            >
                                <div className="relative w-full lg:w-40 h-24 rounded-lg overflow-hidden bg-muted">
                                    {item.thumbnail_url ? (
                                        <Image
                                            src={item.thumbnail_url}
                                            alt={item.title || 'Video thumbnail'}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                                            No thumbnail
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h3 className="font-medium text-card-foreground line-clamp-2">
                                                {item.title || 'Untitled video'}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {item.channel_name || item.channel_youtube_id || 'Unknown channel'}
                                                {item.channel_notice && (
                                                    <span className="ml-2 text-xs text-muted-foreground">
                                                        {item.channel_notice}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {item.errors.length === 0 ? (
                                                <span className="inline-flex items-center gap-1 text-green-500">
                                                    <CheckCircle size={14} />
                                                    Ready
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-red-500">
                                                    <AlertCircle size={14} />
                                                    Issues
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                        <span>{item.published_at ? new Date(item.published_at).toLocaleDateString() : 'No date'}</span>
                                        <span>{formatDuration(item.duration_seconds)}</span>
                                        {item.video_url && (
                                            <a
                                                href={item.video_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline"
                                            >
                                                Open
                                            </a>
                                        )}
                                    </div>

                                    {item.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {item.description}
                                        </p>
                                    )}

                                    {item.errors.length > 0 && (
                                        <div className="text-xs text-red-500">
                                            {item.errors.join(' | ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
