// app/src/lib/tymm/tymmParser.ts
// tymm.meb.gov.tr ünite sayfalarının (Türkiye Yüzyılı Maarif Modeli — MEB'in yeni müfredat
// portalı) HTML'ini regex tabanlı, deterministik (AI'sız) olarak ayrıştırır. Sayfa yapısı
// çok düzenli — her alan `<div class="col-md-3 ... title">ALAN</div><div class="col-md-9
// ... content">DEĞER</div>` çifti şeklinde — bu yüzden tam bir HTML parser kütüphanesine
// gerek yok; iki gerçek ünite sayfasıyla (Fen Bilimleri, Din Kültürü) test edildi.
//
// Önemli: sayfa yapısı derse göre küçük farklılıklar gösterebiliyor (ör. süreç bileşeni
// harfleri bazı derslerde <strong>a)</strong> olarak kalın, bazılarında düz metin) —
// bu yüzden sınıflandırma HER ZAMAN etiketleri temizlenmiş düz metin üzerinden yapılır,
// ham HTML üzerinden değil.

export type TymmProcessComponent = { letter: string; text: string };
// `title` öğrenme çıktısının kendi (uzun) cümlesi — "code. title" birleşimi DB'de topics.
// learning_outcome olarak saklanır. `topicTitle` ise DB'de topics.title olacak, İçerik
// Çerçevesi'ndeki karşılık gelen kısa başlık (ör. "İnsanlara Rehber: Peygamber") — sayfada
// İçerik Çerçevesi satır sayısı öğrenme çıktısı sayısıyla aynıysa sırayla eşleniyor, aksi
// halde (nadir) öğrenme çıktısı cümlesine düşülüyor.
export type TymmLearningOutcome = { code: string; title: string; topicTitle: string; components: TymmProcessComponent[] };
export type TymmUnit = {
  unitNumber: number | null;
  unitTitle: string;
  lessonName: string | null;
  gradeLabel: string | null;
  durationHours: number | null;
  contentFramework: string[];
  keyConcepts: string[];
  learningOutcomes: TymmLearningOutcome[];
};

const ENTITY_MAP: Record<string, string> = {
  acirc: 'â', Acirc: 'Â', amp: '&', Ccedil: 'Ç', ccedil: 'ç', icirc: 'î', Icirc: 'Î', nbsp: ' ',
  Ouml: 'Ö', ouml: 'ö', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', Uuml: 'Ü', uuml: 'ü',
  lt: '<', gt: '>', quot: '"', apos: "'",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => ENTITY_MAP[name] ?? m);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

export function plainText(s: string): string {
  return decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim();
}

// "ALAN" satır başlığının hemen sağındaki content div'in HAM içeriğini (etiketler dahil)
// döner — süreç bileşenlerini ayrıştırmak için <strong>/<br> yapısını bilerek koruyoruz.
function extractFieldHtml(html: string, label: string): string | null {
  const re = new RegExp(
    `<div class="col-md-3 bg-light p-2 title">\\s*${label}\\s*</div>\\s*<div class="col-md-9 p-2 content"[^>]*>([\\s\\S]*?)</div>\\s*</div>`
  );
  return re.exec(html)?.[1] ?? null;
}

function extractFieldText(html: string, label: string): string | null {
  const raw = extractFieldHtml(html, label);
  return raw != null ? plainText(raw) : null;
}

// Bir alanın içindeki birden fazla satırı (İçerik Çerçevesi, Anahtar Kavramlar gibi
// virgül/satır ayraçlı listeler) düz metin dizisine çevirir.
function extractFieldLines(html: string, label: string, splitOn: 'br' | 'comma'): string[] {
  const raw = extractFieldHtml(html, label);
  if (!raw) return [];
  const normalized = raw.replace(/<\/p>\s*<p>/gi, '<br>').replace(/<\/?p>/gi, '');
  const parts = splitOn === 'br' ? normalized.split(/<br\s*\/?>/i) : [normalized];
  const lines = splitOn === 'comma' ? plainText(parts[0]).split(',') : parts.map(plainText);
  return lines.map((s) => s.trim()).filter(Boolean);
}

// Bir alanın HAM (ayrıştırılmamış) düz metnini, satır satır — admin'in bizim
// ayrıştırdığımız/düzenlediği veriyle canlı TYMM sayfasının o bölümünü kafasından
// karşılaştırmadan yan yana kontrol edebilmesi için (bkz. proje sohbeti: sadece o
// bölümün "ekran görüntüsü" gibi ama metin olarak). Stil önemli değil, okunabilir olması
// yeterli — bu yüzden tam bir HTML render'ı yerine düz metne indiriyoruz.
function rawFieldText(html: string, label: string): string {
  const raw = extractFieldHtml(html, label);
  if (!raw) return '';
  const lines = raw
    .replace(/<\/p>\s*<p>/gi, '<br>')
    .replace(/<\/?p>/gi, '')
    .split(/<br\s*\/?>/i)
    .map(plainText)
    .filter(Boolean);
  return lines.join('\n');
}

type RawLearningOutcome = Omit<TymmLearningOutcome, 'topicTitle'>;

function parseLearningOutcomes(html: string): { outcomes: RawLearningOutcome[]; unmatched: string[] } {
  const outcomesHtml = extractFieldHtml(html, 'Öğrenme Çıktıları ve Süreç Bileşenleri');
  if (!outcomesHtml) return { outcomes: [], unmatched: [] };

  // Paragraf sınırları her zaman <br> ile ayrılmıyor (bazı derslerde </p><p> arasında
  // fazladan bir <br> daha var, bazılarında yok) — </p><p> geçişini de her zaman bir
  // satır sonu sayıyoruz, aksi halde bir öğrenme çıktısının son bileşeni ile bir
  // sonrakinin kod satırı, aradaki ham satır sonu yüzünden tek satıra yapışıp kaynaşır.
  const lines = outcomesHtml
    .replace(/<\/p>\s*<p>/gi, '<br>')
    .replace(/<\/?p>/gi, '')
    .split(/<br\s*\/?>/i)
    .map((l) => l.trim())
    .filter(Boolean);

  const outcomes: RawLearningOutcome[] = [];
  const unmatched: string[] = [];

  for (const rawLine of lines) {
    const plain = plainText(rawLine);
    if (!plain) continue;
    if (/^\d+\.\s*Bölüm/i.test(plain)) continue; // "1. Bölüm: ..." — dekoratif, kaydetmiyoruz

    // Süreç bileşeni: "a) metin" — kalın olsun olmasın, sınıflandırma her zaman düz
    // metin üzerinden yapılır (bkz. dosya başı açıklaması).
    const compMatch = /^([a-zçğıöşü])\)\s*(.+)$/i.exec(plain);
    if (compMatch && outcomes.length) {
      outcomes[outcomes.length - 1].components.push({ letter: compMatch[1].toLowerCase(), text: compMatch[2].trim() });
      continue;
    }

    // Öğrenme çıktısı: "FB.5.7.1.1. metin" gibi bir kod ile başlar.
    const outcomeMatch = /^([A-ZÇĞİÖŞÜa-z]+\.\d+(?:\.\d+)*)\.\s*(.+)$/.exec(plain);
    if (outcomeMatch) {
      outcomes.push({ code: outcomeMatch[1], title: outcomeMatch[2].trim(), components: [] });
      continue;
    }

    unmatched.push(plain);
  }

  return { outcomes, unmatched };
}

// TYMM'den çektiğimiz üç alanın HAM (ayrıştırılmamış) metni — karşılaştırma panelinde
// canlı sayfanın tamamı yerine sadece bunları göstermek için.
export type TymmRawSections = { contentFramework: string; keyConcepts: string; learningOutcomes: string };

export type ParseTymmResult = { unit: TymmUnit; unmatchedLines: string[]; rawSections: TymmRawSections };

export function parseTymmUnitHtml(html: string): ParseTymmResult {
  // h1 artık `<h1 class="unite-detail__title">` gibi öznitelikli geliyor (TYMM sayfa
  // yenilemesi sonrası) — `[^>]*` olmadan hiç eşleşmiyor ve ünite adı boş kalıyordu.
  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  const h1 = h1Match ? plainText(h1Match[1]) : '';
  // Derse göre "N. ÜNİTE: ..." (Fen, Din), "N. ÖĞRENME ALANI: ..." (Sosyal Bilgiler) veya
  // "N. TEMA: ..." (Bilişim, Matematik, Türkçe) başlığı kullanılıyor — hepsini kapsıyoruz.
  // "İ" harfi için [İIiı] kullanıyoruz: JS regex /i bayrağı büyük noktalı İ'yi küçük i'ye
  // eşit saymıyor (case-fold'u "i̇" oluyor), bu yüzden düz "ÜNİTE" başlık artık title-case
  // ("Ünite") geldiğinde eşleşmiyordu.
  const unitNumberMatch = /^(\d+)\.\s*(?:[UÜuü]N[İIiı]TE|ÖĞRENME ALANI|TEMA)\s*:?\s*(.*)$/i.exec(h1);
  const unitNumber = unitNumberMatch ? Number(unitNumberMatch[1]) : null;
  const unitTitle = unitNumberMatch ? unitNumberMatch[2].trim() : h1;

  // Ders adı ve sınıf artık ayrı <span class="unite-detail__meta-item"> öğelerinde
  // (eskiden tek bir "/ogretim-programlari/ders/..." linki içindeydi) — sırasıyla kitap
  // ikonlu (ders) ve mezuniyet kepli ikonlu (sınıf) span.
  const metaItemRe = /<span class="unite-detail__meta-item">([\s\S]*?)<\/span>/g;
  const metaItems: string[] = [];
  let metaMatch: RegExpExecArray | null;
  while ((metaMatch = metaItemRe.exec(html))) metaItems.push(plainText(metaMatch[1]));
  const lessonName = metaItems[0] || null;
  const gradeLabel = metaItems[1] || null;

  const durationText = extractFieldText(html, 'Ders Saati');
  const durationHours = durationText ? Number(durationText.match(/\d+/)?.[0] ?? '') : null;

  const contentFramework = extractFieldLines(html, 'İçerik Çerçevesi', 'br');
  const keyConcepts = extractFieldLines(html, 'Anahtar Kavramlar', 'comma');
  const { outcomes: rawOutcomes, unmatched: unmatchedLines } = parseLearningOutcomes(html);
  const learningOutcomes: TymmLearningOutcome[] = rawOutcomes.map((o, i) => ({
    ...o,
    topicTitle: contentFramework.length === rawOutcomes.length ? contentFramework[i] : o.title,
  }));

  return {
    unit: {
      unitNumber,
      unitTitle,
      lessonName,
      gradeLabel,
      durationHours: Number.isFinite(durationHours) ? durationHours : null,
      contentFramework,
      keyConcepts,
      learningOutcomes,
    },
    unmatchedLines,
    rawSections: {
      contentFramework: rawFieldText(html, 'İçerik Çerçevesi'),
      keyConcepts: rawFieldText(html, 'Anahtar Kavramlar'),
      learningOutcomes: rawFieldText(html, 'Öğrenme Çıktıları ve Süreç Bileşenleri'),
    },
  };
}
