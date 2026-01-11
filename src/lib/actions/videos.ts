'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { VideoStatus } from '@/types/database';

export async function updateVideoStatus(id: string, status: VideoStatus) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('videos')
        .update({ status })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to update video status: ${error.message}`);
    }

    revalidatePath('/');
}

export async function toggleNewsletter(id: string, include: boolean) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('videos')
        .update({ include_in_newsletter: include })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to toggle newsletter: ${error.message}`);
    }

    revalidatePath('/');
}

export async function retryTranscript(id: string) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('videos')
        .update({
            transcript_status: 'pending',
            transcript_error: null,
            // Note: attempts NOT reset, capped at 3 total
        })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to retry transcript: ${error.message}`);
    }

    revalidatePath('/');
}

export async function retryAnalysis(id: string) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('videos')
        .update({
            analysis_status: 'pending',
            analysis_error: null,
        })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to retry analysis: ${error.message}`);
    }

    revalidatePath('/');
}

export async function updateVideoNotes(id: string, notes: string) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('videos')
        .update({ notes })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to update notes: ${error.message}`);
    }

    revalidatePath('/');
}
