import { getChannels } from '@/lib/supabase/queries';
import { BulkVideoImport } from '@/components/bulk-video-import';
import { requireUser } from '@/lib/supabase/require-user';

export default async function ImportPage() {
    await requireUser();

    const { data: channels } = await getChannels();

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-card-foreground">
                    Bulk Import
                </h1>
                <p className="text-sm text-muted-foreground">
                    Import multiple videos from a JSON payload.
                </p>
            </div>
            <BulkVideoImport channels={channels || []} />
        </div>
    );
}
