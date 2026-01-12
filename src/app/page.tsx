import { getVideosForTriage, getApprovedChannels } from '@/lib/supabase/queries';
import { VideoFeed } from '@/components/video-feed';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { requireUser } from '@/lib/supabase/require-user';

export default async function Home() {
    await requireUser();

    const [videosResult, channelsResult] = await Promise.all([
        getVideosForTriage({ offset: 0, limit: 20, statuses: ['new'] }),
        getApprovedChannels(),
    ]);

    const videos = videosResult.data || [];
    const channels = channelsResult.data || [];
    const count = videosResult.count || 0;

    return (
        <div className="min-h-screen">
            {/* Main content */}
            <main className="px-8 py-8">
                {videos.length === 0 && channels.length === 0 ? (
                    <div className="neo-panel flex flex-col items-center justify-center py-16 px-10 text-center">
                        <h2 className="font-display text-3xl text-card-foreground mb-2">
                            No videos yet
                        </h2>
                        <p className="text-muted-foreground mb-6 max-w-md">
                            Add channels to start capturing podcast videos, or wait for the next n8n sync to run.
                        </p>
                        <Link
                            href="/channels"
                            className="neo-button inline-flex items-center gap-2 px-6 py-3"
                        >
                            <Settings size={18} />
                            Add Channels
                        </Link>
                    </div>
                ) : (
                    <VideoFeed
                        initialVideos={videos}
                        initialCount={count}
                        channels={channels}
                        title="Inbox"
                        subtitle="Triage new episodes and decide what moves into your favorites or archive."
                        defaultFilters={{ statuses: ['new'] }}
                    />
                )}
            </main>
        </div>
    );
}
