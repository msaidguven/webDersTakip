// Tam sayıyı Türkçe okunuşuna çevirir: 7806015239 → "yedi milyar sekiz yüz altı milyon on beş bin
// iki yüz otuz dokuz". Sesli anlatımda binlik gruplu sayıları (7 806 015 239 / 300.000) TTS'e
// bırakmamak için (Elif sesi grupları ayrı sayılar gibi okuyordu, 2026-10-03). Türkçe kuralları:
// "bir yüz" değil "yüz", "bir bin" değil "bin"; milyon ve üstünde "bir milyon".
const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
const SCALES = ['', 'bin', 'milyon', 'milyar', 'trilyon', 'katrilyon'];

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  return [h === 0 ? '' : h === 1 ? 'yüz' : `${ONES[h]} yüz`, TENS[t], ONES[o]].filter(Boolean).join(' ');
}

export function turkishNumberWords(digits: string): string {
  const clean = digits.replace(/^0+(?=\d)/, '');
  if (!/^\d+$/.test(clean)) return digits;
  if (/^0+$/.test(clean)) return 'sıfır';
  if (clean.length > SCALES.length * 3) return digits; // çok büyük — olduğu gibi bırak
  const groups: number[] = [];
  for (let end = clean.length; end > 0; end -= 3) groups.unshift(Number(clean.slice(Math.max(0, end - 3), end)));
  const words: string[] = [];
  groups.forEach((g, i) => {
    if (g === 0) return;
    const scale = SCALES[groups.length - 1 - i];
    const part = scale === 'bin' && g === 1 ? '' : threeDigits(g);
    words.push([part, scale].filter(Boolean).join(' '));
  });
  return words.join(' ');
}
