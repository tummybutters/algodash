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
    const accentColor = isUrgent ? '#3b82f6' : '#38bdf8';

    return `
    <tr>
      <td style="padding: 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #0f172a; border: 1px solid #1f2a44; border-radius: 16px;">
          <tr>
            <td style="padding: 18px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="110" valign="top" style="padding-right: 16px;">
                    ${video.thumbnail_url ? `<img src="${escapeHtml(video.thumbnail_url)}" alt="" width="110" height="62" style="border-radius: 10px; display: block;">` : '<div style="width: 110px; height: 62px; background: #0b1220; border-radius: 10px;"></div>'}
                  </td>
                  <td valign="top">
                    <a href="${escapeHtml(video.video_url)}" style="color: #e2e8f0; text-decoration: none; font-size: 16px; font-weight: 600; line-height: 1.35;">
                      ${escapeHtml(fields.podcast_name || video.channel_name || 'Podcast')} — ${escapeHtml(fields.guest_name || 'Guest')}
                    </a>
                    <p style="margin: 6px 0 0; font-size: 12px; color: #94a3b8;">
                      ${escapeHtml(video.channel_name || '')} ${video.duration_seconds ? `· ${formatDuration(video.duration_seconds)}` : ''}
                    </p>
                  </td>
                </tr>
              </table>

              ${fields.actor ? `
              <div style="margin-top: 14px;">
                <p style="margin: 0 0 4px; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Actor</p>
                <p style="margin: 0; font-size: 13px; color: #e2e8f0; line-height: 1.6;">${escapeHtml(fields.actor)}</p>
              </div>
              ` : ''}

              ${fields.topics ? `
              <div style="margin-top: 12px;">
                <p style="margin: 0 0 4px; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Topics</p>
                <p style="margin: 0; font-size: 13px; color: #e2e8f0; line-height: 1.6;">${escapeHtml(fields.topics)}</p>
              </div>
              ` : ''}

              ${isUrgent && fields.signals && fields.signals.length > 0 ? `
              <div style="margin-top: 12px;">
                <p style="margin: 0 0 8px; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Signals</p>
                <ul style="margin: 0; padding-left: 16px; font-size: 13px; color: #e2e8f0; line-height: 1.6;">
                  ${fields.signals.map((signal: string) => `<li style="margin-bottom: 4px;">${escapeHtml(signal)}</li>`).join('')}
                </ul>
              </div>
              ` : ''}

              ${!isUrgent && fields.framework ? `
              <div style="margin-top: 12px;">
                <p style="margin: 0 0 4px; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Framework</p>
                <p style="margin: 0; font-size: 13px; color: #e2e8f0; line-height: 1.6;">${escapeHtml(fields.framework)}</p>
              </div>
              ` : ''}

              ${!isUrgent && fields.why_compounds ? `
              <div style="margin-top: 12px;">
                <p style="margin: 0 0 4px; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Why it compounds</p>
                <p style="margin: 0; font-size: 13px; color: #e2e8f0; line-height: 1.6;">${escapeHtml(fields.why_compounds)}</p>
              </div>
              ` : ''}

              ${!isUrgent && fields.nuggets && fields.nuggets.length > 0 ? `
              <div style="margin-top: 12px;">
                <p style="margin: 0 0 8px; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Nuggets</p>
                <ul style="margin: 0; padding-left: 16px; font-size: 13px; color: #e2e8f0; line-height: 1.6;">
                  ${fields.nuggets.map((nugget: string) => `<li style="margin-bottom: 4px;">${escapeHtml(nugget)}</li>`).join('')}
                </ul>
              </div>
              ` : ''}

              ${isUrgent && fields.why_now ? `
              <div style="margin-top: 12px;">
                <p style="margin: 0 0 4px; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Why it matters now</p>
                <p style="margin: 0; font-size: 13px; color: #e2e8f0; line-height: 1.6;">${escapeHtml(fields.why_now)}</p>
              </div>
              ` : ''}

              ${fields.listen_if || fields.skip_if ? `
              <div style="margin-top: 12px;">
                <p style="margin: 0 0 4px; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Listen or Skip</p>
                <p style="margin: 0; font-size: 13px; color: #e2e8f0; line-height: 1.6;">
                  ${fields.listen_if ? `Listen if ${escapeHtml(fields.listen_if)}.` : ''}
                  ${fields.skip_if ? ` Skip if ${escapeHtml(fields.skip_if)}.` : ''}
                </p>
              </div>
              ` : ''}

              <p style="margin: 12px 0 0; font-size: 11px; color: #94a3b8;">
                <strong style="color: ${accentColor};">Relevance:</strong>
                ${isUrgent ? escapeHtml(fields.relevance_horizon || 'Time-sensitive') : 'Multi-year'}
              </p>

              <a href="${escapeHtml(video.video_url)}" style="display: inline-block; margin-top: 14px; font-size: 12px; font-weight: 600; color: ${accentColor}; text-decoration: none;">
                Open episode &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    `;
}

export function renderNewsletterHtml(
    issue: NewsletterIssue,
    items: NewsletterItemWithVideo[]
): string {
    const isUrgent = issue.type === 'urgent';
    const headerColor = isUrgent ? '#3b82f6' : '#38bdf8';
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
<body style="margin: 0; padding: 0; background-color: #05070a; font-family: 'Sora', 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #05070a;">
    <tr>
      <td align="center" style="padding: 36px 18px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #0b1119; border-radius: 20px; border: 1px solid #1f2a44; box-shadow: 0 20px 40px rgba(2, 6, 23, 0.55);">

          <!-- Header -->
          <tr>
            <td style="padding: 28px 36px 22px; border-bottom: 1px solid #1f2a44;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 12px; font-weight: 700; color: #94a3b8; letter-spacing: 0.28em; text-transform: uppercase;">
                      The Conviction Index
                    </p>
                    <p style="margin: 12px 0 0; font-size: 22px; font-weight: 600; color: #f8fafc; letter-spacing: -0.02em;">
                      ${typeLabel}
                    </p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: ${headerColor}; font-weight: 600;">
                      ${formatDate(issue.issue_date)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Intro -->
          ${issue.preview_text ? `
          <tr>
            <td style="padding: 20px 36px 0;">
              <p style="margin: 0; font-size: 14px; color: #cbd5f5; line-height: 1.7;">
                ${escapeHtml(issue.preview_text)}
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- Items -->
          <tr>
            <td style="padding: 12px 36px 6px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemsHtml || `
                <tr>
                  <td style="padding: 40px 0; text-align: center; color: #94a3b8;">
                    No items in this issue yet.
                  </td>
                </tr>
                `}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 26px 36px; background-color: #0b1119; border-radius: 0 0 20px 20px; border-top: 1px solid #1f2a44;">
              <p style="margin: 0 0 12px; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                Reply if something here feels off or missing.
              </p>
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                <a href="*|UNSUB|*" style="color: #64748b;">Unsubscribe</a> ·
                <a href="*|UPDATE_PROFILE|*" style="color: #64748b;">Update preferences</a>
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
        'The Conviction Index',
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
