import type { NewsletterItemFields, NewsletterItemWithVideo } from '@/types/database';

const DIVIDER = '---';

const PLACEHOLDERS = {
    podcastName: '{{PODCAST_NAME}}',
    guestName: '{{GUEST_NAME}}',
    episodeUrl: '{{EPISODE_URL}}',
    episodeReviewedCount: '{{EPISODE_REVIEWED_COUNT}}',
    actor: '{{ONE_SENTENCE_LEVERAGE}}',
    actorLong: '{{ONE_SENTENCE_LEVERAGE_WHO_THEY_ARE_AND_WHY_THEY_MATTER}}',
    topics: '{{ONE_SENTENCE_2-3_DOMAINS_PLUS_THE_DECISION/TRADEOFF}}',
    topicsEvergreen: '{{ONE_SENTENCE_2-3_DOMAINS_PLUS_THE_SYSTEM_THEYRE_MODELING}}',
    signalOne: '{{NUGGET_1_FRAMEWORK_OR_TRADEOFF_OR_PREDICTION}}',
    nuggetOne: '{{NUGGET_1_REUSABLE_RULE_OR_HEURISTIC}}',
    listenIf: '{{CONDITION_1}}',
    skipIf: '{{CONDITION_2}}',
    horizon: '{{WEEKS_OR_MONTHS}}',
    framework: '{{ONE_SENTENCE_CORE_MODEL_OR_ASSUMPTION}}',
    year: '{{YEAR}}',
};

function normalizeFields(fields: NewsletterItemFields | null | undefined): NewsletterItemFields {
    return fields ?? {};
}

function trimValue(value: string | null | undefined) {
    return typeof value === 'string' ? value.trim() : '';
}

function valueOrPlaceholder(value: string | null | undefined, placeholder: string) {
    const trimmed = trimValue(value);
    return trimmed.length > 0 ? trimmed : placeholder;
}

function firstNonEmpty(values: string[] | null | undefined) {
    if (!Array.isArray(values)) return null;
    for (const value of values) {
        const trimmed = trimValue(value);
        if (trimmed) return trimmed;
    }
    return null;
}

function formatIssueDate(raw: string | null | undefined) {
    if (!raw) return '{{DATE}}';
    return raw;
}

function formatYear(raw: string | null | undefined) {
    if (!raw) return PLACEHOLDERS.year;
    const year = new Date(raw).getFullYear();
    return Number.isFinite(year) ? `${year}` : PLACEHOLDERS.year;
}

function buildEditorialParagraph(fields: NewsletterItemFields, index: number, isUrgent: boolean) {
    const actorValue = trimValue(fields.actor);
    const topicsValue = trimValue(fields.topics);

    if (actorValue && topicsValue) return `${actorValue} ${topicsValue}`;
    if (actorValue) return actorValue;
    if (topicsValue) return topicsValue;

    const actorPlaceholder = index === 0 ? PLACEHOLDERS.actorLong : PLACEHOLDERS.actor;
    const topicsPlaceholder = isUrgent ? PLACEHOLDERS.topics : PLACEHOLDERS.topicsEvergreen;
    return `${actorPlaceholder} ${topicsPlaceholder}`.trim();
}

function buildUrgentSpotlight(item: NewsletterItemWithVideo, index: number) {
    const fields = normalizeFields(item.fields);
    const podcastName = valueOrPlaceholder(fields.podcast_name || item.video.channel_name, PLACEHOLDERS.podcastName);
    const guestName = valueOrPlaceholder(fields.guest_name, PLACEHOLDERS.guestName);
    const editorialParagraph = buildEditorialParagraph(fields, index, true);
    const keyInsight = valueOrPlaceholder(firstNonEmpty(fields.signals) ?? fields.why_now, PLACEHOLDERS.signalOne);
    const shelfLife = valueOrPlaceholder(fields.relevance_horizon, PLACEHOLDERS.horizon);
    const skipIf = valueOrPlaceholder(fields.skip_if, PLACEHOLDERS.skipIf);
    const insightLabel = index === 0 ? "What's actually new:" : 'The useful bit:';

    return [
        `**${guestName}, ${podcastName}** (${item.video.video_url})`,
        '',
        editorialParagraph,
        '',
        `${insightLabel} ${keyInsight}`,
        '',
        `*${shelfLife}. Skip if ${skipIf}.*`,
    ]
        .join('\n');
}

function buildUrgentPlaceholderSpotlight(index: number) {
    const insightLabel = index === 0 ? "What's actually new:" : 'The useful bit:';
    return [
        `**${PLACEHOLDERS.guestName}, ${PLACEHOLDERS.podcastName}** (${PLACEHOLDERS.episodeUrl})`,
        '',
        buildEditorialParagraph({}, index, true),
        '',
        `${insightLabel} ${PLACEHOLDERS.signalOne}`,
        '',
        `*${PLACEHOLDERS.horizon}. Skip if ${PLACEHOLDERS.skipIf}.*`,
    ].join('\n');
}

function buildEvergreenSpotlight(item: NewsletterItemWithVideo, index: number) {
    const fields = normalizeFields(item.fields);
    const podcastName = valueOrPlaceholder(fields.podcast_name || item.video.channel_name, PLACEHOLDERS.podcastName);
    const guestName = valueOrPlaceholder(fields.guest_name, PLACEHOLDERS.guestName);
    const editorialParagraph = buildEditorialParagraph(fields, index, false);
    const keyInsight = valueOrPlaceholder(firstNonEmpty(fields.nuggets) ?? fields.framework, PLACEHOLDERS.nuggetOne);
    const skipIf = valueOrPlaceholder(fields.skip_if, PLACEHOLDERS.skipIf);
    const year = formatYear(item.video.published_at);

    return [
        `**${guestName}, ${podcastName} (${year})** (${item.video.video_url})`,
        '',
        editorialParagraph,
        '',
        `The useful bit: ${keyInsight}`,
        '',
        `*Skip if ${skipIf}.*`,
    ]
        .join('\n');
}

function buildEvergreenPlaceholderSpotlight(index: number) {
    return [
        `**${PLACEHOLDERS.guestName}, ${PLACEHOLDERS.podcastName} (${PLACEHOLDERS.year})** (${PLACEHOLDERS.episodeUrl})`,
        '',
        buildEditorialParagraph({}, index, false),
        '',
        `The useful bit: ${PLACEHOLDERS.nuggetOne}`,
        '',
        `*Skip if ${PLACEHOLDERS.skipIf}.*`,
    ].join('\n');
}

function buildQuickHit(item: NewsletterItemWithVideo) {
    const fields = normalizeFields(item.fields);
    const podcastName = valueOrPlaceholder(fields.podcast_name || item.video.channel_name, PLACEHOLDERS.podcastName);
    const guestName = valueOrPlaceholder(fields.guest_name, PLACEHOLDERS.guestName);
    const reason = valueOrPlaceholder(
        firstNonEmpty(fields.signals) ?? fields.topics ?? fields.why_now,
        PLACEHOLDERS.signalOne
    );

    return `- **${guestName}, ${podcastName}** — ${reason} (${item.video.video_url})`;
}

function buildQuickHitPlaceholder() {
    return `- **${PLACEHOLDERS.guestName}, ${PLACEHOLDERS.podcastName}** — ${PLACEHOLDERS.topics} (${PLACEHOLDERS.episodeUrl})`;
}

export function buildUrgentDraft(items: NewsletterItemWithVideo[], issueDate: string) {
    const header = [
        `The Conviction Index — ${formatIssueDate(issueDate)}`,
        `~${PLACEHOLDERS.episodeReviewedCount} episodes reviewed this week`,
    ].join('\n');

    const spotlightItems = items.slice(0, 4);
    const spotlightBlocks = spotlightItems.map((item, index) => buildUrgentSpotlight(item, index));
    const spotlights = spotlightBlocks.length > 0
        ? spotlightBlocks.join(`\n\n${DIVIDER}\n\n`)
        : buildUrgentPlaceholderSpotlight(0);

    const quickHitItems = items.slice(4);
    const quickHits = quickHitItems.length > 0
        ? ['**Also worth your time:**', '', quickHitItems.map(buildQuickHit).join('\n')].join('\n')
        : '**Also worth your time:**\n\n' + buildQuickHitPlaceholder();

    const sections = [
        spotlights,
        quickHits,
        "*Reply with what you're tracking.*\n\nUnsubscribe",
    ];

    return [header, '', DIVIDER, '', sections.join(`\n\n${DIVIDER}\n\n`)].join('\n');
}

export function buildEvergreenDraft(items: NewsletterItemWithVideo[], _issueDate: string) {
    const itemCount = items.length > 0 ? items.length : 3;
    const countLabel = `${itemCount} episode${itemCount === 1 ? '' : 's'} worth keeping`;
    const header = [
        'The Conviction Index — Evergreen',
        countLabel,
    ].join('\n');

    const blocks = items.map((item, index) => buildEvergreenSpotlight(item, index));
    const body = blocks.length > 0
        ? blocks.join(`\n\n${DIVIDER}\n\n`)
        : buildEvergreenPlaceholderSpotlight(0);

    return [
        header,
        '',
        DIVIDER,
        '',
        body,
        '',
        DIVIDER,
        '',
        "*These don't expire. Save or share.*",
        '',
        'Unsubscribe',
    ].join('\n');
}
