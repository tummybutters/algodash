'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { NewsletterItemFields, NewsletterIssue } from '@/types/database';
import { getESPProvider, sendCampaignNow, sendTestEmail as espSendTestEmail } from '../esp';
import {
    assertPublishReady,
    buildCampaignPayload,
    resolveIssueStatus,
    resolvePublishPlan,
} from '@/lib/newsletters/publishing';
import { mapNewsletterItemsFromView } from '@/lib/newsletters/normalize';

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

export async function publishNewsletter(issueId: string, options?: { sendAt?: string; sendNow?: boolean }) {
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

    // 2. Normalize data + build payload
    const itemsWithVideo = mapNewsletterItemsFromView(items || []);
    const typedIssue = issue as NewsletterIssue;

    assertPublishReady(typedIssue, itemsWithVideo);
    const payload = buildCampaignPayload(typedIssue, itemsWithVideo);
    const plan = resolvePublishPlan(options, typedIssue);

    // 3. Create or update campaign
    const esp = getESPProvider();
    const campaign = typedIssue.esp_campaign_id
        ? await esp.updateCampaign(typedIssue.esp_campaign_id, payload)
        : await esp.createCampaign(payload);

    let updatedCampaign = campaign;
    if (plan.action === 'schedule' && plan.sendAt) {
        if (
            campaign.status !== 'sent'
            && campaign.status !== 'archived'
            && (campaign.status !== 'scheduled' || campaign.scheduled_at !== plan.sendAt)
        ) {
            updatedCampaign = await esp.scheduleCampaign(campaign.id, plan.sendAt);
        }
    } else if (plan.action === 'send') {
        if (campaign.status !== 'sent') {
            await sendCampaignNow(campaign.id);
        }
    }

    const nextStatus = resolveIssueStatus(plan.action, updatedCampaign.status);
    const nowIso = new Date().toISOString();
    const nextScheduledAt =
        nextStatus === 'scheduled'
            ? plan.sendAt ?? updatedCampaign.scheduled_at ?? typedIssue.scheduled_at ?? null
            : nextStatus === 'published'
                ? updatedCampaign.scheduled_at ?? nowIso
                : null;

    // 4. Update issue status
    const { error: updateError } = await supabase
        .from('newsletter_issues')
        .update({
            status: nextStatus,
            esp_campaign_id: updatedCampaign.id,
            scheduled_at: nextScheduledAt,
        })
        .eq('id', issueId);

    if (updateError) {
        throw new Error(`Failed to finalize issue: ${updateError.message}`);
    }

    revalidateBuilder();
    return { success: true, espCampaignId: updatedCampaign.id, status: nextStatus };
}

export async function sendTestNewsletter(issueId: string, testEmails: string[]) {
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

    const typedIssue = issue as NewsletterIssue;
    const itemsWithVideo = mapNewsletterItemsFromView(items || []);

    assertPublishReady(typedIssue, itemsWithVideo);
    const payload = buildCampaignPayload(typedIssue, itemsWithVideo);
    const esp = getESPProvider();

    const campaign = typedIssue.esp_campaign_id
        ? await esp.updateCampaign(typedIssue.esp_campaign_id, payload)
        : await esp.createCampaign(payload);

    if (!typedIssue.esp_campaign_id) {
        const { error: updateError } = await supabase
            .from('newsletter_issues')
            .update({ esp_campaign_id: campaign.id })
            .eq('id', issueId);

        if (updateError) {
            throw new Error(`Failed to store campaign id: ${updateError.message}`);
        }
    }

    // Send test email without scheduling
    await espSendTestEmail(campaign.id, testEmails);

    return { success: true };
}
