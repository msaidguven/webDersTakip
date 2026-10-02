// Ekranda görünen metni TTS'in doğru okuyacağı biçime çevirir. Ekran metni değişmez; sadece
// seslendirilen metin dönüştürülür (ör. "=TOPLA(A1:A5)" ekranda formül olarak kalır, ses
// "eşittir TOPLA parantez aç A1 iki nokta üst üste A5 parantez kapat" der).

import { turkishNumberWords } from './turkishNumber';

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

// Sayı ve matematik okunuşu (2026-10-03, iki sesle de dinlenip yazıya dökülerek tespit edildi):
// - Binlik gruplu sayılar (7 806 015 239, 300.000) yazıyla verilir — Elif grupları ayrı sayılar gibi
//   okuyordu. buildScript bu sayıları tek parça tutar (araya bölme girmesin), ayırıcı nbsp olabilir.
// - Ondalık "4,24" → "4 virgül 24" (Elif virgülü yutuyordu; "80, 70" gibi listeler etkilenmez).
// - Üsler: x² → "x kare", 5³ → "5 küp", 2^3 / 2⁴ → "2 üssü 3/4" (Ahmet üssü tamamen düşürüyordu).
// - Negatif sayı: "-26", "(-3)" → "eksi 26" (Ahmet eksiyi düşürüyordu). "5-8" gibi aralıklar etkilenmez.
// - Tek başına "=" → "eşittir"; "a-b", "x-1" → "a eksi b" (eksi için SOL taraf harf olmalı ki
//   "5-8. sınıf" gibi aralıklar etkilenmesin); "a+b", "2+3" → "artı". "e-posta" gibi tireli
//   kelimeler etkilenmez (iki taraf da tek karakter olmalı).
// Kesir (1/4) ve romen rakamlarını (XIX.) Ahmet doğru okuyor — dokunulmadı.
const GROUPED_NUMBER_RE = /(?<![\p{L}\p{N}.,])(\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d{1,3}(?:\.\d{3})+)(?![\p{N}]|[.,]\d)/gu;
const DECIMAL_RE = /(?<![\p{N}.,])(\d+),(\d+)(?![\p{N}])/gu;
const SUPERSCRIPT_DIGITS: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const POWER_RE = /([\p{L}\p{N})])(?:\^\(?(-?\d+)\)?|([⁰¹²³⁴⁵⁶⁷⁸⁹]+))/gu;
const NEGATIVE_RE = /(^|[\s(\[])[-−](?=\d)/gu;
const LONE_EQUALS_RE = /(^|\s)=(?=\s|$)/g;
const SINGLE_MINUS_RE = /(?<![\p{L}\p{N}])(\p{L})\s?[-−]\s?([\p{L}\p{N}])(?![\p{L}\p{N}])/gu;
const SINGLE_PLUS_RE = /(?<![\p{L}\p{N}])([\p{L}\p{N}])\s?\+\s?([\p{L}\p{N}])(?![\p{L}\p{N}])/gu;

function speakPower(_m: string, base: string, caret?: string, sup?: string): string {
  const exp = caret ?? [...(sup ?? '')].map((c) => SUPERSCRIPT_DIGITS[c] ?? '').join('');
  if (exp === '2') return `${base} kare`;
  if (exp === '3') return `${base} küp`;
  return `${base} üssü ${exp.startsWith('-') ? `eksi ${exp.slice(1)}` : exp}`;
}

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
    .replace(GROUPED_NUMBER_RE, (m: string) => turkishNumberWords(m.replace(/[ \u00a0\u202f.]/g, '')))
    .replace(DECIMAL_RE, '$1 virgül $2')
    .replace(POWER_RE, speakPower)
    .replace(NEGATIVE_RE, '$1eksi ')
    .replace(LONE_EQUALS_RE, '$1eşittir')
    .replace(SINGLE_MINUS_RE, '$1 eksi $2')
    .replace(SINGLE_PLUS_RE, '$1 artı $2')
    .replace(WORD_SLASH_RE, '$1 ya da $2')
    .replace(PAREN_ACRONYM_RE, '')
    .replace(DIGIT_LETTER_RE, (_m, num: string, letter: string) => `${num} ${TR_LETTER_NAMES[letter] ?? letter}`)
    .replace(UPPER_WORD_RE, (w: string) => speakUpperWord(w))
    .replace(/\s{2,}/g, ' ')
    // Formül sonundaki virgül cümle noktalamasıyla çakışmasın: "kapat,." → "kapat."
    .replace(/,\s*([.;:!?,])/g, '$1')
    .trim();
}
