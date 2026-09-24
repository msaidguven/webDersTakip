import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { revalidateUnitPagesForTopics } from '@/app/src/lib/topicPageRevalidation';

// Konu Yönetimi panelindeki sürükle-bırak konu sıralamasından tetiklenir — bkz.
// units/reorder/route.ts ile aynı desen, sadece topics tablosu için.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { items?: unknown } | null;
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const items = rawItems.filter(
    (v): v is { id: number; order_no: number } =>
      !!v && typeof v === 'object' &&
      typeof (v as { id?: unknown }).id === 'number' &&
      typeof (v as { order_no?: unknown }).order_no === 'number' &&
      (v as { order_no: number }).order_no >= 0
  );

  if (!items.length || items.length !== rawItems.length) {
    return NextResponse.json({ ok: false, error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // `topics_unit_id_order_no_key` (unit_id, order_no) üzerinde UNIQUE — satırları TEK TEK,
  // hedef sırayla güncellersek bir konunun yeni order_no'su başka bir konunun henüz
  // güncellenmemiş ESKİ order_no'suyla çakışıp unique-violation atabiliyor (kullanıcının
  // 2026-09-24 canlıda yakaladığı bug). Çözüm: önce hepsini gerçek order_no aralığının asla
  // içine girmeyecek BÜYÜK POZİTİF geçici değerlere taşı (negatif OLMAZ — `topics_order_no_check`
  // CHECK (order_no >= 0) var, bunu da canlıda yakaladık) — 100000+id, gerçek bir ünitede asla
  // ulaşılamayacak kadar büyük ve id'ye göre kendi içinde de benzersiz, sonra gerçek hedef
  // değerlerine geç — iki geçiş de kendi içinde çakışmasız olduğu için hiçbir ara adım hiçbir
  // constraint'e takılmaz.
  for (const item of items) {
    const { error } = await supabase.from('topics').update({ order_no: 100000 + item.id }).eq('id', item.id);
    if (error) {
      console.error('[topics/reorder] geçici taşıma başarısız:', item, error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }
  let updated = 0;
  for (const item of items) {
    const { error } = await supabase.from('topics').update({ order_no: item.order_no }).eq('id', item.id);
    if (error) {
      console.error('[topics/reorder] update başarısız:', item, error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    updated += 1;
  }

  await revalidateUnitPagesForTopics(supabase, items.map((i) => i.id));
  return NextResponse.json({ ok: true, updated });
}
