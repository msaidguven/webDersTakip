// Ekranda görünen metni TTS'in doğru okuyacağı biçime çevirir. Ekran metni değişmez; sadece
// seslendirilen metin dönüştürülür (ör. "=TOPLA(A1:A5)" ekranda formül olarak kalır, ses
// "eşittir TOPLA parantez aç A1 iki nokta üst üste A5 parantez kapat" der).

const SYMBOL_WORDS: Record<string, string> = {
  '=': 'eşittir',
  '(': 'parantez aç',
  ')': 'parantez kapat',
  ':': 'iki nokta üst üste',
  '+': 'artı',
  '-': 'eksi',
  '*': 'çarpı',
  '/': 'bölü',
  ';': 'noktalı virgül',
  '<': 'küçüktür',
  '>': 'büyüktür',
};

const CELL = '[A-ZÇĞİÖŞÜ]{1,3}\\d{1,5}';
const FORMULA_RE = /(^|\s)(=[^\s]+?)([.,;]?)(?=\s|$)/g;
const RANGE_RE = new RegExp(`\\b(${CELL}):(${CELL})\\b`, 'g');
// "artı (+)", "eşittir (=) işareti" — sembol zaten sözcükle söylenmiş, parantezdeki sembol okunmaz.
const SYMBOL_IN_PARENS_RE = /\s*\(\s*[=+\-*/<>]\s*\)/g;
// "sütun/çubuk" → "sütun ya da çubuk" (sayı/hücre bölmeleri formül içinde ele alınıyor).
const WORD_SLASH_RE = /([a-zçğıöşü]{2,})\/([a-zçğıöşü]{2,})/giu;

// Kısaltmalar (2026-10-02, "TÜRKSAT 3A, TÜRKSAT 4B…" cümlesi yanlış okunuyordu):
// - Okunabilen büyük harfli adlar (en az 4 harf, 2+ ünlü: TÜRKSAT, GÖKTÜRK, TÜBİTAK, TEKNOFEST,
//   NASA) kelime gibi yazılır → TTS harf harf/yabancı vurguyla okumaz. Ünsüz yığını (HTML, GPS)
//   ve kısa kısaltmalar (DNA, MAK) olduğu gibi kalır.
// - Rakam+harf ("3A", "4B") Türkçe harf adıyla ayrılır ("3 A", "4 Be") — "B" İngilizce okunmasın.
// - Az önce söylenen adın parantez içi kısaltması ("Türkiye Uzay Ajansı (TUA)") okunmaz.
const UPPER = 'A-ZÇĞİÖŞÜ';
const PAREN_ACRONYM_RE = new RegExp(`\\s*\\([${UPPER}]{2,7}\\)`, 'gu');
const DIGIT_LETTER_RE = new RegExp(`(?<![\\p{L}\\p{N}])(\\d+)([${UPPER}])(?![\\p{L}\\p{N}])`, 'gu');
const UPPER_WORD_RE = new RegExp(`(?<![\\p{L}\\p{N}])([${UPPER}]{4,})(?![\\p{L}\\p{N}])`, 'gu');
const TR_LETTER_NAMES: Record<string, string> = {
  A: 'A', B: 'Be', C: 'Ce', Ç: 'Çe', D: 'De', E: 'E', F: 'Fe', G: 'Ge', Ğ: 'Yumuşak Ge', H: 'He', I: 'I', İ: 'İ',
  J: 'Je', K: 'Ke', L: 'Le', M: 'Me', N: 'Ne', O: 'O', Ö: 'Ö', P: 'Pe', R: 'Re', S: 'Se', Ş: 'Şe', T: 'Te',
  U: 'U', Ü: 'Ü', V: 'Ve', Y: 'Ye', Z: 'Ze',
};

function speakUpperWord(word: string): string {
  const vowels = word.match(/[AEIİOÖUÜ]/g)?.length ?? 0;
  return vowels >= 2 ? word[0] + word.slice(1).toLocaleLowerCase('tr') : word;
}

// Parantezler virgülle ayrılır ("eşittir TOPLA, parantez aç, A1 … A5, parantez kapat,") —
// virgülsüz okunuşta Elif HD formülün ortasında takılıyordu (2026-10-02 dinleme testi).
function spellFormula(formula: string): string {
  const out: string[] = [];
  let buf = '';
  const flush = () => { if (buf) { out.push(buf); buf = ''; } };
  for (const ch of formula) {
    const word = SYMBOL_WORDS[ch];
    if (!word) { buf += ch; continue; }
    flush();
    out.push(ch === '(' || ch === ')' ? `, ${word},` : word);
  }
  flush();
  return out.join(' ').replace(/\s+,/g, ',').replace(/,(\s*,)+/g, ',').replace(/^,\s*/, '');
}

export function toSpeech(display: string): string {
  return display
    .replace(SYMBOL_IN_PARENS_RE, '')
    .replace(FORMULA_RE, (_m, pre: string, formula: string, punct: string) => `${pre}${spellFormula(formula)}${punct}`)
    .replace(RANGE_RE, '$1 iki nokta üst üste $2')
    .replace(WORD_SLASH_RE, '$1 ya da $2')
    .replace(PAREN_ACRONYM_RE, '')
    .replace(DIGIT_LETTER_RE, (_m, num: string, letter: string) => `${num} ${TR_LETTER_NAMES[letter] ?? letter}`)
    .replace(UPPER_WORD_RE, (w: string) => speakUpperWord(w))
    .replace(/\s{2,}/g, ' ')
    // Formül sonundaki virgül cümle noktalamasıyla çakışmasın: "kapat,." → "kapat."
    .replace(/,\s*([.;:!?,])/g, '$1')
    .trim();
}
