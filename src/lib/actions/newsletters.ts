'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { NewsletterItemFields } from '@/types/database';

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

export async function updateNewsletterIssueDate(issueId: string, issueDate: string) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('newsletter_issues')
        .update({ issue_date: issueDate })
        .eq('id', issueId);

    if (error) {
        throw new Error(`Failed to update issue date: ${error.message}`);
    }

    revalidateBuilder();
}
