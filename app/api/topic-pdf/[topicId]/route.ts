import { NextRequest, NextResponse, after } from 'next/server';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { PDFDocument } from 'pdf-lib';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { createClient } from '@/utils/supabase/server';
import { markdownToHtml, escapeHtml } from '@/app/src/lib/topicContentV11';
import { slugifyHeading, SITE_URL } from '@/app/src/lib/site';
import { normalizeRecapCard, recapCardToHtml, type RecapCardHtml } from '@/app/src/lib/recapCards';

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

// Üretilen PDF önbelleği (2026-10-25, Vercel CPU): her indirmede Chrome açmak yerine ilk üretilen PDF
// Storage'da saklanır (bkz. supabase/migrations/topic_pdfs_storage.sql). Dosya adı, PDF'i etkileyen her
// şeyin (kapak + içerik HTML'i + üst/altbilgi şablonu) hash'i — içerik ya da tasarım değişince kendiliğinden
// yeni PDF üretilir. Kapaktaki tarih hash'e girmez (her gün yeni PDF olmasın); kapakta ilk üretim tarihi kalır.
const PDF_BUCKET = 'topic-pdfs';
// HTML'e girmeyen basım ayarları (page.pdf kenar boşlukları, kapak birleştirme) değişirse artır.
const PDF_RENDER_VERSION = '1';
const SIGNED_URL_SECONDS = 60;

type TopicRow = { id: number; title: string; slug: string | null; unit_id: number };
type UnitRow = { title: string; slug: string | null; lesson_id: number; grade_id: number };
type TopicContentRow = { id: number; hero_image_url: string | null; subtitle: string | null };
type SectionRow = {
  heading: string;
  body_markdown: string | null;
  notebook_markdown: string | null;
  activity_prompt_markdown: string | null;
  image_url: string | null;
  diagram_svg: string | null;
  recap_card: unknown;
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

// Hap bilgi kartı (2026-10-24): sitedeki RecapCardView ile aynı yapı ve anlam renkleri. HTML recapCardToHtml'den
// (metin kaçışlı, yalnız <strong> + KaTeX); örnek şekli çizilmemişse örnek zaten null gelir.
function recapCardHtml(card: RecapCardHtml): string {
  const groups = card.groups
    .map((g) => `${g.labelHtml ? `<p class="rc-label">${g.labelHtml}</p>` : ''}<ul class="rc-list">${g.itemsHtml.map((h) => `<li>${h}</li>`).join('')}</ul>`)
    .join('');
  const figure = card.example?.figureSvg?.trim().startsWith('<svg') ? `<div class="rc-figure">${stripDangerousSvg(card.example.figureSvg)}</div>` : '';
  const example = card.example
    ? `<div class="rc-box rc-ex"><b>Örnek</b>${figure}<p class="rc-exq">${card.example.questionHtml}</p><ol class="rc-steps">${card.example.stepsHtml.map((h) => `<li>${h}</li>`).join('')}</ol></div>`
    : '';
  return `<div class="rc">
    ${card.introHtml ? `<p class="rc-intro">${card.introHtml}</p>` : ''}
    ${groups}
    ${card.noteHtml ? `<div class="rc-box rc-note"><b>Not</b>${card.noteHtml}</div>` : ''}
    ${card.warningsHtml.map((h) => `<div class="rc-box rc-warn"><b>Dikkat</b>${h}</div>`).join('')}
    ${example}
    ${card.tags.length ? `<p class="rc-tags">İlişkili: ${card.tags.map((x) => `<span>${escapeHtml(x)}</span>`).join('')}</p>` : ''}
  </div>`;
}

// PDF tasarımı (2026-10-19, konu sayfası v1 ile aynı dijital dil): bölümlerde gradyan numara kutusu, "Konu Anlatımı"
// beyaz kart (sol kenarı gradyan), kalın terimler fosforlu kalem. 2026-10-24: kapak koyu değil — beyaz, sade (üstte
// ince renk şeridi, büyük başlık, kısa vurgu çizgisi, görsel, içindekiler); son sayfa kartı da açık renk.
// Yazı tipleri Google Fonts'tan (Onest başlık + Inter metin, sitedeki gibi); yüklenemezse sistem sans-serif'e düşer.
// 2026-10-20: kapak artık AYRI, kenar boşluksuz ve üstbilgisiz tam A4 sayfa olarak basılıp
// pdf-lib ile içeriğin önüne ekleniyor (headerTemplate sayfa bazında kapatılamıyor).
// 2026-10-24: içerik iki sütun (daha az sayfa); siteye bağlantılar ve son sayfa kartı kaldırıldı (kullanıcı:
// "gerek yok" — basılı kâğıtta ileride karekod düşünülüyor); üstbilgi konunun künyesi (sınıf · ders · ünite + konu).
function buildHtml(opts: {
  topicTitle: string;
  gradeName: string;
  lessonName: string;
  unitName: string;
  subtitle: string | null;
  heroImageUrl: string | null;
  sections: SectionRow[];
  generatedDate: string;
}): { cover: string; body: string } {
  const { topicTitle, gradeName, lessonName, unitName, subtitle, heroImageUrl, sections, generatedDate } = opts;
  const siteLabel = SITE_URL.replace(/^https?:\/\//, '');
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
      const card = normalizeRecapCard(s.recap_card);
      const activityHtml = s.activity_prompt_markdown ? markdownToHtml(s.activity_prompt_markdown) : '';
      // Kartı olan bölüm (2026-10-24): PDF bir çalışma kâğıdı — kart + "Düşün" sorusu; uzun anlatım yalnız sitede.
      // Kartı olmayan bölümler eskisi gibi anlatımla basılır.
      const contentHtml = card
        ? `${recapCardHtml(recapCardToHtml(card))}${activityHtml ? `<div class="box think">${activityHtml}</div>` : ''}`
        : notebookHtml
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
            <h2>${escapeHtml(s.heading)}</h2>
          </div>
          ${s.image_url ? `<img class="section-image" src="${escapeHtml(s.image_url)}" alt="" />` : ''}
          ${cleanSvg ? `<div class="diagram">${cleanSvg}</div>` : ''}
          ${contentHtml}
        </section>`;
    })
    .join('\n');

  // İçindekiler içerikteki bölüm başlıklarıyla aynı dilde (gradyan numara kutusu); kartlı bölümde madde sayısı.
  const tocHtml = sections
    .map((s, i) => {
      const items = normalizeRecapCard(s.recap_card)?.groups.reduce((n, g) => n + g.items.length, 0);
      return `<li><span class="toc-no">${pad(i + 1)}</span><span class="toc-t">${escapeHtml(s.heading)}</span>${items ? `<span class="toc-n">${items} madde</span>` : ''}</li>`;
    })
    .join('');


  const head = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Onest:wght@600;700;800&display=swap" rel="stylesheet" />
<style>
${katexCss}
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
:root { --ink: #0B1220; --ink2: #334155; --muted: #64748B; --line: #E3E8F1; --accent: #3B5BFD; --cyan: #06B6D4; --soft: #EBF0FF; --grad: linear-gradient(120deg, #3B5BFD 0%, #2F8CF6 50%, #06B6D4 100%); --mark: rgba(6, 182, 212, .22); }
body { margin: 0; font-family: 'Inter', -apple-system, 'Segoe UI', Arial, sans-serif; color: var(--ink2); font-size: 11.5px; line-height: 1.7; }
h1, h2, h3, .display { font-family: 'Onest', 'Inter', Arial, sans-serif; }

/* KAPAK — kenar boşluksuz tam A4 (ayrı basılır). İçerik sayfalarıyla aynı dil (2026-10-24): aynı kenar boşlukları,
   mavi çizgili üstbilgi, sol kenarı gradyanlı tonlu panel, gradyan numara kutulu iki sütunlu içindekiler, aynı altbilgi.
   Görsel tam genişlikte ve kalan boşluğu doldurur (flex) — başlık/bölüm sayısı ne olursa olsun sayfa dengeli dolar. */
.cover { width: 210mm; height: 297mm; overflow: hidden; background: #FFFFFF; color: var(--ink); padding: 11mm 12mm 9mm; display: flex; flex-direction: column; gap: 7mm; }
.cover-top { flex: none; display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 2.5mm; border-bottom: 1.2px solid var(--accent); }
.brand { display: flex; align-items: center; gap: 8px; font-family: 'Onest', sans-serif; font-weight: 800; font-size: 14px; color: var(--ink); }
.brand-mark { width: 18px; height: 18px; border-radius: 5px; background: var(--grad); }
.cover-kind { font-size: 9px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
.cover-panel { flex: none; position: relative; padding: 9mm 9mm 8mm 11mm; border-radius: 14px; background: #F3F6FF; border: 1px solid #DCE4FF; }
.cover-panel::before { content: ""; position: absolute; left: 0; top: 9mm; bottom: 9mm; width: 4px; border-radius: 4px; background: var(--grad); }
.cover-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 3mm 4mm; font-family: 'Onest', sans-serif; font-weight: 800; }
.cm-grade { font-size: 13.5px; color: #fff; background: var(--grad); padding: 1.3mm 4mm; border-radius: 999px; }
.cm-lesson { font-size: 19px; letter-spacing: -.01em; color: var(--accent); }
.cm-unit { padding-left: 4mm; border-left: 1px solid #C9D4FF; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: var(--ink2); }
.cm-unit span { margin-right: 1.5mm; font-size: 9.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.cover h1 { margin: 6mm 0 0; font-size: 34px; font-weight: 800; line-height: 1.12; letter-spacing: -.02em; color: var(--ink); text-wrap: balance; }
.cover .subtitle { margin: 4mm 0 0; max-width: 165mm; font-size: 12.5px; line-height: 1.6; color: var(--ink2); }
.hero-frame { flex: 1 1 auto; min-height: 45mm; display: flex; align-items: center; justify-content: center; padding: 4mm; border-radius: 14px; background: #F7F9FD; border: 1px solid var(--line); overflow: hidden; }
.hero-frame img { display: block; max-width: 100%; max-height: 100%; border-radius: 10px; object-fit: contain; }
.cover-spacer { flex: 1 1 auto; }
.toc { flex: none; }
.toc-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 2.5mm; padding-bottom: 2.5mm; border-bottom: 1px dashed var(--line); }
.toc-head h2 { margin: 0; font-size: 14px; font-weight: 700; color: var(--ink); }
.toc-head span { font-size: 10px; font-weight: 600; color: var(--muted); }
.toc ol { list-style: none; margin: 0; padding: 0; column-count: 2; column-gap: 7mm; column-rule: 1px solid var(--line); }
.toc li { display: flex; align-items: center; gap: 8px; padding: 1.6mm 0; break-inside: avoid; font-size: 11px; line-height: 1.35; color: var(--ink2); }
.toc-no { flex: none; width: 22px; height: 22px; border-radius: 6px; background: var(--grad); color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'Onest', sans-serif; font-weight: 700; font-size: 10px; }
.toc-t { flex: 1; font-weight: 600; color: var(--ink); }
.toc-n { flex: none; font-size: 9.5px; color: var(--muted); }
.cover-foot { flex: none; display: flex; justify-content: space-between; padding-top: 2.5mm; border-top: 1px solid var(--line); font-size: 8.5px; color: #94A3B8; }

/* BÖLÜMLER — iki sütun (2026-10-24, daha az sayfa); bölümler sütun/sayfa sınırında akabilir, kutular bölünmez */
main { column-count: 2; column-gap: 7mm; column-rule: 1px solid var(--line); font-size: 10px; line-height: 1.55; }
.section { margin-bottom: 5mm; }
.sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 3mm; padding-bottom: 2.5mm; border-bottom: 1px dashed var(--line); break-inside: avoid; break-after: avoid; page-break-after: avoid; }
.sec-no { flex: none; width: 24px; height: 24px; border-radius: 7px; background: var(--grad); color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'Onest', sans-serif; font-weight: 700; font-size: 11px; }
.sec-head h2 { margin: 0; font-size: 14px; font-weight: 700; line-height: 1.25; letter-spacing: -.01em; color: var(--ink); }
.section-image { display: block; max-width: 100%; max-height: 50mm; margin: 0 auto 3mm; border-radius: 10px; border: 1px solid var(--line); object-fit: contain; break-inside: avoid; }
.diagram { margin: 0 0 3mm; padding: 3mm; border-radius: 10px; border: 1px solid var(--line); background: #fff; text-align: center; break-inside: avoid; }
.diagram svg { max-width: 100%; height: auto; }
.box { position: relative; border-radius: 9px; padding: 2.5mm 3mm 1.5mm 4mm; margin-bottom: 2.5mm; }
.box.explain { background: #FFFFFF; border: 1px solid var(--line); }
.box.explain::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 3px; background: var(--grad); }
.box.note { background: linear-gradient(135deg, #EEF6FF, #E6FAFD); border: 1px solid #CDEFF7; }
.box-label { margin: 0 0 2mm; font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); }
.box.note .box-label { color: #0891B2; }
.box p { margin: 0 0 2.5mm; }
.box ul, .box ol { margin: 0 0 2.5mm; padding-left: 5mm; }
.box li { margin-bottom: 1.2mm; }
h3 { margin: 3mm 0 1mm; font-size: 11.5px; font-weight: 700; color: var(--ink); }
strong { color: var(--ink); font-weight: 700; background: linear-gradient(transparent 58%, var(--mark) 58%, var(--mark) 94%, transparent 94%); padding: 0 1px; }
a { color: var(--accent); }
img { max-width: 100%; }
.box.think { background: #F7F3FF; border: 1px solid #E4D9FB; break-inside: avoid; }

/* HAP BİLGİ KARTI — sitedeki anlam renkleri: ara başlık lacivert, kavram mor-pembe, Not turuncu, Dikkat kırmızı, Örnek yeşil */
.rc { display: grid; gap: 2mm; margin-bottom: 2.5mm; }
.rc-intro { margin: 0; font-size: 11px; color: var(--ink); }
.rc-label { margin: 0 0 1.2mm; padding-left: 2.5mm; border-left: 2.5px solid #3B5BFD; font-size: 11px; font-weight: 800; color: #1E3A8A; break-after: avoid; page-break-after: avoid; }
.rc-list { list-style: none; margin: 0; padding: 0; }
.rc-list li { position: relative; padding-left: 3.5mm; margin-bottom: 1mm; break-inside: avoid; }
.rc-list li::before { content: ""; position: absolute; left: .4mm; top: 1.9mm; width: 1.6mm; height: 1.6mm; border-radius: 50%; background: #3B5BFD; }
.rc strong { color: #A21CAF; background: none; padding: 0; }
.rc-box { border: 1px solid; border-radius: 9px; padding: 2mm 3mm; break-inside: avoid; page-break-inside: avoid; }
.rc-box > b { display: block; margin-bottom: .8mm; font-size: 8.5px; letter-spacing: .1em; text-transform: uppercase; }
.rc-note { background: #FFF4E5; border-color: #FDBA74; }
.rc-note > b { color: #C2410C; }
.rc-warn { background: #FEEFEF; border-color: #FCA5A5; }
.rc-warn > b { color: #B91C1C; }
.rc-ex { background: #ECF8F0; border-color: #86EFAC; }
.rc-ex > b { color: #15803D; }
.rc-figure { margin: 1mm 0 2mm; padding: 2mm; border-radius: 8px; background: #fff; text-align: center; }
.rc-figure svg { max-width: 100%; height: auto; }
.rc-exq { margin: 0; font-weight: 600; color: var(--ink); }
.rc-steps { margin: 1.5mm 0 0; padding-left: 5mm; }
.rc-tags { margin: 0; font-size: 9.5px; color: var(--muted); }
.rc-tags span { display: inline-block; margin-left: 1.5mm; padding: .4mm 2.5mm; border-radius: 999px; background: var(--soft); color: var(--accent); font-weight: 700; }

</style>
</head>
<body>`;

  const cover = `${head}
  <div class="cover">
    <div class="cover-top">
      <span class="brand"><span class="brand-mark"></span>Ders Takip</span>
      <span class="cover-kind">Ders notu · ${escapeHtml(generatedDate)}</span>
    </div>
    <div class="cover-panel">
      <div class="cover-meta">
        ${gradeName ? `<span class="cm-grade">${escapeHtml(gradeName)}</span>` : ''}
        ${lessonName ? `<span class="cm-lesson">${escapeHtml(lessonName)}</span>` : ''}
        ${unitName ? `<span class="cm-unit"><span>Ünite</span>${escapeHtml(unitName)}</span>` : ''}
      </div>
      <h1>${escapeHtml(topicTitle)}</h1>
      ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
    </div>
    ${heroImageUrl ? `<div class="hero-frame"><img src="${escapeHtml(heroImageUrl)}" alt="" /></div>` : '<div class="cover-spacer"></div>'}
    ${total ? `<div class="toc"><div class="toc-head"><h2>Bu notta</h2><span>${total} bölüm</span></div><ol>${tocHtml}</ol></div>` : ''}
    <div class="cover-foot">
      <span>Ders Takip · ${escapeHtml(siteLabel)}</span>
      <span>Ücretsiz konu anlatımı, test ve tekrar</span>
    </div>
  </div>
</body>
</html>`;

  const body = `${head}
  <main>
    ${sectionsHtml}
  </main>
</body>
</html>`;

  return { cover, body };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId: topicIdParam } = await params;
  const topicId = Number(topicIdParam);
  if (!Number.isFinite(topicId)) return NextResponse.json({ error: 'Geçersiz konu id' }, { status: 400 });

  // PDF yalnızca üyelere açık (arayüzdeki uyarı penceresi tek başına yetmez, link doğrudan açılabilir).
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: 'PDF indirmek için giriş yapmalısınız.' }, { status: 401 });

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
    .select('heading, body_markdown, notebook_markdown, activity_prompt_markdown, image_url, diagram_svg, recap_card, order_no')
    .eq('topic_content_id', topicContent.id)
    .order('order_no', { ascending: true });
  const sections = (sectionsData as SectionRow[] | null) || [];

  const htmlInput = {
    topicTitle: topic.title,
    gradeName: grade?.name || '',
    lessonName: lesson?.name || '',
    unitName: unit?.title || '',
    subtitle: topicContent.subtitle,
    heroImageUrl: topicContent.hero_image_url,
    sections,
  };

  const siteUrlLabel = SITE_URL.replace(/^https?:\/\//, '');
  // Üstbilgi = konunun künyesi (2026-10-24): solda sınıf · ders · ünite, sağda "Konu: …", altında çizgi.
  const metaLabel = [grade?.name, lesson?.name, unit?.title].filter(Boolean).map((v) => escapeHtml(v as string)).join(' · ');
  const headerTemplate = `
      <div style="-webkit-print-color-adjust:exact; width:100%; padding:0 12mm; font-family:Arial,Helvetica,sans-serif;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:6mm; padding-bottom:1.6mm; border-bottom:1.2px solid #3B5BFD;">
          <span style="flex:none; max-width:55%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:7.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#3B5BFD;">${metaLabel}</span>
          <span style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:9px; color:#64748B;">Konu: <b style="color:#0B1220;">${escapeHtml(topic.title)}</b></span>
        </div>
      </div>
    `;
  const footerTemplate = `
      <div style="-webkit-print-color-adjust:exact; font-size:8px; width:100%; padding:0 12mm; display:flex; justify-content:space-between; align-items:center; color:#94A3B8; font-family:Arial,Helvetica,sans-serif;">
        <span>Ders Takip · ${escapeHtml(siteUrlLabel)}</span>
        <span style="font-weight:700; color:#3B5BFD;"><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    `;

  const asciiName = slugifyHeading(topic.title) || 'ders-notu';
  const keyHtml = buildHtml({ ...htmlInput, generatedDate: '' });
  const hash = createHash('sha256').update([PDF_RENDER_VERSION, keyHtml.cover, keyHtml.body, headerTemplate, footerTemplate].join('\u0000')).digest('hex').slice(0, 32);
  const cachedPath = `${topicId}/${hash}.pdf`;

  // Önbellekte varsa Chrome'u hiç açmadan kısa süreli imzalı URL'ye yönlendir (dosya yoksa hata döner).
  const { data: signed } = await supabase.storage
    .from(PDF_BUCKET)
    .createSignedUrl(cachedPath, SIGNED_URL_SECONDS, { download: `${asciiName}.pdf` });
  if (signed?.signedUrl) {
    return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
  }

  const generatedDate = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const { cover, body } = buildHtml({ ...htmlInput, generatedDate });

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

    // Web fontları (Onest/Inter) 'load' sonrası da gelebilir — basmadan önce bekle.
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    const bodyPdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      // top: üstbilgiye (headerTemplate) yer bırakıyor. Asıl kritik olan, stildeki "@page margin:0" kuralının
      // BURADAN kaldırılmış olması — o kural varken 2. sayfadan itibaren içerik üstbilgiyle çakışıyordu.
      margin: { top: '22mm', bottom: '15mm', left: '12mm', right: '12mm' },
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

    // Yanıt gönderildikten sonra önbelleğe yaz + konunun eski sürümlerini sil. Kayıt başarısız olursa
    // kullanıcı yine PDF'ini alır; bir sonraki indirme yeniden üretir.
    after(async () => {
      const { error: uploadError } = await supabase.storage
        .from(PDF_BUCKET)
        .upload(cachedPath, pdf, { contentType: 'application/pdf', upsert: true });
      if (uploadError) {
        console.error('[topic-pdf] önbelleğe yazılamadı:', uploadError.message);
        return;
      }
      const { data: files } = await supabase.storage.from(PDF_BUCKET).list(String(topicId), { limit: 100 });
      const stale = (files ?? []).filter((f) => f.name !== `${hash}.pdf`).map((f) => `${topicId}/${f.name}`);
      if (stale.length) await supabase.storage.from(PDF_BUCKET).remove(stale);
    });

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
