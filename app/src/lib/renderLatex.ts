import katex from 'katex';

// AI tarafından üretilen ders içeriği ($\frac{50}{100}$, $\rightarrow$ gibi) LaTeX
// ifadelerini düz $...$ / $$...$$ kalıbıyla içeriyor (bkz. prompt dosyaları) ama hiçbir
// yerde gerçekten render edilmiyordu — katex paketi kuruluydu (layout.tsx'teki CSS import)
// fakat JS tarafı hiç çağrılmıyordu (kullanıcının 2026-09-09 ekran görüntüsüyle bulduğu
// "$\frac{50}{100}$ olduğu gibi görünüyor" sorunu). Bu, o ham metni katex'in ürettiği
// HTML ile değiştirir — dangerouslySetInnerHTML'e verilecek HTML string'i üzerinde çalışır,
// DOM'a bağımlı değil, bu yüzden sunucu tarafında da güvenle çağrılabilir.
export function renderLatexInHtml(html: string): string {
  if (!html.includes('$')) return html;

  let out = html.replace(/\$\$([\s\S]+?)\$\$/g, (match, expr: string) => {
    try {
      return katex.renderToString(expr.trim(), { throwOnError: false, displayMode: true });
    } catch {
      return match;
    }
  });

  out = out.replace(/\$([^$\n]+?)\$/g, (match, expr: string) => {
    try {
      return katex.renderToString(expr.trim(), { throwOnError: false, displayMode: false });
    } catch {
      return match;
    }
  });

  return out;
}
