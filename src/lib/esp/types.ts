export type ESPCampaign = {
    id: string;
    status: 'draft' | 'scheduled' | 'sent' | 'archived';
    web_url?: string;
    scheduled_at?: string;
};

export type ESPPayload = {
    subject: string;
    preview_text?: string;
    html_content: string;
    text_content?: string;
    send_at?: string; // ISO string
};

export interface ESPProvider {
    name: string;
    createCampaign(payload: ESPPayload): Promise<ESPCampaign>;
    updateCampaign(id: string, payload: ESPPayload): Promise<ESPCampaign>;
    scheduleCampaign(id: string, sendAt: string): Promise<ESPCampaign>;
    getCampaign(id: string): Promise<ESPCampaign>;
}
