// app/src/lib/tymm/compareUnits.ts
// DB'deki ünite/konu/kazanımları, canlı TYMM sayfasından çekilmiş güncel veriyle
// karşılaştırıp fark raporu üretir — hiçbir şey yazmaz, sadece okur.
//
// KASITLI OLARAK TAHMİN/HESAP YOK (kullanıcının 2026-09-20 isteği: "kontrol et sayfası
// tahmin etmesin, hesap yapmasın, sadece öğrenme çıktıları ve kazanımlar doğru sırada ve
// sayıda eşleşiyor mu ona baksın"). Eskiden bir konuda TYMM sayfasının çerçeve/çıktı sayısı
// uyuşmadığında (ör. 4 konuya 6 öğrenme çıktısı) fazlalığı hangi konuya vereceğimizi
// ALGORİTMA ile TAHMİN ediyorduk (distributeIntoBuckets) — ama bu tahmin her canlı
// yeniden çekişte FARKLI çıkabiliyordu (DB'deki gerçek/onaylanmış yerleşimle uyuşmuyordu),
// bu da tamamen doğru içeriği "farklı" gibi gösteriyordu (2026-09-20 kullanıcı bildirimi,
// Matematik 6 "Geometrik Nicelikler" ünitesi). Artık öğrenme çıktısı eşleştirmesi TAHMİNE
// dayalı "hangi konu" sorusuna hiç girmiyor — doğrudan TYMM'in kendi verdiği KOD'a (ör.
// "MAT.6.4.4") bakıp DB'deki topic_learning_outcomes.code ile eşliyor, kodun hangi
// konunun altında olduğu DB'nin kendi kararı (importUnit.ts / admin'in taşıması) —
// karşılaştırma bunu SORGULAMIYOR, sadece o kod altındaki kazanımların sırayla ve sayıca
// aynı olup olmadığına bakıyor.
//
// Metin kıyası da artık "harfi harfine" değil FUZZY: boşluk/noktalama farkları ve Türkçe
// noktalı/noktasız I/İ/ı/i karışıklığı (ör. "Varsayımı" vs "Varsayımi") görmezden
// geliniyor — bkz. fuzzyNorm. Yapısal eşleştirme (konu/ünite başlığı, kod) hâlâ norm()
// (tam metin, sadece boşluk/büyük-küçük harf normalize) kullanıyor, çünkü oradaki "ufak
// tefek" tolerans yanlış konuyu doğru sanmaya yol açabilir — sadece KAZANIM/ÖĞRENME ÇIKTISI
// METNİ karşılaştırmasında fuzzy davranıyoruz.
//
// "overrides" (outcome_id -> admin'in doğru kabul ettiği tymm metni, bkz.
// outcome_tymm_overrides tablosu): metin eşleşmese bile admin bir kez "doğru kabul et"
// dediyse bir daha "farklı" olarak işaretlenmez, sadece "overridden" listesine düşer.

import type { TymmUnit, TymmLearningOutcome } from './tymmParser';

export type DbOutcome = { id: number; code: string | null; description: string };
// Bir konunun (topic) kendi öğrenme çıktısı grubu — bkz. topic_learning_outcomes migration'ı.
// Sadece BUNDAN SONRA TYMM'den aktarılan üniteler dolduruyor; eski/gruplanmamış konularda
// bu dizi boş gelir ve diffTopics eski (tüm konuyu tek havuz sayan) davranışa düşer.
export type DbLearningOutcomeGroup = { id: number; code: string | null; title: string; outcomes: DbOutcome[] };
export type DbTopic = { id: number; title: string; learning_outcome: string | null; outcomes: DbOutcome[]; learningOutcomeGroups?: DbLearningOutcomeGroup[] };
export type DbUnit = { id: number; title: string; duration_hours: number | null; key_concepts: string[] | null; topics: DbTopic[] };
export type OverrideMap = Map<number, string>;

// Bir konunun İÇİNDEKİ tek bir öğrenme çıktısının kendi karşılaştırması — kullanıcının
// 2026-09-20 isteği: "Kontrol Et sayfasında kazanımların üstünde öğrenme çıktıları da
// hiyerarşik görünmeli". Konu birden fazla öğrenme çıktısı içerebildiği için (bkz.
// topic_learning_outcomes notu) TopicDiff'in outcomesAdded/Removed/Overridden'ı bunların
// DÜZ (flatten) toplamı, asıl doğru/ayrıntılı kıyas burada.
export type LearningOutcomeDiff = {
  code: string;
  title: string;
  status: 'same' | 'changed' | 'tymm-only' | 'db-only';
  dbGroupId: number | null;
  learningOutcomeChanged: boolean;
  // learningOutcomeChanged true olduğunda ASIL fark budur — eskiden bu iki metin
  // hesaplanıp hemen atılıyordu, UI'da "öğrenme çıktısı metni değişmiş" yazıyordu ama
  // eski/yeni metnin kendisi hiçbir yerde görünmüyordu (kullanıcının 2026-09-24 bildirimi:
  // "Geometrik Şekiller ... 1 konu/kazanım farklı ... fark nerede").
  dbLearningOutcomeText: string | null;
  tymmLearningOutcomeText: string | null;
  outcomesAdded: string[];
  outcomesRemoved: DbOutcome[];
  outcomesOverridden: DbOutcome[];
  tymmOutcomeTexts: string[];
};

export type TopicDiff = {
  status: 'same' | 'changed' | 'tymm-only' | 'db-only';
  title: string;
  dbTopicId: number | null;
  learningOutcomeChanged: boolean;
  dbLearningOutcomeText: string | null;
  tymmLearningOutcomeText: string | null;
  // Konunun öğrenme çıktısı grupları TYMM sırasıyla — DB'de henüz gruplanmamış (eski) bir
  // konuysa boş dizi gelir, UI o zaman aşağıdaki düz outcomesAdded/Removed'a düşer.
  learningOutcomeDiffs: LearningOutcomeDiff[];
  // Tüm learningOutcomeDiffs'in DÜZ toplamı — eski (gruplama öncesi) UI kodu hâlâ bunu okuyor.
  outcomesAdded: string[];
  // id taşıyor (sadece metin değil) — admin karşılaştırma ekranından doğrudan bu kazanımı
  // düzenleyebilsin diye (kullanıcının 2026-09-20 isteği: "karşılaştırıp manuel düzenleme
  // yapabileceğim bi sayfa").
  outcomesRemoved: DbOutcome[];
  // Metin eşleşmiyor ama admin "doğru kabul et" demiş — UI bunu ayrı, daha az alarm verici
  // gösterip "zorla doğru kabul edildi" notu ekliyor.
  outcomesOverridden: DbOutcome[];
  // Bu konu için TYMM'deki TÜM kazanım metinleri — bir admin bir kazanımı düzenleyip
  // kaydettiğinde, yeni metnin gerçekten eşleşip eşleşmediğini CANLI kontrol edebilmek için
  // (kullanıcının 2026-09-20 isteği: "kaydet dediğimde otomatik yeşil oluyor ... canlı
  // kontrol edemez mi").
  tymmOutcomeTexts: string[];
};

export type UnitDiff = {
  status: 'same' | 'changed' | 'tymm-only' | 'db-only';
  tymmUrl: string;
  tymmTitle: string;
  dbUnitId: number | null;
  dbUnitTitle: string | null;
  durationHoursChanged: boolean;
  keyConceptsAdded: string[];
  keyConceptsRemoved: string[];
  topics: TopicDiff[];
};

// SADECE öğrenme çıktısı KODU eşleştirmesinde kullanılır. Canlı TYMM parser'ı kodu SONDAKİ
// NOKTA OLMADAN üretiyor (ör. "FB.5.5.1", bkz. tymmParser.ts OUTCOME_CODE_GLOBAL_RE), ama
// eski bir import yolu bazı topic_learning_outcomes.code değerlerini sondaki noktayla
// kaydetmiş ("FB.5.5.1."). norm() bunu ELEMİYOR (sadece boşluk/büyük-küçük harf), bu yüzden
// "fb.5.5.1." !== "fb.5.5.1" olup TÜM kod eşleştirmesi başarısız oluyordu — içerik birebir
// aynı olsa bile ünitenin HER konusu "farklı" görünüyordu (kullanıcının 2026-09-25 bildirimi:
// "5. sınıf fen 5. ünite neden eşleşmiyor halbuki birebir aynı" — Maddenin Doğası ünitesinin
// 4 konusunun da kodu ".": ile bitiyordu). Bu sadece bir NOKTALAMA normalizasyonu, fuzzyNorm
// gibi içerik toleransı DEĞİL — yapısal eşleştirmenin "az tefek" tolere etmemesi gereken
// riski taşımıyor.
function normCode(s: string): string {
  // norm() zaten baştaki/sondaki ve aradaki fazla boşluğu temizliyor; buradaki ek adım
  // sadece kodun başında/sonunda kalmış nokta(lar)ı atıyor.
  return norm(s).replace(/^\.+|\.+$/g, '');
}

// .normalize('NFC') GÜVENLİK AĞI: tymmParser.ts'nin plainText() fonksiyonu artık kendi
// çıktısını NFC'ye normalize ediyor, ama DB'de bu düzeltmeden ÖNCE kaydedilmiş satırlar
// (ör. farklı bir yoldan, NFD Türkçe karakterlerle girilmiş) hâlâ olabilir — burada da
// normalize etmek, kaynak fark etmeksizin iki tarafın hep aynı bayt dizisiyle
// kıyaslanmasını garantiler (bkz. tymmParser.ts plainText() üstündeki not, kullanıcının
// 2026-09-25 bildirimi: NFD "ç" (c + ̧) ile NFC "ç" görsel olarak aynı ama === ile hiç
// eşleşmiyordu).
export function norm(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase().normalize('NFC');
}

// SADECE ünite başlığı eşleştirmesinde kullanılır. TYMM zaman zaman ünite başlığının başına
// "1. Öğrenme Alanı: ", "2. Ünite: " gibi bir sıra numarası + etiket ekliyor; DB'deki ünite
// bu önek olmadan kayıtlı olduğu için salt norm() ile birebir eşleşme başarısız oluyor ve
// (kullanıcının 2026-09-22 bulduğu bug) mevcut ünite yerine YEPYENİ, mükerrer bir ünite
// oluşturuluyordu. Her iki taraftan da bu öneği (varsa) atıyoruz ki DB'de öneksiz/önekli
// hangi şekilde kayıtlıysa olsun eşleşsin.
export function normUnitTitleForMatch(s: string): string {
  return norm(s).replace(/^\d+\s*[.)]\s*[^:]{1,60}:\s*/, '');
}

// normUnitTitleForMatch'in aksine BÜYÜK/KÜÇÜK HARFİ KORUYARAK aynı öneki atar — yeni bir
// ünite ilk kez oluşturulurken DB'ye "1. Öğrenme Alanı: Birlikte Yaşamak" gibi çirkin/
// tutarsız bir başlık YAZILMASIN diye (parser normalde bu öneki zaten ayıklıyor, bkz.
// tymmParser.ts unitNumberMatch — bu sadece o ayıklama bir sebeple başarısız olursa devreye
// giren bir güvenlik ağı).
export function stripUnitTitleNumberPrefix(s: string): string {
  const trimmed = s.trim().replace(/\s+/g, ' ');
  return trimmed.replace(/^\d+\s*[.)]\s*[^:]{1,60}:\s*/, '').trim() || trimmed;
}

// SADECE kazanım/öğrenme çıktısı METNİ karşılaştırmasında kullanılır (yapısal eşleştirmede
// — konu/ünite başlığı, kod — DEĞİL). norm()'a ek olarak: noktalama işaretlerini atar ve
// Türkçe noktalı/noktasız I/İ/ı/i farkını yok sayar (ör. "Varsayımı" ile "Varsayımi" aynı
// sayılır) — kullanıcının 2026-09-20 isteği: "ufak tefek boşluk, harf, nokta vb karakterleri
// ihmal edebiliyorsa etsin".
export function fuzzyNorm(s: string): string {
  return norm(s)
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/[.,;:!?'"()\-–—]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function setDiff(tymmList: string[], dbList: string[]): { added: string[]; removed: string[] } {
  const tymmNorm = new Map(tymmList.map((s) => [norm(s), s]));
  const dbNorm = new Map(dbList.map((s) => [norm(s), s]));
  const added = [...tymmNorm.entries()].filter(([k]) => !dbNorm.has(k)).map(([, v]) => v);
  const removed = [...dbNorm.entries()].filter(([k]) => !tymmNorm.has(k)).map(([, v]) => v);
  return { added, removed };
}

// Bir öğrenme çıktısının a/b/c... kazanımlarını, TAHMİN/gruplama YAPMADAN, SIRAYA göre
// kıyaslar — kullanıcının isteği: "sadece doğru sırada ve sayıda eşleşiyor mu ona baksın".
// DB tarafı `order_index`'e göre sıralı geliyor (bkz. compare-bulk route'taki sort).
//
// SAF indeks eşleştirmesi (tymm[i] ↔ db[i]) DEĞİL, LCS (en uzun ortak alt dizi) tabanlı
// hizalama kullanılıyor: kaydetme sırasında ARADA bir kazanım atlanmışsa (ör. TYMM a,b,c,d,e
// iken DB'ye sadece a,b,d,e yazılmışsa) saf indeks eşleştirmesi c'den sonraki HER pozisyonu
// kaydırıp d'yi ve e'yi de "farklı" gösteriyor, atlanan c ise hiçbir yerde "eklenebilir"
// olarak görünmüyordu — admin'in gerçekten eksik olan kazanımı ekleyecek bir alanı hiç
// olmuyordu (kullanıcının 2026-09-24 bildirimi: "1 kazanımı eklememiş atlamış ama onu
// ekleyebileceğim bi alan yok"). LCS hizalaması ortadaki tek bir ekleme/çıkarmayı, ondan
// SONRAKİ eşleşen kazanımları bozmadan doğru tanır.
function diffOutcomesPositional(
  tymmTexts: string[],
  dbOutcomes: DbOutcome[],
  overrides: OverrideMap
): { added: string[]; removed: DbOutcome[]; overridden: DbOutcome[] } {
  const n = tymmTexts.length;
  const m = dbOutcomes.length;
  const eq = (i: number, j: number) => fuzzyNorm(tymmTexts[i]) === fuzzyNorm(dbOutcomes[j].description);

  // n*m küçük (bir öğrenme çıktısının a/b/c kazanımları), O(n*m) DP burada sorun değil.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(i, j) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const added: string[] = [];
  const removed: DbOutcome[] = [];
  const overridden: DbOutcome[] = [];
  const dropDb = (d: DbOutcome) => (overrides.has(d.id) ? overridden.push(d) : removed.push(d));

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(i, j)) { i++; j++; continue; }
    if (dp[i + 1][j] >= dp[i][j + 1]) { added.push(tymmTexts[i]); i++; }
    else { dropDb(dbOutcomes[j]); j++; }
  }
  while (i < n) { added.push(tymmTexts[i]); i++; }
  while (j < m) { dropDb(dbOutcomes[j]); j++; }

  return { added, removed, overridden };
}

// setDiffOutcomes ile aynı (set bazlı, sırasız) mantık — sadece eski/gruplanmamış konularda
// (topic_learning_outcomes hiç yoksa, dolayısıyla güvenilir bir sıra anchor'ı da yoksa)
// kullanılıyor; metin kıyası yine fuzzy.
function setDiffOutcomes(
  tymmList: string[],
  dbOutcomes: DbOutcome[],
  overrides: OverrideMap
): { added: string[]; removed: DbOutcome[]; overridden: DbOutcome[] } {
  const tymmNormSet = new Set(tymmList.map(fuzzyNorm));
  const dbNormSet = new Set(dbOutcomes.map((o) => fuzzyNorm(o.description)));
  const added = tymmList.filter((s) => !dbNormSet.has(fuzzyNorm(s)));
  const removed: DbOutcome[] = [];
  const overridden: DbOutcome[] = [];
  for (const o of dbOutcomes) {
    if (tymmNormSet.has(fuzzyNorm(o.description))) continue;
    if (overrides.has(o.id)) overridden.push(o);
    else removed.push(o);
  }
  return { added, removed, overridden };
}

// Bir DB öğrenme çıktısı grubunu, TYMM'de AYNI KODA sahip öğrenme çıktısıyla kıyaslar —
// hangi konunun altında olduğu sorusuna hiç girmiyor (o zaten DB'nin kendi kararı), sadece
// kod eşleşince kazanımların sırayla/sayıca aynı olup olmadığına bakıyor.
function diffLearningOutcomeByCode(dbGroup: DbLearningOutcomeGroup, tymmLo: TymmLearningOutcome | undefined, overrides: OverrideMap): LearningOutcomeDiff {
  if (!tymmLo) {
    const removed: DbOutcome[] = [];
    const overridden: DbOutcome[] = [];
    for (const o of dbGroup.outcomes) {
      if (overrides.has(o.id)) overridden.push(o);
      else removed.push(o);
    }
    return {
      code: dbGroup.code || '',
      title: dbGroup.title,
      status: 'db-only',
      dbGroupId: dbGroup.id,
      learningOutcomeChanged: false,
      dbLearningOutcomeText: null,
      tymmLearningOutcomeText: null,
      outcomesAdded: [],
      outcomesRemoved: removed,
      outcomesOverridden: overridden,
      tymmOutcomeTexts: [],
    };
  }
  const tymmOutcomeTexts = tymmLo.components.map((c) => c.text);
  const learningOutcomeText = tymmLo.code ? `${tymmLo.code}. ${tymmLo.title}` : tymmLo.title;
  const dbLearningOutcomeText = dbGroup.code ? `${dbGroup.code}. ${dbGroup.title}` : dbGroup.title;
  const { added, removed, overridden } = diffOutcomesPositional(tymmOutcomeTexts, dbGroup.outcomes, overrides);
  const learningOutcomeChanged = fuzzyNorm(dbLearningOutcomeText) !== fuzzyNorm(learningOutcomeText);
  const same = added.length === 0 && removed.length === 0 && !learningOutcomeChanged;
  return {
    code: tymmLo.code,
    title: tymmLo.title,
    status: same ? 'same' : 'changed',
    dbGroupId: dbGroup.id,
    learningOutcomeChanged,
    dbLearningOutcomeText: learningOutcomeChanged ? dbLearningOutcomeText : null,
    tymmLearningOutcomeText: learningOutcomeChanged ? learningOutcomeText : null,
    outcomesAdded: added,
    outcomesRemoved: removed,
    outcomesOverridden: overridden,
    tymmOutcomeTexts,
  };
}

function diffTopics(tymmUnit: TymmUnit, dbTopics: DbTopic[], overrides: OverrideMap): TopicDiff[] {
  const result: TopicDiff[] = [];

  // Ünite genelinde KOD → TYMM öğrenme çıktısı haritası — konu ataması burada hiç
  // kullanılmıyor, sadece "bu kod TYMM'de hâlâ var mı, kazanımları aynı mı" sorusuna
  // cevap arıyoruz. Kodu olmayan (nadir "beceri alanı" grup başlığı) öğrenme çıktıları bu
  // haritaya girmez, aşağıda ayrıca ele alınır.
  const tymmByCode = new Map<string, TymmLearningOutcome>();
  for (const lo of tymmUnit.learningOutcomes) {
    if (lo.code) tymmByCode.set(normCode(lo.code), lo);
  }
  const matchedTymmCodes = new Set<string>();

  // TYMM'in kendi topicTitle tahmini SADECE şu durumda kullanılıyor: DB'de hiçbir konuya
  // ait grup bu kodu taşımıyor (gerçekten yeni bir öğrenme çıktısı). O zaman anchor
  // olabilecek DB verisi yok, elde TYMM'in kendi (tahmine dayalı) konu ataması kalıyor.
  for (const dbTopic of dbTopics) {
    const dbGroups = dbTopic.learningOutcomeGroups || [];

    if (dbGroups.length === 0) {
      // Eski/gruplanmamış konu — kod bilgisi hiç yok, tek çare eski (topicTitle eşleşmesine
      // dayalı, sırasız/fuzzy) davranış. TYMM'in konu tahmini burada hâlâ devrede çünkü
      // başka bir anchor yok — bu, henüz yeni yapıya taşınmamış eski verinin bilinen sınırı.
      const los = tymmUnit.learningOutcomes.filter((lo) => norm(lo.topicTitle) === norm(dbTopic.title));
      const combinedTexts = los.flatMap((lo) => lo.components.map((c) => c.text));
      const { added, removed, overridden } = setDiffOutcomes(combinedTexts, dbTopic.outcomes, overrides);
      const combinedLearningOutcomeText = los.map((lo) => (lo.code ? `${lo.code}. ${lo.title}` : lo.title)).join(' ');
      const learningOutcomeChanged = fuzzyNorm(dbTopic.learning_outcome || '') !== fuzzyNorm(combinedLearningOutcomeText);
      const same = added.length === 0 && removed.length === 0 && !learningOutcomeChanged;
      result.push({
        status: same ? 'same' : 'changed',
        title: dbTopic.title,
        dbTopicId: dbTopic.id,
        learningOutcomeChanged,
        dbLearningOutcomeText: learningOutcomeChanged ? dbTopic.learning_outcome || '' : null,
        tymmLearningOutcomeText: learningOutcomeChanged ? combinedLearningOutcomeText : null,
        learningOutcomeDiffs: [],
        outcomesAdded: added,
        outcomesRemoved: removed,
        outcomesOverridden: overridden,
        tymmOutcomeTexts: combinedTexts,
      });
      continue;
    }

    // Yeni (gruplanmış) konu — hangi konuya ait olduğu sorgulanmıyor, DB'nin kendi kararı
    // esas alınıyor; her grup KENDİ KODUYLA TYMM'de aranıp sırayla/sayıca kıyaslanıyor.
    const learningOutcomeDiffs = dbGroups.map((g) => {
      const tymmLo = g.code ? tymmByCode.get(normCode(g.code)) : undefined;
      if (tymmLo && g.code) matchedTymmCodes.add(normCode(g.code));
      return diffLearningOutcomeByCode(g, tymmLo, overrides);
    });
    const topicSame = learningOutcomeDiffs.every((d) => d.status === 'same');
    result.push({
      status: topicSame ? 'same' : 'changed',
      title: dbTopic.title,
      dbTopicId: dbTopic.id,
      learningOutcomeChanged: learningOutcomeDiffs.some((d) => d.learningOutcomeChanged),
      // Gruplanmış konuda asıl metin farkı learningOutcomeDiffs[i]'nin kendi
      // dbLearningOutcomeText/tymmLearningOutcomeText'inde — topic seviyesinde birden
      // fazla öğrenme çıktısı olabileceği için tek bir metin çiftine indirgenmiyor.
      dbLearningOutcomeText: null,
      tymmLearningOutcomeText: null,
      learningOutcomeDiffs,
      outcomesAdded: learningOutcomeDiffs.flatMap((d) => d.outcomesAdded),
      outcomesRemoved: learningOutcomeDiffs.flatMap((d) => d.outcomesRemoved),
      outcomesOverridden: learningOutcomeDiffs.flatMap((d) => d.outcomesOverridden),
      tymmOutcomeTexts: learningOutcomeDiffs.flatMap((d) => d.tymmOutcomeTexts),
    });
  }

  // Kodu olup HİÇBİR DB grubunda karşılığı bulunmayan öğrenme çıktıları — gerçekten yeni.
  // Anchor olacak DB verisi olmadığı için TYMM'in kendi (tahmine dayalı) topicTitle'ına göre
  // gruplanıp ayrı "tymm-only" satırlar olarak gösteriliyor.
  const unmatched = tymmUnit.learningOutcomes.filter((lo) => !lo.code || !matchedTymmCodes.has(normCode(lo.code)));
  const unmatchedOrder: string[] = [];
  const unmatchedByTopicTitle = new Map<string, TymmLearningOutcome[]>();
  for (const lo of unmatched) {
    if (!unmatchedByTopicTitle.has(lo.topicTitle)) {
      unmatchedOrder.push(lo.topicTitle);
      unmatchedByTopicTitle.set(lo.topicTitle, []);
    }
    unmatchedByTopicTitle.get(lo.topicTitle)!.push(lo);
  }
  for (const topicTitle of unmatchedOrder) {
    // Bu konu zaten yukarıda (gruplanmış ya da gruplanmamış) bir DB konusuyla işlendiyse
    // tekrar ayrı bir "tymm-only" satır açmıyoruz — bu sadece DB'de HİÇ karşılığı olmayan
    // gerçekten yeni konular/çıktılar için.
    if (dbTopics.some((t) => norm(t.title) === norm(topicTitle))) continue;
    const los = unmatchedByTopicTitle.get(topicTitle)!;
    const learningOutcomeDiffs: LearningOutcomeDiff[] = los.map((lo) => {
      const tymmOutcomeTexts = lo.components.map((c) => c.text);
      return {
        code: lo.code,
        title: lo.title,
        status: 'tymm-only',
        dbGroupId: null,
        learningOutcomeChanged: false,
        dbLearningOutcomeText: null,
        tymmLearningOutcomeText: null,
        outcomesAdded: tymmOutcomeTexts,
        outcomesRemoved: [],
        outcomesOverridden: [],
        tymmOutcomeTexts,
      };
    });
    result.push({
      status: 'tymm-only',
      title: topicTitle,
      dbTopicId: null,
      learningOutcomeChanged: false,
      dbLearningOutcomeText: null,
      tymmLearningOutcomeText: null,
      learningOutcomeDiffs,
      outcomesAdded: learningOutcomeDiffs.flatMap((d) => d.outcomesAdded),
      outcomesRemoved: [],
      outcomesOverridden: [],
      tymmOutcomeTexts: learningOutcomeDiffs.flatMap((d) => d.tymmOutcomeTexts),
    });
  }

  return result;
}

export function diffUnit(tymmUnit: TymmUnit, tymmUrl: string, dbUnit: DbUnit | undefined, overrides: OverrideMap): UnitDiff {
  if (!dbUnit) {
    return {
      status: 'tymm-only',
      tymmUrl,
      tymmTitle: tymmUnit.unitTitle,
      dbUnitId: null,
      dbUnitTitle: null,
      durationHoursChanged: false,
      keyConceptsAdded: [],
      keyConceptsRemoved: [],
      topics: [],
    };
  }

  const durationHoursChanged = (dbUnit.duration_hours ?? null) !== (tymmUnit.durationHours ?? null);
  const { added: keyConceptsAdded, removed: keyConceptsRemoved } = setDiff(tymmUnit.keyConcepts, dbUnit.key_concepts || []);
  const topics = diffTopics(tymmUnit, dbUnit.topics, overrides);
  const topicsAllSame = topics.every((t) => t.status === 'same');
  const same = !durationHoursChanged && keyConceptsAdded.length === 0 && keyConceptsRemoved.length === 0 && topicsAllSame;

  return {
    status: same ? 'same' : 'changed',
    tymmUrl,
    tymmTitle: tymmUnit.unitTitle,
    dbUnitId: dbUnit.id,
    dbUnitTitle: dbUnit.title,
    durationHoursChanged,
    keyConceptsAdded,
    keyConceptsRemoved,
    topics,
  };
}

// TYMM sayfasında bulunamayan (kaldırılmış/yeniden adlandırılmış olabilecek) DB üniteleri
// için ayrı "db-only" satırlar üretir — bu fonksiyon çağrıldıktan SONRA, eşleşen tüm TYMM
// ünitelerinin diffUnit sonuçları elde edildikten sonra kullanılmalı.
export function dbOnlyUnitDiffs(dbUnits: DbUnit[], matchedDbIds: Set<number>, overrides: OverrideMap): UnitDiff[] {
  return dbUnits
    .filter((u) => !matchedDbIds.has(u.id))
    .map((u) => ({
      status: 'db-only' as const,
      tymmUrl: '',
      tymmTitle: '',
      dbUnitId: u.id,
      dbUnitTitle: u.title,
      durationHoursChanged: false,
      keyConceptsAdded: [],
      keyConceptsRemoved: [],
      topics: u.topics.map((t) => {
        const removed: DbOutcome[] = [];
        const overridden: DbOutcome[] = [];
        for (const o of t.outcomes) {
          if (overrides.has(o.id)) overridden.push(o);
          else removed.push(o);
        }
        return {
          status: 'db-only' as const,
          title: t.title,
          dbTopicId: t.id,
          learningOutcomeChanged: false,
          dbLearningOutcomeText: null,
          tymmLearningOutcomeText: null,
          learningOutcomeDiffs: [],
          outcomesAdded: [],
          outcomesRemoved: removed,
          outcomesOverridden: overridden,
          tymmOutcomeTexts: [],
        };
      }),
    }));
}

export function findDbUnitMatch(dbUnits: DbUnit[], tymmTitle: string): DbUnit | undefined {
  const target = normUnitTitleForMatch(tymmTitle);
  return dbUnits.find((u) => normUnitTitleForMatch(u.title) === target);
}
