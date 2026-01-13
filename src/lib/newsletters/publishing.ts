import type { NewsletterIssue, NewsletterItemWithVideo, IssueStatus } from '@/types/database';
import type { ESPCampaign, ESPPayload } from '@/lib/esp/types';
import { renderNewsletterHtml, renderNewsletterText } from '@/lib/newsletter-renderer';

export type PublishAction = 'draft' | 'schedule' | 'send';

export type PublishOptions = {
    sendAt?: string;
    sendNow?: boolean;
};

export type PublishPlan = {
    action: PublishAction;
    sendAt?: string | null;
};

export function resolvePublishPlan(
    options: PublishOptions | undefined,
    issue: Pick<NewsletterIssue, 'scheduled_at'>
): PublishPlan {
    if (options?.sendNow) {
        return { action: 'send' };
    }

    const sendAt = options?.sendAt ?? issue.scheduled_at ?? null;
    if (sendAt) {
        return { action: 'schedule', sendAt };
    }

    return { action: 'draft' };
}

export function resolveIssueStatus(
    action: PublishAction,
    campaignStatus?: ESPCampaign['status']
): IssueStatus {
    if (action === 'send') return 'published';
    if (action === 'schedule') {
        if (campaignStatus === 'sent') return 'published';
        if (campaignStatus === 'archived') return 'archived';
        return 'scheduled';
    }

    switch (campaignStatus) {
        case 'scheduled':
            return 'scheduled';
        case 'sent':
            return 'published';
        case 'archived':
            return 'archived';
        default:
            return 'draft';
    }
}

export function assertPublishReady(
    issue: NewsletterIssue,
    items: NewsletterItemWithVideo[]
) {
    if (!issue.subject) {
        throw new Error('Missing subject line.');
    }
    if (items.length === 0) {
        throw new Error('Issue has no items.');
    }
}

export function buildCampaignPayload(
    issue: NewsletterIssue,
    items: NewsletterItemWithVideo[]
): ESPPayload {
    const html = renderNewsletterHtml(issue, items);
    const text = renderNewsletterText(issue, items);

    return {
        subject: issue.subject || '',
        preview_text: issue.preview_text || undefined,
        html_content: html,
        text_content: text,
    };
}
