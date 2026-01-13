'use client';

import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { GripVertical, X } from 'lucide-react';
import type { NewsletterItemWithVideo, NewsletterType } from '@/types/database';

type IssuePanelProps = {
    type: NewsletterType;
    title: string;
    subtitle: string;
    issueDate: string;
    subject: string;
    previewText: string;
    items: NewsletterItemWithVideo[];
    isPending: boolean;
    onDateChange: (value: string) => void;
    onSubjectChange: (value: string) => void;
    onPreviewTextChange: (value: string) => void;
    onDropItem: (event: React.DragEvent, index: number) => void;
    onDropEnd: (event: React.DragEvent) => void;
    onItemDragStart: (event: React.DragEvent, item: NewsletterItemWithVideo) => void;
    onRemove: (item: NewsletterItemWithVideo) => void;
};

export function IssuePanel({
    type,
    title,
    subtitle,
    issueDate,
    subject,
    previewText,
    items,
    isPending,
    onDateChange,
    onSubjectChange,
    onPreviewTextChange,
    onDropItem,
    onDropEnd,
    onItemDragStart,
    onRemove,
}: IssuePanelProps) {
    return (
        <section
            className="neo-panel p-5 space-y-4"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDropEnd}
        >
            <div className="space-y-5">
                <div>
                    <h2 className="font-display text-xl text-card-foreground">{title}</h2>
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="date"
                        value={issueDate}
                        onChange={(event) => onDateChange(event.target.value)}
                        className="neo-input px-3 py-1.5 text-xs text-card-foreground w-[130px]"
                    />
                    <input
                        placeholder="Subject line"
                        value={subject}
                        onChange={(event) => onSubjectChange(event.target.value)}
                        className="neo-input px-3 py-1.5 text-xs font-medium w-[180px]"
                    />
                    <input
                        placeholder="Preview text"
                        value={previewText}
                        onChange={(event) => onPreviewTextChange(event.target.value)}
                        className="neo-input px-3 py-1.5 text-xs w-[180px]"
                    />
                </div>
            </div>

            <div className="space-y-3 min-h-[200px]">
                {items.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        {type === 'urgent' ? 'Drop urgent picks here.' : 'Drop evergreen picks here.'}
                    </p>
                )}
                {items.map((item, index) => (
                    <div
                        key={item.id}
                        className="neo-card p-3 flex gap-3 items-center"
                        draggable
                        onDragStart={(event) => onItemDragStart(event, item)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => onDropItem(event, index)}
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
                            onClick={() => onRemove(item)}
                            className="neo-button-ghost px-2 py-2 text-xs"
                            aria-label="Remove from issue"
                            disabled={isPending}
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
}
