import type { NewsletterItemWithVideo } from '@/types/database';

export type NewsletterItemsViewRow = {
    id: string;
    issue_id: string;
    video_id: string;
    position: number;
    fields: NewsletterItemWithVideo['fields'];
    created_at: string;
    updated_at: string;
    title: string;
    channel_name: string | null;
    thumbnail_url: string | null;
    video_url: string;
    duration_seconds: number | null;
    published_at: string;
};

export function mapNewsletterItemsFromView(
    items: NewsletterItemsViewRow[]
): NewsletterItemWithVideo[] {
    return items.map((item) => ({
        id: item.id,
        issue_id: item.issue_id,
        video_id: item.video_id,
        position: item.position,
        fields: item.fields ?? {},
        created_at: item.created_at,
        updated_at: item.updated_at,
        video: {
            id: item.video_id,
            title: item.title,
            channel_name: item.channel_name,
            thumbnail_url: item.thumbnail_url,
            video_url: item.video_url,
            duration_seconds: item.duration_seconds,
            published_at: item.published_at,
        },
    }));
}
