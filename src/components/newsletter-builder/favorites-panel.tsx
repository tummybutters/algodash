'use client';

import Image from 'next/image';
import { type NewsletterType, type VideoListItem } from '@/types/database';

type FavoritesPanelProps = {
    items: VideoListItem[];
    isPending: boolean;
    onQuickAdd: (videoId: string, target: NewsletterType) => void;
    onDragStart: (event: React.DragEvent, videoId: string) => void;
};

export function FavoritesPanel({ items, isPending, onQuickAdd, onDragStart }: FavoritesPanelProps) {
    return (
        <section className="gpt-panel p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-card-foreground">Favorites</h2>
                <span className="text-xs text-muted-foreground">Drag to add</span>
            </div>
            <div className="space-y-2 min-h-[200px]" onDragOver={(event) => event.preventDefault()}>
                {items.length === 0 && (
                    <p className="text-sm text-muted-foreground py-8 text-center">No favorited episodes available.</p>
                )}
                {items.map((video) => (
                    <div
                        key={video.id}
                        className="gpt-card p-3 flex gap-3 items-center cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(event) => onDragStart(event, video.id)}
                    >
                        <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-[#1a1a1a] shrink-0">
                            {video.thumbnail_url ? (
                                <Image
                                    src={video.thumbnail_url}
                                    alt={video.title}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                                    —
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-card-foreground line-clamp-1">{video.title}</p>
                            <p className="text-xs text-muted-foreground">{video.channel_name || 'Unknown channel'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => onQuickAdd(video.id, 'urgent')}
                                className="gpt-button px-3 py-1.5 text-xs"
                                disabled={isPending}
                            >
                                Urgent
                            </button>
                            <button
                                onClick={() => onQuickAdd(video.id, 'evergreen')}
                                className="gpt-button-ghost px-3 py-1.5 text-xs"
                                disabled={isPending}
                            >
                                Evergreen
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
