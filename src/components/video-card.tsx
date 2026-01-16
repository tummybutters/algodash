'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import {
    AlertCircle,
    CheckCircle,
    Clock,
    ExternalLink,
    FileText,
    Loader2,
    RefreshCw,
    Sparkles,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { formatDuration } from '@/lib/utils/duration';
import { updateVideoStatus, retryTranscript, retryAnalysis, deleteVideo } from '@/lib/actions/videos';
import type { VideoListItem, VideoStatus, ProcessStatus, Video } from '@/types/database';

interface VideoCardProps {
    video: VideoListItem;
    onExpand: (id: string) => Promise<Pick<
        Video,
        | 'transcript_text'
        | 'analysis_text'
        | 'transcript_error'
        | 'analysis_error'
        | 'transcript_status'
        | 'analysis_status'
    >>;
    index?: number;
}

const STATUS_OPTIONS: { value: VideoStatus; label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'favorited', label: 'Favorited' },
    { value: 'archived', label: 'Archived' },
];

const VIDEO_STATUS_STYLES: Record<VideoStatus, string> = {
    new: 'status-new',
    favorited: 'status-favorited',
    archived: 'status-archived',
};

const PROCESS_STATUS_CONFIG: Record<ProcessStatus, { label: string; icon: typeof AlertCircle; classes: string }> = {
    pending: { label: 'Pending', icon: Clock, classes: 'process-pending' },
    success: { label: 'Ready', icon: CheckCircle, classes: 'process-success' },
    failed: { label: 'Failed', icon: AlertCircle, classes: 'process-failed' },
    unavailable: { label: 'Missing', icon: XCircle, classes: 'process-unavailable' },
};

function ProcessPill({ status, label }: { status: ProcessStatus; label: string }) {
    const config = PROCESS_STATUS_CONFIG[status];
    const Icon = config.icon;

    return (
        <span className={`gpt-chip text-xs ${config.classes}`}>
            <Icon size={12} strokeWidth={1.5} />
            {label}: {config.label}
        </span>
    );
}

export function VideoCard({ video, onExpand, index = 0 }: VideoCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedContent, setExpandedContent] = useState<Pick<
        Video,
        | 'transcript_text'
        | 'analysis_text'
        | 'transcript_error'
        | 'analysis_error'
        | 'transcript_status'
        | 'analysis_status'
    > | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript');
    const [isPending, startTransition] = useTransition();
    const [status, setStatus] = useState<VideoStatus>(video.status);
    const [transcriptStatus, setTranscriptStatus] = useState<ProcessStatus>(video.transcript_status);
    const [analysisStatus, setAnalysisStatus] = useState<ProcessStatus>(video.analysis_status);
    const summaryText = expandedContent?.analysis_text?.trim();

    useEffect(() => {
        setStatus(video.status);
        setTranscriptStatus(video.transcript_status);
        setAnalysisStatus(video.analysis_status);
    }, [video]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKey);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKey);
        };
    }, [isOpen]);

    const handleOpen = async () => {
        setIsOpen(true);
        setActiveTab('transcript');
        if (!expandedContent) {
            setIsLoadingDetails(true);
            const content = await onExpand(video.id);
            setExpandedContent(content);
            setTranscriptStatus(content.transcript_status);
            setAnalysisStatus(content.analysis_status);
            setIsLoadingDetails(false);
        }
    };

    const handleStatusChange = (nextStatus: VideoStatus) => {
        setStatus(nextStatus);
        startTransition(() => {
            updateVideoStatus(video.id, nextStatus);
        });
    };

    const handleRetryTranscript = () => {
        startTransition(async () => {
            setTranscriptStatus('pending');
            try {
                const result = await retryTranscript(video.id);
                if (result?.status) {
                    setTranscriptStatus(result.status as ProcessStatus);
                }
                const content = await onExpand(video.id);
                setExpandedContent(content);
                setTranscriptStatus(content.transcript_status);
                setAnalysisStatus(content.analysis_status);
            } catch {
                setTranscriptStatus('failed');
            }
        });
    };

    const handleRetrySummary = () => {
        setActiveTab('summary');
        startTransition(async () => {
            setAnalysisStatus('pending');
            try {
                await retryAnalysis(video.id);
                const content = await onExpand(video.id);
                setExpandedContent(content);
                setTranscriptStatus(content.transcript_status);
                setAnalysisStatus(content.analysis_status);
            } catch {
                setAnalysisStatus('failed');
            }
        });
    };

    const handleSummaryTab = () => {
        setActiveTab('summary');
        if (!summaryText && analysisStatus !== 'pending' && !isLoadingDetails) {
            handleRetrySummary();
        }
    };

    const handleDelete = () => {
        if (confirm('Delete this video permanently?')) {
            startTransition(() => {
                deleteVideo(video.id);
            });
        }
    };

    return (
        <>
            <article
                className="gpt-card p-4 space-y-3 group slide-up cursor-pointer"
                style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
                onClick={handleOpen}
            >
                {/* Thumbnail with delete button overlay */}
                <div className="relative rounded-lg overflow-hidden aspect-[16/9] bg-[#1a1a1a]">
                    {video.thumbnail_url ? (
                        <Image
                            src={video.thumbnail_url}
                            alt={video.title}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            No thumbnail
                        </div>
                    )}
                    {/* Duration badge */}
                    <span className="absolute bottom-2 left-2 bg-black/80 text-white text-[11px] font-medium px-2 py-0.5 rounded-md">
                        {formatDuration(video.duration_seconds)}
                    </span>
                    {/* Delete button - top right */}
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                        className="delete-btn absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete"
                        disabled={isPending}
                    >
                        <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                </div>

                {/* Title */}
                <h3 className="font-medium text-sm leading-snug line-clamp-2 text-card-foreground">
                    {video.title}
                </h3>

                {/* Meta info */}
                <div className="text-xs text-muted-foreground space-y-1">
                    <p>{video.channel_name || 'Unknown channel'}</p>
                    <p>{formatDistanceToNow(new Date(video.published_at), { addSuffix: true })}</p>
                </div>

                {/* Status row */}
                <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <span className={`gpt-chip text-xs ${VIDEO_STATUS_STYLES[status]}`}>
                        {status}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={transcriptStatus === 'success' ? 'text-primary' : ''}>
                            T:{transcriptStatus === 'success' ? '✓' : transcriptStatus === 'pending' ? '...' : '✗'}
                        </span>
                        <span className={analysisStatus === 'success' ? 'text-primary' : ''}>
                            S:{analysisStatus === 'success' ? '✓' : analysisStatus === 'pending' ? '...' : '✗'}
                        </span>
                    </div>
                </div>

                {/* Status toggles */}
                <div className="status-toggles" onClick={(e) => e.stopPropagation()}>
                    {STATUS_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => handleStatusChange(option.value)}
                            className={`status-toggle ${status === option.value ? 'status-toggle-active' : ''}`}
                            disabled={isPending}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </article>

            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div
                        className="gpt-modal-backdrop"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="relative w-[min(92vw,900px)] max-h-[88vh] overflow-hidden gpt-modal">
                        <div className="gpt-modal-header">
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Video Review</p>
                                <h2 className="gpt-modal-title line-clamp-1">{video.title}</h2>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="gpt-modal-close"
                            >
                                <X size={18} strokeWidth={1.5} />
                            </button>
                        </div>

                        <div className="gpt-modal-content grid lg:grid-cols-[160px,1fr] gap-6 max-h-[75vh] overflow-y-auto">
                            <div className="space-y-5">
                                <div className="relative rounded-lg overflow-hidden aspect-[16/10] bg-[#1a1a1a]">
                                    {video.thumbnail_url ? (
                                        <Image
                                            src={video.thumbnail_url}
                                            alt={video.title}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                            No thumbnail
                                        </div>
                                    )}
                                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded-md">
                                        {formatDuration(video.duration_seconds)}
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xs text-muted-foreground">Channel</p>
                                            <p className="font-medium text-sm text-card-foreground truncate">{video.channel_name || 'Unknown'}</p>
                                        </div>
                                        <a
                                            href={video.video_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="gpt-button-ghost px-3 py-2 text-xs shrink-0"
                                        >
                                            <ExternalLink size={14} strokeWidth={1.5} />
                                            Open
                                        </a>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <span className="gpt-chip text-xs">
                                            {formatDistanceToNow(new Date(video.published_at), { addSuffix: true })}
                                        </span>
                                        <span className={`gpt-chip text-xs ${VIDEO_STATUS_STYLES[status]}`}>
                                            {status}
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground">Update Status</p>
                                        <div className="flex flex-wrap gap-2">
                                            {STATUS_OPTIONS.map((option) => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => handleStatusChange(option.value)}
                                                    className={`gpt-chip text-xs ${status === option.value
                                                        ? 'gpt-chip-active'
                                                        : ''}`}
                                                    disabled={isPending}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground">Actions</p>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={handleRetryTranscript}
                                                disabled={isPending}
                                                className="gpt-button px-4 py-2.5 text-xs justify-start disabled:opacity-50"
                                            >
                                                {isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} strokeWidth={1.5} />}
                                                Fetch transcript
                                            </button>
                                            <button
                                                onClick={handleRetrySummary}
                                                disabled={isPending}
                                                className="gpt-button-ghost px-4 py-2.5 text-xs justify-start disabled:opacity-50"
                                            >
                                                <Sparkles size={14} strokeWidth={1.5} />
                                                Generate summary
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setActiveTab('transcript')}
                                        className={`gpt-chip ${activeTab === 'transcript' ? 'gpt-chip-active' : ''}`}
                                    >
                                        Transcript
                                    </button>
                                    <button
                                        onClick={handleSummaryTab}
                                        className={`gpt-chip ${activeTab === 'summary' ? 'gpt-chip-active' : ''}`}
                                    >
                                        Summary
                                    </button>
                                </div>

                                {isLoadingDetails ? (
                                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                                        <Loader2 size={24} className="animate-spin text-primary" />
                                    </div>
                                ) : (
                                    <div className="gpt-panel p-5 max-h-[55vh] overflow-y-auto">
                                        {activeTab === 'transcript' ? (
                                            transcriptStatus === 'failed' ? (
                                                <div className="flex flex-col items-center justify-center py-10 gap-4">
                                                    <AlertCircle className="text-destructive" size={32} strokeWidth={1.5} />
                                                    <p className="text-destructive text-sm text-center">
                                                        {expandedContent?.transcript_error || 'Transcript fetch failed'}
                                                    </p>
                                                    <button
                                                        onClick={handleRetryTranscript}
                                                        disabled={isPending}
                                                        className="gpt-button px-4 py-2 text-xs disabled:opacity-50"
                                                    >
                                                        <RefreshCw size={14} strokeWidth={1.5} /> Retry
                                                    </button>
                                                </div>
                                            ) : transcriptStatus === 'unavailable' ? (
                                                <div className="flex flex-col items-center justify-center py-10 gap-3">
                                                    <XCircle className="text-muted-foreground" size={32} strokeWidth={1.5} />
                                                    <p className="text-muted-foreground text-sm">No transcript available for this video</p>
                                                </div>
                                            ) : transcriptStatus === 'pending' ? (
                                                <div className="flex flex-col items-center justify-center py-10 gap-4">
                                                    <Clock className="text-yellow-500" size={32} strokeWidth={1.5} />
                                                    <p className="text-muted-foreground text-sm">Transcript not fetched yet</p>
                                                    <button
                                                        onClick={handleRetryTranscript}
                                                        disabled={isPending}
                                                        className="gpt-button-ghost px-4 py-2 text-xs disabled:opacity-50"
                                                    >
                                                        <RefreshCw size={14} strokeWidth={1.5} /> Fetch now
                                                    </button>
                                                </div>
                                            ) : (
                                                <pre className="text-sm text-card-foreground whitespace-pre-wrap font-sans leading-relaxed">
                                                    {expandedContent?.transcript_text || 'No transcript content'}
                                                </pre>
                                            )
                                        ) : summaryText ? (
                                            <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap">
                                                {summaryText}
                                            </div>
                                        ) : analysisStatus === 'failed' ? (
                                            <div className="flex flex-col items-center justify-center py-10 gap-4">
                                                <AlertCircle className="text-destructive" size={32} strokeWidth={1.5} />
                                                <p className="text-destructive text-sm text-center">
                                                    {expandedContent?.analysis_error || 'Summary failed'}
                                                </p>
                                                <button
                                                    onClick={handleRetrySummary}
                                                    disabled={isPending}
                                                    className="gpt-button px-4 py-2 text-xs disabled:opacity-50"
                                                >
                                                    <RefreshCw size={14} strokeWidth={1.5} /> Retry
                                                </button>
                                            </div>
                                        ) : analysisStatus === 'pending' ? (
                                            <div className="flex flex-col items-center justify-center py-10 gap-3">
                                                <Clock className="text-yellow-500" size={32} strokeWidth={1.5} />
                                                <p className="text-muted-foreground text-sm">Summary pending...</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                                                <Sparkles className="text-muted-foreground" size={28} strokeWidth={1.5} />
                                                <p className="text-muted-foreground text-sm">No summary yet.</p>
                                                <button
                                                    onClick={handleRetrySummary}
                                                    disabled={isPending}
                                                    className="gpt-button px-4 py-2 text-xs disabled:opacity-50"
                                                >
                                                    <Sparkles size={14} strokeWidth={1.5} /> Generate summary
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
