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
  try {
    return JSON.parse(fixUnescapedLatexBackslashes(jsonSlice));
  } catch (e) {
    // Model JSON'dan sonra ikinci bir nesne/metin ekleyince ("Unexpected non-whitespace character after JSON",
    // 2026-11 konu 574) ilk dengeli nesne okunur.
    const firstObject = start >= 0 ? balancedObject(candidate, start) : null;
    if (!firstObject || firstObject.length === jsonSlice.length) throw e;
    return JSON.parse(fixUnescapedLatexBackslashes(firstObject));
  }
}

// start'taki '{' ile eşleşen '}'e kadar olan metin (string içindeki parantezler ve kaçışlar sayılmaz).
function balancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}
