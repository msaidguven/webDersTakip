import { NextRequest, NextResponse } from 'next/server';
import { refreshAllPages } from '@/app/src/lib/scheduledCacheRefresh';

// Haftalık tüm sayfa yenilemesi — pg_cron pazartesi 00:00 UTC (03:00 TR) çağırır
// (bkz. supabase/migrations/weekly_cache_refresh_cron.sql, scheduledCacheRefresh.ts).
export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  refreshAllPages();
  return NextResponse.json({ refreshed: true });
}
