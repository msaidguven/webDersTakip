// Kelime zaman damgası vermeyen TTS'ler için grup başlangıç zamanı tahmini: ses cümle başına ayrı
// üretildiği için cümle sınırları kesin; cümle içindeki gruplar seslendirilen metnin uzunluğuna
// (+ noktalama duraklamasına) orantılı dağıtılır. Sessizlik üretimde kırpıldığından sapma küçük.

const PAUSE_WEIGHT: [RegExp, number][] = [[/[.!?]$/, 8], [/[;:]$/, 7], [/,$/, 5]];
const LEAD_IN = 0.05;

export function estimateChunkStarts(chunkSpeech: string[], duration: number): number[] {
  const weights = chunkSpeech.map((s) => {
    const letters = s.replace(/[^\p{L}\p{N}]/gu, '').length + s.split(/\s+/).length;
    return letters + (PAUSE_WEIGHT.find(([re]) => re.test(s))?.[1] ?? 0);
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(0, duration - LEAD_IN);
  let acc = 0;
  return weights.map((w) => {
    const start = LEAD_IN + (acc / total) * span;
    acc += w;
    return Math.round(start * 100) / 100;
  });
}
