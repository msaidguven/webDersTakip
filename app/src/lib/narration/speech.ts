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

function spellFormula(formula: string): string {
  const out: string[] = [];
  let buf = '';
  const flush = () => { if (buf) { out.push(buf); buf = ''; } };
  for (const ch of formula) {
    const word = SYMBOL_WORDS[ch];
    if (word) { flush(); out.push(word); } else buf += ch;
  }
  flush();
  return out.join(' ');
}

export function toSpeech(display: string): string {
  return display
    .replace(SYMBOL_IN_PARENS_RE, '')
    .replace(FORMULA_RE, (_m, pre: string, formula: string, punct: string) => `${pre}${spellFormula(formula)}${punct}`)
    .replace(RANGE_RE, '$1 iki nokta üst üste $2')
    .replace(WORD_SLASH_RE, '$1 ya da $2')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
