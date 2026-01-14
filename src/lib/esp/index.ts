import { mailchimpProvider } from './mailchimp';
import type { ESPProvider } from './types';

export * from './types';
export * from './mailchimp';

// Get the configured ESP provider
export function getESPProvider(): ESPProvider {
    return mailchimpProvider;
}
