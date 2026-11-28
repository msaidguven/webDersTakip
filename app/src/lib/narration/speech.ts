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
// "artı (+)", "eşittir (=) işareti", "üs alma (^)", "iki nokta üst üste (:)" — sembol zaten
// sözcükle söylenmiş, parantezdeki sembol okunmaz.
const SYMBOL_IN_PARENS_RE = /\s*\(\s*[=+\-*/<>^:;]\s*\)/g;
// Birim/bölme ifadeleri WORD_SLASH_RE'den önce ele alınır (aksi halde "metre/saniye" → "metre ya da saniye" olur).
const UNIT_SLASH_RULES: [RegExp, string][] = [
  [/\bmetre\/saniye\s*\(\s*m\/s\s*\)/giu, 'metre bölü saniye'],
  [/\bkilometre\/saat\s*\(\s*km\/sa?\s*\)/giu, 'kilometre bölü saat'],
  [/\bkilometre\/saat\s*\(\s*km\/h\s*\)/giu, 'kilometre bölü saat'],
  [/\bmetre\/saniye\b/giu, 'metre bölü saniye'],
  [/\bkilometre\/saat\b/giu, 'kilometre bölü saat'],
  [/(?<![\p{L}\p{N}])m\/s(?![\p{L}\p{N}])/gu, 'metre bölü saniye'],
  [/(?<![\p{L}\p{N}])km\/(?:h|sa)(?![\p{L}\p{N}])/gu, 'kilometre bölü saat'],
  // Ölçü birimleri (sayı ardından gelen kısa birimler)
  [/(?<=\d\.?\s+)sn(?![\p{L}])/gu, 'saniye'],
  [/(?<=\d\.?\s+)dk\.?(?![\p{L}])/gu, 'dakika'],
  [/(?<=\d\s+)mL(?![\p{L}])/gu, 'mililitre'],
  [/(?<=\d\s+)cL(?![\p{L}])/gu, 'santilitre'],
  [/(?<=\d\s+)dL(?![\p{L}])/gu, 'desilitre'],
  [/(?<=\d\s+)cm(?![\p{L}])/gu, 'santimetre'],
  [/(?<=\d\s+)mm(?![\p{L}])/gu, 'milimetre'],
  [/(?<=\d\s+)km(?![\p{L}])/gu, 'kilometre'],
  [/(?<=\d\s+)kg(?![\p{L}])/gu, 'kilogram'],
  [/(?<=\d\s+)mg(?![\p{L}])/gu, 'miligram'],
  // Tek başına geçen hacim/sıvı birimleri (cL, dL, mL)
  [/(?<![\p{L}\p{N}])mL(?![\p{L}\p{N}])/gu, 'mililitre'],
  [/(?<![\p{L}\p{N}])cL(?![\p{L}\p{N}])/gu, 'santilitre'],
  [/(?<![\p{L}\p{N}])dL(?![\p{L}\p{N}])/gu, 'desilitre'],
];
// Din dersi ve genel Türkçe kısaltmalar (Azure TTS kısaltmaları harfleyerek veya kesik okuyor).
const ABBREV_RULES: [RegExp, string][] = [
  [/(?<![\p{L}])Hz\.(?=\s|$)/gu, 'Hazreti'],
  [/(?<![\p{L}])Prof\.(?=\s|$)/gu, 'Profesör'],
  [/(?<![\p{L}])Dr\.(?=\s|$)/gu, 'Doktor'],
  [/\(\s*s\.?\s*a\.?\s*v\.?\s*\)/giu, 'sallallahu aleyhi ve sellem'],
  [/(?<![\p{L}])s\.a\.v\.(?=\s|$)/giu, 'sallallahu aleyhi ve sellem'],
  [/\(\s*a\.?\s*s\.?\s*\)/giu, 'aleyhisselam'],
  [/\(\s*r\.?\s*a\.?\s*\)/giu, 'radıyallahu anh'],
  [/\(\s*c\.?\s*c\.?\s*\)/giu, 'celle celalühü'],
  [/(?<![\p{L}])vb\.(?=\s|$|[),;:])/giu, 've benzeri'],
  [/(?<![\p{L}])vd\.(?=\s|$|[),;:])/giu, 've diğerleri'],
  [/(?<![\p{L}])örn\.(?=\s|$)/giu, 'örneğin'],
  [/(?<![\p{L}])bkz\.(?=\s|$)/giu, 'bakınız'],
  [/(?<![\p{L}])yy\.(?=\s|$|[),;:])/giu, 'yüzyıl'],
  [/(?<![\p{L}])M\.?Ö\.?(?=\s+\d)/gu, 'milattan önce'],
  [/(?<![\p{L}])M\.?S\.?(?=\s+\d)/gu, 'milattan sonra'],
];
// Yabancı marka, teknoloji ve bilim terimleri (Azure Türkçe sesi İngilizce/karma adları bozuk okuyor).
const PRONUNCIATION_RULES: [RegExp, string | ((...args: string[]) => string)][] = [
  [/\bDuckDuckGo\b/gi, 'Dak Dak Go'],
  [/\bGarageBand\b/gi, 'Garaj Bend'],
  [/\bmacOS\b/g, 'Mek O Es'],
  [/\bWindows\b/gi, 'Vindovs'],
  [/\bLinux\b/gi, 'Linuks'],
  [/\bYandex\b/gi, 'Yandeks'],
  [/\bWilliam\b/g, 'Vilyım'],
  [/\bGoogle\b/gi, 'Gugıl'],
  [/\bYouTube\b/gi, 'Yutub'],
  [/\bWhatsApp\b/gi, 'Vatsap'],
  [/\bPowerPoint\b/gi, 'Pavırpoynt'],
  [/\bExcel\b/gi, 'Eksel'],
  [/\bAudacity\b/gi, 'Odasiti'],
  [/\bChrome\b/gi, 'Krom'],
  [/\bFirefox\b/gi, 'Fayırfoks'],
  [/\bEdge\b/g, 'Eç'],
  [/\bfiletype:/gi, 'fayl tayp iki nokta'],
  [/\bsite:/gi, 'site iki nokta'],
  [/(?<![\p{L}\p{N}])\.pdf(?![\p{L}\p{N}])/giu, 'nokta pe de fe'],
  [/(?<![\p{L}\p{N}])\.doc(?![\p{L}\p{N}])/giu, 'nokta dok'],
  [/(?<![\p{L}\p{N}])WAV(?![\p{L}\p{N}])/gu, 'vav'],
  [/(?<![\p{L}\p{N}])OGG(?![\p{L}\p{N}])/gu, 'og'],
  [/(?<![\p{L}\p{N}])MP3(?![\p{L}\p{N}])/giu, 'em pe üç'],
  [/(?<![\p{L}\p{N}])MP4(?![\p{L}\p{N}])/giu, 'em pe dört'],
  [/(?<![\p{L}\p{N}])CD(?![\p{L}\p{N}])/gu, 'si di'],
  [/(?<![\p{L}\p{N}])SUM(?![\p{L}\p{N}])/gu, 'sam'],
  [/(?<![\p{L}\p{N}])rRNA(?![\p{L}\p{N}])/gu, 're R N A'],
  [/(?<![\p{L}\p{N}])MEB(?![\p{L}\p{N}])/gu, 'Meb'],
  [/(?<![\p{L}\p{N}])EBA(?![\p{L}\p{N}])/gu, 'Eba'],
  [/(?<![\p{L}\p{N}])MAK(?![\p{L}\p{N}])/gu, 'Mak'],
  [/(?<![\p{L}\p{N}])MİN(?![\p{L}\p{N}])/gu, 'Min'],
  // "x1000" gibi çarpma ön eki
  [/(?<![\p{L}\p{N}])[x×](\d+)(?![\p{L}\p{N}])/gu, (_m: string, d: string) => `çarpı ${turkishNumberWords(d)}`],
];
// "sütun/çubuk" → "sütun ya da çubuk" (sayı/hücre bölmeleri ve birimler önceden ele alınıyor).
const WORD_SLASH_RE = /([a-zçğıöşü]{2,})\/([a-zçğıöşü]{2,})/giu;
// Türkçe dil bilgisi ek gösterimleri: "-da/-de" → "da ya da de", "-mak" → "mak", "sev-" → "sev".
// Negatif sayılar (-26) ve bileşik kelimeler (e-posta) etkilenmez.
const SUFFIX_PAIR_RE = /(?<![\p{L}\p{N}])-([a-zçğıöşü]{1,5})-?\s*\/\s*-([a-zçğıöşü]{1,5})-?(?![\p{L}\p{N}])/giu;
const LEADING_SUFFIX_RE = /(?<![\p{L}\p{N}])-([a-zçğıöşü]{1,5})(?![\p{L}\p{N}-])/giu;
const TRAILING_ROOT_HYPHEN_RE = /(?<![\p{L}\p{N}])([a-zçğıöşü]{2,})-(?![\p{L}\p{N}])/giu;
// Metin içi semboller: "&" → "ve", "→" ve "|" → doğal duraklama (virgül).
const AMPERSAND_RE = /(\s)&(\s)/g;
const ARROW_OR_PIPE_RE = /\s*[→|]\s*/g;
// Boşluklu toplama ve çarpma ("2 000 000 + 100 000", "2 * a^2", "a * b * c").
const SPACED_PLUS_RE = /(?<=\S)\s+\+\s+(?=\S)/g;
const SPACED_TIMES_RE = /(?<=\S)\s+\*\s+(?=\S)/g;
// Noktasız 5+ basamaklı büyük sayılar (ör. 44100, 345345345; 4 basamaklı yıllara dokunmaz).
const PLAIN_BIG_NUMBER_RE = /(?<![\p{L}\p{N}.,])\d{5,}(?![\p{N}.,])/gu;

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

// Parantez içi Romen rakamları: "(I)", "(II)", "(III)", "(IV)"… (Türkçe/paragraf sorularında numaralanmış
// sözcük ve cümleler). PAREN_ACRONYM_RE'den önce ele alınır ki "(II)", "(III)", "(IV)" kısaltma sanılıp
// silinmesin, "(I)" da Azure TTS tarafından "ı" harfi gibi okunmasın.
// Tek harfli "(I)", "(V)", "(X)" yalnız metinde en az 2 parantez içi Romen rakamı (veya çok harfli bir
// Romen rakamı) varsa sayıya çevrilir; böylece "İyot (I)", "Gerilim (V)" gibi fen/kimya sembolleri bozulmaz.
const ROMAN_WORDS: Record<string, string> = {
  I: 'bir',
  II: 'iki',
  III: 'üç',
  IV: 'dört',
  V: 'beş',
  VI: 'altı',
  VII: 'yedi',
  VIII: 'sekiz',
  IX: 'dokuz',
  X: 'on',
  XI: 'on bir',
  XII: 'on iki',
};
const ROMAN_PAREN_RE = /\s*\(\s*(XII|XI|IX|VIII|VII|VI|IV|III|II|X|V|I)\s*\)/g;
const MULTI_ROMAN_PAREN_RE = /\(\s*(?:XII|XI|IX|VIII|VII|VI|IV|III|II)\s*\)/;

function replaceRomanInParens(text: string): string {
  if (!ROMAN_PAREN_RE.test(text)) return text;
  ROMAN_PAREN_RE.lastIndex = 0;
  // Tek harfli (I)/(V)/(X) yalnız metinde çok harfli bir Romen rakamı ((II), (III), (IV)…)
  // da varsa sayıya çevrilir; "İyot (I)" veya "Gerilim (V) ile akım (I)" gibi fen sembolleri bozulmaz.
  const hasSeries = MULTI_ROMAN_PAREN_RE.test(text);
  return text.replace(ROMAN_PAREN_RE, (full, roman: string) => {
    if (roman.length === 1 && !hasSeries) return full;
    const word = ROMAN_WORDS[roman];
    return word ? `, ${word},` : full;
  });
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
  let out = display
    .replace(SYMBOL_IN_PARENS_RE, '')
    .replace(FORMULA_RE, (_m, pre: string, formula: string, punct: string) => `${pre}${spellFormula(formula)}${punct}`)
    .replace(RANGE_RE, '$1 iki nokta üst üste $2');
  for (const [re, rep] of ABBREV_RULES) out = out.replace(re, rep);
  for (const [re, rep] of UNIT_SLASH_RULES) out = out.replace(re, rep);
  for (const [re, rep] of PRONUNCIATION_RULES) {
    out = typeof rep === 'string' ? out.replace(re, rep) : out.replace(re, rep);
  }
  out = out
    .replace(GROUPED_NUMBER_RE, (m: string) => turkishNumberWords(m.replace(/[ \u00a0\u202f.]/g, '')))
    .replace(PLAIN_BIG_NUMBER_RE, (m: string) => turkishNumberWords(m))
    // "bin iki yüz'dür" → "bin iki yüzdür" (sayı yazıya dönünce kesme işareti doğal akışı bozmasın).
    .replace(/([\p{L}]+)'([\p{L}]+)/gu, (m: string, word: string, suf: string) =>
      /^(?:sıfır|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|elli|altmış|yetmiş|seksen|doksan|yüz|bin|milyon|milyar|trilyon)$/i.test(word)
        ? `${word}${suf}`
        : m,
    )
    .replace(DECIMAL_RE, '$1 virgül $2')
    .replace(POWER_RE, speakPower)
    .replace(NEGATIVE_RE, '$1eksi ')
    .replace(LONE_EQUALS_RE, '$1eşittir')
    .replace(SPACED_TIMES_RE, ' çarpı ')
    .replace(SPACED_PLUS_RE, ' artı ')
    .replace(SINGLE_MINUS_RE, '$1 eksi $2')
    .replace(SINGLE_PLUS_RE, '$1 artı $2')
    .replace(AMPERSAND_RE, '$1ve$2')
    .replace(ARROW_OR_PIPE_RE, ', ');
  out = replaceRomanInParens(out);
  return out
    .replace(SUFFIX_PAIR_RE, '$1 ya da $2')
    .replace(LEADING_SUFFIX_RE, '$1')
    .replace(TRAILING_ROOT_HYPHEN_RE, '$1')
    .replace(WORD_SLASH_RE, '$1 ya da $2')
    .replace(PAREN_ACRONYM_RE, '')
    .replace(DIGIT_LETTER_RE, (_m, num: string, letter: string) => `${num} ${TR_LETTER_NAMES[letter] ?? letter}`)
    .replace(UPPER_WORD_RE, (w: string) => speakUpperWord(w))
    .replace(/\s{2,}/g, ' ')
    // Formül veya parantez içi Romen rakamı çevirisinden kalan kenar virgüllerini temizle:
    // "kapat,." → "kapat.", ". , iki," → ". iki,", ", bir, Sabah" → "bir, Sabah"
    .replace(/([.!?:])\s*,\s*/g, '$1 ')
    .replace(/,\s*([.;:!?,])(?=\s|$)/g, '$1')
    .replace(/^,\s*/, '')
    .trim();
}
