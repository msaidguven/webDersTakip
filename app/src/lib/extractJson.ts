// AI (Gemini/NotebookLM) çıktısı LaTeX komutları/parantezleri (\times, \frac, \rightarrow,
// \binom, \(, \), \[, \], \sqrt, \alpha ...) içerdiğinde JSON string'i içine ters eğik
// çizgiyi kaçırmadan (çift \\ yapmadan) yazıyor. Geçerli JSON kaçış dizisi SADECE şunlardır:
// \" \\ \/ \b \f \n \r \t \uXXXX — bunun dışında kalan her ters eğik çizgi JSON.parse'ı ya
// direkt "Bad escaped character" ile patlatıyor (\(, \[ gibi hiç geçerli olmayanlar —
// kullanıcının 2026-09-12 "generate-practice-question" worker loglarında \( \) formatı
// eklendikten SONRA gördüğü hata) ya da harfi sessizce yutuyor (\times → "imes" gibi, kaçış
// harfi tesadüfen t/b/r/f olduğunda — 2026-09-09 "2imes5"/"rac59" bozukluğu). \n bunun
// dışında: bu alanlarda GERÇEK satır sonu olarak yoğun kullanılıyor (ardından her zaman
// normal metin/harf gelir), bu yüzden \n hiçbir zaman dokunulmadan bırakılıyor — ama \t/\b/
// \r/\f hemen ardından bir harf geldiğinde (LaTeX komutunun devamı, ör. "\frac"taki "rac")
// GEÇERSİZ sayılıp ikiye katlanıyor; harf gelmiyorsa (gerçek tab/backspace/CR/form-feed
// ihtimaline karşı) dokunulmuyor.
function fixUnescapedLatexBackslashes(jsonText: string): string {
  return jsonText.replace(
    /\\(u[0-9a-fA-F]{4}|n|["\\/]|[tbrf](?![A-Za-z]))?/g,
    (match, valid) => (valid ? match : '\\\\')
  );
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
