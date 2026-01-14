"use client";

import { useEffect, useMemo, useState, useTransition } from 'react';
import { ArrowRight } from 'lucide-react';
import type {
    NewsletterIssue,
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
import { buildEvergreenDraft, buildUrgentDraft } from '@/lib/newsletters/drafts';
import { insertAt, reorderList } from '@/lib/newsletters/ordering';
import { DraftOutputPanel } from './draft-output-panel';
import { FavoritesPanel } from './favorites-panel';
import { IssuePanel } from './issue-panel';
import { IssueCalendar } from './issue-calendar';

type NewsletterBuilderProps = {
    issues: Record<NewsletterType, NewsletterIssue>;
    draftIssues: NewsletterIssue[];
    allItems: NewsletterItemWithVideo[];
    favorites: VideoListItem[];
};

type DragPayload = {
    source: 'favorites' | 'urgent' | 'evergreen';
    itemId?: string;
    videoId: string;
};

export function NewsletterBuilder({ issues, draftIssues, allItems, favorites }: NewsletterBuilderProps) {
    const [drafts, setDrafts] = useState(() => [...draftIssues]);
    const [activeIssueIds, setActiveIssueIds] = useState({
        urgent: issues.urgent.id,
        evergreen: issues.evergreen.id,
    });
    const itemsByIssueId = useMemo(() => {
        const map = new Map<string, NewsletterItemWithVideo[]>();
        allItems.forEach((item) => {
            const list = map.get(item.issue_id) || [];
            list.push(item);
            map.set(item.issue_id, list);
        });
        map.forEach((list, key) => {
            map.set(key, [...list].sort((a, b) => a.position - b.position));
        });
        return map;
    }, [allItems]);
    const [urgentList, setUrgentList] = useState(() => itemsByIssueId.get(issues.urgent.id) || []);
    const [evergreenList, setEvergreenList] = useState(() => itemsByIssueId.get(issues.evergreen.id) || []);
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
        },
    });
    const [isPending, startTransition] = useTransition();
    const [copied, setCopied] = useState<NewsletterType | null>(null);
    const [published, setPublished] = useState<NewsletterType | null>(null);
    const [publishError, setPublishError] = useState<string | null>(null);

    const issuesById = useMemo(() => {
        return new Map(drafts.map((issue) => [issue.id, issue]));
    }, [drafts]);

    const activeIssues = useMemo(() => {
        return {
            urgent: issuesById.get(activeIssueIds.urgent) || issues.urgent,
            evergreen: issuesById.get(activeIssueIds.evergreen) || issues.evergreen,
        };
    }, [activeIssueIds, issuesById, issues]);

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

    useEffect(() => {
        const urgentIssue = issuesById.get(activeIssueIds.urgent);
        const evergreenIssue = issuesById.get(activeIssueIds.evergreen);

        if (urgentIssue) {
            setUrgentList(itemsByIssueId.get(urgentIssue.id) || []);
            setIssueDates((prev) => ({ ...prev, urgent: urgentIssue.issue_date }));
            setIssueMetadata((prev) => ({
                ...prev,
                urgent: {
                    subject: urgentIssue.subject || '',
                    preview_text: urgentIssue.preview_text || '',
                },
            }));
        }

        if (evergreenIssue) {
            setEvergreenList(itemsByIssueId.get(evergreenIssue.id) || []);
            setIssueDates((prev) => ({ ...prev, evergreen: evergreenIssue.issue_date }));
            setIssueMetadata((prev) => ({
                ...prev,
                evergreen: {
                    subject: evergreenIssue.subject || '',
                    preview_text: evergreenIssue.preview_text || '',
                },
            }));
        }
    }, [activeIssueIds, itemsByIssueId, issuesById]);

    const persistOrder = (items: NewsletterItemWithVideo[]) => {
        startTransition(() => {
            reorderNewsletterItems(items.map((item, index) => ({ id: item.id, position: index })));
        });
    };

    const setDragPayload = (event: React.DragEvent, payload: DragPayload) => {
        event.dataTransfer.setData('application/json', JSON.stringify(payload));
        event.dataTransfer.effectAllowed = 'move';
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

        const targetIssue = activeIssues[target];
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
            persistOrder(nextTarget);
            return;
        }

        if (!sourceList || !setSourceList || !payload.itemId) return;

        const sourceIndex = sourceList.findIndex((item) => item.id === payload.itemId);
        if (sourceIndex === -1) return;

        const movingItem = sourceList[sourceIndex];

        if (payload.source === target) {
            const nextTarget = reorderList(targetList, sourceIndex, targetIndex);
            setTargetList(nextTarget);
            persistOrder(nextTarget);
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
        persistOrder(nextList);
        startTransition(() => removeNewsletterItem(item.id));
    };

    const handleQuickAdd = async (videoId: string, target: NewsletterType) => {
        const targetIssue = activeIssues[target];
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
        persistOrder(nextList);
    };

    const handleCopy = async (type: NewsletterType, content: string) => {
        await navigator.clipboard.writeText(content);
        setCopied(type);
        setTimeout(() => setCopied(null), 1200);
    };

    const updateDraft = (issueId: string, updates: Partial<NewsletterIssue>) => {
        setDrafts((prev) =>
            prev.map((issue) => (issue.id === issueId ? { ...issue, ...updates } : issue))
        );
    };

    const updateIssueDate = (type: NewsletterType, value: string) => {
        const issueId = activeIssues[type].id;
        setIssueDates((prev) => ({ ...prev, [type]: value }));
        updateDraft(issueId, { issue_date: value });
        startTransition(() => updateNewsletterIssueDate(issueId, value));
    };

    const updateIssueMetadata = (type: NewsletterType, field: 'subject' | 'preview_text', value: string) => {
        setIssueMetadata((prev) => ({
            ...prev,
            [type]: { ...prev[type], [field]: value },
        }));
        const issueId = activeIssues[type].id;
        updateDraft(issueId, { [field]: value });
        startTransition(() => updateNewsletterIssue(issueId, { [field]: value }));
    };

    const handlePublish = async (type: NewsletterType) => {
        setPublishError(null);
        setPublished(null);

        startTransition(async () => {
            try {
                await publishNewsletter(activeIssues[type].id);
                setPublished(type);
                setTimeout(() => setPublished(null), 3000);
            } catch (err) {
                setPublishError(err instanceof Error ? err.message : 'Publishing failed');
            }
        });
    };

    return (
        <div className="space-y-8">
            <IssueCalendar
                issueDates={issueDates}
                onAssignDate={updateIssueDate}
                onOpenIssue={(type) => {
                    document.getElementById(`issue-panel-${type}`)?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                    });
                }}
            />

            <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold text-card-foreground">Newsletter Builder</h1>
                    <p className="text-sm text-muted-foreground">
                        Drag favorites into the urgent or evergreen drafts, then copy the formatted output.
                    </p>
                </div>
                <span className="text-sm text-muted-foreground">
                    {availableFavorites.length} favorites available
                </span>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.1fr,1fr,1fr]">
                <FavoritesPanel
                    items={availableFavorites}
                    isPending={isPending}
                    onQuickAdd={handleQuickAdd}
                    onDragStart={(event, videoId) =>
                        setDragPayload(event, { source: 'favorites', videoId })
                    }
                />

                <IssuePanel
                    type="urgent"
                    title="Urgent Signals"
                    subtitle="Time-sensitive picks for the next send."
                    issueDate={issueDates.urgent}
                    subject={issueMetadata.urgent.subject}
                    previewText={issueMetadata.urgent.preview_text}
                    items={urgentList}
                    isPending={isPending}
                    onDateChange={(value) => updateIssueDate('urgent', value)}
                    onSubjectChange={(value) => updateIssueMetadata('urgent', 'subject', value)}
                    onPreviewTextChange={(value) => updateIssueMetadata('urgent', 'preview_text', value)}
                    onDropItem={(event, index) => handleDrop(event, 'urgent', index)}
                    onDropEnd={(event) => handleDrop(event, 'urgent', urgentList.length)}
                    onItemDragStart={(event, item) =>
                        setDragPayload(event, { source: 'urgent', itemId: item.id, videoId: item.video_id })
                    }
                    onRemove={(item) => handleRemove(item, 'urgent')}
                />

                <IssuePanel
                    type="evergreen"
                    title="Evergreen Signals"
                    subtitle="Long-horizon recommendations worth revisiting."
                    issueDate={issueDates.evergreen}
                    subject={issueMetadata.evergreen.subject}
                    previewText={issueMetadata.evergreen.preview_text}
                    items={evergreenList}
                    isPending={isPending}
                    onDateChange={(value) => updateIssueDate('evergreen', value)}
                    onSubjectChange={(value) => updateIssueMetadata('evergreen', 'subject', value)}
                    onPreviewTextChange={(value) => updateIssueMetadata('evergreen', 'preview_text', value)}
                    onDropItem={(event, index) => handleDrop(event, 'evergreen', index)}
                    onDropEnd={(event) => handleDrop(event, 'evergreen', evergreenList.length)}
                    onItemDragStart={(event, item) =>
                        setDragPayload(event, { source: 'evergreen', itemId: item.id, videoId: item.video_id })
                    }
                    onRemove={(item) => handleRemove(item, 'evergreen')}
                />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <DraftOutputPanel
                    title="Urgent Draft Output"
                    draft={urgentDraft}
                    copyLabel={copied === 'urgent' ? 'Copied' : 'Copy'}
                    publishLabel={published === 'urgent' ? 'Published!' : 'Publish'}
                    onCopy={() => handleCopy('urgent', urgentDraft)}
                    onPublish={() => handlePublish('urgent')}
                    isPending={isPending}
                    publishError={publishError}
                />

                <DraftOutputPanel
                    title="Evergreen Draft Output"
                    draft={evergreenDraft}
                    copyLabel={copied === 'evergreen' ? 'Copied' : 'Copy'}
                    publishLabel={published === 'evergreen' ? 'Published!' : 'Publish'}
                    onCopy={() => handleCopy('evergreen', evergreenDraft)}
                    onPublish={() => handlePublish('evergreen')}
                    isPending={isPending}
                    publishError={publishError}
                />
            </div>

            <div className="gpt-panel p-5 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                    <ArrowRight size={16} strokeWidth={1.5} />
                    Drag from Favorites into the issue lists or tap quick add on mobile.
                </div>
                <div>Updates are saved automatically.</div>
            </div>
        </div>
    );
}
