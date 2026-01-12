import { requireUser } from '@/lib/supabase/require-user';
import { getFavoritedVideos, getNewsletterItems, getOrCreateDraftIssues } from '@/lib/supabase/newsletters';
import { NewsletterBuilder } from '@/components/newsletter-builder';

export default async function BuilderPage() {
    await requireUser();

    const issues = await getOrCreateDraftIssues();
    const [items, favorites] = await Promise.all([
        getNewsletterItems([issues.urgent.id, issues.evergreen.id]),
        getFavoritedVideos(),
    ]);

    const urgentItems = items.filter((item) => item.issue_id === issues.urgent.id);
    const evergreenItems = items.filter((item) => item.issue_id === issues.evergreen.id);

    return (
        <div className="min-h-screen">
            <main className="px-8 py-8">
                <NewsletterBuilder
                    issues={issues}
                    urgentItems={urgentItems}
                    evergreenItems={evergreenItems}
                    favorites={favorites}
                />
            </main>
        </div>
    );
}
