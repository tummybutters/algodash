import { describe, it, expect } from 'vitest';
import { resolveIssueStatus, resolvePublishPlan } from '@/lib/newsletters/publishing';

describe('resolvePublishPlan', () => {
    it('prefers sendNow over sendAt', () => {
        const plan = resolvePublishPlan(
            { sendNow: true, sendAt: '2025-01-01T00:00:00.000Z' },
            { scheduled_at: '2025-02-02T00:00:00.000Z' }
        );

        expect(plan).toEqual({ action: 'send' });
    });

    it('uses explicit sendAt when provided', () => {
        const plan = resolvePublishPlan(
            { sendAt: '2025-01-01T00:00:00.000Z' },
            { scheduled_at: null }
        );

        expect(plan).toEqual({ action: 'schedule', sendAt: '2025-01-01T00:00:00.000Z' });
    });

    it('falls back to issue scheduled_at', () => {
        const plan = resolvePublishPlan(
            undefined,
            { scheduled_at: '2025-03-03T00:00:00.000Z' }
        );

        expect(plan).toEqual({ action: 'schedule', sendAt: '2025-03-03T00:00:00.000Z' });
    });

    it('defaults to draft when no schedule is set', () => {
        const plan = resolvePublishPlan(
            {},
            { scheduled_at: null }
        );

        expect(plan).toEqual({ action: 'draft' });
    });
});

describe('resolveIssueStatus', () => {
    it('maps action send to published', () => {
        expect(resolveIssueStatus('send', 'draft')).toBe('published');
    });

    it('maps action schedule to scheduled', () => {
        expect(resolveIssueStatus('schedule', 'draft')).toBe('scheduled');
    });

    it('maps sent campaign to published even when scheduling', () => {
        expect(resolveIssueStatus('schedule', 'sent')).toBe('published');
    });

    it('maps archived campaign to archived even when scheduling', () => {
        expect(resolveIssueStatus('schedule', 'archived')).toBe('archived');
    });

    it('keeps scheduled campaign as scheduled when drafting', () => {
        expect(resolveIssueStatus('draft', 'scheduled')).toBe('scheduled');
    });

    it('maps sent campaign to published when drafting', () => {
        expect(resolveIssueStatus('draft', 'sent')).toBe('published');
    });

    it('maps archived campaign to archived when drafting', () => {
        expect(resolveIssueStatus('draft', 'archived')).toBe('archived');
    });

    it('defaults to draft when campaign is missing', () => {
        expect(resolveIssueStatus('draft')).toBe('draft');
    });
});
