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

// Bir alanın içindeki birden fazla satırı (İçerik Çerçevesi gibi virgül/satır ayraçlı
// listeler) düz metin dizisine çevirir.
function extractFieldLines(html: string, label: string, splitOn: 'br' | 'comma'): string[] {
  const raw = extractFieldHtml(html, label);
  if (!raw) return [];
  const normalized = raw.replace(/<\/p>\s*<p>/gi, '<br>').replace(/<\/?p>/gi, '');
  const parts = splitOn === 'br' ? normalized.split(/<br\s*\/?>/i) : [normalized];
  const lines = splitOn === 'comma' ? plainText(parts[0]).split(',') : parts.map(plainText);
  return lines.map((s) => s.trim()).filter(Boolean);
}

// "Anahtar Kavramlar" alanı bazı derslerde (Matematik gibi) düz bir virgüllü liste değil —
// TYMM'in KENDİ satır başlığıyla (dışarıdaki "Anahtar Kavramlar" etiketiyle) aynı isimde
// bir alt başlık dahil <strong>Genellemeler</strong> / <strong>Anahtar Kavramlar</strong> /
// <strong>Sembol ve Gösterimler</strong> diye üçe bölünmüş oluyor. Bunu görmeden tüm alanı
// tek liste sayıp virgülle bölmek, Genellemeler'in madde imli cümlelerini ve Sembol ve
// Gösterimler'i de "anahtar kavram" diye yutup birbirine karıştırıyordu (2026-09-09 kullanıcı
// bildirimi, Matematik 7 "Geometrik Şekiller"). Alt başlık yapısı varsa SADECE "Anahtar
// Kavramlar" alt başlığının altını alıyoruz; yoksa (basit derslerde) eski düz-liste davranışı.
function extractKeyConcepts(html: string): string[] {
  const raw = extractFieldHtml(html, 'Anahtar Kavramlar');
  if (!raw) return [];
  const normalized = raw.replace(/<\/p>\s*<p>/gi, '<br>').replace(/<\/?p>/gi, '');

  const headers = [...normalized.matchAll(/<strong>\s*([\s\S]*?)\s*<\/strong>/gi)].map((m) => ({
    label: plainText(m[1]).toLowerCase(),
    start: m.index!,
    contentStart: m.index! + m[0].length,
  }));
  const kavramIdx = headers.findIndex((h) => h.label === 'anahtar kavramlar');
  const section =
    kavramIdx === -1
      ? normalized
      : normalized.slice(headers[kavramIdx].contentStart, kavramIdx + 1 < headers.length ? headers[kavramIdx + 1].start : normalized.length);

  return plainText(section)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '-');
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

// N öğeyi M kovaya, hiçbirini bölmeden ve SIRAYI bozmadan, mümkün olduğunca eşit dağıtır —
// kalan öğeler ilk kovalardan başlanarak dağıtılır (ör. 4 öğe/3 kova → [2,1,1]).
function distributeIntoBuckets<T>(items: T[], bucketCount: number): T[][] {
  const base = Math.floor(items.length / bucketCount);
  const remainder = items.length % bucketCount;
  const buckets: T[][] = [];
  let idx = 0;
  for (let b = 0; b < bucketCount; b++) {
    const size = base + (b < remainder ? 1 : 0);
    buckets.push(items.slice(idx, idx + size));
    idx += size;
  }
  return buckets;
}

// Kod: "DKAB.5.1.1" gibi tek harf bloklu, ama "T.D.5.3" gibi (Türkçe'nin
// Dinleme/Okuma/Konuşma/Yazma alt kodları) birden fazla nokta ayraçlı harf bloklu da
// olabiliyor — sondaki rakam grubu her zaman en az bir tane. Harf bloğuyla ilk rakam
// grubu arasındaki nokta bilerek OPSİYONEL (\.?) — TYMM'in kendi sayfasında bu nokta
// bazen unutuluyor (ör. Bilişim Teknolojileri 7. sınıf, "6. Tema" ünitesinde "BTY6.6.3."
// yazılmış, doğrusu "BTY.6.6.3." olmalıydı, 2026-09-09 kullanıcı bildirimi) — nokta
// zorunlu tutulunca o kazanım hiç eşleşmiyor, kazanım sayısı İçerik Çerçevesi satır
// sayısıyla uyuşmuyor ve konu başlıkları yanlış (uzun kazanım cümlesi) düşüyordu.
const OUTCOME_CODE_CORE = '[A-ZÇĞİÖŞÜa-z]+(?:\\.[A-ZÇĞİÖŞÜa-z]+)*\\.?\\d+(?:\\.\\d+)*';
// Türkçe temalarında (ve muhtemelen diğer "temaya yönelik" derslerde) süreç bileşeni
// (a) b) c)) yok — birden fazla öğrenme çıktısı aynı satıra <br> olmadan, sadece boşlukla
// ayrılmış şekilde art arda geliyor (ör. "T.D.5.3. ... T.D.5.4. ..."). Bu yüzden satır
// başında tek kod aramak yetmiyor; satırın tamamında kaç kod varsa o kadar öğrenme çıktısı
// çıkarıyoruz.
const OUTCOME_CODE_GLOBAL_RE = new RegExp(`(${OUTCOME_CODE_CORE})\\.\\s*`, 'g');

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

  // Türkçe temaları gibi ("Süreç Detaylı Öğretim Programı") bazı derslerde a)/b)/c) süreç
  // bileşeni hiç yok — bunun yerine düz bir "beceri alanı" başlığı (ör. "Dinleme/İzleme",
  // "Okuma") altında birden fazla kod art arda sıralanıyor. Böyle bir başlık gördüğümüzde
  // "grup modu"na geçip sonraki kodları, o başlık konu (topic) olacak şekilde onun süreç
  // bileşeni gibi ekliyoruz — aksi halde her kod kendi başına bir konu olur ama hiç
  // kazanımı (outcomes satırı) olmaz, çünkü DB'ye yazılan kazanımlar components'ten gelir.
  let activeGroup: RawLearningOutcome | null = null;

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

    // Öğrenme çıktısı/çıktıları: "FB.5.7.1.1. metin" gibi bir veya daha fazla kodla
    // başlar — satırda kaç kod varsa metni o kadar parçaya bölüyoruz.
    const codeMatches = [...plain.matchAll(OUTCOME_CODE_GLOBAL_RE)];
    if (codeMatches.length && codeMatches[0].index === 0) {
      const segments = codeMatches
        .map((m, i) => {
          const textStart = m.index! + m[0].length;
          const textEnd = i + 1 < codeMatches.length ? codeMatches[i + 1].index! : plain.length;
          return { code: m[1], text: plain.slice(textStart, textEnd).trim() };
        })
        .filter((s) => s.text);

      if (activeGroup) {
        for (const s of segments) activeGroup.components.push({ letter: s.code, text: s.text });
      } else if (segments.length === 1) {
        outcomes.push({ code: segments[0].code, title: segments[0].text, components: [] });
      } else if (segments.length > 1) {
        // Grup başlığı görmeden aynı satırda birden fazla kod — beklenmedik ama veriyi
        // kaybetmemek için ilk kodu başlık, gerisini süreç bileşeni gibi ekliyoruz.
        const [first, ...rest] = segments;
        outcomes.push({ code: first.code, title: first.text, components: rest.map((s) => ({ letter: s.code, text: s.text })) });
      }
      continue;
    }

    // Sadece kalın (<strong>) ve kısa bir satır — süreç bileşeni içermeyen düz kod
    // listesi formatlarındaki "beceri alanı" başlığı.
    if (plain.length <= 40 && /^<strong>[\s\S]*<\/strong>$/i.test(rawLine)) {
      activeGroup = { code: '', title: plain, components: [] };
      outcomes.push(activeGroup);
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
  const keyConcepts = extractKeyConcepts(html);
  const { outcomes: rawOutcomes, unmatched: unmatchedLines } = parseLearningOutcomes(html);

  // İçerik Çerçevesi bazı derslerde (ör. Matematik) düz bir liste değil — "Kesirlerle
  // İşlemler:" gibi sonu ":" ile biten bir GRUP BAŞLIĞI satırı, altındaki alt konuları
  // (kendi öğrenme çıktısı olmayan, sadece kategori) topluyor; asıl öğrenme çıktısı sayısı
  // sadece alt konularla eşleşiyor. Bu satırlar direkt sayıca eşleşmeyince eleniyor —
  // eşleşme sağlarsa (başlıksız) liste kullanılıyor, sağlamazsa (ör. bir çerçeve satırı
  // birden fazla öğrenme çıktısını kapsıyorsa — TYMM sayfasında bunu ayıran bir yapı yok)
  // eski davranışa (öğrenme çıktısı cümlesini başlık say) düşülüp admin'e uyarı basılıyor.
  const withoutGroupHeaders = contentFramework.filter((line) => !line.trim().endsWith(':'));
  const effectiveFramework =
    contentFramework.length === rawOutcomes.length
      ? contentFramework
      : withoutGroupHeaders.length === rawOutcomes.length
        ? withoutGroupHeaders
        : null;

  // KONU sayısı DB'de her zaman İçerik Çerçevesi'ne eşit olmalı — orası TYMM'in kendi konu
  // listesi (bkz. proje sohbeti: "içerik çerçevesi ile konular aynı olmalı", 2026-09-09).
  // Yukarıdaki birebir eşleşme başarısız olduğunda, öğrenme çıktısı SAYISI çerçeve satır
  // sayısından FAZLAYSA (Matematik'te çok görülüyor: bir çerçeve konusu birden fazla
  // öğrenme çıktısını kapsıyor ama sayfa bunu ayırt eden bir yapı sunmuyor), art arda gelen
  // öğrenme çıktısı gruplarını (hiçbirini bölmeden, koddan koda bütün halde) sırayla çerçeve
  // konularına dağıtıp konu sayısını çerçeveyle eşitliyoruz — sınır tahmini olduğu için admin
  // bilgilendiriliyor ama en azından konu sayısı/başlıkları artık TYMM'deki gibi doğru.
  // Tersi (çerçeve satırı öğrenme çıktısından FAZLA) durumda güvenli bir bölüştürme yok —
  // bir öğrenme çıktısı grubunu ikiye bölmek anlamsız olur — o yüzden eski (uzun cümle)
  // davranışa düşülüp uyarı basılıyor.
  let learningOutcomes: TymmLearningOutcome[];
  if (effectiveFramework) {
    learningOutcomes = rawOutcomes.map((o, i) => ({ ...o, topicTitle: effectiveFramework[i] }));
  } else if (withoutGroupHeaders.length > 0 && withoutGroupHeaders.length < rawOutcomes.length) {
    const buckets = distributeIntoBuckets(rawOutcomes, withoutGroupHeaders.length);
    learningOutcomes = buckets.map((group, i) => ({
      code: group.map((o) => o.code).filter(Boolean).join(' / '),
      title: group.map((o) => o.title).join(' '),
      topicTitle: withoutGroupHeaders[i],
      components: group.flatMap((o) => o.components),
    }));
    if (rawOutcomes.length > withoutGroupHeaders.length) {
      unmatchedLines.push(
        `${withoutGroupHeaders.length} içerik çerçevesi konusuna ${rawOutcomes.length} öğrenme çıktısı sırayla gruplanarak dağıtıldı (TYMM sayfasında kesin sınır bilgisi yok) — grup sınırlarını kontrol edin.`
      );
    }
  } else {
    if (contentFramework.length > 0 && rawOutcomes.length > 0) {
      unmatchedLines.push(
        `İçerik Çerçevesi satır sayısı (${contentFramework.length}) ile öğrenme çıktısı sayısı (${rawOutcomes.length}) uyuşmuyor — konu başlıkları TYMM'deki kısa başlık yerine öğrenme çıktısı cümlesinden alındı, elle düzeltin.`
      );
    }
    learningOutcomes = rawOutcomes.map((o) => ({ ...o, topicTitle: o.title }));
  }

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
