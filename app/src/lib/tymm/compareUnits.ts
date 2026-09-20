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

export function norm(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

// SADECE kazanım/öğrenme çıktısı METNİ karşılaştırmasında kullanılır (yapısal eşleştirmede
// — konu/ünite başlığı, kod — DEĞİL). norm()'a ek olarak: noktalama işaretlerini atar ve
// Türkçe noktalı/noktasız I/İ/ı/i farkını yok sayar (ör. "Varsayımı" ile "Varsayımi" aynı
// sayılır) — kullanıcının 2026-09-20 isteği: "ufak tefek boşluk, harf, nokta vb karakterleri
// ihmal edebiliyorsa etsin".
function fuzzyNorm(s: string): string {
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

// Bir öğrenme çıktısının a/b/c... kazanımlarını, TAHMİN/gruplama YAPMADAN, doğrudan
// SIRAYA göre ikişer ikişer (TYMM'in i'inci bileşeni ↔ DB'nin i'inci kazanımı) kıyaslar —
// kullanıcının isteği: "sadece doğru sırada ve sayıda eşleşiyor mu ona baksın". DB tarafı
// `order_index`'e göre sıralı geliyor (bkz. compare-bulk route'taki sort). Sayı farklıysa
// fazlalık taraf o pozisyonlarda "eklendi"/"silindi" olarak düşer.
function diffOutcomesPositional(
  tymmTexts: string[],
  dbOutcomes: DbOutcome[],
  overrides: OverrideMap
): { added: string[]; removed: DbOutcome[]; overridden: DbOutcome[] } {
  const added: string[] = [];
  const removed: DbOutcome[] = [];
  const overridden: DbOutcome[] = [];
  const maxLen = Math.max(tymmTexts.length, dbOutcomes.length);
  for (let i = 0; i < maxLen; i++) {
    const t = i < tymmTexts.length ? tymmTexts[i] : undefined;
    const d = i < dbOutcomes.length ? dbOutcomes[i] : undefined;
    if (t !== undefined && d !== undefined) {
      if (fuzzyNorm(t) === fuzzyNorm(d.description)) continue;
      if (overrides.has(d.id)) overridden.push(d);
      else removed.push(d);
      continue;
    }
    if (t !== undefined) added.push(t);
    if (d !== undefined) {
      if (overrides.has(d.id)) overridden.push(d);
      else removed.push(d);
    }
  }
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
    if (lo.code) tymmByCode.set(norm(lo.code), lo);
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
      const tymmLo = g.code ? tymmByCode.get(norm(g.code)) : undefined;
      if (tymmLo && g.code) matchedTymmCodes.add(norm(g.code));
      return diffLearningOutcomeByCode(g, tymmLo, overrides);
    });
    const topicSame = learningOutcomeDiffs.every((d) => d.status === 'same');
    result.push({
      status: topicSame ? 'same' : 'changed',
      title: dbTopic.title,
      dbTopicId: dbTopic.id,
      learningOutcomeChanged: learningOutcomeDiffs.some((d) => d.learningOutcomeChanged),
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
  const unmatched = tymmUnit.learningOutcomes.filter((lo) => !lo.code || !matchedTymmCodes.has(norm(lo.code)));
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
  const target = norm(tymmTitle);
  return dbUnits.find((u) => norm(u.title) === target);
}
