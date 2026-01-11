import { getVideosForTriage, getApprovedChannels } from '@/lib/supabase/queries';
import { VideoFeed } from '@/components/video-feed';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default async function Home() {
    const [videosResult, channelsResult] = await Promise.all([
        getVideosForTriage({ offset: 0, limit: 20 }),
        getApprovedChannels(),
    ]);

    const videos = videosResult.data || [];
    const channels = channelsResult.data || [];
    const count = videosResult.count || 0;

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-card-foreground">
                        YouTube Newsletter Dashboard
                    </h1>
                    <Link
                        href="/channels"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground hover:text-card-foreground rounded-lg transition-colors"
                    >
                        <Settings size={18} />
                        Manage Channels
                    </Link>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-6xl mx-auto px-4 py-6">
                {videos.length === 0 && channels.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <h2 className="text-2xl font-semibold text-card-foreground mb-2">
                            No videos yet
                        </h2>
                        <p className="text-muted-foreground mb-6 max-w-md">
                            Add channels to start capturing podcast videos, or wait for the next n8n sync to run.
                        </p>
                        <Link
                            href="/channels"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
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
                    />
                )}
            </main>
        </div>
    );
}
