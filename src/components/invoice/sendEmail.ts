import { Office365OutlookService } from '../../generated/services/Office365OutlookService';
import type { ClientSendHtmlMessage } from '../../generated/models/Office365OutlookModel';

export interface EmailAttachment {
  name: string;
  contentBytes: string; // base64 encoded (no data URL prefix)
}

export interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  attachments?: EmailAttachment[];
  cc?: string;
  bcc?: string;
}

/**
 * Send an email via the Office 365 Outlook connector.
 * Throws on failure with a readable error message.
 */
export async function sendOutlookEmail(params: SendEmailParams): Promise<void> {
  const emailMessage: ClientSendHtmlMessage = {
    To: params.to,
    Subject: params.subject,
    Body: params.htmlBody,
    Importance: 'Normal',
  };

  if (params.cc) emailMessage.Cc = params.cc;
  if (params.bcc) emailMessage.Bcc = params.bcc;

  if (params.attachments && params.attachments.length > 0) {
    emailMessage.Attachments = params.attachments.map(att => ({
      Name: att.name,
      ContentBytes: att.contentBytes,
    }));
  }

  console.log('[Outlook] Sending email to:', params.to, 'subject:', params.subject, 'attachments:', params.attachments?.length || 0);
  const result = await Office365OutlookService.SendEmailV2(emailMessage) as any;
  console.log('[Outlook] Result:', result?.success, result?.error?.message || 'no error');

  if (result?.success === false || result?.error) {
    throw new Error(result?.error?.message || 'Failed to send email via Outlook');
  }
}

/**
 * Convert a Blob (e.g., jsPDF output) to a base64 string with the data URL prefix stripped.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
