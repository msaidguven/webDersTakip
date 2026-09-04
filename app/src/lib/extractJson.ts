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
  return JSON.parse(jsonSlice);
}
