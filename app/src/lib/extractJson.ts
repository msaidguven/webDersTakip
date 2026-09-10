// AI (Gemini/NotebookLM) çıktısı LaTeX komutları (\times, \frac, \rightarrow, \binom...)
// içerdiğinde JSON string'i içine ters eğik çizgiyi kaçırmadan (çift \\ yapmadan)
// yazıyor. JSON.parse bunu geçerli bir kaçış dizisi sanıyor — \t (tab), \f (form feed),
// \b (backspace), \r (satır başı) — ve harfi yutuyor: "\times" → "imes", "\frac" →
// "rac" (kullanıcının 2026-09-09 ekran görüntüsüyle bulduğu "2imes5", "rac59" bozukluğu).
// Bu uygulamanın hiçbir içeriğinde gerçek bir tab/form feed/backspace/CR karakterinin
// kasıtlı kullanımı yok, bu yüzden harfle devam eden böyle bir diziyi her zaman kaçırılmamış
// bir LaTeX komutu sayıp ters eğik çizgiyi ikiye katlıyoruz (\n hariç — body_markdown'da
// gerçek satır sonları için yoğun kullanılıyor, dokunmuyoruz).
function fixUnescapedLatexBackslashes(jsonText: string): string {
  return jsonText.replace(/\\([tbrf])(?=[A-Za-z])/g, '\\\\$1');
}

// AI çıktısı çoğunlukla düz JSON'dur ama bazen ```json ... ``` bloğuna sarılı ya da
// öncesinde/sonrasında açıklama metni ile gelir — burada hem manuel yapıştırma akışı
// (admin panel) hem de otomatik üretim (Gemini API çağrısı) aynı toleranslı ayrıştırmayı
// kullanır.
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const jsonSlice = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(fixUnescapedLatexBackslashes(jsonSlice));
}
