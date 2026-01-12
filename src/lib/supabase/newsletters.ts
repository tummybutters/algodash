import { createServiceClient } from '@/lib/supabase/server';
import type { NewsletterIssue, NewsletterItemWithVideo, NewsletterType, VideoListItem } from '@/types/database';

const ISSUE_TYPES: NewsletterType[] = ['urgent', 'evergreen'];

function todayDateString() {
    return new Date().toISOString().slice(0, 10);
}

export async function getOrCreateDraftIssues(): Promise<Record<NewsletterType, NewsletterIssue>> {
    const supabase = createServiceClient();

    const { data: existing, error } = await supabase
        .from('newsletter_issues')
        .select('*')
        .eq('status', 'draft')
        .in('type', ISSUE_TYPES)
        .order('issue_date', { ascending: false });

    if (error) {
        throw new Error(`Failed to load draft issues: ${error.message}`);
    }

    const issuesByType = new Map<NewsletterType, NewsletterIssue>();
    (existing || []).forEach((issue) => {
        if (!issuesByType.has(issue.type)) {
            issuesByType.set(issue.type, issue as NewsletterIssue);
        }
    });

    const missingTypes = ISSUE_TYPES.filter((type) => !issuesByType.has(type));
    if (missingTypes.length > 0) {
        const payload = missingTypes.map((type) => ({
            type,
            issue_date: todayDateString(),
            status: 'draft',
        }));

        const { data: created, error: createError } = await supabase
            .from('newsletter_issues')
            .insert(payload)
            .select('*');

        if (createError) {
            throw new Error(`Failed to create draft issues: ${createError.message}`);
        }

        (created || []).forEach((issue) => {
            issuesByType.set(issue.type, issue as NewsletterIssue);
        });
    }

    return {
        urgent: issuesByType.get('urgent')!,
        evergreen: issuesByType.get('evergreen')!,
    };
}

export async function getNewsletterItems(issueIds: string[]): Promise<NewsletterItemWithVideo[]> {
    if (issueIds.length === 0) return [];
    const supabase = createServiceClient();

    const { data, error } = await supabase
        .from('newsletter_items')
        .select(
            'id, issue_id, video_id, position, fields, created_at, updated_at, video:videos (id, title, channel_name, video_url, thumbnail_url, duration_seconds, published_at)'
        )
        .in('issue_id', issueIds)
        .order('position', { ascending: true });

    if (error) {
        throw new Error(`Failed to load newsletter items: ${error.message}`);
    }

    // Supabase returns joined relations as arrays, extract first element
    return (data || []).map((item) => ({
        ...item,
        video: Array.isArray(item.video) ? item.video[0] : item.video,
    })) as NewsletterItemWithVideo[];
}

export async function getFavoritedVideos(): Promise<VideoListItem[]> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
        .from('videos_list')
        .select('*')
        .eq('status', 'favorited')
        .order('published_at', { ascending: false });

    if (error) {
        throw new Error(`Failed to load favorited videos: ${error.message}`);
    }

    return (data || []) as VideoListItem[];
}
