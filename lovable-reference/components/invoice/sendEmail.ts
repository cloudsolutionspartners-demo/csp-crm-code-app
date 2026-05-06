import { supabase } from '@/integrations/supabase/client';

interface EmailAttachment {
  name: string;
  contentBytes: string; // base64 encoded
}

interface SendEmailParams {
  to: string;
  cc?: string | string[];
  subject: string;
  htmlBody: string;
  attachments?: EmailAttachment[];
}

export async function sendOutlookEmail(params: SendEmailParams): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-outlook-email', {
    body: params,
  });

  if (error) {
    console.error('Edge function error:', error);
    throw new Error(error.message || 'Failed to send email');
  }

  if (data && !data.success) {
    throw new Error(data.error || 'Failed to send email');
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Strip the data:...;base64, prefix
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
