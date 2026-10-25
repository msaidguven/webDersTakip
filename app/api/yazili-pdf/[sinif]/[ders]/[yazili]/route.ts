import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/app/src/lib/teacherAuth';
import { htmlToA4Pdf } from '@/app/src/lib/htmlToPdf';
import { getYaziliExam } from '@/app/src/lib/yazili/publicData';
import { buildPaperHtml } from '@/app/src/lib/yazili/paperPdfHtml';

// Yazılı örnek sınav kağıdı PDF'i — 2026-10-25'ten beri yalnız admin ve onaylı öğretmen (kullanıcı kararı,
// "şimdilik"; öğrenci/misafir için ileride tekrar konuşulacak). Sorular sayfada herkese açık kalıyor.
// ?s=<senaryo, ülke genelinde 0>&v=<1|2>&anahtar=1 (cevap anahtarı).
// Kağıt publicData.getYaziliExam'daki buildPapers ile sayfadakiyle aynı kuralla kurulur.
// Chromium kurulumu topic-pdf ile aynı (bkz. oradaki notlar).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ sinif: string; ders: string; yazili: string }> }) {
  const auth = await requireTeacher();
  if (!auth.ok) return auth.response;

  const { sinif, ders, yazili } = await params;
  const sp = request.nextUrl.searchParams;
  const scenario = Number(sp.get('s'));
  const variant = Number(sp.get('v'));
  const answerKey = sp.get('anahtar') === '1';
  if (!Number.isInteger(scenario) || (variant !== 1 && variant !== 2)) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const data = await getYaziliExam(sinif, ders, yazili);
  const paper = data?.papers.find((p) => (p.scenario ?? 0) === scenario && p.variant === variant);
  if (!data || !paper) return NextResponse.json({ error: 'Kağıt bulunamadı' }, { status: 404 });

  const byId = new Map(data.topics.flatMap((t) => t.questions).map((q) => [q.id, q]));
  const items = paper.items.flatMap((it) => (byId.has(it.questionId) ? [{ question: byId.get(it.questionId)!, points: it.points }] : []));
  const letter = variant === 1 ? 'A' : 'B';
  const title = `${data.gradeName} ${data.lessonName} Dersi ${data.exam.label} Sınavı`;
  const subtitle = [
    paper.scenario ? `MEB ${paper.scenario}. senaryoya göre` : 'Ülke geneli sınav kapsamında',
    `${letter} kağıdı`,
    answerKey ? 'CEVAP ANAHTARI' : null,
  ].filter(Boolean).join(' · ');
  const html = buildPaperHtml({ title, subtitle, items, answerKey });

  try {
    const pdf = await htmlToA4Pdf(html);
    const fileName = `${sinif}-${ders}-${yazili}-${paper.scenario ? `senaryo-${paper.scenario}-` : ''}${letter.toLowerCase()}${answerKey ? '-cevap-anahtari' : ''}.pdf`.replace(/[^a-z0-9.-]/gi, '');
    return new NextResponse(new Uint8Array(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName}"`, 'Cache-Control': 'private, no-store' },
    });
  } catch (err) {
    console.error('[yazili-pdf] PDF üretilemedi:', err);
    return NextResponse.json({ error: `PDF üretilemedi: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}` }, { status: 500 });
  }
}
