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
    X,
    XCircle,
} from 'lucide-react';
import { formatDuration } from '@/lib/utils/duration';
import { updateVideoStatus, toggleNewsletter, retryTranscript, retryAnalysis } from '@/lib/actions/videos';
import type { VideoListItem, VideoStatus, ProcessStatus } from '@/types/database';

interface VideoCardProps {
    video: VideoListItem;
    onExpand: (id: string) => Promise<{
        transcript_text: string | null;
        analysis_text: string | null;
        transcript_error: string | null;
        analysis_error: string | null;
    }>;
    index?: number;
}

const STATUS_OPTIONS: { value: VideoStatus; label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'selected', label: 'Selected' },
    { value: 'skipped', label: 'Skipped' },
    { value: 'archived', label: 'Archived' },
];

const VIDEO_STATUS_STYLES: Record<VideoStatus, string> = {
    new: 'bg-blue-100 text-blue-700',
    reviewed: 'bg-amber-100 text-amber-700',
    selected: 'bg-emerald-100 text-emerald-700',
    skipped: 'bg-stone-200 text-stone-600',
    archived: 'bg-rose-100 text-rose-700',
};

const PROCESS_STATUS_CONFIG: Record<ProcessStatus, { label: string; icon: typeof AlertCircle; classes: string }> = {
    pending: { label: 'Pending', icon: Clock, classes: 'bg-amber-100 text-amber-700' },
    success: { label: 'Ready', icon: CheckCircle, classes: 'bg-emerald-100 text-emerald-700' },
    failed: { label: 'Failed', icon: AlertCircle, classes: 'bg-rose-100 text-rose-700' },
    unavailable: { label: 'Missing', icon: XCircle, classes: 'bg-stone-200 text-stone-600' },
};

function ProcessPill({ status, label }: { status: ProcessStatus; label: string }) {
    const config = PROCESS_STATUS_CONFIG[status];
    const Icon = config.icon;

    return (
        <span className={`neo-chip ${config.classes}`}>
            <Icon size={12} />
            {label}: {config.label}
        </span>
    );
}

export function VideoCard({ video, onExpand, index = 0 }: VideoCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedContent, setExpandedContent] = useState<{
        transcript_text: string | null;
        analysis_text: string | null;
        transcript_error: string | null;
        analysis_error: string | null;
    } | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript');
    const [isPending, startTransition] = useTransition();
    const [includeInNewsletter, setIncludeInNewsletter] = useState(video.include_in_newsletter);
    const [status, setStatus] = useState<VideoStatus>(video.status);
    const [transcriptStatus, setTranscriptStatus] = useState<ProcessStatus>(video.transcript_status);
    const [analysisStatus, setAnalysisStatus] = useState<ProcessStatus>(video.analysis_status);

    useEffect(() => {
        setIncludeInNewsletter(video.include_in_newsletter);
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
            } catch {
                setTranscriptStatus('failed');
            }
        });
    };

    const handleRetrySummary = () => {
        startTransition(async () => {
            setAnalysisStatus('pending');
            try {
                await retryAnalysis(video.id);
            } catch {
                setAnalysisStatus('failed');
            }
        });
    };

    return (
        <>
            <article
                className="neo-card p-6 space-y-4 group rise-in cursor-pointer"
                style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                onClick={handleOpen}
            >
                <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-muted">
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                        {formatDuration(video.duration_seconds)}
                    </span>
                </div>

                <div>
                    <h3 className="font-display text-lg leading-tight line-clamp-2 text-card-foreground">
                        {video.title}
                    </h3>
                </div>

                <p className="text-sm text-muted-foreground">
                    {video.channel_name || 'Unknown channel'}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                    <span className="neo-chip bg-muted text-muted-foreground">
                        {formatDistanceToNow(new Date(video.published_at), { addSuffix: true })}
                    </span>
                    <span className={`neo-chip ${VIDEO_STATUS_STYLES[status]}`}>
                        {status}
                    </span>
                </div>

                <div className="flex flex-wrap gap-3">
                    <ProcessPill status={transcriptStatus} label="Transcript" />
                    <ProcessPill status={analysisStatus} label="Summary" />
                </div>
            </article>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="relative w-[min(92vw,960px)] max-h-[88vh] overflow-hidden neo-panel">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Video review</p>
                                <h2 className="font-display text-2xl text-card-foreground">{video.title}</h2>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 rounded-full text-muted-foreground hover:text-card-foreground transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid lg:grid-cols-[200px,1fr] gap-6 px-6 py-6 overflow-y-auto max-h-[75vh]">
                            <div className="space-y-4">
                                <div className="relative rounded-[24px] overflow-hidden aspect-[16/10] bg-muted">
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
                                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                                        {formatDuration(video.duration_seconds)}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Channel</p>
                                            <p className="font-medium text-card-foreground">{video.channel_name || 'Unknown channel'}</p>
                                        </div>
                                        <a
                                            href={video.video_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="neo-button-ghost px-3 py-1 text-xs inline-flex items-center gap-1"
                                        >
                                            Open
                                            <ExternalLink size={12} />
                                        </a>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <span className="neo-chip bg-muted text-muted-foreground">
                                            {formatDistanceToNow(new Date(video.published_at), { addSuffix: true })}
                                        </span>
                                        <span className={`neo-chip ${VIDEO_STATUS_STYLES[status]}`}>
                                            {status}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Hand selected</p>
                                            <label className="neo-switch" onClick={(event) => event.stopPropagation()}>
                                                <input
                                                    className="neo-toggle"
                                                    type="checkbox"
                                                    checked={includeInNewsletter}
                                                    aria-label="Include in hand selected"
                                                    onChange={() => {
                                                        const nextValue = !includeInNewsletter;
                                                        setIncludeInNewsletter(nextValue);
                                                        startTransition(() => {
                                                            toggleNewsletter(video.id, nextValue);
                                                        });
                                                    }}
                                                />
                                                <span className="neo-slider" />
                                            </label>
                                        </div>
                                        <div className="text-xs text-muted-foreground">Duration {formatDuration(video.duration_seconds)}</div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground">Status</p>
                                        <div className="flex flex-wrap gap-2">
                                            {STATUS_OPTIONS.map((option) => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => handleStatusChange(option.value)}
                                                    className={`neo-chip ${status === option.value
                                                        ? 'bg-primary text-white border-transparent'
                                                        : 'bg-muted text-muted-foreground'}`}
                                                    disabled={isPending}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground">Actions</p>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={handleRetryTranscript}
                                                disabled={isPending}
                                                className="neo-button px-4 py-2 text-xs inline-flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                                Fetch transcript
                                            </button>
                                            <button
                                                onClick={handleRetrySummary}
                                                disabled={isPending}
                                                className="neo-button-ghost px-4 py-2 text-xs inline-flex items-center gap-2 disabled:opacity-50"
                                            >
                                                <Sparkles size={14} />
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
                                        className={`neo-chip ${activeTab === 'transcript'
                                            ? 'bg-primary text-white border-transparent'
                                            : 'bg-muted text-muted-foreground'}`}
                                    >
                                        Transcript
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('summary')}
                                        className={`neo-chip ${activeTab === 'summary'
                                            ? 'bg-primary text-white border-transparent'
                                            : 'bg-muted text-muted-foreground'}`}
                                    >
                                        Summary
                                    </button>
                                </div>

                                {isLoadingDetails ? (
                                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                                        <Loader2 size={24} className="animate-spin" />
                                    </div>
                                ) : (
                                    <div className="neo-panel p-4 max-h-[55vh] overflow-y-auto">
                                        {activeTab === 'transcript' ? (
                                            transcriptStatus === 'failed' ? (
                                                <div className="flex flex-col items-center justify-center py-10 gap-3">
                                                    <AlertCircle className="text-rose-500" size={32} />
                                                    <p className="text-rose-600 text-sm text-center">
                                                        {expandedContent?.transcript_error || 'Transcript fetch failed'}
                                                    </p>
                                                    <button
                                                        onClick={handleRetryTranscript}
                                                        disabled={isPending}
                                                        className="neo-button px-4 py-2 text-xs inline-flex items-center gap-2 disabled:opacity-50"
                                                    >
                                                        <RefreshCw size={14} /> Retry
                                                    </button>
                                                </div>
                                            ) : transcriptStatus === 'unavailable' ? (
                                                <div className="flex flex-col items-center justify-center py-10 gap-3">
                                                    <XCircle className="text-stone-500" size={32} />
                                                    <p className="text-muted-foreground text-sm">No transcript available for this video</p>
                                                </div>
                                            ) : transcriptStatus === 'pending' ? (
                                                <div className="flex flex-col items-center justify-center py-10 gap-3">
                                                    <Clock className="text-amber-500 animate-pulse" size={32} />
                                                    <p className="text-muted-foreground text-sm">Transcript not fetched yet</p>
                                                    <button
                                                        onClick={handleRetryTranscript}
                                                        disabled={isPending}
                                                        className="neo-button-ghost px-4 py-2 text-xs inline-flex items-center gap-2 disabled:opacity-50"
                                                    >
                                                        <RefreshCw size={14} /> Fetch now
                                                    </button>
                                                </div>
                                            ) : (
                                                <pre className="text-sm text-card-foreground whitespace-pre-wrap font-sans">
                                                    {expandedContent?.transcript_text || 'No transcript content'}
                                                </pre>
                                            )
                                        ) : analysisStatus === 'failed' ? (
                                            <div className="flex flex-col items-center justify-center py-10 gap-3">
                                                <AlertCircle className="text-rose-500" size={32} />
                                                <p className="text-rose-600 text-sm text-center">
                                                    {expandedContent?.analysis_error || 'Summary failed'}
                                                </p>
                                                <button
                                                    onClick={handleRetrySummary}
                                                    disabled={isPending}
                                                    className="neo-button px-4 py-2 text-xs inline-flex items-center gap-2 disabled:opacity-50"
                                                >
                                                    <RefreshCw size={14} /> Retry
                                                </button>
                                            </div>
                                        ) : analysisStatus === 'pending' ? (
                                            <div className="flex flex-col items-center justify-center py-10 gap-3">
                                                <Clock className="text-amber-500 animate-pulse" size={32} />
                                                <p className="text-muted-foreground text-sm">Summary pending...</p>
                                            </div>
                                        ) : (
                                            <div className="prose prose-sm max-w-none">
                                                {expandedContent?.analysis_text || 'No summary yet'}
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
