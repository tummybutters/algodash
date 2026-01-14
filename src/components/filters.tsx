'use client';

import { useState } from 'react';
import { X, Search, SlidersHorizontal, Calendar } from 'lucide-react';
import type { VideoStatus, ChannelOption } from '@/types/database';
import { DEFAULT_DURATION_MAX_MINUTES } from '@/lib/supabase/video-queries';

interface FiltersProps {
    channels: ChannelOption[];
    onFilterChange: (filters: FilterState) => void;
    filters: FilterState;
}

export interface FilterState {
    channels: string[];
    statuses: VideoStatus[];
    dateFrom: string;
    dateTo: string;
    durationMin: number;
    durationMax: number;
    search: string;
}

const STATUS_OPTIONS: { value: VideoStatus; label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'favorited', label: 'Favorited' },
    { value: 'archived', label: 'Archived' },
];

export function Filters({ channels, onFilterChange, filters }: FiltersProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const updateFilters = (updates: Partial<FilterState>) => {
        const newFilters = { ...filters, ...updates };
        onFilterChange(newFilters);
    };

    const toggleStatus = (status: VideoStatus) => {
        const newStatuses = filters.statuses.includes(status)
            ? filters.statuses.filter((s) => s !== status)
            : [...filters.statuses, status];
        updateFilters({ statuses: newStatuses });
    };

    const toggleChannel = (channelId: string) => {
        const newChannels = filters.channels.includes(channelId)
            ? filters.channels.filter((c) => c !== channelId)
            : [...filters.channels, channelId];
        updateFilters({ channels: newChannels });
    };

    const clearFilters = () => {
        const cleared: FilterState = {
            channels: [],
            statuses: [],
            dateFrom: '',
            dateTo: '',
            durationMin: 0,
            durationMax: DEFAULT_DURATION_MAX_MINUTES,
            search: '',
        };
        onFilterChange(cleared);
    };

    const hasActiveFilters =
        filters.channels.length > 0 ||
        filters.statuses.length > 0 ||
        filters.dateFrom ||
        filters.dateTo ||
        filters.durationMin > 0 ||
        filters.durationMax < DEFAULT_DURATION_MAX_MINUTES ||
        filters.search;

    return (
        <div className="gpt-panel p-6 section-stack">
            <div className="flex flex-wrap items-center gap-3">
                <div className="gpt-input-wrapper field-xl">
                    <Search className="gpt-input-icon" size={16} strokeWidth={1.5} />
                    <input
                        type="text"
                        placeholder="Search videos..."
                        value={filters.search}
                        onChange={(e) => updateFilters({ search: e.target.value })}
                        className="gpt-input-field"
                    />
                    {filters.search && (
                        <button
                            type="button"
                            onClick={() => updateFilters({ search: '' })}
                            className="gpt-input-clear"
                            aria-label="Clear search"
                        >
                            <X size={14} strokeWidth={1.5} />
                        </button>
                    )}
                </div>

                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`gpt-button-ghost px-4 py-2.5 text-sm ${isExpanded ? 'bg-secondary' : ''}`}
                >
                    <SlidersHorizontal size={16} strokeWidth={1.5} />
                    Filters
                </button>

                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-sm text-destructive hover:opacity-80 transition-opacity inline-flex items-center gap-1.5"
                    >
                        <X size={14} strokeWidth={1.5} />
                        Clear all
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                    <button
                        key={status.value}
                        onClick={() => toggleStatus(status.value)}
                        className={`gpt-chip ${filters.statuses.includes(status.value) ? 'gpt-chip-active' : ''}`}
                    >
                        {status.label}
                    </button>
                ))}
            </div>

            {isExpanded && (
                <div className="pt-6 border-t border-border section-stack fade-in">
                    {channels.length > 0 && (
                        <div>
                            <label className="gpt-label-muted mb-3 block">
                                Channels
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {channels.map((channel) => (
                                    <button
                                        key={channel.id}
                                        onClick={() => toggleChannel(channel.id)}
                                        className={`gpt-chip text-sm ${filters.channels.includes(channel.id) ? 'gpt-chip-active' : ''}`}
                                    >
                                        {channel.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-3">
                            <label className="text-sm text-muted-foreground flex items-center gap-2">
                                <Calendar size={14} strokeWidth={1.5} />
                                From
                            </label>
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => updateFilters({ dateFrom: e.target.value })}
                                className="gpt-input px-4 py-2 text-sm field-sm"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="text-sm text-muted-foreground flex items-center gap-2">
                                <Calendar size={14} strokeWidth={1.5} />
                                To
                            </label>
                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => updateFilters({ dateTo: e.target.value })}
                                className="gpt-input px-4 py-2 text-sm field-sm"
                            />
                        </div>
                    </div>

                    <div className="max-w-md">
                        <label className="gpt-label-muted mb-3 block">
                            Duration: {filters.durationMin}min – {filters.durationMax}min
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min={0}
                                max={120}
                                value={filters.durationMin}
                                onChange={(e) => updateFilters({ durationMin: parseInt(e.target.value) })}
                                className="flex-1 h-1 accent-primary"
                            />
                            <span className="text-muted-foreground text-sm">–</span>
                            <input
                                type="range"
                                min={30}
                                max={DEFAULT_DURATION_MAX_MINUTES}
                                value={filters.durationMax}
                                onChange={(e) => updateFilters({ durationMax: parseInt(e.target.value) })}
                                className="flex-1 h-1 accent-primary"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
