'use client';

import { ArrowRight, Clipboard } from 'lucide-react';

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
    return (
        <section className="neo-panel p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
                <h3 className="font-display text-xl text-card-foreground">{title}</h3>
                <div className="flex gap-2">
                    <button
                        onClick={onCopy}
                        className="neo-button-ghost inline-flex items-center gap-2 px-3 py-1.5 text-xs"
                    >
                        <Clipboard size={14} />
                        {copyLabel}
                    </button>
                    <button
                        onClick={onPublish}
                        disabled={isPending}
                        className={`neo-button inline-flex items-center gap-2 px-3 py-1.5 text-xs ${publishLabel === 'Published!' ? 'bg-green-600' : ''}`}
                    >
                        <ArrowRight size={14} />
                        {publishLabel}
                    </button>
                </div>
            </div>
            {publishError && <p className="text-[10px] text-rose-500">{publishError}</p>}

            <pre className="neo-panel p-4 text-xs whitespace-pre-wrap max-h-[420px] overflow-y-auto">
                {draft}
            </pre>
        </section>
    );
}
