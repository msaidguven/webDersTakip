import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { refreshAllPages } from '@/app/src/lib/scheduledCacheRefresh';

// Haftalık tüm sayfa yenilemesi — pg_cron pazartesi 00:00 UTC (03:00 TR) çağırır
// (bkz. supabase/migrations/weekly_cache_refresh_cron.sql, scheduledCacheRefresh.ts).
// Her başarılı çalışma weekly_cache_refresh_runs'a yazılır (bkz. weekly_cache_refresh_runs.sql).
export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  refreshAllPages();

  const { error } = await createServiceClient().from('weekly_cache_refresh_runs').insert({});
  if (error) {
    console.error('weekly-cache-refresh: kayıt yazılamadı', error.message);
    return NextResponse.json({ error: 'Kayıt yazılamadı' }, { status: 500 });
  }
  return NextResponse.json({ refreshed: true });
}
