// Hesap silme (2026-11-15): istek verilince hesap hemen silinmez; bu kadar gün sonra kalıcı silinir.
// Aynı süre supabase/migrations/account_deletion_30_days.sql'deki cron koşulunda da yazılı.
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

/** Silme isteği zamanından kalıcı silinme gününü verir: "15 Aralık 2026". */
export function formatDeletionDate(requestedAt: string): string {
  return new Date(Date.parse(requestedAt) + ACCOUNT_DELETION_GRACE_DAYS * 86400000).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  });
}
