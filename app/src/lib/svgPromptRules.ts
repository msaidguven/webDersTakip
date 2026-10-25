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
// tutarlı çıkmasını sağlıyor (kullanıcı isteği 2026-09-09). Soru kökünü görünce model
// soruyu şeklin içinde çözüyordu (7089: "Dengeleyici Kuvvet: 5 N (Batı)"), bu yüzden
// cevap/çözüm yazma yasağı açıkça eklendi (2026-10-03).
// Teknik kısım soru ve cevap görselinde ortak; "cevabı yazma" yasağı yalnız soru görselinde.
const SVG_TECHNICAL_RULES =
  `Teknik kurallar: viewBox'lı <svg> kökü kullan; script/style/foreignObject/image/a/use/gradient/filter/animasyon/event-handler kullanma; ` +
  `renk kodlarını "#" ile başlat; metni <text> içinde tut ve Türkçe yaz; sade 3-4 renk kullan, farklı unsurları (gövde/çizgi/etiket) ayırt et, ` +
  `çakışan çizgileri aynı renkte bırakma; kontrastlı zemin/yazı kullan; `;

export const SVG_RENDER_RULES =
  SVG_TECHNICAL_RULES +
  `şekil soru kökünde VERİLENLERLE birebir tutarlı olsun (sayılar, etiketler, işaretli noktalar); ` +
  `şekilde YALNIZCA soru kökünde verilen bilgileri göster: sonuç, hesaplama, formül, kural/açıklama cümlesi, doğru cevap ya da sorulan büyüklüğün değeri kesinlikle yazılmasın (şekil soruyu çözmemeli); sorulan büyüklük gerekiyorsa "?" ile göster; soruda olmayan etiket/yön ekleme; ` +
  `sadece SVG kodu döndür.`;

// Cevap görseli (yazılı klasik soruları, plan: docs/yazili-sorulari-plani.md "Cevap görseli"): cevap anahtarındaki
// doğru çizim. Sorunun SVG'si varsa ondan türetilir (kural 3): aynı çizim korunur, yalnız cevap eklenir.
const ANSWER_SVG_RULES =
  SVG_TECHNICAL_RULES +
  `bu bir CEVAP ANAHTARI görselidir: doğru cevabı çizimle göster ve yazılı cevapla birebir tutarlı olsun; cevabı belirgin bir vurgu rengiyle (ör. #dc2626) çiz; ` +
  `açıklama paragrafı, çözüm adımı ya da formül yazma; sadece SVG kodu döndür.`;

export function buildAnswerSvgPrompt(params: {
  questionText: string;
  answerSvgPrompt: string;
  modelAnswer: string | null;
  questionSvg: string | null;
  topicTitle?: string | null;
}): string {
  const { questionText, answerSvgPrompt, modelAnswer, questionSvg, topicTitle } = params;
  const base = questionSvg
    ? `Sorunun görseli (SVG kodu) aşağıda. Bu çizimi AYNEN koru (viewBox, ölçek, renkler, sayılar, etiketler); yalnız istenen cevabı üstüne ekle.
${questionSvg}`
    : null;
  const context = [
    topicTitle ? `Konu: ${topicTitle}` : null,
    `Soru: ${questionText}`,
    modelAnswer ? `Yazılı cevap: ${modelAnswer}` : null,
    `İstenen cevap çizimi: ${answerSvgPrompt}`,
    base,
  ]
    .filter(Boolean)
    .join('\n');
  return `${context}\n\n${ANSWER_SVG_RULES}`;
}

export function buildSvgGenerationPrompt(params: { questionText: string; svgPrompt: string; topicTitle?: string | null }): string {
  const { questionText, svgPrompt, topicTitle } = params;
  const context = [topicTitle ? `Konu: ${topicTitle}` : null, `Soru: ${questionText}`, `İstenen şekil: ${svgPrompt}`].filter(Boolean).join('\n');
  return `${context}\n\n${SVG_RENDER_RULES}`;
}
