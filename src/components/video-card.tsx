'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import {
    ChevronDown,
    ChevronUp,
    Star,
    RefreshCw,
    ExternalLink,
    AlertCircle,
    CheckCircle,
    Clock,
    XCircle,
} from 'lucide-react';
import { formatDuration } from '@/lib/utils/duration';
import { updateVideoStatus, toggleNewsletter, retryTranscript, retryAnalysis } from '@/lib/actions/videos';
import type { VideoListItem, VideoStatus, ProcessStatus } from '@/types/database';

interface VideoCardProps {
    video: VideoListItem;
    onExpand: (id: string) => Promise<{ transcript_text: string | null; analysis_text: string | null; transcript_error: string | null; analysis_error: string | null }>;
}

const STATUS_OPTIONS: { value: VideoStatus; label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'selected', label: 'Selected' },
    { value: 'skipped', label: 'Skipped' },
    { value: 'archived', label: 'Archived' },
];

function ProcessStatusBadge({ status, label }: { status: ProcessStatus; label: string }) {
    const config = {
        pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
        failed: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
        unavailable: { icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-500/10' },
    };
    const { icon: Icon, color, bg } = config[status];

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${color} ${bg}`}>
            <Icon size={12} />
            {label}
        </span>
    );
}

export function VideoCard({ video, onExpand }: VideoCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedContent, setExpandedContent] = useState<{
        transcript_text: string | null;
        analysis_text: string | null;
        transcript_error: string | null;
        analysis_error: string | null;
    } | null>(null);
    const [isPending, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<'transcript' | 'analysis'>('transcript');

    const handleExpand = async () => {
        if (!isExpanded && !expandedContent) {
            const content = await onExpand(video.id);
            setExpandedContent(content);
        }
        setIsExpanded(!isExpanded);
    };

    const handleStatusChange = (status: VideoStatus) => {
        startTransition(() => {
            updateVideoStatus(video.id, status);
        });
    };

    const handleNewsletterToggle = () => {
        startTransition(() => {
            toggleNewsletter(video.id, !video.include_in_newsletter);
        });
    };

    const handleRetryTranscript = () => {
        startTransition(() => {
            retryTranscript(video.id);
        });
    };

    const handleRetryAnalysis = () => {
        startTransition(() => {
            retryAnalysis(video.id);
        });
    };

    return (
        <div className="bg-card border border-border rounded-lg overflow-hidden hover:border-muted-foreground/30 transition-colors">
            <div className="flex gap-4 p-4">
                {/* Thumbnail */}
                <a
                    href={video.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex-shrink-0 w-40 h-24 rounded overflow-hidden group"
                >
                    {video.thumbnail_url ? (
                        <Image
                            src={video.thumbnail_url}
                            alt={video.title}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                            <span className="text-muted-foreground text-xs">No thumbnail</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ExternalLink size={24} className="text-white" />
                    </div>
                    {/* Duration badge */}
                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                        {formatDuration(video.duration_seconds)}
                    </span>
                </a>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-card-foreground line-clamp-2 leading-tight">
                                {video.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {video.channel_name}
                            </p>
                        </div>

                        {/* Newsletter toggle */}
                        <button
                            onClick={handleNewsletterToggle}
                            disabled={isPending}
                            className={`p-2 rounded-lg transition-colors ${video.include_in_newsletter
                                    ? 'text-accent bg-accent/20 hover:bg-accent/30'
                                    : 'text-muted-foreground hover:text-card-foreground hover:bg-muted'
                                }`}
                            title={video.include_in_newsletter ? 'Remove from newsletter' : 'Add to newsletter'}
                        >
                            <Star size={20} fill={video.include_in_newsletter ? 'currentColor' : 'none'} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {/* Published date */}
                        <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(video.published_at), { addSuffix: true })}
                        </span>

                        {/* Status badges */}
                        <ProcessStatusBadge status={video.transcript_status} label="Transcript" />
                        <ProcessStatusBadge status={video.analysis_status} label="Analysis" />

                        {/* Status dropdown */}
                        <select
                            value={video.status}
                            onChange={(e) => handleStatusChange(e.target.value as VideoStatus)}
                            disabled={isPending}
                            className="ml-auto bg-muted text-card-foreground text-sm px-2 py-1 rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            {STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Expand button */}
            <button
                onClick={handleExpand}
                className="w-full py-2 px-4 bg-muted/50 hover:bg-muted text-sm text-muted-foreground flex items-center justify-center gap-1 transition-colors"
            >
                {isExpanded ? (
                    <>
                        <ChevronUp size={16} /> Hide details
                    </>
                ) : (
                    <>
                        <ChevronDown size={16} /> Show transcript & analysis
                    </>
                )}
            </button>

            {/* Expanded content */}
            {isExpanded && expandedContent && (
                <div className="border-t border-border">
                    {/* Tabs */}
                    <div className="flex border-b border-border">
                        <button
                            onClick={() => setActiveTab('transcript')}
                            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${activeTab === 'transcript'
                                    ? 'text-primary border-b-2 border-primary'
                                    : 'text-muted-foreground hover:text-card-foreground'
                                }`}
                        >
                            Transcript
                        </button>
                        <button
                            onClick={() => setActiveTab('analysis')}
                            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${activeTab === 'analysis'
                                    ? 'text-primary border-b-2 border-primary'
                                    : 'text-muted-foreground hover:text-card-foreground'
                                }`}
                        >
                            AI Analysis
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 max-h-96 overflow-y-auto">
                        {activeTab === 'transcript' ? (
                            video.transcript_status === 'failed' ? (
                                <div className="flex flex-col items-center justify-center py-8 gap-3">
                                    <AlertCircle className="text-red-500" size={32} />
                                    <p className="text-red-500 text-sm">{expandedContent.transcript_error || 'Transcript fetch failed'}</p>
                                    <button
                                        onClick={handleRetryTranscript}
                                        disabled={isPending}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw size={16} /> Retry
                                    </button>
                                </div>
                            ) : video.transcript_status === 'unavailable' ? (
                                <div className="flex flex-col items-center justify-center py-8 gap-2">
                                    <XCircle className="text-gray-500" size={32} />
                                    <p className="text-muted-foreground text-sm">No transcript available for this video</p>
                                </div>
                            ) : video.transcript_status === 'pending' ? (
                                <div className="flex flex-col items-center justify-center py-8 gap-2">
                                    <Clock className="text-yellow-500 animate-pulse" size={32} />
                                    <p className="text-muted-foreground text-sm">Transcript pending...</p>
                                </div>
                            ) : (
                                <pre className="text-sm text-card-foreground whitespace-pre-wrap font-sans">
                                    {expandedContent.transcript_text || 'No transcript content'}
                                </pre>
                            )
                        ) : (
                            video.analysis_status === 'failed' ? (
                                <div className="flex flex-col items-center justify-center py-8 gap-3">
                                    <AlertCircle className="text-red-500" size={32} />
                                    <p className="text-red-500 text-sm">{expandedContent.analysis_error || 'Analysis failed'}</p>
                                    <button
                                        onClick={handleRetryAnalysis}
                                        disabled={isPending}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw size={16} /> Retry
                                    </button>
                                </div>
                            ) : video.analysis_status === 'pending' ? (
                                <div className="flex flex-col items-center justify-center py-8 gap-2">
                                    <Clock className="text-yellow-500 animate-pulse" size={32} />
                                    <p className="text-muted-foreground text-sm">
                                        {video.status === 'selected'
                                            ? 'Analysis pending...'
                                            : 'Analysis runs after selection'}
                                    </p>
                                </div>
                            ) : (
                                <div className="prose prose-invert prose-sm max-w-none">
                                    {expandedContent.analysis_text || 'No analysis content'}
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
