import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { revalidateUnitPages } from '@/app/src/lib/topicPageRevalidation';

// Konu Yönetimi panelindeki sürükle-bırak ünite sıralamasından tetiklenir — sürüklenen
// listenin TAMAMI (yeni order_no'larıyla) tek seferde gönderilir, biz de tek tek
// güncelleriz (bkz. outcomes/move/route.ts'teki aynı sıralı-update deseni).
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

  // units.order_no üzerinde de UNIQUE constraint var (bkz. supabase/migrations/
  // fix_units_order_no_unique_per_grade.sql) — topics/reorder'daki AYNI çakışma riski
  // burada da geçerli, aynı iki-aşamalı (önce büyük pozitif geçici değer — NEGATİF OLMAZ,
  // CHECK order_no>=0 var — sonra hedef değer) çözümü uyguluyoruz (bkz.
  // topics/reorder/route.ts'teki ayrıntılı not).
  for (const item of items) {
    const { error } = await supabase.from('units').update({ order_no: 100000 + item.id }).eq('id', item.id);
    if (error) {
      console.error('[units/reorder] geçici taşıma başarısız:', item, error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }
  let updated = 0;
  for (const item of items) {
    const { error } = await supabase.from('units').update({ order_no: item.order_no }).eq('id', item.id);
    if (error) {
      console.error('[units/reorder] update başarısız:', item, error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    updated += 1;
  }

  await revalidateUnitPages(supabase, items.map((i) => i.id));
  return NextResponse.json({ ok: true, updated });
}
