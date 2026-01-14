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
    const canSubmit = videoUrl.trim().length > 0 && publishedAt.length > 0;

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
        <div className="gpt-panel p-5 space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-card-foreground">Add episode by URL</h2>
                <p className="text-sm text-muted-foreground">Manually add a video to your library.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="gpt-input-wrapper flex-1 min-w-[200px]">
                    <Link2 size={16} strokeWidth={1.5} className="gpt-input-icon" />
                    <input
                        value={videoUrl}
                        onChange={(event) => setVideoUrl(event.target.value)}
                        placeholder="YouTube URL or video ID"
                        className="gpt-input-field"
                    />
                </div>
                <select
                    value={channelId}
                    onChange={(event) => setChannelId(event.target.value)}
                    className="gpt-input px-4 py-3 text-sm"
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
                    className="gpt-input px-4 py-3 text-sm"
                />
                <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Title (optional)"
                    className="gpt-input px-4 py-3 text-sm min-w-[180px]"
                />
                <button
                    onClick={handleSubmit}
                    disabled={isPending || !canSubmit}
                    className="gpt-button disabled:opacity-50"
                >
                    {isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Plus size={16} strokeWidth={1.5} />
                    )}
                    Add
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-lg">
                    <AlertCircle size={16} strokeWidth={1.5} />
                    {error}
                </div>
            )}
        </div>
    );
}
