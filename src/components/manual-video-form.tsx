'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Link2, Plus } from 'lucide-react';
import type { Channel, VideoStatus } from '@/types/database';
import { addManualVideo } from '@/lib/actions/videos';

type ManualVideoFormProps = {
    channels: Channel[];
    onAdded: () => void;
    defaultStatus?: VideoStatus;
};

function todayDateString() {
    const now = new Date();
    return now.toISOString().slice(0, 10);
}

export function ManualVideoForm({ channels, onAdded, defaultStatus = 'favorited' }: ManualVideoFormProps) {
    const router = useRouter();
    const [videoUrl, setVideoUrl] = useState('');
    const [channelId, setChannelId] = useState('');
    const [publishedAt, setPublishedAt] = useState(todayDateString);
    const [title, setTitle] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const canSubmit = videoUrl.trim().length > 0 && channelId.length > 0 && publishedAt.length > 0;

    const channelOptions = useMemo(
        () => channels.map((channel) => ({ id: channel.id, name: channel.name })),
        [channels]
    );

    const handleSubmit = () => {
        setError(null);

        startTransition(async () => {
            try {
                await addManualVideo({
                    video_url: videoUrl,
                    channel_id: channelId,
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
        <div className="neo-panel p-5 space-y-4">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Manual add</p>
                <h2 className="font-display text-2xl text-card-foreground">Add a podcast episode by URL</h2>
                <p className="text-sm text-muted-foreground">
                    Paste a YouTube URL, pick the channel, and it will land in your favorites library.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[1.6fr,1fr,0.8fr]">
                <div className="neo-input-wrapper w-full">
                    <Link2 size={16} className="neo-input-icon" />
                    <input
                        value={videoUrl}
                        onChange={(event) => setVideoUrl(event.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="neo-input-field"
                    />
                </div>
                <select
                    value={channelId}
                    onChange={(event) => setChannelId(event.target.value)}
                    className="neo-input w-full"
                >
                    <option value="">Select channel</option>
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
                    className="neo-input w-full"
                />
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                <div className="neo-input-wrapper w-full">
                    <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Optional title override"
                        className="neo-input-field"
                    />
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={isPending || !canSubmit}
                    className="neo-button inline-flex items-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
                >
                    <Plus size={16} />
                    Add to favorites
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-sm text-rose-600">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}
        </div>
    );
}
