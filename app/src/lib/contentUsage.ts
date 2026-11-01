// Slayt ve sesli anlatım kullanım ölçümü (istemci). Aynı tarayıcı oturumunda aynı konu + olay bir kez gönderilir;
// gönderim sessizdir, başarısız olsa da kullanıcı etkilenmez. Sunucu tarafı: app/api/usage-event/route.ts,
// tablo + rapor: supabase/migrations/content_usage_stats.sql.
export type ContentEvent = 'slides_open' | 'slides_finish' | 'narration_play' | 'narration_finish';

export function trackContentEvent(kind: ContentEvent, topicId: number): void {
  if (!Number.isInteger(topicId) || topicId <= 0) return;
  const key = `content-usage:${kind}:${topicId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {}
  void fetch('/api/usage-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, topicId }),
    keepalive: true,
  }).catch(() => {});
}
