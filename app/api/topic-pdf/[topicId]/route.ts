import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { PDFDocument } from 'pdf-lib';
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

type TopicRow = { id: number; title: string; slug: string | null; unit_id: number };
type UnitRow = { title: string; slug: string | null; lesson_id: number; grade_id: number };
type TopicContentRow = { id: number; hero_image_url: string | null; subtitle: string | null };
type SectionRow = {
  heading: string;
  body_markdown: string | null;
  notebook_markdown: string | null;
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

// PDF tasarımı (2026-10-19, konu sayfası v1 ile aynı dijital dil): koyu lacivert kapak (ızgara +
// mavi/camgöbeği ışık, içindekiler), bölümlerde gradyan numara kutusu, "Konu Anlatımı" beyaz kart
// (sol kenarı gradyan), "Defterine Not Al" camgöbeği tonlu kart, kalın terimler fosforlu kalem.
// Yazı tipleri Google Fonts'tan (Space Grotesk + Inter); yüklenemezse sistem sans-serif'e düşer.
// 2026-10-20: kapak artık AYRI, kenar boşluksuz ve üstbilgisiz tam A4 sayfa olarak basılıp
// pdf-lib ile içeriğin önüne ekleniyor (headerTemplate sayfa bazında kapatılamıyor). Kapakta,
// bölüm sonlarında ve son sayfada siteye tıklanabilir linkler var (topicUrl/testUrl null ise gizli).
function buildHtml(opts: {
  topicTitle: string;
  gradeName: string;
  lessonName: string;
  unitName: string;
  subtitle: string | null;
  heroImageUrl: string | null;
  sections: SectionRow[];
  generatedDate: string;
  topicUrl: string | null;
  testUrl: string | null;
}): { cover: string; body: string } {
  const { topicTitle, gradeName, lessonName, unitName, subtitle, heroImageUrl, sections, generatedDate, topicUrl, testUrl } = opts;
  const siteLabel = SITE_URL.replace(/^https?:\/\//, '');
  const sectionUrl = (heading: string) => (topicUrl ? `${topicUrl}#${slugifyHeading(heading)}` : null);
  const total = sections.length;
  const pad = (n: number) => String(n).padStart(2, '0');

  const sectionsHtml = sections
    .map((s, i) => {
      const cleanSvg = s.diagram_svg?.trim().startsWith('<svg') ? stripDangerousSvg(s.diagram_svg) : null;
      // Site'deki SectionContent.tsx ile aynı ayrım: notebook_markdown VARSA body_markdown
      // "Konu Anlatımı", notebook_markdown "Defterine Not Al" olarak İKİ AYRI kutuda; yoksa
      // (eski bölümler) body_markdown tek kutuda.
      const bodyHtml = s.body_markdown ? markdownToHtml(s.body_markdown) : '';
      const notebookHtml = s.notebook_markdown ? markdownToHtml(s.notebook_markdown) : '';
      const contentHtml = notebookHtml
        ? `
          <div class="box explain">
            <p class="box-label">Konu anlatımı</p>
            ${bodyHtml}
          </div>
          <div class="box note">
            <p class="box-label">Defterine not al</p>
            ${notebookHtml}
          </div>`
        : `<div class="box explain">${bodyHtml}</div>`;
      return `
        <section class="section">
          <div class="sec-head">
            <span class="sec-no">${pad(i + 1)}</span>
            <div>
              <p class="kicker">Bölüm ${i + 1} / ${total}</p>
              <h2>${escapeHtml(s.heading)}</h2>
            </div>
          </div>
          ${s.image_url ? `<img class="section-image" src="${escapeHtml(s.image_url)}" alt="" />` : ''}
          ${cleanSvg ? `<div class="diagram">${cleanSvg}</div>` : ''}
          ${contentHtml}
          ${sectionUrl(s.heading) ? `<a class="sec-link" href="${escapeHtml(sectionUrl(s.heading)!)}">Bu bölümü sitede aç →</a>` : ''}
        </section>`;
    })
    .join('\n');

  const tocHtml = sections
    .map((s, i) => {
      const url = sectionUrl(s.heading);
      const inner = `<span class="toc-no">${pad(i + 1)}</span><span class="toc-t">${escapeHtml(s.heading)}</span>`;
      return `<li>${url ? `<a href="${escapeHtml(url)}">${inner}<span class="toc-go">↗</span></a>` : inner}</li>`;
    })
    .join('');

  const pills = [gradeName, lessonName, unitName].filter(Boolean).map((p) => `<span class="pill">${escapeHtml(p)}</span>`).join('');

  const head = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
<style>
${katexCss}
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
:root { --ink: #0B1220; --ink2: #334155; --muted: #64748B; --line: #E3E8F1; --accent: #3B5BFD; --cyan: #06B6D4; --soft: #EBF0FF; --grad: linear-gradient(120deg, #3B5BFD 0%, #2F8CF6 50%, #06B6D4 100%); --mark: rgba(6, 182, 212, .22); }
body { margin: 0; font-family: 'Inter', -apple-system, 'Segoe UI', Arial, sans-serif; color: var(--ink2); font-size: 11.5px; line-height: 1.7; }
h1, h2, h3, .display { font-family: 'Space Grotesk', 'Inter', Arial, sans-serif; }

/* KAPAK — kenar boşluksuz tam A4 (ayrı basılır) */
.cover { position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #0A1024; color: #F1F5FF; padding: 18mm 18mm 14mm; display: flex; flex-direction: column; }
.cover::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px); background-size: 10mm 10mm; -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0,0,0,.35) 100%); }
.cover::after { content: ""; position: absolute; inset: 0; background: radial-gradient(140mm 100mm at 100% 0%, rgba(59,91,253,.6), transparent 65%), radial-gradient(130mm 100mm at 0% 100%, rgba(6,182,212,.45), transparent 65%); }
.cover > * { position: relative; z-index: 1; }
.cover a { color: inherit; text-decoration: none; }
.cover-top { display: flex; justify-content: space-between; align-items: center; }
.brand { display: flex; align-items: center; gap: 9px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: .02em; }
.brand-dot { width: 10px; height: 10px; border-radius: 50%; background: #22D3EE; box-shadow: 0 0 0 4px rgba(34,211,238,.22), 0 0 12px #22D3EE; }
.cover-site { font-size: 10px; font-weight: 600; color: #9FB0D8; border: 1px solid rgba(255,255,255,.16); padding: 4px 10px; border-radius: 999px; }
.pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 22mm; }
.pill { font-size: 10px; font-weight: 600; color: #C7D2F0; border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.07); padding: 4px 11px; border-radius: 999px; }
.cover h1 { margin: 7mm 0 0; font-size: 42px; font-weight: 700; line-height: 1.05; letter-spacing: -.025em; color: #FFFFFF; }
.cover h1 .grad { background: linear-gradient(120deg, #8EA2FF, #5CC8FF 50%, #4FE3F5); -webkit-background-clip: text; background-clip: text; color: transparent; }
.cover .subtitle { margin: 5mm 0 0; max-width: 150mm; font-size: 13.5px; line-height: 1.6; color: #A9B6D6; }
.cta-row { display: flex; gap: 8px; margin-top: 8mm; }
.cta { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; padding: 9px 16px; border-radius: 12px; }
.cta.primary { background: linear-gradient(120deg, #3B5BFD 0%, #2F8CF6 50%, #06B6D4 100%); color: #fff; box-shadow: 0 8px 24px rgba(47,140,246,.35); }
.cta.ghost { border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.06); color: #E2E8F8; }
.hero-frame { margin-top: 9mm; padding: 6px; border-radius: 18px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14); align-self: flex-start; max-width: 100%; }
.hero-frame img { display: block; max-width: 100%; max-height: 70mm; border-radius: 13px; object-fit: contain; }
.toc { margin-top: auto; padding-top: 8mm; }
.toc-label { margin: 0 0 4mm; font-size: 9.5px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #7FE4F3; }
.toc ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; column-gap: 8mm; }
.toc li { font-size: 11.5px; color: #E2E8F8; border-bottom: 1px solid rgba(255,255,255,.1); }
.toc li a { display: flex; align-items: baseline; gap: 10px; padding: 2.4mm 0; }
.toc li:not(:has(a)) { display: flex; align-items: baseline; gap: 10px; padding: 2.4mm 0; }
.toc-t { flex: 1; }
.toc-go { color: #5E77C9; font-size: 10px; }
.toc-no { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 11px; color: #7C93FF; min-width: 20px; }
.cover-foot { display: flex; justify-content: space-between; margin-top: 8mm; font-size: 9.5px; color: #7D8BAE; }

/* BÖLÜMLER */
.section { margin-bottom: 9mm; }
.sec-head { display: flex; align-items: center; gap: 12px; margin-bottom: 5mm; padding-bottom: 4mm; border-bottom: 1px dashed var(--line); break-after: avoid; page-break-after: avoid; }
.sec-no { flex: none; width: 34px; height: 34px; border-radius: 10px; background: var(--grad); color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; }
.kicker { margin: 0 0 1px; font-size: 9px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); }
.sec-head h2 { margin: 0; font-size: 18px; font-weight: 700; line-height: 1.2; letter-spacing: -.01em; color: var(--ink); }
.section-image { display: block; max-width: 100%; max-height: 80mm; margin: 0 auto 5mm; border-radius: 12px; border: 1px solid var(--line); object-fit: contain; }
.diagram { margin: 0 0 5mm; padding: 4mm; border-radius: 12px; border: 1px solid var(--line); background: #fff; text-align: center; }
.diagram svg { max-width: 100%; height: auto; }
.box { position: relative; border-radius: 12px; padding: 4.5mm 5mm 3mm 6mm; margin-bottom: 4mm; }
.box.explain { background: #FFFFFF; border: 1px solid var(--line); }
.box.explain::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 3px; background: var(--grad); }
.box.note { background: linear-gradient(135deg, #EEF6FF, #E6FAFD); border: 1px solid #CDEFF7; }
.box-label { margin: 0 0 2mm; font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); }
.box.note .box-label { color: #0891B2; }
.box p { margin: 0 0 2.5mm; }
.box ul, .box ol { margin: 0 0 2.5mm; padding-left: 5mm; }
.box li { margin-bottom: 1.2mm; }
h3 { margin: 4mm 0 1.5mm; font-size: 13px; font-weight: 700; color: var(--ink); }
strong { color: var(--ink); font-weight: 700; background: linear-gradient(transparent 58%, var(--mark) 58%, var(--mark) 94%, transparent 94%); padding: 0 1px; }
a { color: var(--accent); }
img { max-width: 100%; }
.sec-link { display: inline-block; font-size: 10px; font-weight: 600; text-decoration: none; color: var(--accent); }

/* SON SAYFA — siteye dönüş kartı */
.outro { break-inside: avoid; page-break-inside: avoid; margin-top: 10mm; border-radius: 18px; overflow: hidden; background: #0A1024; color: #E2E8F8; padding: 8mm 8mm 7mm; position: relative; }
.outro::after { content: ""; position: absolute; inset: 0; background: radial-gradient(90mm 60mm at 100% 0%, rgba(59,91,253,.5), transparent 65%), radial-gradient(80mm 60mm at 0% 100%, rgba(6,182,212,.35), transparent 65%); }
.outro > * { position: relative; z-index: 1; }
.outro h2 { margin: 0; font-size: 20px; color: #fff; letter-spacing: -.01em; }
.outro p { margin: 2mm 0 5mm; color: #A9B6D6; }
.outro-links { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
.outro-links a { display: block; text-decoration: none; border-radius: 12px; padding: 4mm; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14); color: #fff; }
.outro-links a.primary { background: linear-gradient(120deg, #3B5BFD 0%, #2F8CF6 50%, #06B6D4 100%); border-color: transparent; }
.outro-links b { display: block; font-family: 'Space Grotesk', sans-serif; font-size: 12.5px; }
.outro-links span { display: block; margin-top: 1mm; font-size: 9.5px; color: #C7D2F0; }
</style>
</head>
<body>`;

  const cover = `${head}
  <div class="cover">
    <div class="cover-top">
      <a class="brand" href="${SITE_URL}"><span class="brand-dot"></span>Ders Takip</a>
      <a class="cover-site" href="${SITE_URL}">${escapeHtml(siteLabel)}</a>
    </div>
    <div class="pills">${pills}<span class="pill">Konu anlatımı</span></div>
    <h1><span class="grad">${escapeHtml(topicTitle)}</span></h1>
    ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
    ${topicUrl || testUrl ? `<div class="cta-row">
      ${topicUrl ? `<a class="cta primary" href="${escapeHtml(topicUrl)}">Konuyu sitede aç →</a>` : ''}
      ${testUrl ? `<a class="cta ghost" href="${escapeHtml(testUrl)}">Konu testini çöz</a>` : ''}
    </div>` : ''}
    ${heroImageUrl ? `<div class="hero-frame"><img src="${escapeHtml(heroImageUrl)}" alt="" /></div>` : ''}
    ${total ? `<div class="toc"><p class="toc-label">İçindekiler · ${total} bölüm</p><ol>${tocHtml}</ol></div>` : ''}
    <div class="cover-foot">
      <span>Ücretsiz konu anlatımı, test ve tekrar · ${escapeHtml(siteLabel)}</span>
      <span>${escapeHtml(generatedDate)}</span>
    </div>
  </div>
</body>
</html>`;

  const outro = `
    <div class="outro">
      <h2>Konuyu pekiştirme zamanı</h2>
      <p>Okuduklarını test et, eksiklerini gör ve ilerlemeni takip et — hepsi ücretsiz.</p>
      <div class="outro-links">
        ${testUrl ? `<a class="primary" href="${escapeHtml(testUrl)}"><b>Konu testini çöz →</b><span>Bu konunun soruları</span></a>` : ''}
        ${topicUrl ? `<a href="${escapeHtml(topicUrl)}"><b>Konuyu sitede aç</b><span>Görseller, sesli anlatım, slaytlar</span></a>` : ''}
        <a href="${SITE_URL}"><b>${escapeHtml(siteLabel)}</b><span>Tüm dersler ve günün sorusu</span></a>
      </div>
    </div>`;

  const body = `${head}
  <main>
    ${sectionsHtml}
    ${outro}
  </main>
</body>
</html>`;

  return { cover, body };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId: topicIdParam } = await params;
  const topicId = Number(topicIdParam);
  if (!Number.isFinite(topicId)) return NextResponse.json({ error: 'Geçersiz konu id' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: topicData } = await supabase.from('topics').select('id, title, slug, unit_id').eq('id', topicId).maybeSingle();
  const topic = topicData as TopicRow | null;
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });

  const { data: unitData } = await supabase.from('units').select('title, slug, lesson_id, grade_id').eq('id', topic.unit_id).maybeSingle();
  const unit = unitData as UnitRow | null;

  const [{ data: lesson }, { data: grade }] = await Promise.all([
    unit ? supabase.from('lessons').select('name, slug').eq('id', unit.lesson_id).maybeSingle() : Promise.resolve({ data: null as { name: string; slug: string | null } | null }),
    unit ? supabase.from('grades').select('name, slug').eq('id', unit.grade_id).maybeSingle() : Promise.resolve({ data: null as { name: string; slug: string | null } | null }),
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
    .select('heading, body_markdown, notebook_markdown, image_url, diagram_svg, order_no')
    .eq('topic_content_id', topicContent.id)
    .order('order_no', { ascending: true });
  const sections = (sectionsData as SectionRow[] | null) || [];

  const generatedDate = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  const topicPath =
    grade?.slug && lesson?.slug && unit?.slug && topic.slug ? `${grade.slug}/${lesson.slug}/${unit.slug}/${topic.slug}` : null;

  const { cover, body } = buildHtml({
    topicTitle: topic.title,
    gradeName: grade?.name || '',
    lessonName: lesson?.name || '',
    unitName: unit?.title || '',
    subtitle: topicContent.subtitle,
    heroImageUrl: topicContent.hero_image_url,
    sections,
    generatedDate,
    topicUrl: topicPath ? `${SITE_URL}/${topicPath}` : null,
    testUrl: topicPath ? `${SITE_URL}/soru-bankasi/${topicPath}` : null,
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
    await page.setContent(cover, { waitUntil: 'load', timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const coverPdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 }, pageRanges: '1' });

    await page.setContent(body, { waitUntil: 'load', timeout: 20_000 });

    const siteUrlLabel = SITE_URL.replace(/^https?:\/\//, '');
    // Web fontları (Space Grotesk/Inter) 'load' sonrası da gelebilir — basmadan önce bekle.
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    const metaLabel = [lesson?.name, grade?.name].filter(Boolean).map((v) => escapeHtml(v as string)).join(' · ');
    const headerTemplate = `
      <div style="-webkit-print-color-adjust:exact; font-size:8.5px; width:100%; padding:0 14mm; display:flex; justify-content:space-between; align-items:center; color:#64748B; font-family:Arial,Helvetica,sans-serif;">
        <span style="display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#06B6D4;"></span>
          <b style="color:#0B1220;">${escapeHtml(topic.title)}</b>
        </span>
        <span>${metaLabel}</span>
      </div>
    `;
    const footerTemplate = `
      <div style="-webkit-print-color-adjust:exact; font-size:8px; width:100%; padding:0 14mm; display:flex; justify-content:space-between; align-items:center; color:#94A3B8; font-family:Arial,Helvetica,sans-serif;">
        <span>Ders Takip · ${escapeHtml(siteUrlLabel)}</span>
        <span style="font-weight:700; color:#3B5BFD;"><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    `;

    const bodyPdf = await page.pdf({
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

    // Kapak + içerik birleştirme; linkler (annotation) copyPages ile korunuyor.
    const merged = await PDFDocument.create();
    for (const bytes of [coverPdf, bodyPdf]) {
      const src = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    merged.setTitle(`${topic.title} – Ders Takip`);
    const pdf = await merged.save();

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
