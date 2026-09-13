import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { markdownToHtml, escapeHtml } from '@/app/src/lib/topicContentV11';
import { slugifyHeading, SITE_URL } from '@/app/src/lib/site';

// Ders sayfasındaki "PDF Olarak İndir" butonu (kullanıcı isteği, 2026-09-12: güzel bir
// kapak + her sayfada başlık/site linki taşıyan bir üstbilgi). Bunu tarayıcının kendi
// "Yazdır → PDF Kaydet"iyle güvenilir biçimde yapamazsın — tarayıcılar özel bir üstbilgiyi
// değil kendi URL/tarih üstbilgisini basar. Bu yüzden sunucuda headless Chrome (Puppeteer +
// @sparticuz/chromium, Vercel serverless'te çalışan tek pratik Chromium dağıtımı) ile
// sayfayı GERÇEKTEN render edip PDF'e basıyoruz — page.pdf()'in headerTemplate/
// footerTemplate'i bunun için native destek veriyor. docx export'taki (Resvg) gibi bu da
// ağır bir native bağımlılık ekliyor; next.config.ts'te sharp/resvg ile AYNI
// outputFileTracingIncludes deseniyle Vercel fonksiyon paketine dahil ediliyor.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Soğuk başlangıçta Chromium binary'sinin /tmp'e açılması + tarayıcı başlatma + sayfa
// render'ı tek başına birkaç saniye sürebiliyor — düşük bir maxDuration (kullanıcının
// 2026-09-12 "HTTP ERROR 500" raporunda gördüğümüz gibi) bunu zamanaşımına uğratıp
// GÖVDESİZ, jenerik bir 500 döndürüyordu (tarayıcı bunu kendi "sayfa çalışmıyor"
// ekranıyla gösteriyor). Vercel Hobby'nin izin verdiği üst sınıra çıkarıldı.
export const maxDuration = 60;

const katexCss = (() => {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'node_modules/katex/dist/katex.min.css'), 'utf8');
  } catch {
    return '';
  }
})();

type TopicRow = { id: number; title: string; unit_id: number };
type UnitRow = { title: string; lesson_id: number; grade_id: number };
type TopicContentRow = { id: number; hero_image_url: string | null; subtitle: string | null };
type SectionRow = {
  heading: string;
  body_markdown: string | null;
  image_url: string | null;
  diagram_svg: string | null;
  order_no: number;
};

// diagram_svg sadece admin panelinden (bkz. section/[id]/diagram/route.ts PATCH'i) yazılabiliyor
// — Word export'taki (Resvg) ile aynı güven sınırı, ayrı bir DOMPurify/jsdom bağımlılığı
// eklemeden ucuz bir son savunma: script/event-handler/foreignObject'i temizle.
function stripDangerousSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
}

function buildHtml(opts: {
  topicTitle: string;
  gradeName: string;
  lessonName: string;
  unitName: string;
  subtitle: string | null;
  heroImageUrl: string | null;
  sections: SectionRow[];
  generatedDate: string;
}): string {
  const { topicTitle, gradeName, lessonName, unitName, subtitle, heroImageUrl, sections, generatedDate } = opts;

  const sectionsHtml = sections
    .map((s) => {
      const cleanSvg = s.diagram_svg?.trim().startsWith('<svg') ? stripDangerousSvg(s.diagram_svg) : null;
      return `
        <div class="section">
          <h2 class="heading">${escapeHtml(s.heading)}</h2>
          ${s.image_url ? `<img class="section-image" src="${escapeHtml(s.image_url)}" alt="" />` : ''}
          ${cleanSvg ? `<div class="diagram">${cleanSvg}</div>` : ''}
          ${s.body_markdown ? markdownToHtml(s.body_markdown) : ''}
        </div>
      `;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<style>
${katexCss}
* { box-sizing: border-box; }
body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #292524; margin: 0; font-size: 12.5px; line-height: 1.65; }
/* DİKKAT: burada bilerek "@page { size: A4; margin: 0; }" YOK — yerel testte doğrulandı,
   bu kural page.pdf()'in kendi margin seçeneğiyle çakışıp 2. sayfadan itibaren içeriğin
   üstbilgiyle (headerTemplate) çakışmasına yol açıyordu. Sayfa boyutu/marjlar SADECE
   page.pdf() çağrısındaki format/margin seçenekleriyle kontrol ediliyor. */
/* Kapak: dergi/kitap kapağı gibi — varsa konu kapak görseli tam sayfa arka plan olarak
   kullanılıyor (üstüne okunabilirlik için koyu bir gradyan), yoksa markanın kendi
   indigo→mor→pembe gradyanı + dekoratif daireler. Marka rozeti ve sınıf/ders/ünite
   etiketleri üstte, büyük başlık alt üçte birde, ince bir alt şerit en altta —
   düz ortalanmış tek satır başlıktan (önceki hâl) çok daha "kapak" hissi veriyor.
   page-break-after burada değil DIŞ kapsayıcıda (.cover-page) — arka plan görseli/
   gradyanı tam sayfaya bleed etsin diye .cover'ın kendisi padding taşımıyor. */
.cover-page { height: 250mm; page-break-after: always; }
.cover { position: relative; height: 100%; overflow: hidden; color: #fff; }
.cover .bg-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.cover .bg-fallback { position: absolute; inset: 0; background: linear-gradient(135deg, #4338ca 0%, #9333ea 55%, #e11d48 100%); }
.cover .bg-fallback::before, .cover .bg-fallback::after { content: ''; position: absolute; border-radius: 50%; background: rgba(255,255,255,0.09); }
.cover .bg-fallback::before { width: 220mm; height: 220mm; top: -110mm; right: -80mm; }
.cover .bg-fallback::after { width: 150mm; height: 150mm; bottom: -70mm; left: -50mm; }
.cover .overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(15,10,30,0.9) 0%, rgba(15,10,30,0.55) 40%, rgba(15,10,30,0.18) 70%); }
.cover .inner { position: relative; height: 100%; display: flex; flex-direction: column; padding: 14mm 16mm; }
.cover .brand-badge { align-self: flex-start; display: inline-block; background: rgba(255,255,255,0.95); color: #4338ca; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; }
.cover .pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10mm; }
.cover .pill { background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.4); color: #fff; font-size: 10.5px; font-weight: 700; padding: 5px 12px; border-radius: 999px; }
.cover .title-block { margin-top: auto; }
.cover h1 { font-size: 36px; font-weight: 900; line-height: 1.18; margin: 0 0 8px; text-shadow: 0 2px 14px rgba(0,0,0,0.4); }
.cover .subtitle { font-size: 15px; color: rgba(255,255,255,0.9); max-width: 480px; text-shadow: 0 1px 6px rgba(0,0,0,0.35); }
.cover .footer-row { display: flex; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,0.75); border-top: 1px solid rgba(255,255,255,0.3); padding-top: 8px; margin-top: 12mm; }
.content { padding: 2mm; }
.section { margin-bottom: 22px; page-break-inside: avoid; }
.section h2.heading { font-size: 17px; font-weight: 900; color: #e11d48; border-bottom: 2px solid #fecdd3; padding-bottom: 6px; margin: 0 0 12px; }
h1, h2, h3 { color: #1c1917; }
h3 { font-size: 14px; font-weight: 800; color: #4f46e5; margin: 16px 0 6px; }
p { margin: 0 0 8px; }
ul, ol { margin: 0 0 8px 18px; padding: 0; }
li { margin-bottom: 3px; }
strong { font-weight: 800; }
img.section-image { max-width: 100%; border-radius: 10px; margin: 10px 0; }
.diagram { margin: 10px 0; text-align: center; }
.diagram svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
  <div class="cover-page">
    <div class="cover">
      ${heroImageUrl ? `<img class="bg-image" src="${escapeHtml(heroImageUrl)}" />` : '<div class="bg-fallback"></div>'}
      <div class="overlay"></div>
      <div class="inner">
        <span class="brand-badge">📚 Ders Takip.net</span>
        <div class="pills">
          ${gradeName ? `<span class="pill">${escapeHtml(gradeName)}</span>` : ''}
          ${lessonName ? `<span class="pill">${escapeHtml(lessonName)}</span>` : ''}
          ${unitName ? `<span class="pill">${escapeHtml(unitName)}</span>` : ''}
        </div>
        <div class="title-block">
          <h1>${escapeHtml(topicTitle)}</h1>
          ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <div class="footer-row">
          <span>${escapeHtml(SITE_URL.replace(/^https?:\/\//, ''))}</span>
          <span>${escapeHtml(generatedDate)}</span>
        </div>
      </div>
    </div>
  </div>
  <div class="content">
    ${sectionsHtml}
  </div>
</body>
</html>`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId: topicIdParam } = await params;
  const topicId = Number(topicIdParam);
  if (!Number.isFinite(topicId)) return NextResponse.json({ error: 'Geçersiz konu id' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: topicData } = await supabase.from('topics').select('id, title, unit_id').eq('id', topicId).maybeSingle();
  const topic = topicData as TopicRow | null;
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });

  const { data: unitData } = await supabase.from('units').select('title, lesson_id, grade_id').eq('id', topic.unit_id).maybeSingle();
  const unit = unitData as UnitRow | null;

  const [{ data: lesson }, { data: grade }] = await Promise.all([
    unit ? supabase.from('lessons').select('name').eq('id', unit.lesson_id).maybeSingle() : Promise.resolve({ data: null as { name: string } | null }),
    unit ? supabase.from('grades').select('name').eq('id', unit.grade_id).maybeSingle() : Promise.resolve({ data: null as { name: string } | null }),
  ]);

  // Sadece yayınlanmış içerik dışa aktarılabilir — public ders sayfasıyla AYNI görünürlük
  // sınırı (kullanıcı, giriş yapmamış olsa bile, sayfada zaten görmediği bir taslağı
  // PDF'e çeviremez).
  const { data: topicContentData } = await supabase
    .from('topic_contents')
    .select('id, hero_image_url, subtitle')
    .eq('topic_id', topicId)
    .eq('is_published', true)
    .maybeSingle();
  const topicContent = topicContentData as TopicContentRow | null;
  if (!topicContent) return NextResponse.json({ error: 'Bu konu için yayınlanmış içerik yok' }, { status: 404 });

  const { data: sectionsData } = await supabase
    .from('topic_content_sections')
    .select('heading, body_markdown, image_url, diagram_svg, order_no')
    .eq('topic_content_id', topicContent.id)
    .order('order_no', { ascending: true });
  const sections = (sectionsData as SectionRow[] | null) || [];

  const generatedDate = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = buildHtml({
    topicTitle: topic.title,
    gradeName: grade?.name || '',
    lessonName: lesson?.name || '',
    unitName: unit?.title || '',
    subtitle: topicContent.subtitle,
    heroImageUrl: topicContent.hero_image_url,
    sections,
    generatedDate,
  });

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    // @sparticuz/chromium 137'de defaultViewport/headless static alanları kaldırıldı
    // (bkz. build/index.d.ts) — sadece args/executablePath sağlıyor, headless artık
    // puppeteer-core'un kendi varsayılanı (true).
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    // 'networkidle0' (500ms boyunca sıfır ağ isteği) sayfadaki görsellerden biri yavaş/
    // yanıt vermezse gereksiz yere bekleyip süreyi uzatabiliyordu — bu sayfada script yok,
    // sadece resim/SVG var; tarayıcının kendi 'load' event'i (tüm <img>'ler yüklenene/
    // hataya düşene kadar bekler) burada hem yeterli hem daha hızlı/öngörülebilir.
    await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });

    const siteUrlLabel = SITE_URL.replace(/^https?:\/\//, '');
    const headerTemplate = `
      <div style="font-size:9px; width:100%; padding:0 14mm; display:flex; justify-content:space-between; align-items:center; color:#78716c; font-family:Arial,Helvetica,sans-serif;">
        <span style="font-weight:700; color:#e11d48;">${escapeHtml(topic.title)}</span>
        <span>Ders Takip.net · ${escapeHtml(siteUrlLabel)}</span>
      </div>
    `;
    const footerTemplate = `
      <div style="font-size:8.5px; width:100%; text-align:center; color:#a8a29e; font-family:Arial,Helvetica,sans-serif;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `;

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      // top 26mm: üstbilgiye (headerTemplate) rahat yer bırakıyor. Asıl kritik olan,
      // stildeki "@page margin:0" kuralının BURADAN kaldırılmış olması (bkz. yukarıdaki
      // not) — o kural varken 2. sayfadan itibaren içerik üstbilgiyle çakışıyordu.
      margin: { top: '26mm', bottom: '16mm', left: '14mm', right: '14mm' },
    });

    const asciiName = slugifyHeading(topic.title) || 'ders-notu';
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiName}.pdf"`,
      },
    });
  } catch (err) {
    // Önceki sürüm hatayı yutup Next'in jenerik (gövdesiz) 500'üne düşüyordu — tarayıcı
    // bunu "HTTP ERROR 500" diye gösteriyordu, asıl sebep (zaman aşımı mı, chromium
    // binary mi, bellek mi) hiçbir yerde görünmüyordu. Artık hem sunucu loguna (Vercel
    // fonksiyon logları) hem yanıt gövdesine gerçek hata mesajı yazılıyor.
    console.error('[topic-pdf] PDF üretilemedi:', err);
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
    return NextResponse.json({ error: `PDF üretilemedi: ${message}` }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
