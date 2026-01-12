import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getChannels } from '@/lib/supabase/queries';
import { BulkVideoImport } from '@/components/bulk-video-import';
import { AuthButton } from '@/components/auth-button';
import { requireUser } from '@/lib/supabase/require-user';

export default async function ImportPage() {
    await requireUser();

    const { data: channels } = await getChannels();

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-50 glass-header border-b border-border">
                <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/"
                            className="neo-button-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"
                        >
                            <ArrowLeft size={18} />
                            Back
                        </Link>
                        <h1 className="font-display text-2xl text-card-foreground">
                            Bulk Import
                        </h1>
                    </div>
                    <AuthButton />
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-6">
                <BulkVideoImport channels={channels || []} />
            </main>
        </div>
    );
}
