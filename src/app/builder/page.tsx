import { requireUser } from '@/lib/supabase/require-user';
import { getFavoritedVideos, getNewsletterItems, getOrCreateDraftIssues } from '@/lib/supabase/newsletters';
import { NewsletterBuilder } from '@/components/newsletter-builder';

export default async function BuilderPage() {
    await requireUser();

    const { issues, drafts } = await getOrCreateDraftIssues();
    const [items, favorites] = await Promise.all([
        getNewsletterItems(drafts.map((issue) => issue.id)),
        getFavoritedVideos(),
    ]);

    return (
        <div className="min-h-screen">
            <main className="px-10 py-8">
                <NewsletterBuilder
                    issues={issues}
                    draftIssues={drafts}
                    allItems={items}
                    favorites={favorites}
                />
            </main>
        </div>
    );
}
