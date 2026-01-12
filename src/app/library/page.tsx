import { getVideosForTriage, getApprovedChannels } from '@/lib/supabase/queries';
import { VideoFeed } from '@/components/video-feed';
import { ManualVideoForm } from '@/components/manual-video-form';
import { requireUser } from '@/lib/supabase/require-user';

export default async function LibraryPage() {
    await requireUser();

    const [videosResult, channelsResult] = await Promise.all([
        getVideosForTriage({ offset: 0, limit: 20, statuses: ['favorited'] }),
        getApprovedChannels(),
    ]);

    const videos = videosResult.data || [];
    const channels = channelsResult.data || [];
    const count = videosResult.count || 0;

    return (
        <div className="min-h-screen">
            <main className="px-8 py-8 space-y-8">
                <ManualVideoForm channels={channels} onAdded={() => {}} defaultStatus="favorited" />
                <VideoFeed
                    initialVideos={videos}
                    initialCount={count}
                    channels={channels}
                    title="Favorites Library"
                    subtitle="Save high-signal episodes here before placing them into urgent or evergreen issues."
                    defaultFilters={{ statuses: ['favorited'] }}
                />
            </main>
        </div>
    );
}
