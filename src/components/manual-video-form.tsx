'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Link2, Plus, Loader2 } from 'lucide-react';
import type { ChannelOption, VideoStatus } from '@/types/database';
import { addManualVideo } from '@/lib/actions/videos';

type ManualVideoFormProps = {
    channels: ChannelOption[];
    onAdded?: () => void;
    defaultStatus?: VideoStatus;
};

function todayDateString() {
    const now = new Date();
    return now.toISOString().slice(0, 10);
}

export function ManualVideoForm({
    channels,
    onAdded = () => { },
    defaultStatus = 'favorited',
}: ManualVideoFormProps) {
    const router = useRouter();
    const [videoUrl, setVideoUrl] = useState('');
    const [channelId, setChannelId] = useState('');
    const [publishedAt, setPublishedAt] = useState(todayDateString);
    const [title, setTitle] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [showDetails, setShowDetails] = useState(false);
    const canSubmit = videoUrl.trim().length > 0 && publishedAt.length > 0;

    const channelOptions = useMemo(
        () => channels.map((channel) => ({ id: channel.id, name: channel.name })),
        [channels]
    );

    const handleSubmit = () => {
        if (!canSubmit || isPending) return;
        setError(null);

        startTransition(async () => {
            try {
                await addManualVideo({
                    video_url: videoUrl,
                    channel_id: channelId || undefined,
                    published_at: publishedAt,
                    title: title || undefined,
                    status: defaultStatus,
                });
                setVideoUrl('');
                setTitle('');
                setPublishedAt(todayDateString());
                onAdded();
                router.refresh();
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to add video.';
                setError(message);
            }
        });
    };

    return (
        <form
            className="gpt-panel p-6 panel-stack content-rail"
            onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
            }}
        >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-card-foreground">Add to favorites</h2>
                    <p className="text-sm text-muted-foreground">Paste a YouTube link and tap save.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowDetails((prev) => !prev)}
                    className="gpt-button-ghost text-sm px-4 py-2"
                >
                    {showDetails ? 'Hide details' : 'Add details'}
                </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="gpt-input-wrapper field-flex w-full input-compact">
                    <Link2 size={14} strokeWidth={1.5} className="gpt-input-icon" />
                    <input
                        type="url"
                        inputMode="url"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck="false"
                        value={videoUrl}
                        onChange={(event) => setVideoUrl(event.target.value)}
                        placeholder="YouTube URL or video ID"
                        className="gpt-input-field text-base sm:text-sm"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isPending || !canSubmit}
                    className="gpt-button disabled:opacity-50 w-full sm:w-auto"
                >
                    {isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Plus size={16} strokeWidth={1.5} />
                    )}
                    Save
                </button>
            </div>

            {showDetails && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <select
                        value={channelId}
                        onChange={(event) => setChannelId(event.target.value)}
                        className="gpt-input px-4 py-3 text-sm w-full"
                    >
                        <option value="">Channel (optional)</option>
                        {channelOptions.map((channel) => (
                            <option key={channel.id} value={channel.id}>
                                {channel.name}
                            </option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={publishedAt}
                        onChange={(event) => setPublishedAt(event.target.value)}
                        className="gpt-input px-4 py-3 text-sm w-full"
                    />
                    <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Title (optional)"
                        className="gpt-input px-4 py-3 text-sm w-full sm:col-span-2 lg:col-span-1"
                    />
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-lg">
                    <AlertCircle size={16} strokeWidth={1.5} />
                    {error}
                </div>
            )}
        </form>
    );
}
