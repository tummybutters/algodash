'use client';

import { useState } from 'react';
import { X, Search, Filter, Star, Calendar } from 'lucide-react';
import type { VideoStatus, Channel } from '@/types/database';

interface FiltersProps {
    channels: Channel[];
    onFilterChange: (filters: FilterState) => void;
    initialFilters: FilterState;
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

export function Filters({ channels, onFilterChange, initialFilters }: FiltersProps) {
    const [filters, setFilters] = useState<FilterState>(initialFilters);
    const [isExpanded, setIsExpanded] = useState(false);

    const updateFilters = (updates: Partial<FilterState>) => {
        const newFilters = { ...filters, ...updates };
        setFilters(newFilters);
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
            newsletterOnly: false,
        };
        setFilters(cleared);
        onFilterChange(cleared);
    };

    const hasActiveFilters =
        filters.channels.length > 0 ||
        filters.statuses.length > 0 ||
        filters.dateFrom ||
        filters.dateTo ||
        filters.durationMin > 0 ||
        filters.durationMax < 240 ||
        filters.search ||
        filters.newsletterOnly;

    return (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            {/* Search bar */}
            <div className="relative">
                <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={18}
                />
                <input
                    type="text"
                    placeholder="Search videos..."
                    value={filters.search}
                    onChange={(e) => updateFilters({ search: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {/* Quick filters */}
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={() => updateFilters({ newsletterOnly: !filters.newsletterOnly })}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${filters.newsletterOnly
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-muted text-muted-foreground hover:text-card-foreground'
                        }`}
                >
                    <Star size={14} fill={filters.newsletterOnly ? 'currentColor' : 'none'} />
                    Newsletter only
                </button>

                {STATUS_OPTIONS.map((status) => (
                    <button
                        key={status.value}
                        onClick={() => toggleStatus(status.value)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${filters.statuses.includes(status.value)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:text-card-foreground'
                            }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${status.color}`} />
                        {status.label}
                    </button>
                ))}

                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-muted text-muted-foreground hover:text-card-foreground transition-colors ml-auto"
                >
                    <Filter size={14} />
                    More filters
                </button>

                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-400 transition-colors"
                    >
                        <X size={12} />
                        Clear
                    </button>
                )}
            </div>

            {/* Expanded filters */}
            {isExpanded && (
                <div className="pt-4 border-t border-border space-y-4">
                    {/* Channels */}
                    <div>
                        <label className="block text-sm font-medium text-card-foreground mb-2">
                            Channels
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {channels.map((channel) => (
                                <button
                                    key={channel.id}
                                    onClick={() => toggleChannel(channel.id)}
                                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${filters.channels.includes(channel.id)
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:text-card-foreground'
                                        }`}
                                >
                                    {channel.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-card-foreground mb-2">
                                <Calendar size={14} className="inline mr-1" />
                                From
                            </label>
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => updateFilters({ dateFrom: e.target.value })}
                                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>

                    {/* Duration range */}
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
