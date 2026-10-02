// Sağlayıcıdan bağımsız ses yardımcıları. Tüm TTS motorları 24 kHz 16-bit mono PCM döndürür;
// kırpma/MP3 kodlama/zamanlama bu ortak biçim üzerinden çalışır.
export const TTS_SAMPLE_RATE = 24000;

// Baştaki/sondaki sessizliği kırpar (kısa pay bırakarak) — grup zamanlaması tahmini bu sayede
// cümlenin gerçek başlangıcına oturur, ekranlar arası geçişte de ölü bekleme kalmaz.
export function trimSilence(pcm: Int16Array, threshold = 500, padSeconds = 0.06): Int16Array {
  const pad = Math.round(padSeconds * TTS_SAMPLE_RATE);
  let start = 0;
  let end = pcm.length - 1;
  while (start < end && Math.abs(pcm[start]) < threshold) start++;
  while (end > start && Math.abs(pcm[end]) < threshold) end--;
  return pcm.subarray(Math.max(0, start - pad), Math.min(pcm.length, end + pad));
}
