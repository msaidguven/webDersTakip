import { NextRequest } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function checkAuthRateLimit(ip: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('web_check_auth_rate_limit', { p_ip: ip });
  const row = (data as { allowed: boolean; retry_after_seconds: number }[] | null)?.[0];
  if (error || !row) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds };
}

export async function recordAuthAttempt(ip: string, kind: 'register' | 'login', success: boolean): Promise<void> {
  const supabase = createServiceClient();
  await supabase.rpc('web_record_auth_attempt', { p_ip: ip, p_kind: kind, p_success: success });
}

const MIN_FORM_SECONDS = 3;

export interface BotChallengeInput {
  honeypot?: unknown;
  formRenderedAt?: unknown;
  mathA?: unknown;
  mathB?: unknown;
  mathAnswer?: unknown;
}

// Client tarafındaki aynı kontrolleri (honeypot boş mu, form en az 3 sn açık kaldı mı,
// basit toplama sorusu doğru mu) sunucuda TEKRAR doğrular — frontend kontrolleri sadece
// UX için, bot bunları hiç çalıştırmadan doğrudan bu endpoint'e istek atabilir.
export function verifyBotChallenge(input: BotChallengeInput): boolean {
  if (typeof input.honeypot === 'string' && input.honeypot.trim() !== '') return false;

  const renderedAt = Number(input.formRenderedAt);
  if (!Number.isFinite(renderedAt) || Date.now() - renderedAt < MIN_FORM_SECONDS * 1000) return false;

  const a = Number(input.mathA);
  const b = Number(input.mathB);
  const answer = Number(input.mathAnswer);
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(answer) || answer !== a + b) return false;

  return true;
}
