import { getChannels } from '@/lib/supabase/queries';
import { ChannelManager } from '@/components/channel-manager';
import { requireUser } from '@/lib/supabase/require-user';

export default async function ChannelsPage() {
    await requireUser();

    const { data: channels } = await getChannels();

    return (
        <div className="page-stack">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-card-foreground">
                    Manage Channels
                </h1>
                <p className="text-sm text-muted-foreground">
                    Add YouTube channels to track for new podcast episodes.
                </p>
            </div>
            <ChannelManager channels={channels || []} />
        </div>
    );
}
