'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addChannel(youtubeChannelId: string, name: string) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('channels')
        .upsert({
            youtube_channel_id: youtubeChannelId,
            name,
            approved: true,
        }, {
            onConflict: 'youtube_channel_id',
        });

    if (error) {
        throw new Error(`Failed to add channel: ${error.message}`);
    }

    revalidatePath('/channels');
}

export async function toggleChannelApproval(id: string, approved: boolean) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('channels')
        .update({ approved })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to toggle channel: ${error.message}`);
    }

    revalidatePath('/channels');
}

export async function deleteChannel(id: string) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to delete channel: ${error.message}`);
    }

    revalidatePath('/channels');
}
