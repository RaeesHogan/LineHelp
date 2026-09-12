// src/utils/line-signature.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export async function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): Promise<boolean> {
  const hash = createHmac('sha256', channelSecret).update(body).digest('base64');
  
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
  } catch (e) {
    return false;
  }
}
