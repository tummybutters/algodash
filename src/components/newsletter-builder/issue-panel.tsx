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
            className="gpt-panel p-6 panel-stack"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDropEnd}
            id={`issue-panel-${type}`}
        >
            <div className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="date"
                        value={issueDate}
                        onChange={(event) => onDateChange(event.target.value)}
                        className="gpt-input px-4 py-2 text-sm field-sm"
                    />
                    <input
                        placeholder="Subject line"
                        value={subject}
                        onChange={(event) => onSubjectChange(event.target.value)}
                        className="gpt-input px-4 py-2 text-sm font-medium field-md"
                    />
                    <input
                        placeholder="Preview text"
                        value={previewText}
                        onChange={(event) => onPreviewTextChange(event.target.value)}
                        className="gpt-input px-4 py-2 text-sm field-lg"
                    />
                </div>
            </div>

            <div className="space-y-2 min-h-[200px]">
                {items.length === 0 && (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                        {type === 'urgent' ? 'Drop urgent picks here.' : 'Drop evergreen picks here.'}
                    </p>
                )}
                {items.map((item, index) => (
                    <div
                        key={item.id}
                        className="gpt-card p-3 flex gap-3 items-center cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(event) => onItemDragStart(event, item)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => onDropItem(event, index)}
                    >
                        <div className="text-muted-foreground">
                            <GripVertical size={16} strokeWidth={1.5} />
                        </div>
                        <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-[#1a1a1a] shrink-0">
                            {item.video.thumbnail_url ? (
                                <Image src={item.video.thumbnail_url} alt={item.video.title} fill className="object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                                    —
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-card-foreground line-clamp-1">{item.video.title}</p>
                            <p className="text-xs text-muted-foreground">
                                {item.video.channel_name || 'Unknown'} · {formatDistanceToNow(new Date(item.video.published_at), { addSuffix: true })}
                            </p>
                        </div>
                        <button
                            onClick={() => onRemove(item)}
                            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                            aria-label="Remove from issue"
                            disabled={isPending}
                        >
                            <X size={16} strokeWidth={1.5} />
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
}
