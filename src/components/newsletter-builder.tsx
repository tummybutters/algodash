"use client";

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Clipboard, GripVertical, X } from 'lucide-react';
import type {
    NewsletterIssue,
    NewsletterItemFields,
    NewsletterItemWithVideo,
    NewsletterType,
    VideoListItem,
} from '@/types/database';
import {
    addNewsletterItem,
    moveNewsletterItem,
    removeNewsletterItem,
    reorderNewsletterItems,
    updateNewsletterIssue,
    updateNewsletterIssueDate,
    publishNewsletter,
} from '@/lib/actions/newsletters';

type NewsletterBuilderProps = {
    issues: Record<NewsletterType, NewsletterIssue>;
    urgentItems: NewsletterItemWithVideo[];
    evergreenItems: NewsletterItemWithVideo[];
    favorites: VideoListItem[];
};

type DragPayload = {
    source: 'favorites' | 'urgent' | 'evergreen';
    itemId?: string;
    videoId: string;
};

const PLACEHOLDERS = {
    podcastName: '{{PODCAST_NAME}}',
    guestName: '{{GUEST_NAME}}',
    actor: '{{ONE_SENTENCE_LEVERAGE}}',
    actorLong: '{{ONE_SENTENCE_LEVERAGE_WHO_THEY_ARE_AND_WHY_THEY_MATTER}}',
    topics: '{{ONE_SENTENCE_2-3_DOMAINS_PLUS_THE_DECISION/TRADEOFF}}',
    topicsEvergreen: '{{ONE_SENTENCE_2-3_DOMAINS_PLUS_THE_SYSTEM_THEYRE_MODELING}}',
    signal: '{{NUGGET}}',
    whyNow: '{{ONE_SENTENCE_WHAT_DECISION_OR_RISK_CHANGES_IF_YOU_WAIT}}',
    whyCompounds: '{{ONE_SENTENCE_HOW_THIS_CHANGES_DECISIONS_OVER_TIME}}',
    listenIf: '{{CONDITION_1}}',
    skipIf: '{{CONDITION_2}}',
    horizon: '{{WEEKS_OR_MONTHS}}',
    framework: '{{ONE_SENTENCE_CORE_MODEL_OR_ASSUMPTION}}',
};

function normalizeFields(fields: NewsletterItemFields | null | undefined): NewsletterItemFields {
    return fields ?? {};
}

function valueOrPlaceholder(value: string | null | undefined, placeholder: string) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed.length > 0 ? trimmed : placeholder;
}

function arrayValueOrPlaceholder(values: string[] | null | undefined, index: number, placeholder: string) {
    const entry = Array.isArray(values) ? values[index] : undefined;
    return valueOrPlaceholder(entry, placeholder);
}

function formatIssueDate(raw: string | null | undefined) {
    if (!raw) return '{{DATE}}';
    return raw;
}

function buildUrgentBlock(item: NewsletterItemWithVideo, index: number) {
    const fields = normalizeFields(item.fields);
    const podcastName = valueOrPlaceholder(fields.podcast_name || item.video.channel_name, PLACEHOLDERS.podcastName);
    const guestName = valueOrPlaceholder(fields.guest_name, PLACEHOLDERS.guestName);
    const actorPlaceholder = index === 0 ? PLACEHOLDERS.actorLong : PLACEHOLDERS.actor;
    const actor = valueOrPlaceholder(fields.actor, actorPlaceholder);
    const topics = valueOrPlaceholder(fields.topics, PLACEHOLDERS.topics);
    const signalOne = arrayValueOrPlaceholder(fields.signals, 0, '{{NUGGET_1_FRAMEWORK_OR_TRADEOFF_OR_PREDICTION}}');
    const signalTwo = arrayValueOrPlaceholder(fields.signals, 1, '{{NUGGET_2_NON_CONSENSUS_OR_COMPETITIVE_POSITIONING}}');
    const signalThree = arrayValueOrPlaceholder(fields.signals, 2, '{{NUGGET_3_CONSTRAINT_OR_TIMELINE}}');
    const whyNow = valueOrPlaceholder(fields.why_now, PLACEHOLDERS.whyNow);
    const listenIf = valueOrPlaceholder(fields.listen_if, PLACEHOLDERS.listenIf);
    const skipIf = valueOrPlaceholder(fields.skip_if, PLACEHOLDERS.skipIf);
    const horizon = valueOrPlaceholder(fields.relevance_horizon, PLACEHOLDERS.horizon);

    return [
        index === 0 ? '★ Must Watch (Urgent)' : '',
        `${podcastName} — ${guestName}`.trim(),
        item.video.video_url,
        '',
        'Actor:',
        actor,
        '',
        'Topics:',
        topics,
        '',
        'Signals:',
        `• ${signalOne}`,
        `• ${signalTwo}`,
        `• ${signalThree}`,
        '',
        'Why it matters now:',
        whyNow,
        '',
        'Listen or skip:',
        `Listen if ${listenIf}. Skip if ${skipIf}.`,
        '',
        'Relevance horizon:',
        horizon,
    ]
        .filter((line) => line !== '')
        .join('\n');
}

function buildEvergreenBlock(item: NewsletterItemWithVideo, index: number) {
    const fields = normalizeFields(item.fields);
    const podcastName = valueOrPlaceholder(fields.podcast_name || item.video.channel_name, PLACEHOLDERS.podcastName);
    const guestName = valueOrPlaceholder(fields.guest_name, PLACEHOLDERS.guestName);
    const actorPlaceholder = index === 0 ? PLACEHOLDERS.actorLong : PLACEHOLDERS.actor;
    const actor = valueOrPlaceholder(fields.actor, actorPlaceholder);
    const topics = valueOrPlaceholder(fields.topics, PLACEHOLDERS.topicsEvergreen);
    const framework = valueOrPlaceholder(fields.framework, PLACEHOLDERS.framework);
    const whyCompounds = valueOrPlaceholder(fields.why_compounds, PLACEHOLDERS.whyCompounds);
    const nuggetOne = arrayValueOrPlaceholder(fields.nuggets, 0, '{{NUGGET_1_REUSABLE_RULE_OR_HEURISTIC}}');
    const nuggetTwo = arrayValueOrPlaceholder(fields.nuggets, 1, '{{NUGGET_2_INCENTIVE_OR_ORG_DESIGN_INSIGHT}}');
    const nuggetThree = arrayValueOrPlaceholder(fields.nuggets, 2, '{{NUGGET_3_SECOND_ORDER_EFFECT_OR_FAILURE_MODE}}');
    const listenIf = valueOrPlaceholder(fields.listen_if, PLACEHOLDERS.listenIf);
    const skipIf = valueOrPlaceholder(fields.skip_if, PLACEHOLDERS.skipIf);

    return [
        index === 0 ? '★ Must Keep (Evergreen)' : '',
        `${podcastName} — ${guestName}`.trim(),
        item.video.video_url,
        '',
        'Actor:',
        actor,
        '',
        'Topics:',
        topics,
        '',
        'Framework / Assumption:',
        framework,
        '',
        'Why it compounds:',
        whyCompounds,
        '',
        'Nuggets:',
        `• ${nuggetOne}`,
        `• ${nuggetTwo}`,
        `• ${nuggetThree}`,
        '',
        'Listen or skip:',
        `Listen if ${listenIf}. Skip if ${skipIf}.`,
        '',
        'Relevance horizon:',
        'Multi-year',
    ]
        .filter((line) => line !== '')
        .join('\n');
}

function buildUrgentDraft(items: NewsletterItemWithVideo[], issueDate: string) {
    const header = [
        'Executive Algorithm',
        `Urgent Signals — ${formatIssueDate(issueDate)}`,
        '',
    ].join('\n');

    const blocks = items.map((item, index) => buildUrgentBlock(item, index));
    const body = blocks.length > 0 ? blocks.join('\n\n— — —\n\n') : '{{URGENT_ITEM_1}}';
    const footer = [
        '',
        'Meta (optional, quiet credibility line):',
        'Signals surfaced: {{SIGNAL_COUNT}} / Episodes reviewed: ~{{EPISODE_REVIEWED_COUNT}}',
        '',
        'Reply if something here feels off or missing.',
        'Unsubscribe',
    ].join('\n');

    return `${header}${body}${footer}`;
}

function buildEvergreenDraft(items: NewsletterItemWithVideo[], issueDate: string) {
    const header = [
        'Executive Algorithm',
        `Evergreen Signals — ${formatIssueDate(issueDate)}`,
        '',
    ].join('\n');

    const blocks = items.map((item, index) => buildEvergreenBlock(item, index));
    const body = blocks.length > 0 ? blocks.join('\n\n— — —\n\n') : '{{EVERGREEN_ITEM_1}}';
    const footer = [
        '',
        'Meta (optional):',
        'Signals surfaced: {{SIGNAL_COUNT}} / Episodes reviewed: ~{{EPISODE_REVIEWED_COUNT}}',
        '',
        'Reply if something here feels off or missing.',
        'Unsubscribe',
    ].join('\n');

    return `${header}${body}${footer}`;
}

function reorderList<T>(list: T[], fromIndex: number, toIndex: number) {
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
}

function insertAt<T>(list: T[], item: T, index: number) {
    const next = [...list];
    next.splice(index, 0, item);
    return next;
}

export function NewsletterBuilder({ issues, urgentItems, evergreenItems, favorites }: NewsletterBuilderProps) {
    const [urgentList, setUrgentList] = useState(() => [...urgentItems].sort((a, b) => a.position - b.position));
    const [evergreenList, setEvergreenList] = useState(() => [...evergreenItems].sort((a, b) => a.position - b.position));
    const [issueDates, setIssueDates] = useState({
        urgent: issues.urgent.issue_date,
        evergreen: issues.evergreen.issue_date,
    });
    const [issueMetadata, setIssueMetadata] = useState({
        urgent: {
            subject: issues.urgent.subject || '',
            preview_text: issues.urgent.preview_text || '',
        },
        evergreen: {
            subject: issues.evergreen.subject || '',
            preview_text: issues.evergreen.preview_text || '',
        }
    });
    const [isPending, startTransition] = useTransition();
    const [copied, setCopied] = useState<NewsletterType | null>(null);
    const [published, setPublished] = useState<NewsletterType | null>(null);
    const [publishError, setPublishError] = useState<string | null>(null);

    const availableFavorites = useMemo(() => {
        const assigned = new Set([...urgentList, ...evergreenList].map((item) => item.video_id));
        return favorites.filter((video) => !assigned.has(video.id));
    }, [favorites, urgentList, evergreenList]);

    const urgentDraft = useMemo(
        () => buildUrgentDraft(urgentList, issueDates.urgent),
        [urgentList, issueDates.urgent]
    );
    const evergreenDraft = useMemo(
        () => buildEvergreenDraft(evergreenList, issueDates.evergreen),
        [evergreenList, issueDates.evergreen]
    );

    const persistOrder = (issueId: string, items: NewsletterItemWithVideo[]) => {
        startTransition(() => {
            reorderNewsletterItems(items.map((item, index) => ({ id: item.id, position: index })));
        });
    };

    const parsePayload = (event: React.DragEvent): DragPayload | null => {
        const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
        if (!raw) return null;
        try {
            return JSON.parse(raw) as DragPayload;
        } catch {
            return null;
        }
    };

    const handleDrop = async (
        event: React.DragEvent,
        target: NewsletterType,
        targetIndex: number
    ) => {
        event.preventDefault();
        const payload = parsePayload(event);
        if (!payload) return;

        const targetIssue = issues[target];
        const targetList = target === 'urgent' ? urgentList : evergreenList;
        const setTargetList = target === 'urgent' ? setUrgentList : setEvergreenList;
        const sourceList = payload.source === 'urgent' ? urgentList : payload.source === 'evergreen' ? evergreenList : null;
        const setSourceList = payload.source === 'urgent' ? setUrgentList : payload.source === 'evergreen' ? setEvergreenList : null;

        if (payload.source === 'favorites') {
            const video = favorites.find((item) => item.id === payload.videoId);
            if (!video) return;

            const response = await addNewsletterItem({
                issueId: targetIssue.id,
                videoId: payload.videoId,
                position: targetIndex,
            });

            const newItem: NewsletterItemWithVideo = {
                ...(response as NewsletterItemWithVideo),
                video: {
                    id: video.id,
                    title: video.title,
                    channel_name: video.channel_name,
                    video_url: video.video_url,
                    thumbnail_url: video.thumbnail_url,
                    duration_seconds: video.duration_seconds,
                    published_at: video.published_at,
                },
            };

            const nextTarget = insertAt(targetList, newItem, targetIndex);
            setTargetList(nextTarget);
            persistOrder(targetIssue.id, nextTarget);
            return;
        }

        if (!sourceList || !setSourceList || !payload.itemId) return;

        const sourceIndex = sourceList.findIndex((item) => item.id === payload.itemId);
        if (sourceIndex === -1) return;

        const movingItem = sourceList[sourceIndex];

        if (payload.source === target) {
            const nextTarget = reorderList(targetList, sourceIndex, targetIndex);
            setTargetList(nextTarget);
            persistOrder(targetIssue.id, nextTarget);
            return;
        }

        const nextSource = sourceList.filter((item) => item.id !== payload.itemId);
        const nextTarget = insertAt(
            targetList,
            { ...movingItem, issue_id: targetIssue.id, position: targetIndex },
            targetIndex
        );

        setSourceList(nextSource);
        setTargetList(nextTarget);

        startTransition(() => {
            moveNewsletterItem({ itemId: payload.itemId!, issueId: targetIssue.id, position: targetIndex });
            reorderNewsletterItems(nextSource.map((item, index) => ({ id: item.id, position: index })));
            reorderNewsletterItems(nextTarget.map((item, index) => ({ id: item.id, position: index })));
        });
    };

    const handleRemove = (item: NewsletterItemWithVideo, listType: NewsletterType) => {
        const list = listType === 'urgent' ? urgentList : evergreenList;
        const setList = listType === 'urgent' ? setUrgentList : setEvergreenList;
        const nextList = list.filter((entry) => entry.id !== item.id);
        setList(nextList);
        persistOrder(issues[listType].id, nextList);
        startTransition(() => removeNewsletterItem(item.id));
    };

    const handleQuickAdd = async (videoId: string, target: NewsletterType) => {
        const targetIssue = issues[target];
        const list = target === 'urgent' ? urgentList : evergreenList;
        const setList = target === 'urgent' ? setUrgentList : setEvergreenList;
        const video = favorites.find((item) => item.id === videoId);
        if (!video) return;

        const response = await addNewsletterItem({
            issueId: targetIssue.id,
            videoId,
            position: list.length,
        });

        const newItem: NewsletterItemWithVideo = {
            ...(response as NewsletterItemWithVideo),
            video: {
                id: video.id,
                title: video.title,
                channel_name: video.channel_name,
                video_url: video.video_url,
                thumbnail_url: video.thumbnail_url,
                duration_seconds: video.duration_seconds,
                published_at: video.published_at,
            },
        };

        const nextList = [...list, newItem];
        setList(nextList);
        persistOrder(targetIssue.id, nextList);
    };

    const handleCopy = async (type: NewsletterType, content: string) => {
        await navigator.clipboard.writeText(content);
        setCopied(type);
        setTimeout(() => setCopied(null), 1200);
    };

    const updateIssueDate = (type: NewsletterType, value: string) => {
        setIssueDates((prev) => ({ ...prev, [type]: value }));
        startTransition(() => updateNewsletterIssueDate(issues[type].id, value));
    };

    const updateIssueMetadata = (type: NewsletterType, field: 'subject' | 'preview_text', value: string) => {
        setIssueMetadata((prev) => ({
            ...prev,
            [type]: { ...prev[type], [field]: value }
        }));
        startTransition(() => updateNewsletterIssue(issues[type].id, { [field]: value }));
    };

    const handlePublish = async (type: NewsletterType) => {
        setPublishError(null);
        setPublished(null);

        startTransition(async () => {
            try {
                await publishNewsletter(issues[type].id);
                setPublished(type);
                setTimeout(() => setPublished(null), 3000);
            } catch (err) {
                setPublishError(err instanceof Error ? err.message : 'Publishing failed');
            }
        });
    };

    const renderItemCard = (
        item: NewsletterItemWithVideo,
        listType: NewsletterType,
        index: number
    ) => (
        <div
            key={item.id}
            className="neo-card p-3 flex gap-3 items-center"
            draggable
            onDragStart={(event) => {
                const payload: DragPayload = {
                    source: listType,
                    itemId: item.id,
                    videoId: item.video_id,
                };
                event.dataTransfer.setData('application/json', JSON.stringify(payload));
                event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, listType, index)}
        >
            <div className="text-muted-foreground">
                <GripVertical size={16} />
            </div>
            <div className="relative w-16 h-12 rounded-md overflow-hidden bg-muted">
                {item.video.thumbnail_url ? (
                    <Image src={item.video.thumbnail_url} alt={item.video.title} fill className="object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                        No thumbnail
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground line-clamp-2">{item.video.title}</p>
                <p className="text-xs text-muted-foreground">{item.video.channel_name || 'Unknown channel'}</p>
                <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.video.published_at), { addSuffix: true })}
                </p>
            </div>
            <button
                onClick={() => handleRemove(item, listType)}
                className="neo-button-ghost px-2 py-2 text-xs"
                aria-label="Remove from issue"
                disabled={isPending}
            >
                <X size={14} />
            </button>
        </div>
    );

    return (
        <div className="space-y-10">
            <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="space-y-2">
                    <h1 className="font-display text-3xl text-card-foreground">Newsletter Builder</h1>
                    <p className="text-sm text-muted-foreground">
                        Drag favorites into the urgent or evergreen drafts, then copy the formatted output.
                    </p>
                </div>
                <span className="neo-chip bg-muted text-muted-foreground">
                    Favorites available: {availableFavorites.length}
                </span>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr,1fr,1fr]">
                <section className="neo-panel p-5 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="font-display text-xl text-card-foreground">Favorites</h2>
                        <span className="text-xs text-muted-foreground">Drag to add</span>
                    </div>
                    <div className="space-y-3 min-h-[200px]" onDragOver={(event) => event.preventDefault()}>
                        {availableFavorites.length === 0 && (
                            <p className="text-sm text-muted-foreground">No favorited episodes available.</p>
                        )}
                        {availableFavorites.map((video) => (
                            <div
                                key={video.id}
                                className="neo-card p-3 flex gap-3 items-center"
                                draggable
                                onDragStart={(event) => {
                                    const payload: DragPayload = { source: 'favorites', videoId: video.id };
                                    event.dataTransfer.setData('application/json', JSON.stringify(payload));
                                    event.dataTransfer.effectAllowed = 'move';
                                }}
                            >
                                <div className="relative w-16 h-12 rounded-md overflow-hidden bg-muted">
                                    {video.thumbnail_url ? (
                                        <Image
                                            src={video.thumbnail_url}
                                            alt={video.title}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                                            No thumbnail
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-card-foreground line-clamp-2">{video.title}</p>
                                    <p className="text-xs text-muted-foreground">{video.channel_name || 'Unknown channel'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleQuickAdd(video.id, 'urgent')}
                                        className="neo-button px-2 py-1 text-xs"
                                        disabled={isPending}
                                    >
                                        Urgent
                                    </button>
                                    <button
                                        onClick={() => handleQuickAdd(video.id, 'evergreen')}
                                        className="neo-button-ghost px-2 py-1 text-xs"
                                        disabled={isPending}
                                    >
                                        Evergreen
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section
                    className="neo-panel p-5 space-y-4"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, 'urgent', urgentList.length)}
                >
                    <div className="space-y-5">
                        <div>
                            <h2 className="font-display text-xl text-card-foreground">Urgent Signals</h2>
                            <p className="text-xs text-muted-foreground">Time-sensitive picks for the next send.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <input
                                type="date"
                                value={issueDates.urgent}
                                onChange={(event) => updateIssueDate('urgent', event.target.value)}
                                className="neo-input px-3 py-1.5 text-xs text-card-foreground w-[130px]"
                            />
                            <input
                                placeholder="Subject line"
                                value={issueMetadata.urgent.subject}
                                onChange={(e) => updateIssueMetadata('urgent', 'subject', e.target.value)}
                                className="neo-input px-3 py-1.5 text-xs font-medium w-[180px]"
                            />
                            <input
                                placeholder="Preview text"
                                value={issueMetadata.urgent.preview_text}
                                onChange={(e) => updateIssueMetadata('urgent', 'preview_text', e.target.value)}
                                className="neo-input px-3 py-1.5 text-xs w-[180px]"
                            />
                        </div>
                    </div>
                    <div className="space-y-3 min-h-[200px]">
                        {urgentList.length === 0 && (
                            <p className="text-sm text-muted-foreground">Drop urgent picks here.</p>
                        )}
                        {urgentList.map((item, index) => renderItemCard(item, 'urgent', index))}
                    </div>
                </section>

                <section
                    className="neo-panel p-5 space-y-4"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, 'evergreen', evergreenList.length)}
                >
                    <div className="space-y-5">
                        <div>
                            <h2 className="font-display text-xl text-card-foreground">Evergreen Signals</h2>
                            <p className="text-xs text-muted-foreground">Long-horizon recommendations worth revisiting.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <input
                                type="date"
                                value={issueDates.evergreen}
                                onChange={(event) => updateIssueDate('evergreen', event.target.value)}
                                className="neo-input px-3 py-1.5 text-xs text-card-foreground w-[130px]"
                            />
                            <input
                                placeholder="Subject line"
                                value={issueMetadata.evergreen.subject}
                                onChange={(e) => updateIssueMetadata('evergreen', 'subject', e.target.value)}
                                className="neo-input px-3 py-1.5 text-xs font-medium w-[180px]"
                            />
                            <input
                                placeholder="Preview text"
                                value={issueMetadata.evergreen.preview_text}
                                onChange={(e) => updateIssueMetadata('evergreen', 'preview_text', e.target.value)}
                                className="neo-input px-3 py-1.5 text-xs w-[180px]"
                            />
                        </div>
                    </div>
                    <div className="space-y-3 min-h-[200px]">
                        {evergreenList.length === 0 && (
                            <p className="text-sm text-muted-foreground">Drop evergreen picks here.</p>
                        )}
                        {evergreenList.map((item, index) => renderItemCard(item, 'evergreen', index))}
                    </div>
                </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="neo-panel p-6 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <h3 className="font-display text-xl text-card-foreground">Urgent Draft Output</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleCopy('urgent', urgentDraft)}
                                className="neo-button-ghost inline-flex items-center gap-2 px-3 py-1.5 text-xs"
                            >
                                <Clipboard size={14} />
                                {copied === 'urgent' ? 'Copied' : 'Copy'}
                            </button>
                            <button
                                onClick={() => handlePublish('urgent')}
                                disabled={isPending}
                                className={`neo-button inline-flex items-center gap-2 px-3 py-1.5 text-xs ${published === 'urgent' ? 'bg-green-600' : ''}`}
                            >
                                <ArrowRight size={14} />
                                {published === 'urgent' ? 'Published!' : 'Publish'}
                            </button>
                        </div>
                    </div>
                    {publishError && <p className="text-[10px] text-rose-500">{publishError}</p>}

                    <pre className="neo-panel p-4 text-xs whitespace-pre-wrap max-h-[420px] overflow-y-auto">
                        {urgentDraft}
                    </pre>
                </section>

                <section className="neo-panel p-6 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <h3 className="font-display text-xl text-card-foreground">Evergreen Draft Output</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleCopy('evergreen', evergreenDraft)}
                                className="neo-button-ghost inline-flex items-center gap-2 px-3 py-1.5 text-xs"
                            >
                                <Clipboard size={14} />
                                {copied === 'evergreen' ? 'Copied' : 'Copy'}
                            </button>
                            <button
                                onClick={() => handlePublish('evergreen')}
                                disabled={isPending}
                                className={`neo-button inline-flex items-center gap-2 px-3 py-1.5 text-xs ${published === 'evergreen' ? 'bg-green-600' : ''}`}
                            >
                                <ArrowRight size={14} />
                                {published === 'evergreen' ? 'Published!' : 'Publish'}
                            </button>
                        </div>
                    </div>
                    {publishError && <p className="text-[10px] text-rose-500">{publishError}</p>}

                    <pre className="neo-panel p-4 text-xs whitespace-pre-wrap max-h-[420px] overflow-y-auto">
                        {evergreenDraft}
                    </pre>
                </section>
            </div>

            <div className="neo-panel p-5 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <ArrowRight size={14} />
                    Drag from Favorites into the issue lists or tap quick add on mobile.
                </div>
                <div>Updates are saved automatically.</div>
            </div>
        </div>
    );
}
