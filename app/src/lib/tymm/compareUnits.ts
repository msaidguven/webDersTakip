// app/src/lib/tymm/compareUnits.ts
// DB'deki ünite/konu/kazanımları, canlı TYMM sayfasından çekilmiş güncel veriyle
// karşılaştırıp fark raporu üretir — hiçbir şey yazmaz, sadece okur. Eşleştirme importUnit.ts
// ile TUTARLI tutuldu: ünite başlığı ve konu başlığı normalize edilmiş tam metin eşleşmesine,
// kazanım ise açıklama (description) tam metin eşleşmesine bakar — importUnit.ts kayıt
// sırasında da aynı anahtarları kullandığı için "farklı" çıkan her şey gerçekten TYMM'in
// güncellediği/admin'in elle değiştirdiği bir içeriktir, eşleştirme gürültüsü değildir.

import type { TymmUnit } from './tymmParser';

export type DbOutcome = { id: number; code: string | null; description: string };
export type DbTopic = { id: number; title: string; learning_outcome: string | null; outcomes: DbOutcome[] };
export type DbUnit = { id: number; title: string; duration_hours: number | null; key_concepts: string[] | null; topics: DbTopic[] };

export type TopicDiff = {
  status: 'same' | 'changed' | 'tymm-only' | 'db-only';
  title: string;
  dbTopicId: number | null;
  learningOutcomeChanged: boolean;
  outcomesAdded: string[];
  outcomesRemoved: string[];
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

function norm(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

function setDiff(tymmList: string[], dbList: string[]): { added: string[]; removed: string[] } {
  const tymmNorm = new Map(tymmList.map((s) => [norm(s), s]));
  const dbNorm = new Map(dbList.map((s) => [norm(s), s]));
  const added = [...tymmNorm.entries()].filter(([k]) => !dbNorm.has(k)).map(([, v]) => v);
  const removed = [...dbNorm.entries()].filter(([k]) => !tymmNorm.has(k)).map(([, v]) => v);
  return { added, removed };
}

function diffTopics(tymmUnit: TymmUnit, dbTopics: DbTopic[]): TopicDiff[] {
  const dbByTitle = new Map(dbTopics.map((t) => [norm(t.title), t]));
  const matchedDbIds = new Set<number>();
  const result: TopicDiff[] = [];

  for (const lo of tymmUnit.learningOutcomes) {
    const dbTopic = dbByTitle.get(norm(lo.topicTitle));
    const tymmOutcomeTexts = lo.components.map((c) => c.text);
    const learningOutcomeText = lo.code ? `${lo.code}. ${lo.title}` : lo.title;

    if (!dbTopic) {
      result.push({
        status: 'tymm-only',
        title: lo.topicTitle,
        dbTopicId: null,
        learningOutcomeChanged: false,
        outcomesAdded: tymmOutcomeTexts,
        outcomesRemoved: [],
      });
      continue;
    }
    matchedDbIds.add(dbTopic.id);

    const dbOutcomeTexts = dbTopic.outcomes.map((o) => o.description);
    const { added, removed } = setDiff(tymmOutcomeTexts, dbOutcomeTexts);
    const learningOutcomeChanged = norm(dbTopic.learning_outcome || '') !== norm(learningOutcomeText);
    const same = added.length === 0 && removed.length === 0 && !learningOutcomeChanged;

    result.push({
      status: same ? 'same' : 'changed',
      title: lo.topicTitle,
      dbTopicId: dbTopic.id,
      learningOutcomeChanged,
      outcomesAdded: added,
      outcomesRemoved: removed,
    });
  }

  for (const t of dbTopics) {
    if (matchedDbIds.has(t.id)) continue;
    result.push({
      status: 'db-only',
      title: t.title,
      dbTopicId: t.id,
      learningOutcomeChanged: false,
      outcomesAdded: [],
      outcomesRemoved: t.outcomes.map((o) => o.description),
    });
  }

  return result;
}

export function diffUnit(tymmUnit: TymmUnit, tymmUrl: string, dbUnit: DbUnit | undefined): UnitDiff {
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
  const topics = diffTopics(tymmUnit, dbUnit.topics);
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
export function dbOnlyUnitDiffs(dbUnits: DbUnit[], matchedDbIds: Set<number>): UnitDiff[] {
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
      topics: u.topics.map((t) => ({
        status: 'db-only' as const,
        title: t.title,
        dbTopicId: t.id,
        learningOutcomeChanged: false,
        outcomesAdded: [],
        outcomesRemoved: t.outcomes.map((o) => o.description),
      })),
    }));
}

export function findDbUnitMatch(dbUnits: DbUnit[], tymmTitle: string): DbUnit | undefined {
  const target = norm(tymmTitle);
  return dbUnits.find((u) => norm(u.title) === target);
}
