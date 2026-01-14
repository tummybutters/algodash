'use client';

import { Copy, Send, Check } from 'lucide-react';

type DraftOutputPanelProps = {
    title: string;
    draft: string;
    copyLabel: string;
    publishLabel: string;
    onCopy: () => void;
    onPublish: () => void;
    isPending: boolean;
    publishError?: string | null;
};

export function DraftOutputPanel({
    title,
    draft,
    copyLabel,
    publishLabel,
    onCopy,
    onPublish,
    isPending,
    publishError,
}: DraftOutputPanelProps) {
    const isCopied = copyLabel === 'Copied';
    const isPublished = publishLabel === 'Published!';

    return (
        <section className="gpt-panel p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-card-foreground">{title}</h3>
                <div className="flex gap-2">
                    <button
                        onClick={onCopy}
                        className={`gpt-button-ghost px-4 py-2 text-sm ${isCopied ? 'text-primary' : ''}`}
                    >
                        {isCopied ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
                        {copyLabel}
                    </button>
                    <button
                        onClick={onPublish}
                        disabled={isPending}
                        className={`gpt-button px-4 py-2 text-sm ${isPublished ? '!bg-primary' : ''}`}
                    >
                        <Send size={16} strokeWidth={1.5} />
                        {publishLabel}
                    </button>
                </div>
            </div>
            {publishError && (
                <p className="text-sm text-destructive">{publishError}</p>
            )}

            <pre className="bg-[#1a1a1a] rounded-xl p-5 text-sm text-muted-foreground whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed">
                {draft}
            </pre>
        </section>
    );
}
