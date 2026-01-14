import mailchimp from '@mailchimp/mailchimp_marketing';
import type { ESPProvider, ESPCampaign, ESPPayload } from './types';

const DEFAULT_FROM_NAME = 'Executive Algorithm';
const DEFAULT_REPLY_TO = 'hello@example.com';

// Initialize Mailchimp client
function getClient() {
    const apiKey = process.env.MAILCHIMP_API_KEY;
    const server = process.env.MAILCHIMP_SERVER_PREFIX;

    if (!apiKey || !server) {
        throw new Error('Missing MAILCHIMP_API_KEY or MAILCHIMP_SERVER_PREFIX environment variables');
    }

    mailchimp.setConfig({
        apiKey,
        server,
    });

    return mailchimp;
}

function getListId(): string {
    const listId = process.env.MAILCHIMP_LIST_ID;
    if (!listId) {
        throw new Error('Missing MAILCHIMP_LIST_ID environment variable');
    }
    return listId;
}

function mapCampaignStatus(status: string): ESPCampaign['status'] {
    switch (status) {
        case 'save':
        case 'paused':
            return 'draft';
        case 'schedule':
            return 'scheduled';
        case 'sending':
        case 'sent':
            return 'sent';
        case 'archived':
            return 'archived';
        default:
            return 'draft';
    }
}

function mapCampaignResponse(response: {
    id: string;
    status: string;
    archive_url?: string;
    send_time?: string;
}): ESPCampaign {
    return {
        id: response.id,
        status: mapCampaignStatus(response.status),
        web_url: response.archive_url,
        scheduled_at: response.send_time,
    };
}

export const mailchimpProvider: ESPProvider = {
    name: 'mailchimp',

    async createCampaign(payload: ESPPayload): Promise<ESPCampaign> {
        const client = getClient();
        const listId = getListId();

        // 1. Create the campaign
        const campaign = await client.campaigns.create({
            type: 'regular',
            recipients: {
                list_id: listId,
            },
            settings: {
                subject_line: payload.subject,
                preview_text: payload.preview_text || '',
                from_name: DEFAULT_FROM_NAME,
                reply_to: DEFAULT_REPLY_TO,
            },
        }) as { id: string; status: string; archive_url?: string };

        // 2. Set the campaign content
        await client.campaigns.setContent(campaign.id, {
            html: payload.html_content,
            ...(payload.text_content ? { plain_text: payload.text_content } : {}),
        });

        // 3. If send_at is provided, schedule it
        if (payload.send_at) {
            const scheduleTime = new Date(payload.send_at);
            // Mailchimp requires schedule time to be at least 15 minutes in the future
            const minScheduleTime = new Date(Date.now() + 15 * 60 * 1000);

            if (scheduleTime > minScheduleTime) {
                await client.campaigns.schedule(campaign.id, {
                    schedule_time: scheduleTime.toISOString(),
                });

                return {
                    id: campaign.id,
                    status: 'scheduled',
                    web_url: campaign.archive_url,
                    scheduled_at: payload.send_at,
                };
            }
        }

        return mapCampaignResponse(campaign);
    },

    async updateCampaign(id: string, payload: ESPPayload): Promise<ESPCampaign> {
        const client = getClient();

        // Update campaign settings
        await client.campaigns.update(id, {
            settings: {
                subject_line: payload.subject,
                preview_text: payload.preview_text || '',
            },
        });

        // Update content
        await client.campaigns.setContent(id, {
            html: payload.html_content,
            ...(payload.text_content ? { plain_text: payload.text_content } : {}),
        });

        // Get updated campaign info
        const campaign = await client.campaigns.get(id) as {
            id: string;
            status: string;
            archive_url?: string;
            send_time?: string;
        };

        return mapCampaignResponse(campaign);
    },

    async scheduleCampaign(id: string, sendAt: string): Promise<ESPCampaign> {
        const client = getClient();

        const scheduleTime = new Date(sendAt);
        const minScheduleTime = new Date(Date.now() + 15 * 60 * 1000);

        if (scheduleTime <= minScheduleTime) {
            throw new Error('Schedule time must be at least 15 minutes in the future');
        }

        await client.campaigns.schedule(id, {
            schedule_time: scheduleTime.toISOString(),
        });

        const campaign = await client.campaigns.get(id) as {
            id: string;
            status: string;
            archive_url?: string;
            send_time?: string;
        };

        return mapCampaignResponse(campaign);
    },

    async getCampaign(id: string): Promise<ESPCampaign> {
        const client = getClient();

        const campaign = await client.campaigns.get(id) as {
            id: string;
            status: string;
            archive_url?: string;
            send_time?: string;
        };

        return mapCampaignResponse(campaign);
    },
};

// Additional utility functions

export async function sendCampaignNow(campaignId: string): Promise<void> {
    const client = getClient();
    await client.campaigns.send(campaignId);
}

export async function sendTestEmail(campaignId: string, testEmails: string[]): Promise<void> {
    const client = getClient();
    await client.campaigns.sendTestEmail(campaignId, {
        test_emails: testEmails,
        send_type: 'html',
    });
}

export async function unscheduleCampaign(campaignId: string): Promise<void> {
    const client = getClient();
    await client.campaigns.unschedule(campaignId);
}

export async function deleteCampaign(campaignId: string): Promise<void> {
    const client = getClient();
    await client.campaigns.remove(campaignId);
}
