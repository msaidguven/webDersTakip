// SVG çizim kurallarının tek kaynağı. Önceden bu kurallar her soru için
// notebook LLM'e yazdırılıyordu (bkz. app/prompt/_svg-question-fragment.md,
// eski hali) — bu hem prompt'u şişiriyor hem de NotebookLM'in karakter
// sınırını aşırıyordu (kullanıcı bildirimi 2026-09-04). Artık notebook
// prompt'u kısa tutuluyor; bu sabit kurallar sadece svg_prompt kopyalanırken
// (SVG'yi asıl çizecek AI'ye verilmek üzere) otomatik ekleniyor — bkz.
// SvgQuestionsPanel.tsx, ManagementTab.tsx (QuestionEditModal), QuizQuestionEditModal.tsx.
export const SVG_RENDER_RULES =
  `Teknik kurallar: viewBox'lı <svg> kökü kullan; script/style/foreignObject/image/a/use/gradient/filter/animasyon/event-handler kullanma; ` +
  `renk kodlarını "#" ile başlat; metni <text> içinde tut; sade 3-4 renk kullan, farklı unsurları (gövde/çizgi/etiket) ayırt et, ` +
  `çakışan çizgileri aynı renkte bırakma; kontrastlı zemin/yazı kullan; sadece SVG kodu döndür.`;

export function buildSvgGenerationPrompt(svgPrompt: string): string {
  return `${svgPrompt}\n\n${SVG_RENDER_RULES}`;
}
