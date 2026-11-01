// AI'dan kopyalanan SVG çoğu zaman ```svg kod bloğu ya da <?xml …?> başlığıyla gelir (prompt kodu kod bloğunda
// istiyor, bkz. svgPromptRules.ts): yalnız <svg>…</svg> kısmı alınır. Bulunamazsa metin olduğu gibi döner.
// Hem önizleme (sanitizeSvg.ts, client) hem kayıt (admin route'ları, server) kullanır.
export function extractSvgMarkup(raw: string): string {
  const text = raw.trim();
  const start = text.indexOf('<svg');
  const end = text.lastIndexOf('</svg>');
  return start >= 0 && end > start ? text.slice(start, end + '</svg>'.length) : text;
}
