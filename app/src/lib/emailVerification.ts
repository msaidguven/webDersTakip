// Öğretmen e-posta doğrulaması (2026-10-28, bkz. supabase/migrations/teacher_email_verification.sql). Bağlantıdaki
// rastgele anahtarın yalnız sha256'sı saklanır; 24 saat geçerli, yeniden gönderme 2 dakikada bir. E-posta Resend
// HTTP API ile gider (Supabase Auth SMTP'si de Resend; alan adı derstakip.net doğrulanmış, bkz. reference_email_dns).
import 'server-only';
import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/app/src/lib/site';

export const VERIFY_TTL_MS = 24 * 3600 * 1000;
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendTeacherVerificationEmail(service: SupabaseClient<any, any, any>, userId: string, email: string, fullName: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'E-posta gönderimi yapılandırılmamış' };

  const { data: row } = await service.from('profiles').select('email_verified_at, email_verify_sent_at').eq('id', userId).maybeSingle();
  const profile = row as { email_verified_at: string | null; email_verify_sent_at: string | null } | null;
  if (profile?.email_verified_at) return { ok: false, error: 'E-postan zaten doğrulanmış' };
  if (profile?.email_verify_sent_at && Date.now() - Date.parse(profile.email_verify_sent_at) < RESEND_COOLDOWN_MS) {
    return { ok: false, error: 'Bağlantı az önce gönderildi, birkaç dakika sonra tekrar dene' };
  }

  const token = randomBytes(32).toString('base64url');
  const { error } = await service
    .from('profiles')
    .update({ email_verify_token_hash: hashToken(token), email_verify_sent_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) return { ok: false, error: 'Bağlantı oluşturulamadı' };

  const link = `${SITE_URL}/api/auth/eposta-dogrula?t=${token}`;
  const hello = fullName?.trim() ? `Merhaba ${escapeHtml(fullName.trim().split(/\s+/)[0])} Hocam,` : 'Merhaba Hocam,';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Ders Takip <noreply@derstakip.net>',
      to: [email],
      subject: 'E-posta adresini doğrula — Ders Takip',
      html: `<p>${hello}</p><p>Ders Takip öğretmen hesabının e-posta adresini doğrulamak için aşağıdaki bağlantıya tıkla. Bağlantı 24 saat geçerlidir.</p><p><a href="${link}">E-posta adresimi doğrula</a></p><p>Bu hesabı sen açmadıysan bu e-postayı yok sayabilirsin.</p>`,
      text: `${hello.replace(/&#39;/g, "'")}\n\nE-posta adresini doğrulamak için: ${link}\n\nBağlantı 24 saat geçerlidir. Bu hesabı sen açmadıysan bu e-postayı yok sayabilirsin.`,
    }),
  }).catch(() => null);
  if (!res?.ok) {
    console.error('[emailVerification] Resend hatası:', res?.status, await res?.text().catch(() => ''));
    return { ok: false, error: 'E-posta gönderilemedi, biraz sonra tekrar dene' };
  }
  return { ok: true };
}
