'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { NewsletterItemFields, NewsletterItemWithVideo, NewsletterIssue } from '@/types/database';
import { renderNewsletterHtml } from '../newsletter-renderer';

function revalidateBuilder() {
    revalidatePath('/builder');
    revalidatePath('/library');
}

export async function addNewsletterItem(input: {
    issueId: string;
    videoId: string;
    position?: number;
}) {
    const supabase = createServiceClient();

    let position = input.position;
    if (position === undefined) {
        const { data } = await supabase
            .from('newsletter_items')
            .select('position')
            .eq('issue_id', input.issueId)
            .order('position', { ascending: false })
            .limit(1)
            .maybeSingle();

        position = data?.position !== undefined ? data.position + 1 : 0;
    }

    const { data, error } = await supabase
        .from('newsletter_items')
        .insert({
            issue_id: input.issueId,
            video_id: input.videoId,
            position,
        })
        .select('id, issue_id, video_id, position, fields, created_at, updated_at')
        .single();

    if (error) {
        throw new Error(`Failed to add newsletter item: ${error.message}`);
    }

    revalidateBuilder();
    return data;
}

export async function moveNewsletterItem(input: {
    itemId: string;
    issueId: string;
    position: number;
}) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('newsletter_items')
        .update({
            issue_id: input.issueId,
            position: input.position,
        })
        .eq('id', input.itemId);

    if (error) {
        throw new Error(`Failed to move newsletter item: ${error.message}`);
    }

    revalidateBuilder();
}

export async function removeNewsletterItem(itemId: string) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('newsletter_items')
        .delete()
        .eq('id', itemId);

    if (error) {
        throw new Error(`Failed to remove newsletter item: ${error.message}`);
    }

    revalidateBuilder();
}

export async function reorderNewsletterItems(updates: Array<{ id: string; position: number }>) {
    if (updates.length === 0) return;

    const supabase = createServiceClient();
    const operations = updates.map((update) =>
        supabase
            .from('newsletter_items')
            .update({ position: update.position })
            .eq('id', update.id)
    );

    const results = await Promise.all(operations);
    const error = results.find((result) => result.error)?.error;

    if (error) {
        throw new Error(`Failed to reorder newsletter items: ${error.message}`);
    }

    revalidateBuilder();
}

export async function updateNewsletterItemFields(itemId: string, fields: NewsletterItemFields) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('newsletter_items')
        .update({ fields })
        .eq('id', itemId);

    if (error) {
        throw new Error(`Failed to update newsletter item: ${error.message}`);
    }

    revalidateBuilder();
}

export async function updateNewsletterIssue(issueId: string, updates: {
    issue_date?: string;
    subject?: string;
    preview_text?: string;
    scheduled_at?: string;
    status?: string;
}) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('newsletter_issues')
        .update(updates)
        .eq('id', issueId);

    if (error) {
        throw new Error(`Failed to update issue: ${error.message}`);
    }

    revalidateBuilder();
}

export async function updateNewsletterIssueDate(issueId: string, issueDate: string) {
    return updateNewsletterIssue(issueId, { issue_date: issueDate });
}
export async function publishNewsletter(issueId: string) {
    const supabase = createServiceClient();

    // 1. Fetch issue and items
    const { data: issue, error: issueError } = await supabase
        .from('newsletter_issues')
        .select('*')
        .eq('id', issueId)
        .single();

    if (issueError || !issue) {
        throw new Error(`Failed to fetch issue: ${issueError?.message}`);
    }

    const { data: items, error: itemsError } = await supabase
        .from('newsletter_items_view')
        .select('*')
        .eq('issue_id', issueId)
        .order('position', { ascending: true });

    if (itemsError) {
        throw new Error(`Failed to fetch items: ${itemsError.message}`);
    }

    // Transform view items to the correct type for renderer
    const itemsWithVideo = (items || []).map(item => ({
        ...item,
        video: {
            id: item.video_id,
            title: item.title,
            channel_name: item.channel_name,
            thumbnail_url: item.thumbnail_url,
            video_url: item.video_url,
            duration_seconds: item.duration_seconds,
            published_at: item.published_at
        }
    })) as NewsletterItemWithVideo[];

    // 2. Render HTML
    const html = renderNewsletterHtml(issue as NewsletterIssue, itemsWithVideo);

    // 3. QA Checks
    if (!issue.subject) throw new Error("Missing subject line.");
    if (itemsWithVideo.length === 0) throw new Error("Issue has no items.");

    // 4. Send to ESP (Placeholder)
    console.log("Publishing issue to ESP...", {
        subject: issue.subject,
        itemCount: itemsWithVideo.length,
        htmlLength: html.length
    });

    // TODO: Implement actual ESP API call here
    const espCampaignId = `fake_${Date.now()}`;

    // 5. Update status
    const { error: updateError } = await supabase
        .from('newsletter_issues')
        .update({
            status: 'scheduled',
            esp_campaign_id: espCampaignId,
            scheduled_at: new Date().toISOString()
        })
        .eq('id', issueId);

    if (updateError) {
        throw new Error(`Failed to finalize issue: ${updateError.message}`);
    }

    revalidateBuilder();
    return { success: true, espCampaignId };
}
