import type { NewsletterItemFields, NewsletterItemWithVideo } from '@/types/database';

const STAR = '\u2605';
const EM_DASH = '\u2014';
const BULLET = '\u2022';

const DIVIDER = `${EM_DASH} ${EM_DASH} ${EM_DASH}`;

const PLACEHOLDERS = {
    podcastName: '{{PODCAST_NAME}}',
    guestName: '{{GUEST_NAME}}',
    actor: '{{ONE_SENTENCE_LEVERAGE}}',
    actorLong: '{{ONE_SENTENCE_LEVERAGE_WHO_THEY_ARE_AND_WHY_THEY_MATTER}}',
    topics: '{{ONE_SENTENCE_2-3_DOMAINS_PLUS_THE_DECISION/TRADEOFF}}',
    topicsEvergreen: '{{ONE_SENTENCE_2-3_DOMAINS_PLUS_THE_SYSTEM_THEYRE_MODELING}}',
    signal: '{{NUGGET}}',
    whyNow: '{{ONE_SENTENCE_WHAT_DECISION_OR_RISK_CHANGES_IF_YOU_WAIT}}',
    whyCompounds: '{{ONE_SENTENCE_HOW_THIS_CHANGES_DECISIONS_OVER_TIME}}',
    listenIf: '{{CONDITION_1}}',
    skipIf: '{{CONDITION_2}}',
    horizon: '{{WEEKS_OR_MONTHS}}',
    framework: '{{ONE_SENTENCE_CORE_MODEL_OR_ASSUMPTION}}',
};

function normalizeFields(fields: NewsletterItemFields | null | undefined): NewsletterItemFields {
    return fields ?? {};
}

function valueOrPlaceholder(value: string | null | undefined, placeholder: string) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed.length > 0 ? trimmed : placeholder;
}

function arrayValueOrPlaceholder(values: string[] | null | undefined, index: number, placeholder: string) {
    const entry = Array.isArray(values) ? values[index] : undefined;
    return valueOrPlaceholder(entry, placeholder);
}

function formatIssueDate(raw: string | null | undefined) {
    if (!raw) return '{{DATE}}';
    return raw;
}

function buildUrgentBlock(item: NewsletterItemWithVideo, index: number) {
    const fields = normalizeFields(item.fields);
    const podcastName = valueOrPlaceholder(fields.podcast_name || item.video.channel_name, PLACEHOLDERS.podcastName);
    const guestName = valueOrPlaceholder(fields.guest_name, PLACEHOLDERS.guestName);
    const actorPlaceholder = index === 0 ? PLACEHOLDERS.actorLong : PLACEHOLDERS.actor;
    const actor = valueOrPlaceholder(fields.actor, actorPlaceholder);
    const topics = valueOrPlaceholder(fields.topics, PLACEHOLDERS.topics);
    const signalOne = arrayValueOrPlaceholder(fields.signals, 0, '{{NUGGET_1_FRAMEWORK_OR_TRADEOFF_OR_PREDICTION}}');
    const signalTwo = arrayValueOrPlaceholder(fields.signals, 1, '{{NUGGET_2_NON_CONSENSUS_OR_COMPETITIVE_POSITIONING}}');
    const signalThree = arrayValueOrPlaceholder(fields.signals, 2, '{{NUGGET_3_CONSTRAINT_OR_TIMELINE}}');
    const whyNow = valueOrPlaceholder(fields.why_now, PLACEHOLDERS.whyNow);
    const listenIf = valueOrPlaceholder(fields.listen_if, PLACEHOLDERS.listenIf);
    const skipIf = valueOrPlaceholder(fields.skip_if, PLACEHOLDERS.skipIf);
    const horizon = valueOrPlaceholder(fields.relevance_horizon, PLACEHOLDERS.horizon);

    return [
        index === 0 ? `${STAR} Must Watch (Urgent)` : '',
        `${podcastName} ${EM_DASH} ${guestName}`.trim(),
        item.video.video_url,
        '',
        'Actor:',
        actor,
        '',
        'Topics:',
        topics,
        '',
        'Signals:',
        `${BULLET} ${signalOne}`,
        `${BULLET} ${signalTwo}`,
        `${BULLET} ${signalThree}`,
        '',
        'Why it matters now:',
        whyNow,
        '',
        'Listen or skip:',
        `Listen if ${listenIf}. Skip if ${skipIf}.`,
        '',
        'Relevance horizon:',
        horizon,
    ]
        .filter((line) => line !== '')
        .join('\n');
}

function buildEvergreenBlock(item: NewsletterItemWithVideo, index: number) {
    const fields = normalizeFields(item.fields);
    const podcastName = valueOrPlaceholder(fields.podcast_name || item.video.channel_name, PLACEHOLDERS.podcastName);
    const guestName = valueOrPlaceholder(fields.guest_name, PLACEHOLDERS.guestName);
    const actorPlaceholder = index === 0 ? PLACEHOLDERS.actorLong : PLACEHOLDERS.actor;
    const actor = valueOrPlaceholder(fields.actor, actorPlaceholder);
    const topics = valueOrPlaceholder(fields.topics, PLACEHOLDERS.topicsEvergreen);
    const framework = valueOrPlaceholder(fields.framework, PLACEHOLDERS.framework);
    const whyCompounds = valueOrPlaceholder(fields.why_compounds, PLACEHOLDERS.whyCompounds);
    const nuggetOne = arrayValueOrPlaceholder(fields.nuggets, 0, '{{NUGGET_1_REUSABLE_RULE_OR_HEURISTIC}}');
    const nuggetTwo = arrayValueOrPlaceholder(fields.nuggets, 1, '{{NUGGET_2_INCENTIVE_OR_ORG_DESIGN_INSIGHT}}');
    const nuggetThree = arrayValueOrPlaceholder(fields.nuggets, 2, '{{NUGGET_3_SECOND_ORDER_EFFECT_OR_FAILURE_MODE}}');
    const listenIf = valueOrPlaceholder(fields.listen_if, PLACEHOLDERS.listenIf);
    const skipIf = valueOrPlaceholder(fields.skip_if, PLACEHOLDERS.skipIf);

    return [
        index === 0 ? `${STAR} Must Keep (Evergreen)` : '',
        `${podcastName} ${EM_DASH} ${guestName}`.trim(),
        item.video.video_url,
        '',
        'Actor:',
        actor,
        '',
        'Topics:',
        topics,
        '',
        'Framework / Assumption:',
        framework,
        '',
        'Why it compounds:',
        whyCompounds,
        '',
        'Nuggets:',
        `${BULLET} ${nuggetOne}`,
        `${BULLET} ${nuggetTwo}`,
        `${BULLET} ${nuggetThree}`,
        '',
        'Listen or skip:',
        `Listen if ${listenIf}. Skip if ${skipIf}.`,
        '',
        'Relevance horizon:',
        'Multi-year',
    ]
        .filter((line) => line !== '')
        .join('\n');
}

export function buildUrgentDraft(items: NewsletterItemWithVideo[], issueDate: string) {
    const header = [
        'Executive Algorithm',
        `Urgent Signals ${EM_DASH} ${formatIssueDate(issueDate)}`,
        '',
    ].join('\n');

    const blocks = items.map((item, index) => buildUrgentBlock(item, index));
    const body = blocks.length > 0 ? blocks.join(`\n\n${DIVIDER}\n\n`) : '{{URGENT_ITEM_1}}';
    const footer = [
        '',
        'Meta (optional, quiet credibility line):',
        'Signals surfaced: {{SIGNAL_COUNT}} / Episodes reviewed: ~{{EPISODE_REVIEWED_COUNT}}',
        '',
        'Reply if something here feels off or missing.',
        'Unsubscribe',
    ].join('\n');

    return `${header}${body}${footer}`;
}

export function buildEvergreenDraft(items: NewsletterItemWithVideo[], issueDate: string) {
    const header = [
        'Executive Algorithm',
        `Evergreen Signals ${EM_DASH} ${formatIssueDate(issueDate)}`,
        '',
    ].join('\n');

    const blocks = items.map((item, index) => buildEvergreenBlock(item, index));
    const body = blocks.length > 0 ? blocks.join(`\n\n${DIVIDER}\n\n`) : '{{EVERGREEN_ITEM_1}}';
    const footer = [
        '',
        'Meta (optional):',
        'Signals surfaced: {{SIGNAL_COUNT}} / Episodes reviewed: ~{{EPISODE_REVIEWED_COUNT}}',
        '',
        'Reply if something here feels off or missing.',
        'Unsubscribe',
    ].join('\n');

    return `${header}${body}${footer}`;
}
