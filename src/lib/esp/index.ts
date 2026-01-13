import { mailchimpProvider } from './mailchimp';
import type { ESPProvider } from './types';

export * from './types';
export * from './mailchimp';

// Get the configured ESP provider
export function getESPProvider(): ESPProvider {
    const provider = process.env.ESP_PROVIDER || 'mailchimp';

    switch (provider) {
        case 'mailchimp':
            return mailchimpProvider;
        default:
            throw new Error(`Unknown ESP provider: ${provider}`);
    }
}
