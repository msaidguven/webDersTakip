import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { xlsxBufferToSheets } from '@/app/src/lib/yillikPlan/xlsxParser';
import { skipRow } from '@/app/src/lib/yillikPlan/importer';

// MEB "Taslak Çerçeve Yıllık Plan" Excel'i genelde her sınıf için AYRI bir sayfa içeriyor
// (ör. BTY_5, BTY_6) — parse-docx'ten farkı bu yüzden tek bir rows listesi değil, SHEET
// BAŞINA bir sonuç döndürmesi: admin hangi sayfanın hedeflediği sınıfa ait olduğunu seçiyor
// (bkz. RowTable öncesi sayfa seçici, YillikPlanPanel.tsx). Sadece 1 kullanılabilir sayfa
// varsa (Sayfa1 gibi boş/karar-dışı sayfalar zaten xlsxBufferToSheets'te elenmiş oluyor)
// seçim adımı atlanıp otomatik kullanılıyor.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Dosya yok' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Sadece .xlsx kabul edilir' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const sheets = await xlsxBufferToSheets(buffer);
    if (!sheets.length) {
      return NextResponse.json({ error: 'Excel içinde tanınabilir bir yıllık plan tablosu bulunamadı (HAFTA/TEMA sütunları aranıyor).' }, { status: 400 });
    }

    const withStats = sheets.map((s) => {
      const temiz = s.rows.filter((r) => !skipRow(r));
      const uniteler = Array.from(new Set(temiz.map((r) => r.ünite).filter(Boolean)));
      const konular = new Set(temiz.filter((r) => r.konu).map((r) => `${r.ünite} ${r.konu}`));
      const kazSayisi = temiz.reduce((sum, r) => sum + (r.kazanım?.length || 0), 0);
      return {
        sheetName: s.sheetName,
        rows: s.rows,
        total: s.rows.length,
        clean: temiz.length,
        uniteler,
        konu_count: konular.size,
        kazanim_count: kazSayisi,
      };
    });

    return NextResponse.json({ sheets: withStats });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Excel ayrıştırılamadı' }, { status: 400 });
  }
}
