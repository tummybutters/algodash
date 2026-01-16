'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { VideoStatus, ProcessStatus } from '@/types/database';

const TRANSCRIPT_API_URL = 'https://transcriptapi.com/api/v2/youtube/transcript';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ANALYSIS_MODEL = 'google/gemini-3-flash-preview';
const ANALYSIS_MAX_TOKENS = 1600;
const ANALYSIS_SYSTEM_PROMPT = `You are an analytical extraction engine.
You do not generate new ideas.
You do not improve, extend, or reinterpret the speaker's claims.
You only extract and re-express what is present in the transcript.

Your task is to surface existing signal, not to add insight.

Epistemic Constraints (Critical)

Do not introduce novel claims, examples, or analogies.

Do not speculate about intent, motivation, or beliefs unless the speaker makes them explicit.

Do not "steelman" or clean up arguments.

Do not resolve ambiguity - preserve it.

Inference is allowed only when it is:

Directly implied by repeated statements and

Would be obvious to a careful human reader

Any inference must be clearly labeled as inference, not fact.

If a section cannot be populated without adding new information, leave it sparse or state that the signal is weak.

Objective

Given a long-form transcript (e.g. tech, markets, power, AI), extract latent but present intellectual signal such as:

Explicit beliefs

Repeated assumptions

Non-consensus statements

Predictions the speaker actually makes

Frameworks the speaker explicitly uses

Cross-domain connections the speaker themselves draws

You are not summarizing content.
You are extracting how the speaker thinks, as evidenced by what they say.

Required Output Structure
1. Explicit Worldview Statements

List only statements the speaker directly makes (or restates multiple times) about:

Power

Technology

Incentives

Human behavior

Markets or institutions

Format as declarative statements.
If a statement is paraphrased, keep it faithful to the original meaning.

If confidence is unclear, say so.

2. Non-Consensus or Contrarian Claims

Include only claims that:

Are explicitly stated by the speaker

Clearly diverge from mainstream or commonly accepted views

For each:

The claim (paraphrased faithfully)

What it contrasts with (briefly)

Whether the speaker asserts it strongly or tentatively

Do not label something contrarian unless the contrast is obvious.

3. Predictions & Forecasts

Extract:

Explicit predictions

Conditional forecasts ("if X, then Y")

For each:

Prediction

Time horizon (if stated)

Degree of certainty expressed by the speaker

Do not infer predictions from tone alone.

4. Stated Frameworks & Models

Extract only frameworks the speaker actually uses, such as:

Explicit mental models

Repeated explanatory lenses

Named or described ways of reasoning

For each:

Framework (one sentence)

Where it appears in the transcript

Do not invent or generalize frameworks beyond what is said.

5. Cross-Domain Connections (Explicit Only)

Include connections only if the speaker draws them directly, such as:

This is similar to...

The same thing happens in...

You see this in [other domain]

Explain the connection using the speaker's own logic.

6. High-Signal Quotable Nuggets

Extract up to 5 short passages or paraphrases that:

Are unusually precise

Reframe an issue

Reveal a core belief or prediction

Do not rewrite for cleverness. Preserve intent.

7. Analyst Notes (Boundary-Aware)

Briefly note:

Where the transcript is ambiguous

Where signal is thin or repetitive

Where inference was unavoidable (clearly marked)

If the transcript contains mostly surface-level discussion, say so plainly.

Operating Principle

Your job is to act as a lossless intellectual compressor.

If insight is not present, do not manufacture it.
Silence or sparsity is preferable to distortion.`;

type YoutubeVideoResponse = {
    items?: Array<{
        snippet?: {
            title?: string;
            channelId?: string;
            channelTitle?: string;
            thumbnails?: Record<string, { url?: string }>;
        };
    }>;
};

function pickYoutubeThumbnail(thumbnails?: Record<string, { url?: string }>) {
    if (!thumbnails) return null;
    return (
        thumbnails.maxres?.url
        || thumbnails.standard?.url
        || thumbnails.high?.url
        || thumbnails.medium?.url
        || thumbnails.default?.url
        || null
    );
}

async function fetchYoutubeMetadata(videoId: string) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return null;

    const detailsUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
    detailsUrl.searchParams.set('part', 'snippet');
    detailsUrl.searchParams.set('id', videoId);
    detailsUrl.searchParams.set('key', apiKey);

    try {
        const response = await fetch(detailsUrl.toString(), { cache: 'no-store' });
        if (!response.ok) return null;
        const data = (await response.json()) as YoutubeVideoResponse;
        const snippet = data.items?.[0]?.snippet;
        if (!snippet) return null;
        return {
            title: typeof snippet.title === 'string' ? snippet.title : null,
            channelId: typeof snippet.channelId === 'string' ? snippet.channelId : null,
            channelTitle: typeof snippet.channelTitle === 'string' ? snippet.channelTitle : null,
            thumbnailUrl: pickYoutubeThumbnail(snippet.thumbnails),
        };
    } catch {
        return null;
    }
}

function revalidateCoreViews() {
    revalidatePath('/');
    revalidatePath('/library');
    revalidatePath('/builder');
}

export async function updateVideoStatus(id: string, status: VideoStatus) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('videos')
        .update({ status })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to update video status: ${error.message}`);
    }

    revalidateCoreViews();
}

export async function deleteVideo(id: string) {
    const supabase = createServiceClient();

    const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to delete video: ${error.message}`);
    }

    revalidateCoreViews();
}

export async function retryTranscript(id: string): Promise<{ status: ProcessStatus }> {
    const supabase = createServiceClient();

    const { data: video, error } = await supabase
        .from('videos')
        .select('youtube_video_id, transcript_attempts, transcript_status, transcript_text')
        .eq('id', id)
        .single();

    if (error || !video) {
        throw new Error(`Failed to load video for transcript: ${error?.message ?? 'Not found'}`);
    }

    if (video.transcript_status === 'success' && video.transcript_text) {
        return { status: 'success' };
    }

    const apiKey = process.env.TRANSCRIPT_API_KEY;
    const nextAttempts = (video.transcript_attempts ?? 0) + 1;

    if (!apiKey) {
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                transcript_status: 'failed',
                transcript_error: 'Missing TRANSCRIPT_API_KEY',
                transcript_attempts: nextAttempts,
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update transcript status: ${updateError.message}`);
        }

        revalidateCoreViews();
        revalidatePath('/import');
        return { status: 'failed' };
    }

    const params = new URLSearchParams({
        video_url: video.youtube_video_id,
        format: 'json',
    });

    let response: Response;
    try {
        response = await fetch(`${TRANSCRIPT_API_URL}?${params.toString()}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            cache: 'no-store',
        });
    } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : 'Transcript request failed';
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                transcript_status: 'failed',
                transcript_error: message,
                transcript_attempts: nextAttempts,
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update transcript status: ${updateError.message}`);
        }

        revalidateCoreViews();
        revalidatePath('/import');
        return { status: 'failed' };
    }

    let payload: unknown = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok) {
        const detail =
            typeof (payload as { detail?: unknown } | null)?.detail === 'string'
                ? (payload as { detail: string }).detail
                : `Transcript API error (${response.status})`;
        const status = response.status === 404 ? 'unavailable' : 'failed';

        const { error: updateError } = await supabase
            .from('videos')
            .update({
                transcript_status: status,
                transcript_error: detail,
                transcript_attempts: nextAttempts,
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update transcript status: ${updateError.message}`);
        }

        revalidateCoreViews();
        revalidatePath('/import');
        return { status };
    }

    const transcriptPayload = (payload as { transcript?: unknown } | null)?.transcript;
    let transcriptText: string | null = null;

    if (Array.isArray(transcriptPayload)) {
        const lines = transcriptPayload
            .map((segment) => {
                if (segment && typeof segment === 'object' && 'text' in segment) {
                    const text = (segment as { text?: unknown }).text;
                    return typeof text === 'string' ? text.trim() : '';
                }
                return '';
            })
            .filter((line) => line.length > 0);
        transcriptText = lines.length > 0 ? lines.join('\n') : null;
    } else if (typeof transcriptPayload === 'string') {
        transcriptText = transcriptPayload.trim() || null;
    }

    if (!transcriptText) {
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                transcript_status: 'failed',
                transcript_error: 'Transcript payload missing text',
                transcript_attempts: nextAttempts,
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update transcript status: ${updateError.message}`);
        }

        revalidateCoreViews();
        revalidatePath('/import');
        return { status: 'failed' };
    }

    const { error: updateError } = await supabase
        .from('videos')
        .update({
            transcript_text: transcriptText,
            transcript_json: payload,
            transcript_status: 'success',
            transcript_error: null,
            transcript_attempts: nextAttempts,
            transcript_fetched_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (updateError) {
        throw new Error(`Failed to update transcript: ${updateError.message}`);
    }

    revalidateCoreViews();
    revalidatePath('/import');
    return { status: 'success' };
}

export async function retryAnalysis(id: string): Promise<{ status: ProcessStatus }> {
    const supabase = createServiceClient();

    const { data: video, error: loadError } = await supabase
        .from('videos')
        .select('transcript_text, analysis_attempts')
        .eq('id', id)
        .single();

    if (loadError || !video) {
        throw new Error(`Failed to load video for analysis: ${loadError?.message ?? 'Not found'}`);
    }

    const nextAttempts = (video.analysis_attempts ?? 0) + 1;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!video.transcript_text || video.transcript_text.trim().length === 0) {
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                analysis_status: 'failed',
                analysis_error: 'Transcript missing for summary generation.',
                analysis_attempts: nextAttempts,
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update analysis status: ${updateError.message}`);
        }

        revalidateCoreViews();
        revalidatePath('/import');
        return { status: 'failed' };
    }

    if (!apiKey) {
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                analysis_status: 'failed',
                analysis_error: 'Missing OPENROUTER_API_KEY',
                analysis_attempts: nextAttempts,
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update analysis status: ${updateError.message}`);
        }

        revalidateCoreViews();
        revalidatePath('/import');
        return { status: 'failed' };
    }

    const { error: pendingError } = await supabase
        .from('videos')
        .update({
            analysis_status: 'pending',
            analysis_error: null,
            analysis_attempts: nextAttempts,
        })
        .eq('id', id);

    if (pendingError) {
        throw new Error(`Failed to mark analysis pending: ${pendingError.message}`);
    }

    const referer =
        process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Executive Algorithm',
    };

    if (referer) {
        headers['HTTP-Referer'] = referer;
    }

    let response: Response;
    try {
        response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: ANALYSIS_MODEL,
                temperature: 0.2,
                max_tokens: ANALYSIS_MAX_TOKENS,
                messages: [
                    { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
                    { role: 'user', content: `Transcript:\n${video.transcript_text}` },
                ],
            }),
        });
    } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : 'Summary request failed';
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                analysis_status: 'failed',
                analysis_error: message,
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update analysis status: ${updateError.message}`);
        }

        revalidateCoreViews();
        revalidatePath('/import');
        return { status: 'failed' };
    }

    let payload: unknown = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok) {
        const detail =
            typeof (payload as { error?: { message?: string } } | null)?.error?.message === 'string'
                ? (payload as { error: { message: string } }).error.message
                : `OpenRouter error (${response.status})`;
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                analysis_status: 'failed',
                analysis_error: detail,
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update analysis status: ${updateError.message}`);
        }

        revalidateCoreViews();
        revalidatePath('/import');
        return { status: 'failed' };
    }

    const finishReason = (payload as { choices?: Array<{ finish_reason?: string }> } | null)
        ?.choices?.[0]?.finish_reason;
    let content = (payload as { choices?: Array<{ message?: { content?: string } }> } | null)
        ?.choices?.[0]?.message?.content?.trim();

    if (content && finishReason === 'length') {
        content = `${content}\n\n[Output truncated - increase max_tokens to capture full response.]`;
    }

    if (!content) {
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                analysis_status: 'failed',
                analysis_error: 'Summary response was empty.',
            })
            .eq('id', id);

        if (updateError) {
            throw new Error(`Failed to update analysis status: ${updateError.message}`);
        }

        revalidateCoreViews();
        revalidatePath('/import');
        return { status: 'failed' };
    }

    const { error: updateError } = await supabase
        .from('videos')
        .update({
            analysis_status: 'success',
            analysis_error: null,
            analysis_text: content,
            analysis_json: payload,
            analysis_model: ANALYSIS_MODEL,
            analysis_generated_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (updateError) {
        throw new Error(`Failed to update summary: ${updateError.message}`);
    }

    revalidateCoreViews();
    revalidatePath('/import');
    return { status: 'success' };
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

    revalidateCoreViews();
}

export async function upsertVideosManual(videos: Array<{
    youtube_video_id: string;
    channel_id: string | null;
    channel_youtube_id: string | null;
    title: string;
    description: string | null;
    published_at: string;
    duration_seconds: number | null;
    thumbnail_url: string | null;
    channel_name: string | null;
}>) {
    if (videos.length === 0) {
        return { count: 0 };
    }

    const supabase = createServiceClient();

    const channelYoutubeIds = Array.from(new Set(
        videos
            .map((video) => video.channel_youtube_id)
            .filter((id): id is string => Boolean(id))
    ));

    let channelsByYoutubeId = new Map<string, { id: string; name: string }>();

    if (channelYoutubeIds.length > 0) {
        const { data, error } = await supabase
            .from('channels')
            .select('id, youtube_channel_id, name')
            .in('youtube_channel_id', channelYoutubeIds);

        if (error) {
            throw new Error(`Failed to load channels: ${error.message}`);
        }

        (data || []).forEach((channel) => {
            channelsByYoutubeId.set(channel.youtube_channel_id, {
                id: channel.id,
                name: channel.name,
            });
        });
    }

    const missingChannelIds = channelYoutubeIds.filter((id) => !channelsByYoutubeId.has(id));
    if (missingChannelIds.length > 0) {
        const channelPayload = missingChannelIds.map((youtubeChannelId) => {
            const fallbackName = videos.find((video) => video.channel_youtube_id === youtubeChannelId)?.channel_name;
            return {
                youtube_channel_id: youtubeChannelId,
                name: fallbackName && fallbackName.trim().length > 0 ? fallbackName.trim() : youtubeChannelId,
                approved: true,
            };
        });

        const { error } = await supabase
            .from('channels')
            .upsert(channelPayload, { onConflict: 'youtube_channel_id' });

        if (error) {
            throw new Error(`Failed to create channels: ${error.message}`);
        }

        const { data, error: reloadError } = await supabase
            .from('channels')
            .select('id, youtube_channel_id, name')
            .in('youtube_channel_id', channelYoutubeIds);

        if (reloadError) {
            throw new Error(`Failed to load channels: ${reloadError.message}`);
        }

        channelsByYoutubeId = new Map(
            (data || []).map((channel) => [channel.youtube_channel_id, { id: channel.id, name: channel.name }])
        );
    }

    const preparedVideos = videos.map((video) => {
        const resolvedChannelId = video.channel_id
            || (video.channel_youtube_id ? channelsByYoutubeId.get(video.channel_youtube_id)?.id : null);

        if (!resolvedChannelId) {
            throw new Error('Missing channel mapping for one or more videos.');
        }

        return {
            youtube_video_id: video.youtube_video_id,
            channel_id: resolvedChannelId,
            title: video.title,
            description: video.description,
            published_at: video.published_at,
            duration_seconds: video.duration_seconds,
            thumbnail_url: video.thumbnail_url,
            channel_name: video.channel_name,
        };
    });

    const { data, error } = await supabase
        .from('videos')
        .upsert(preparedVideos, { onConflict: 'youtube_video_id' })
        .select('id');

    if (error) {
        throw new Error(`Failed to upsert videos: ${error.message}`);
    }

    revalidateCoreViews();
    revalidatePath('/import');
    revalidatePath('/channels');
    revalidatePath('/library');
    revalidatePath('/builder');

    return { count: data?.length ?? 0 };
}

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

function extractYouTubeId(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (YOUTUBE_ID_REGEX.test(trimmed)) return trimmed;

    try {
        const url = new URL(trimmed);
        const host = url.hostname.replace('www.', '');

        if (host === 'youtu.be') {
            const id = url.pathname.split('/').filter(Boolean)[0];
            return id && YOUTUBE_ID_REGEX.test(id) ? id : null;
        }

        if (host.endsWith('youtube.com')) {
            const queryId = url.searchParams.get('v');
            if (queryId && YOUTUBE_ID_REGEX.test(queryId)) return queryId;

            const parts = url.pathname.split('/').filter(Boolean);
            if (parts[0] === 'shorts' || parts[0] === 'embed') {
                const id = parts[1];
                return id && YOUTUBE_ID_REGEX.test(id) ? id : null;
            }
        }
    } catch {
        return null;
    }

    return null;
}

function normalizePublishDate(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return new Date(`${trimmed}T12:00:00Z`).toISOString();
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
}

export async function addManualVideo(input: {
    video_url: string;
    channel_id?: string | null;
    published_at: string;
    title?: string | null;
    status?: VideoStatus;
}) {
    const supabase = createServiceClient();

    const youtubeVideoId = extractYouTubeId(input.video_url);
    if (!youtubeVideoId) {
        throw new Error('Enter a valid YouTube URL or ID.');
    }

    const publishedAt = normalizePublishDate(input.published_at);
    if (!publishedAt) {
        throw new Error('Enter a valid publish date.');
    }

    const channelInput = input.channel_id?.trim();
    let resolvedChannelId = channelInput && channelInput.length > 0 ? channelInput : null;
    let resolvedChannelName: string | null = null;
    let youtubeMeta = !resolvedChannelId ? await fetchYoutubeMetadata(youtubeVideoId) : null;

    if (!resolvedChannelId && youtubeMeta?.channelId) {
        const { data: existingChannel, error: channelError } = await supabase
            .from('channels')
            .select('id, name')
            .eq('youtube_channel_id', youtubeMeta.channelId)
            .maybeSingle();

        if (channelError) {
            throw new Error(`Failed to load channel: ${channelError.message}`);
        }

        if (existingChannel) {
            resolvedChannelId = existingChannel.id;
            resolvedChannelName = existingChannel.name;
        } else {
            const channelName = (youtubeMeta.channelTitle || youtubeMeta.channelId).trim();
            const { data: createdChannel, error: createError } = await supabase
                .from('channels')
                .insert({
                    youtube_channel_id: youtubeMeta.channelId,
                    name: channelName,
                    approved: true,
                })
                .select('id')
                .single();

            if (createError) {
                throw new Error(`Failed to create channel: ${createError.message}`);
            }

            resolvedChannelId = createdChannel.id;
            resolvedChannelName = channelName;
        }
    }

    if (!resolvedChannelId) {
        throw new Error('Select a channel or configure YOUTUBE_API_KEY to auto-detect channel.');
    }

    if (!resolvedChannelName) {
        const { data: channelRow, error: channelRowError } = await supabase
            .from('channels')
            .select('name')
            .eq('id', resolvedChannelId)
            .maybeSingle();

        if (channelRowError) {
            throw new Error(`Failed to load channel details: ${channelRowError.message}`);
        }

        if (!channelRow) {
            throw new Error('Selected channel not found.');
        }

        resolvedChannelName = channelRow.name;
    }

    let oembedTitle: string | null = null;
    let oembedThumbnail: string | null = null;

    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeVideoId}&format=json`;
        const response = await fetch(oembedUrl, { cache: 'no-store' });
        if (response.ok) {
            const data = await response.json();
            oembedTitle = typeof data?.title === 'string' ? data.title : null;
            oembedThumbnail = typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : null;
        }
    } catch {
        oembedTitle = null;
        oembedThumbnail = null;
    }

    if (!youtubeMeta) {
        youtubeMeta = await fetchYoutubeMetadata(youtubeVideoId);
    }

    const title = (input.title && input.title.trim().length > 0
        ? input.title.trim()
        : oembedTitle || youtubeMeta?.title);
    if (!title) {
        throw new Error('Title is required.');
    }

    const payload = {
        youtube_video_id: youtubeVideoId,
        channel_id: resolvedChannelId,
        channel_name: resolvedChannelName,
        title,
        description: null,
        published_at: publishedAt,
        duration_seconds: null,
        thumbnail_url: oembedThumbnail
            || youtubeMeta?.thumbnailUrl
            || `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`,
        status: input.status ?? 'favorited',
    };

    const { data, error } = await supabase
        .from('videos')
        .upsert(payload, { onConflict: 'youtube_video_id' })
        .select('id');

    if (error) {
        throw new Error(`Failed to add video: ${error.message}`);
    }

    revalidateCoreViews();
    revalidatePath('/import');

    return { id: data?.[0]?.id ?? null };
}
