'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { VideoCard } from './video-card';
import { Filters, FilterState } from './filters';
import { createClient } from '@/lib/supabase/client';
import type { VideoListItem, Channel, Video } from '@/types/database';
import { Loader2, Sparkles } from 'lucide-react';
import { ManualVideoForm } from './manual-video-form';

interface VideoFeedProps {
    initialVideos: VideoListItem[];
    initialCount: number;
    channels: Channel[];
}

const DEFAULT_FILTERS: FilterState = {
    channels: [],
    statuses: [],
    dateFrom: '',
    dateTo: '',
    durationMin: 0,
    durationMax: 240,
    search: '',
    newsletterOnly: false,
};

const PAGE_SIZE = 20;

export function VideoFeed({ initialVideos, initialCount, channels }: VideoFeedProps) {
    const [videos, setVideos] = useState<VideoListItem[]>(initialVideos);
    const [totalCount, setTotalCount] = useState(initialCount);
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [activeTab, setActiveTab] = useState<'all' | 'hand'>('all');
    const [isLoading, setIsLoading] = useState(false);
    const [offset, setOffset] = useState(PAGE_SIZE);
    const loaderRef = useRef<HTMLDivElement>(null);

    const supabase = createClient();

    const fetchVideos = useCallback(async (currentFilters: FilterState, currentOffset: number, append: boolean) => {
        setIsLoading(true);

        let query = supabase
            .from('videos_list')
            .select('*', { count: 'exact' });

        if (currentFilters.channels.length > 0) {
            query = query.in('channel_id', currentFilters.channels);
        }
        if (currentFilters.statuses.length > 0) {
            query = query.in('status', currentFilters.statuses);
        }
        if (currentFilters.dateFrom) {
            query = query.gte('published_at', currentFilters.dateFrom);
        }
        if (currentFilters.dateTo) {
            query = query.lte('published_at', currentFilters.dateTo);
        }
        if (currentFilters.durationMin > 0) {
            query = query.gte('duration_seconds', currentFilters.durationMin * 60);
        }
        if (currentFilters.durationMax < 240) {
            query = query.lte('duration_seconds', currentFilters.durationMax * 60);
        }
        if (currentFilters.newsletterOnly) {
            query = query.eq('include_in_newsletter', true);
        }
        if (currentFilters.search) {
            query = query.textSearch('search_tsv', currentFilters.search, { type: 'websearch' });
        }

        query = query
            .order('published_at', { ascending: false })
            .range(currentOffset, currentOffset + PAGE_SIZE - 1);

        const { data, count } = await query;

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
        setActiveTab(newFilters.newsletterOnly ? 'hand' : 'all');
        setOffset(PAGE_SIZE);
        fetchVideos(newFilters, 0, false);
    }, [fetchVideos]);

    const handleTabChange = useCallback((tab: 'all' | 'hand') => {
        const nextFilters = { ...filters, newsletterOnly: tab === 'hand' };
        setActiveTab(tab);
        setFilters(nextFilters);
        setOffset(PAGE_SIZE);
        fetchVideos(nextFilters, 0, false);
    }, [filters, fetchVideos]);

    const handleManualAdded = useCallback(() => {
        const nextFilters = { ...filters, newsletterOnly: true };
        setActiveTab('hand');
        setFilters(nextFilters);
        setOffset(PAGE_SIZE);
        fetchVideos(nextFilters, 0, false);
    }, [filters, fetchVideos]);

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
        const { data } = await supabase
            .from('videos')
            .select('transcript_text, analysis_text, transcript_error, analysis_error')
            .eq('id', id)
            .single();

        return data || { transcript_text: null, analysis_text: null, transcript_error: null, analysis_error: null };
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => handleTabChange('all')}
                        className={`neo-chip ${activeTab === 'all'
                                ? 'bg-primary text-white border-transparent'
                                : 'bg-muted text-muted-foreground'}`}
                    >
                        All videos
                    </button>
                    <button
                        onClick={() => handleTabChange('hand')}
                        className={`neo-chip inline-flex items-center gap-2 ${activeTab === 'hand'
                                ? 'bg-primary text-white border-transparent'
                                : 'bg-muted text-muted-foreground'}`}
                    >
                        <Sparkles size={12} />
                        Hand selected
                    </button>
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

            {activeTab === 'hand' && (
                <ManualVideoForm channels={channels} onAdded={handleManualAdded} />
            )}

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
