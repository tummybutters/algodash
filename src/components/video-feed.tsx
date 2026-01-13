'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { VideoCard } from './video-card';
import { Filters, FilterState } from './filters';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_DURATION_MAX_MINUTES, fetchVideoDetail, fetchVideoList } from '@/lib/supabase/video-queries';
import type { VideoListItem, ChannelOption, Video } from '@/types/database';
import { Loader2 } from 'lucide-react';

interface VideoFeedProps {
    initialVideos: VideoListItem[];
    initialCount: number;
    channels: ChannelOption[];
    title?: string;
    subtitle?: string;
    defaultFilters?: Partial<FilterState>;
}

const DEFAULT_FILTERS: FilterState = {
    channels: [],
    statuses: [],
    dateFrom: '',
    dateTo: '',
    durationMin: 0,
    durationMax: DEFAULT_DURATION_MAX_MINUTES,
    search: '',
};

const PAGE_SIZE = 20;

export function VideoFeed({ initialVideos, initialCount, channels, title, subtitle, defaultFilters }: VideoFeedProps) {
    const resolvedFilters = useMemo(
        () => ({ ...DEFAULT_FILTERS, ...defaultFilters }),
        [defaultFilters]
    );
    const [videos, setVideos] = useState<VideoListItem[]>(initialVideos);
    const [totalCount, setTotalCount] = useState(initialCount);
    const [filters, setFilters] = useState<FilterState>(resolvedFilters);
    const [isLoading, setIsLoading] = useState(false);
    const [offset, setOffset] = useState(PAGE_SIZE);
    const loaderRef = useRef<HTMLDivElement>(null);

    const supabase = createClient();

    const fetchVideos = useCallback(async (currentFilters: FilterState, currentOffset: number, append: boolean) => {
        setIsLoading(true);

        const { data, count } = await fetchVideoList(
            supabase,
            currentFilters,
            { offset: currentOffset, limit: PAGE_SIZE, count: append ? null : 'planned' }
        );

        if (data) {
            if (append) {
                setVideos((prev) => [...prev, ...data as VideoListItem[]]);
            } else {
                setVideos(data as VideoListItem[]);
            }
        }
        if (count !== null) {
            setTotalCount(count);
        }

        setIsLoading(false);
    }, [supabase]);

    const handleFilterChange = useCallback((newFilters: FilterState) => {
        setFilters(newFilters);
        setOffset(PAGE_SIZE);
        fetchVideos(newFilters, 0, false);
    }, [fetchVideos]);

    const loadMore = useCallback(() => {
        if (isLoading || videos.length >= totalCount) return;
        fetchVideos(filters, offset, true);
        setOffset((prev) => prev + PAGE_SIZE);
    }, [isLoading, videos.length, totalCount, fetchVideos, filters, offset]);

    // Infinite scroll observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }

        return () => observer.disconnect();
    }, [loadMore]);

    const handleExpand = async (id: string): Promise<Pick<Video, 'transcript_text' | 'analysis_text' | 'transcript_error' | 'analysis_error'>> => {
        const { data } = await fetchVideoDetail(supabase, id);

        return data || { transcript_text: null, analysis_text: null, transcript_error: null, analysis_error: null };
    };

    return (
        <div className="space-y-10">
            <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="space-y-2">
                    {title && <h1 className="font-display text-3xl text-card-foreground">{title}</h1>}
                    {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                </div>
                <span className="neo-chip bg-muted text-muted-foreground">
                    Showing {videos.length} of {totalCount} videos
                </span>
            </div>

            <Filters
                channels={channels}
                onFilterChange={handleFilterChange}
                filters={filters}
            />

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((video, index) => (
                    <VideoCard
                        key={video.id}
                        video={video}
                        onExpand={handleExpand}
                        index={index}
                    />
                ))}
            </div>

            {/* Infinite scroll loader */}
            <div ref={loaderRef} className="flex items-center justify-center py-10">
                {isLoading && (
                    <Loader2 className="animate-spin text-primary" size={32} />
                )}
                {!isLoading && videos.length >= totalCount && videos.length > 0 && (
                    <span className="text-muted-foreground text-sm">No more videos</span>
                )}
            </div>
        </div>
    );
}
