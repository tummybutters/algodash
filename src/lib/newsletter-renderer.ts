import type { NewsletterIssue, NewsletterItemWithVideo } from '@/types/database';

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function formatDuration(seconds: number | null): string {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function renderItem(item: NewsletterItemWithVideo, index: number, isUrgent: boolean): string {
    const fields = item.fields || {};
    const video = item.video;
    const accentColor = isUrgent ? '#6366f1' : '#10b981';
    const sectionLabel = isUrgent ? 'Must Watch (Urgent)' : 'Must Keep (Evergreen)';

    return `
    <tr>
      <td style="padding: 24px 0; border-bottom: 1px solid #e5e7eb;">
        ${index === 0 ? `<p style="margin: 0 0 16px; font-size: 12px; font-weight: 600; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.1em;">${sectionLabel}</p>` : ''}

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="120" valign="top" style="padding-right: 16px;">
              ${video.thumbnail_url ? `<img src="${escapeHtml(video.thumbnail_url)}" alt="" width="120" height="68" style="border-radius: 8px; display: block;">` : '<div style="width: 120px; height: 68px; background: #e5e7eb; border-radius: 8px;"></div>'}
            </td>
            <td valign="top">
              <a href="${escapeHtml(video.video_url)}" style="color: #111827; text-decoration: none; font-size: 16px; font-weight: 600; line-height: 1.4;">
                ${escapeHtml(fields.podcast_name || video.channel_name || 'Podcast')} — ${escapeHtml(fields.guest_name || 'Guest')}
              </a>
              <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">
                ${escapeHtml(video.channel_name || '')} ${video.duration_seconds ? `· ${formatDuration(video.duration_seconds)}` : ''}
              </p>
            </td>
          </tr>
        </table>

        ${fields.actor ? `
        <div style="margin-top: 16px;">
          <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Actor</p>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">${escapeHtml(fields.actor)}</p>
        </div>
        ` : ''}

        ${fields.topics ? `
        <div style="margin-top: 12px;">
          <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Topics</p>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">${escapeHtml(fields.topics)}</p>
        </div>
        ` : ''}

        ${isUrgent && fields.signals && fields.signals.length > 0 ? `
        <div style="margin-top: 12px;">
          <p style="margin: 0 0 8px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Signals</p>
          <ul style="margin: 0; padding-left: 16px; font-size: 14px; color: #374151; line-height: 1.6;">
            ${fields.signals.map((signal: string) => `<li style="margin-bottom: 4px;">${escapeHtml(signal)}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${!isUrgent && fields.framework ? `
        <div style="margin-top: 12px;">
          <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Framework / Assumption</p>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">${escapeHtml(fields.framework)}</p>
        </div>
        ` : ''}

        ${!isUrgent && fields.why_compounds ? `
        <div style="margin-top: 12px;">
          <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Why it compounds</p>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">${escapeHtml(fields.why_compounds)}</p>
        </div>
        ` : ''}

        ${!isUrgent && fields.nuggets && fields.nuggets.length > 0 ? `
        <div style="margin-top: 12px;">
          <p style="margin: 0 0 8px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Nuggets</p>
          <ul style="margin: 0; padding-left: 16px; font-size: 14px; color: #374151; line-height: 1.6;">
            ${fields.nuggets.map((nugget: string) => `<li style="margin-bottom: 4px;">${escapeHtml(nugget)}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${isUrgent && fields.why_now ? `
        <div style="margin-top: 12px;">
          <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Why it matters now</p>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">${escapeHtml(fields.why_now)}</p>
        </div>
        ` : ''}

        ${fields.listen_if || fields.skip_if ? `
        <div style="margin-top: 12px;">
          <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Listen or Skip</p>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">
            ${fields.listen_if ? `Listen if ${escapeHtml(fields.listen_if)}.` : ''}
            ${fields.skip_if ? ` Skip if ${escapeHtml(fields.skip_if)}.` : ''}
          </p>
        </div>
        ` : ''}

        <p style="margin: 12px 0 0; font-size: 12px; color: #9ca3af;">
          <strong>Relevance horizon:</strong> ${isUrgent ? escapeHtml(fields.relevance_horizon || 'Time-sensitive') : 'Multi-year'}
        </p>

        <a href="${escapeHtml(video.video_url)}" style="display: inline-block; margin-top: 16px; padding: 8px 16px; background: ${accentColor}; color: white; text-decoration: none; font-size: 13px; font-weight: 500; border-radius: 6px;">
          Watch Episode &rarr;
        </a>
      </td>
    </tr>
    `;
}

export function renderNewsletterHtml(
    issue: NewsletterIssue,
    items: NewsletterItemWithVideo[]
): string {
    const isUrgent = issue.type === 'urgent';
    const headerColor = isUrgent ? '#6366f1' : '#10b981';
    const typeLabel = isUrgent ? 'Urgent Signals' : 'Evergreen Signals';

    const itemsHtml = items
        .sort((a, b) => a.position - b.position)
        .map((item, index) => renderItem(item, index, isUrgent))
        .join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(issue.subject || typeLabel)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; border-bottom: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.02em;">
                      Executive Algorithm
                    </p>
                    <p style="margin: 8px 0 0; font-size: 14px; color: ${headerColor}; font-weight: 600;">
                      ${typeLabel} — ${formatDate(issue.issue_date)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Intro -->
          ${issue.preview_text ? `
          <tr>
            <td style="padding: 24px 40px 0;">
              <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.6;">
                ${escapeHtml(issue.preview_text)}
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- Items -->
          <tr>
            <td style="padding: 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemsHtml || `
                <tr>
                  <td style="padding: 40px 0; text-align: center; color: #9ca3af;">
                    No items in this issue yet.
                  </td>
                </tr>
                `}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 12px; font-size: 12px; color: #6b7280; line-height: 1.5;">
                Reply if something here feels off or missing.
              </p>
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                <a href="*|UNSUB|*" style="color: #9ca3af;">Unsubscribe</a> ·
                <a href="*|UPDATE_PROFILE|*" style="color: #9ca3af;">Update preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
}

export function renderNewsletterText(
    issue: NewsletterIssue,
    items: NewsletterItemWithVideo[]
): string {
    const isUrgent = issue.type === 'urgent';
    const typeLabel = isUrgent ? 'Urgent Signals' : 'Evergreen Signals';

    const lines: string[] = [
        'Executive Algorithm',
        `${typeLabel} — ${formatDate(issue.issue_date)}`,
        '',
    ];

    if (issue.preview_text) {
        lines.push(issue.preview_text, '');
    }

    items
        .sort((a, b) => a.position - b.position)
        .forEach((item, index) => {
            const fields = item.fields || {};
            const video = item.video;

            if (index === 0) {
                lines.push(isUrgent ? '★ Must Watch (Urgent)' : '★ Must Keep (Evergreen)');
            }

            lines.push(
                '',
                `${fields.podcast_name || video.channel_name || 'Podcast'} — ${fields.guest_name || 'Guest'}`,
                video.video_url,
                ''
            );

            if (fields.actor) {
                lines.push('Actor:', fields.actor, '');
            }
            if (fields.topics) {
                lines.push('Topics:', fields.topics, '');
            }
            if (isUrgent && fields.signals?.length) {
                lines.push('Signals:');
                fields.signals.forEach((s: string) => lines.push(`• ${s}`));
                lines.push('');
            }
            if (!isUrgent && fields.nuggets?.length) {
                lines.push('Nuggets:');
                fields.nuggets.forEach((n: string) => lines.push(`• ${n}`));
                lines.push('');
            }
            if (fields.listen_if || fields.skip_if) {
                lines.push(
                    'Listen or skip:',
                    `Listen if ${fields.listen_if || '...'} Skip if ${fields.skip_if || '...'}`,
                    ''
                );
            }

            lines.push('— — —');
        });

    lines.push(
        '',
        'Reply if something here feels off or missing.',
        '',
        'Unsubscribe: *|UNSUB|*'
    );

    return lines.join('\n');
}
