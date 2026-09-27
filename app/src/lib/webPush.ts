// SADECE sunucu (API route'ları) — VAPID özel anahtarı kullanır, client bileşenlerden import edilmez.
// Web Push gönderimi (yol haritası 3c, 2026-09-27). VAPID anahtarları env'den:
// NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (https://… ya da mailto:).
import webpush, { type PushSubscription } from 'web-push';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

let configured = false;
export function isWebPushConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type SendResult = 'sent' | 'gone' | 'failed';

// 404/410: abonelik artık geçersiz (izin kaldırıldı, tarayıcı verisi silindi) — çağıran siler.
export async function sendPush(subscription: PushSubscription, payload: PushPayload): Promise<SendResult> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 * 4, urgency: 'normal' });
    return 'sent';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? 'gone' : 'failed';
  }
}
