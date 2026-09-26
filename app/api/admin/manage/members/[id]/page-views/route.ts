import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 50;

// Üye Düzenle penceresindeki "Son ziyaret ettiği sayfalar" listesi. user_page_views'ta
// client policy'si yok; okuma yalnızca buradan, service role ile.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Geçersiz üye' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('user_page_views')
    .select('path, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
