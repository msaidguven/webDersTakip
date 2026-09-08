// SVG çizim kurallarının tek kaynağı. Önceden bu kurallar her soru için
// notebook LLM'e yazdırılıyordu (bkz. app/prompt/_svg-question-fragment.md,
// eski hali) — bu hem prompt'u şişiriyor hem de NotebookLM'in karakter
// sınırını aşırıyordu (kullanıcı bildirimi 2026-09-04). Artık notebook
// prompt'u kısa tutuluyor; bu sabit kurallar sadece svg_prompt kopyalanırken
// (SVG'yi asıl çizecek AI'ye verilmek üzere) otomatik ekleniyor — bkz.
// SvgQuestionsPanel.tsx, ManagementTab.tsx (QuestionEditModal), QuizQuestionEditModal.tsx.
//
// svg_prompt tek cümlelik bir özet (NotebookLM karakter sınırı yüzünden kısa
// tutuluyor, bkz. yukarısı) — ama o sınır SADECE soru üretim promptu için
// geçerli, burada (şekli asıl çizecek AI'ye) soru kökünü de vermenin bir
// maliyeti yok ve şeklin soruyla (sayılar, etiketler, bağlam) birebir
// tutarlı çıkmasını sağlıyor (kullanıcı isteği 2026-09-09).
export const SVG_RENDER_RULES =
  `Teknik kurallar: viewBox'lı <svg> kökü kullan; script/style/foreignObject/image/a/use/gradient/filter/animasyon/event-handler kullanma; ` +
  `renk kodlarını "#" ile başlat; metni <text> içinde tut ve Türkçe yaz; sade 3-4 renk kullan, farklı unsurları (gövde/çizgi/etiket) ayırt et, ` +
  `çakışan çizgileri aynı renkte bırakma; kontrastlı zemin/yazı kullan; şekil soru metniyle birebir tutarlı olsun (sayılar, etiketler, işaretli noktalar); ` +
  `sadece SVG kodu döndür.`;

export function buildSvgGenerationPrompt(params: { questionText: string; svgPrompt: string; topicTitle?: string | null }): string {
  const { questionText, svgPrompt, topicTitle } = params;
  const context = [topicTitle ? `Konu: ${topicTitle}` : null, `Soru: ${questionText}`, `İstenen şekil: ${svgPrompt}`].filter(Boolean).join('\n');
  return `${context}\n\n${SVG_RENDER_RULES}`;
}
