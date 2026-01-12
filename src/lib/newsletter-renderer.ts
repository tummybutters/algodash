import type { NewsletterIssue, NewsletterItemWithVideo, NewsletterType } from '@/types/database';

export function renderNewsletterHtml(
    issue: NewsletterIssue,
    items: NewsletterItemWithVideo[]
): string {
    const title = issue.subject || `Executive Algorithm - ${issue.issue_date}`;

    // Sort items by position
    const sortedItems = [...items].sort((a, b) => a.position - b.position);

    const itemsHtml = sortedItems.map(item => {
        const f = item.fields;
        return `
            <div class="item" style="margin-bottom: 40px; padding-bottom: 40px; border-bottom: 1px solid #eee;">
                <h3 style="margin: 0 0 10px 0; color: #111;">${item.video.title}</h3>
                <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                    <strong>${f.podcast_name || item.video.channel_name}</strong> ${f.guest_name ? `ft. ${f.guest_name}` : ''}
                </p>
                
                ${f.why_now ? `<p><strong>Why Now:</strong> ${f.why_now}</p>` : ''}
                
                ${f.signals && f.signals.length > 0 ? `
                    <p><strong>Signals Surfaced:</strong></p>
                    <ul>
                        ${f.signals.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                ` : ''}

                ${f.nuggets && f.nuggets.length > 0 ? `
                    <p><strong>Key Nuggets:</strong></p>
                    <ul>
                        ${f.nuggets.map(n => `<li>${n}</li>`).join('')}
                    </ul>
                ` : ''}
                
                ${f.framework ? `<p><strong>Framework:</strong> ${f.framework}</p>` : ''}
                
                <p>
                    <a href="${item.video.video_url}" style="color: #6366f1; text-decoration: none; font-weight: bold;">
                        Watch Episode →
                    </a>
                </p>
            </div>
        `;
    }).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                h1 { color: #111; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
                .footer { margin-top: 50px; font-size: 12px; color: #999; text-align: center; }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            ${issue.preview_text ? `<p style="font-style: italic; color: #666;">${issue.preview_text}</p>` : ''}
            
            <div class="content">
                ${itemsHtml}
            </div>

            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Executive Algorithm</p>
                <p>Curated signals for high-leverage minds.</p>
            </div>
        </body>
        </html>
    `;
}
