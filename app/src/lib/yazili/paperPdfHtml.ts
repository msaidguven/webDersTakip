// Yazılı sınav kağıdı / cevap anahtarı PDF HTML'i (2026-10-21). Okulda fotokopiyle çoğaltılacağı için
// siyah-beyaz ve az mürekkepli: üstte okul/ad-soyad/numara/puan tablosu, her soruda puan ve cevap boşluğu.
// Cevap anahtarı ayrı belge: cevap, puanlama ölçütü (rubrik), puan. Öğretmen panelinden ("Yazılı hazırla")
// okul adı ve öğretmen adı gelirse başlığa ve kağıt sonuna yazılır; boşsa elle doldurulacak satır kalır.
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import katex from 'katex';
import { escapeHtml, renderPlainTextMath } from '@/app/src/lib/topicContentV11';
import type { YaziliQuestion } from '@/app/src/lib/yazili/publicData';

// KaTeX CSS'i yazı tiplerini göreli yoldan (fonts/…) ister; HTML Chromium'a setContent ile (about:blank) ve
// önizlemede srcdoc ile verildiği için o yol hiçbir yere çıkmaz, formüller yedek yazı tipine düşerdi. Yazı
// tipleri kurulu paketle aynı sürümün CDN'inden yüklenir.
const katexCss = (() => {
  try {
    return fs
      .readFileSync(path.join(process.cwd(), 'node_modules/katex/dist/katex.min.css'), 'utf8')
      .replaceAll('url(fonts/', `url(https://cdn.jsdelivr.net/npm/katex@${katex.version}/dist/fonts/`);
  } catch {
    return '';
  }
})();

// svg_content yalnız admin panelinden yazılır; topic-pdf'teki aynı ucuz son savunma.
function stripDangerousSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
}

// Cevap boşluğu zorluğa göre: kolay soru kısa, zor soru uzun cevap ister.
const answerSpaceMm = (difficulty: number | null) => ((difficulty ?? 3) <= 2 ? 28 : (difficulty ?? 3) >= 4 ? 48 : 36);

export function buildPaperHtml(opts: {
  title: string;
  subtitle: string;
  items: { question: YaziliQuestion; points: number }[];
  answerKey: boolean;
  school?: string;
  teacherName?: string;
  // Öğrenci kağıdı sütun sayısı (öğretmen seçer, 2026-10-23). Başlık/öğrenci tablosu her zaman tam genişlik;
  // cevap anahtarı hep tek sütun.
  columns?: 1 | 2;
}): string {
  const questions = opts.items
    .map(({ question: q, points }, i) => {
      // Cevap anahtarında cevap görseli varsa soru görseli basılmaz: cevap görseli ondan türetilir (aynı çizim
      // + cevap), ikisi art arda aynı şekli iki kez gösterirdi. Öğrenci kağıdında boş çerçeve her zaman basılır.
      const answerSvg = opts.answerKey && q.answerSvgContent ? `<div class="svg">${stripDangerousSvg(q.answerSvgContent)}</div>` : '';
      const svg = q.svgContent && !answerSvg ? `<div class="svg">${stripDangerousSvg(q.svgContent)}</div>` : '';
      // Görsel numara/puan satırının dışında, satırın tam genişliğinde (iki sütunda dar metin alanına sıkışmasın).
      const row = `<div class="qhead"><span class="no">${i + 1}.</span><div class="qtext">${renderPlainTextMath(q.text)}</div><span class="pts">${points} puan</span></div>`;
      const head = q.svgPosition === 'above' ? `${svg}${row}` : `${row}${svg}`;
      if (!opts.answerKey) return `<section class="q">${head}<div class="space" style="height:${answerSpaceMm(q.difficulty)}mm"></div></section>`;
      return `<section class="q key">${head}
        <p><b>Cevap:</b> ${renderPlainTextMath(q.modelAnswer)}</p>
        ${answerSvg}
        ${q.rubric ? `<p class="rubric"><b>Puanlama:</b> ${escapeHtml(q.rubric).replace(/\n/g, '<br>')}</p>` : ''}
        ${q.keyTerms.length ? `<p class="terms"><b>Anahtar kavramlar:</b> ${escapeHtml(q.keyTerms.join(', '))}</p>` : ''}
      </section>`;
    })
    .join('');

  const studentBox = opts.answerKey
    ? ''
    : `<table class="student"><tr><td>Adı Soyadı:</td><td>Numarası:</td><td>Sınıfı / Şubesi:</td><td class="score">Puan:</td></tr></table>`;

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(opts.title)}</title>
<style>${katexCss}
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11.5pt; line-height: 1.45; margin: 0; }
  header { border: 1.5px solid #000; padding: 8px 10px; text-align: center; }
  header .year { font-size: 9.5pt; letter-spacing: .04em; }
  header .school { margin: 6px 0; font-size: 10pt; text-align: left; }
  header .school.named { text-align: center; font-weight: 700; font-size: 11pt; text-transform: uppercase; }
  .sign { margin-top: 14px; text-align: right; font-size: 10.5pt; break-inside: avoid; }
  header h1 { font-size: 13pt; margin: 4px 0 0; text-transform: uppercase; }
  header .sub { font-size: 9pt; margin-top: 2px; }
  table.student { width: 100%; border-collapse: collapse; margin-top: -1.5px; }
  table.student td { border: 1.5px solid #000; padding: 6px 8px; font-size: 10pt; height: 30px; vertical-align: top; width: 30%; }
  table.student td.score { width: 10%; }
  .note { font-size: 9pt; margin: 8px 0 4px; }
  section.q { break-inside: avoid; padding: 8px 0 0; border-bottom: 1px dashed #999; }
  section.q.key { padding-bottom: 6px; }
  .qhead { display: flex; gap: 8px; align-items: flex-start; }
  .no { font-weight: 700; min-width: 20px; }
  .qtext { flex: 1; }
  .q-em { font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
  .pts { font-size: 9pt; font-weight: 700; white-space: nowrap; border: 1px solid #000; border-radius: 4px; padding: 0 5px; }
  .svg { margin: 6px 0; text-align: center; }
  /* Yalnız viewBox'lı SVG'de width:auto tarayıcı varsayılanına (300×150) düşüp geniş görseli küçültüyordu:
     kutu tam genişlik, yükseklik en fazla 55 mm, çizim oranı korunarak ortalanır. */
  .svg svg { display: block; margin: 0 auto; width: 100%; height: auto; max-height: 55mm; }
  .key p { margin: 4px 0 0 28px; font-size: 10.5pt; }
  .key .rubric, .key .terms { font-size: 9.5pt; }
  .cols { column-count: 2; column-gap: 7mm; column-rule: 1px solid #000; }
  .cols .pts { font-size: 8.5pt; }
</style></head><body>
<header>
  <div class="year">2026-2027 EĞİTİM-ÖĞRETİM YILI</div>
  ${opts.answerKey ? '' : opts.school ? `<div class="school named">${escapeHtml(opts.school)}</div>` : '<div class="school">Okul: ..........................................................................................................</div>'}
  <h1>${escapeHtml(opts.title)}</h1>
  <div class="sub">${escapeHtml(opts.subtitle)}</div>
</header>
${studentBox}
${opts.answerKey ? '' : '<p class="note">Soruları dikkatlice okuyunuz. Cevaplarınızı soruların altındaki boşluğa yazınız. Süre bir ders saatidir.</p>'}
<div class="${!opts.answerKey && opts.columns === 2 ? 'cols' : ''}">
${questions}
${opts.answerKey ? '' : `<p class="sign">Başarılar dilerim.${opts.teacherName ? `<br><b>${escapeHtml(opts.teacherName)}</b><br>Ders Öğretmeni` : ''}</p>`}
</div>
</body></html>`;
}
