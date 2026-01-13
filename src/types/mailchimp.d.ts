declare module '@mailchimp/mailchimp_marketing' {
    interface Config {
        apiKey: string;
        server: string;
    }

    interface CampaignSettings {
        subject_line?: string;
        preview_text?: string;
        from_name?: string;
        reply_to?: string;
    }

    interface CampaignRecipients {
        list_id: string;
    }

    interface CreateCampaignBody {
        type: 'regular' | 'plaintext' | 'absplit' | 'rss' | 'variate';
        recipients?: CampaignRecipients;
        settings?: CampaignSettings;
    }

    interface UpdateCampaignBody {
        settings?: CampaignSettings;
    }

    interface CampaignContent {
        html?: string;
        plain_text?: string;
    }

    interface ScheduleBody {
        schedule_time: string;
    }

    interface TestEmailBody {
        test_emails: string[];
        send_type: 'html' | 'plaintext';
    }

    interface Campaign {
        id: string;
        status: string;
        archive_url?: string;
        send_time?: string;
    }

    interface PingResponse {
        health_status: string;
    }

    interface Campaigns {
        create(body: CreateCampaignBody): Promise<Campaign>;
        update(campaignId: string, body: UpdateCampaignBody): Promise<Campaign>;
        get(campaignId: string): Promise<Campaign>;
        setContent(campaignId: string, content: CampaignContent): Promise<unknown>;
        send(campaignId: string): Promise<unknown>;
        schedule(campaignId: string, body: ScheduleBody): Promise<unknown>;
        unschedule(campaignId: string): Promise<unknown>;
        sendTestEmail(campaignId: string, body: TestEmailBody): Promise<unknown>;
        remove(campaignId: string): Promise<unknown>;
    }

    interface Ping {
        get(): Promise<PingResponse>;
    }

    interface MailchimpClient {
        setConfig(config: Config): void;
        campaigns: Campaigns;
        ping: Ping;
    }

    const client: MailchimpClient;
    export default client;
}
