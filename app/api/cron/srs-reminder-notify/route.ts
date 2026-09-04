import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Vercel Cron her gün bu route'u tetikler (bkz. vercel.json). CRON_SECRET Vercel proje
// ayarlarında env var olarak tanımlıysa, Vercel isteğe otomatik olarak
// "Authorization: Bearer $CRON_SECRET" ekliyor — bu kontrol dışarıdan rastgele birinin
// bildirim spam'i tetiklemesini engelliyor.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('notify_due_srs_reviews');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notified: data });
}
