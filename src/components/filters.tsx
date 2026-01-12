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
    newsletterOnly: boolean;
}

const STATUS_OPTIONS: { value: VideoStatus; label: string; color: string }[] = [
    { value: 'new', label: 'New', color: 'bg-blue-500' },
    { value: 'reviewed', label: 'Reviewed', color: 'bg-purple-500' },
    { value: 'selected', label: 'Selected', color: 'bg-green-500' },
    { value: 'skipped', label: 'Skipped', color: 'bg-gray-500' },
    { value: 'archived', label: 'Archived', color: 'bg-red-500' },
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
            newsletterOnly: filters.newsletterOnly,
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
            <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                    <Search
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="Search videos..."
                        value={filters.search}
                        onChange={(e) => updateFilters({ search: e.target.value })}
                        className="neo-input w-full pl-11 pr-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="neo-button-ghost px-4 py-2 text-xs inline-flex items-center gap-2"
                    >
                        <Filter size={14} />
                        More filters
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
            </div>

            <div className="flex flex-wrap gap-2">
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
                        <label className="block text-sm font-medium text-card-foreground mb-2">
                            Channels
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {channels.map((channel) => (
                                <button
                                    key={channel.id}
                                    onClick={() => toggleChannel(channel.id)}
                                    className={`neo-chip ${filters.channels.includes(channel.id)
                                            ? 'bg-primary text-white border-transparent'
                                            : 'bg-muted text-muted-foreground'}`}
                                >
                                    {channel.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-card-foreground mb-2">
                                <Calendar size={14} className="inline mr-1" />
                                From
                            </label>
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => updateFilters({ dateFrom: e.target.value })}
                                className="neo-input w-full px-3 py-2 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-card-foreground mb-2">
                                <Calendar size={14} className="inline mr-1" />
                                To
                            </label>
                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => updateFilters({ dateTo: e.target.value })}
                                className="neo-input w-full px-3 py-2 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-card-foreground mb-2">
                            Duration: {filters.durationMin}min - {filters.durationMax}min
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min={0}
                                max={120}
                                value={filters.durationMin}
                                onChange={(e) => updateFilters({ durationMin: parseInt(e.target.value) })}
                                className="flex-1"
                            />
                            <span className="text-muted-foreground">-</span>
                            <input
                                type="range"
                                min={30}
                                max={240}
                                value={filters.durationMax}
                                onChange={(e) => updateFilters({ durationMax: parseInt(e.target.value) })}
                                className="flex-1"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
