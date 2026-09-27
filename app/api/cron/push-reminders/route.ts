// Akşam hatırlatması (yol haritası 3c, 2026-09-27) — Vercel Cron her gün 16:00 UTC = 19:00 TR
// (bkz. vercel.json). Sadece BUGÜN hiç soru çözmemiş ve bugün henüz bildirim almamış öğrencilere,
// günde en fazla bir kez (bkz. get_push_reminder_candidates):
//   - serisi varsa: seri bu gece bozulacak uyarısı → anasayfa ("Bugün")
//   - yoksa tekrar zamanı gelen soru varsa → /tekrar
//   - ikisi de yoksa göndermez (hedefsiz "gel bak" bildirimi = spam).
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { isWebPushConfigured, sendPush, type PushPayload } from '@/app/src/lib/webPush';

export const maxDuration = 300;
const CONCURRENCY = 20;

type Candidate = { user_id: string; streak: number; due_count: number };
type SubRow = { id: number; user_id: string; endpoint: string; p256dh: string; auth: string };

function messageFor(c: Candidate): PushPayload | null {
  if (c.streak > 0) {
    return {
      title: `🔥 ${c.streak} günlük serin bu gece bozulacak`,
      body: c.due_count > 0 ? `${c.due_count} soru da tekrar zamanını bekliyor. Birkaç soru çöz, serin devam etsin.` : 'Birkaç soru çöz, serin devam etsin.',
      url: '/',
      tag: 'daily-reminder',
    };
  }
  if (c.due_count > 0) {
    return { title: `${c.due_count} soru tekrar zamanı geldi`, body: 'Unutmadan tekrar et — birkaç dakika yeter.', url: '/tekrar', tag: 'daily-reminder' };
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  if (!isWebPushConfigured()) return NextResponse.json({ error: 'VAPID anahtarları tanımlı değil' }, { status: 500 });

  const supabase = createServiceClient();
  const { data: candidates, error } = await supabase.rpc('get_push_reminder_candidates');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messages = new Map<string, PushPayload>();
  for (const c of (candidates as Candidate[] | null) || []) {
    const msg = messageFor(c);
    if (msg) messages.set(c.user_id, msg);
  }
  if (!messages.size) return NextResponse.json({ candidates: candidates?.length ?? 0, sent: 0 });

  const { data: subRows } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', [...messages.keys()]);
  const subs = (subRows as SubRow[] | null) || [];

  let sent = 0;
  let failed = 0;
  const gone: number[] = [];
  for (let i = 0; i < subs.length; i += CONCURRENCY) {
    const batch = subs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((s) => sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, messages.get(s.user_id)!))
    );
    results.forEach((r, j) => {
      if (r === 'sent') sent++;
      else if (r === 'gone') gone.push(batch[j].id);
      else failed++;
    });
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  await supabase.from('push_subscriptions').update({ last_notified_on: today }).in('user_id', [...messages.keys()]);
  if (gone.length) await supabase.from('push_subscriptions').delete().in('id', gone);

  return NextResponse.json({ candidates: candidates?.length ?? 0, users: messages.size, sent, failed, removed: gone.length });
}
