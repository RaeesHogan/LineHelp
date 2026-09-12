import crypto from 'crypto';

/**
 * Verify LINE webhook signature
 * @param body - Raw request body
 * @param signature - X-Line-Signature header
 * @returns true if signature is valid
 */
export async function verifySignature(body: string, signature: string): Promise<boolean> {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  
  if (!channelSecret) {
    console.error('LINE_CHANNEL_SECRET is not set');
    return false;
  }

  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body, 'utf8')
    .digest('base64');

  return hash === signature;
}
