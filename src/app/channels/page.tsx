import { getChannels } from '@/lib/supabase/queries';
import { ChannelManager } from '@/components/channel-manager';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function ChannelsPage() {
    const { data: channels } = await getChannels();

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-card-foreground transition-colors"
                    >
                        <ArrowLeft size={18} />
                        Back
                    </Link>
                    <h1 className="text-xl font-bold text-card-foreground">
                        Manage Channels
                    </h1>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-6xl mx-auto px-4 py-6">
                <ChannelManager channels={channels || []} />
            </main>
        </div>
    );
}
