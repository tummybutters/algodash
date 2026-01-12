'use client';

import { useState } from 'react';
import { X, Search, Filter, Calendar } from 'lucide-react';
import type { VideoStatus, Channel } from '@/types/database';

interface FiltersProps {
    channels: Channel[];
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

const STATUS_OPTIONS: { value: VideoStatus; label: string; color: string }[] = [
    { value: 'new', label: 'New', color: 'bg-blue-500' },
    { value: 'favorited', label: 'Favorited', color: 'bg-amber-500' },
    { value: 'archived', label: 'Archived', color: 'bg-stone-500' },
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
            durationMax: 240,
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
        filters.durationMax < 240 ||
        filters.search;

    return (
        <div className="neo-panel p-5 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
                <div className="neo-input-wrapper w-[280px]">
                    <Search className="neo-input-icon" size={16} />
                    <input
                        type="text"
                        placeholder="Search videos..."
                        value={filters.search}
                        onChange={(e) => updateFilters({ search: e.target.value })}
                        className="neo-input-field text-sm"
                    />
                    {filters.search && (
                        <button
                            type="button"
                            onClick={() => updateFilters({ search: '' })}
                            className="neo-input-clear"
                            aria-label="Clear search"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="neo-button-ghost px-3 py-1.5 text-xs inline-flex items-center gap-2"
                >
                    <Filter size={14} />
                    Filters
                </button>

                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-xs text-rose-500 hover:text-rose-600 transition-colors inline-flex items-center gap-1"
                    >
                        <X size={12} />
                        Clear
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-3">
                {STATUS_OPTIONS.map((status) => (
                    <button
                        key={status.value}
                        onClick={() => toggleStatus(status.value)}
                        className={`neo-chip ${filters.statuses.includes(status.value)
                            ? 'bg-primary text-white border-transparent'
                            : 'bg-muted text-muted-foreground'}`}
                    >
                        <span className={`w-2 h-2 rounded-full ${status.color}`} />
                        {status.label}
                    </button>
                ))}
            </div>

            {isExpanded && (
                <div className="pt-4 border-t border-border space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-2">
                            Channels
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {channels.map((channel) => (
                                <button
                                    key={channel.id}
                                    onClick={() => toggleChannel(channel.id)}
                                    className={`neo-chip text-xs ${filters.channels.includes(channel.id)
                                        ? 'bg-primary text-white border-transparent'
                                        : 'bg-muted text-muted-foreground'}`}
                                >
                                    {channel.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">
                                <Calendar size={12} className="inline mr-1" />
                                From
                            </label>
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => updateFilters({ dateFrom: e.target.value })}
                                className="neo-input px-3 py-1.5 text-xs w-[130px]"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">
                                <Calendar size={12} className="inline mr-1" />
                                To
                            </label>
                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => updateFilters({ dateTo: e.target.value })}
                                className="neo-input px-3 py-1.5 text-xs w-[130px]"
                            />
                        </div>
                    </div>

                    <div className="max-w-md">
                        <label className="block text-xs text-muted-foreground mb-2">
                            Duration: {filters.durationMin}min - {filters.durationMax}min
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={0}
                                max={120}
                                value={filters.durationMin}
                                onChange={(e) => updateFilters({ durationMin: parseInt(e.target.value) })}
                                className="flex-1 h-1"
                            />
                            <span className="text-muted-foreground text-xs">–</span>
                            <input
                                type="range"
                                min={30}
                                max={240}
                                value={filters.durationMax}
                                onChange={(e) => updateFilters({ durationMax: parseInt(e.target.value) })}
                                className="flex-1 h-1"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
