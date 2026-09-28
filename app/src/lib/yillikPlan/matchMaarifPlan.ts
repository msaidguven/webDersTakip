// app/src/lib/yillikPlan/matchMaarifPlan.ts
// Maarif yıllık planını (maarifPlanParser.ts) bir ders+sınıfın DB'deki TÜM kazanımlarıyla
// eşleştirir — saf fonksiyon, DB'ye dokunmaz. İki mod:
//
//  - 'code': kazanımlar öğrenme çıktısına bağlıysa (TYMM'den aktarılanlar) anahtar
//    (öğrenme çıktısı kodu, harf). Sıraya/metne güvenilmez. Dosyada bileşeni yazılmamış bir
//    harf varsa (ör. FB.6.2.3a) öğrenme çıktısının haftalarına düşülür.
//  - 'sequence': dersin HİÇBİR kazanımı koda bağlı değilse (eski DOCX akışıyla girilenler)
//    DB kazanımları konu sırasıyla dolaşılıp her "a" harfinde yeni bir öğrenme çıktısı
//    başlatılarak bölünür ve plandaki kod sırasıyla eşleştirilir. Sağlamlık kapıları:
//    bölüm sayısı = kod sayısı, her kodun harfleri bölümün harflerinin alt kümesi, aynı DB
//    ünitesindeki bölümler aynı plan ünite numarasına (FB.6.<3>.1) düşer ve ünite
//    numaraları DB ünite sırasıyla artar. Tek bir ihlalde hiçbir şey önerilmez. Geçerse
//    kodlar da (topic_learning_outcomes + outcomes.learning_outcome_id) yazılmak üzere
//    döner; ders sonraki yüklemede 'code' moduyla eşleşir.

import { compareCodes, letterIndex, type MaarifPlan } from './maarifPlanParser';

export type WeekRange = { start: number; end: number };

export type DbOutcome = {
  id: number;
  letter: string | null;
  description: string;
  orderIndex: number | null;
  learningOutcomeId: number | null;
  weeks: WeekRange[];
};
export type DbTopic = { id: number; title: string; orderNo: number; learningOutcomes: { id: number; code: string | null }[]; outcomes: DbOutcome[] };
export type DbUnit = { id: number; title: string; orderNo: number; topics: DbTopic[] };

export type OutcomeMatch = {
  outcomeId: number;
  code: string | null;
  letter: string | null;
  description: string;
  current: WeekRange | null;
  proposed: WeekRange | null;
  /** 'component': bileşenin kendi haftaları; 'learning-outcome': dosyada bileşen yok, öğrenme çıktısının haftaları */
  source: 'component' | 'learning-outcome' | null;
};
export type LinkPlan = { topicId: number; code: string; title: string; orderNo: number; outcomeIds: number[] };

export type MatchSuccess = {
  ok: true;
  mode: 'code' | 'sequence';
  units: { unitId: number; title: string; topics: { topicId: number; title: string; outcomes: OutcomeMatch[] }[] }[];
  links: LinkPlan[];
  unusedPlanCodes: string[];
  stats: { total: number; matched: number; viaLearningOutcome: number; unmatched: number; added: number; changed: number };
};
export type MatchResult = MatchSuccess | { ok: false; error: string };

const fail = (error: string): MatchResult => ({ ok: false, error });
const sameRange = (a: WeekRange | null, b: WeekRange | null) => a?.start === b?.start && a?.end === b?.end;
const toRange = (weeks: number[]): WeekRange | null => (weeks.length ? { start: Math.min(...weeks), end: Math.max(...weeks) } : null);
const unitNoOf = (code: string) => Number(code.split('.')[2]);

function collapse(weeks: WeekRange[]): WeekRange | null {
  if (!weeks.length) return null;
  return { start: Math.min(...weeks.map((w) => w.start)), end: Math.max(...weeks.map((w) => w.end)) };
}

function sortedOutcomes(topic: DbTopic) {
  return [...topic.outcomes].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.id - b.id);
}

// 'sequence' modu: outcomeId → öğrenme çıktısı kodu, ve yazılacak kod bağlantıları.
function alignBySequence(units: DbUnit[], plan: MaarifPlan): { codeByOutcome: Map<number, string>; links: LinkPlan[] } | { error: string } {
  type Segment = { unitId: number; topicId: number; outcomes: DbOutcome[] };
  const segments: Segment[] = [];
  for (const unit of units) {
    for (const topic of unit.topics) {
      let seg: Segment | null = null;
      for (const o of sortedOutcomes(topic)) {
        if (!o.letter) return { error: `"${topic.title}" konusunda harfi (a, b, c…) olmayan kazanım var — sıra eşleştirmesi yapılamaz.` };
        if (!seg || o.letter === 'a') {
          seg = { unitId: unit.id, topicId: topic.id, outcomes: [] };
          segments.push(seg);
        }
        seg.outcomes.push(o);
      }
    }
  }

  const los = plan.learningOutcomes;
  if (segments.length !== los.length) {
    return { error: `DB'de ${segments.length} öğrenme çıktısı grubu (a'dan başlayan kazanım dizisi), planda ${los.length} öğrenme çıktısı var — sıra eşleştirmesi güvenli değil.` };
  }

  const lettersByCode = new Map<string, string[]>();
  for (const c of plan.components) lettersByCode.set(c.code, [...(lettersByCode.get(c.code) || []), c.letter]);

  const unitNoByDbUnit = new Map<number, number>();
  let prevUnitNo = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const lo = los[i];
    const segLetters = new Set(seg.outcomes.map((o) => o.letter));
    const missing = (lettersByCode.get(lo.code) || []).filter((l) => !segLetters.has(l));
    const topicTitle = units.flatMap((u) => u.topics).find((t) => t.id === seg.topicId)?.title;
    if (missing.length) {
      return { error: `"${topicTitle}" konusundaki ${i + 1}. grup (${[...segLetters].join('')}) planda ${lo.code} ile eşleşiyor ama plandaki ${missing.join(', ')} harf(ler)i DB'de yok.` };
    }
    const unitNo = unitNoOf(lo.code);
    const known = unitNoByDbUnit.get(seg.unitId);
    if (known == null) {
      if (unitNo <= prevUnitNo) return { error: `Ünite sırası tutmuyor: "${topicTitle}" konusu planda ${lo.code} (ünite ${unitNo}) ile eşleşiyor.` };
      unitNoByDbUnit.set(seg.unitId, unitNo);
      prevUnitNo = unitNo;
    } else if (known !== unitNo) {
      return { error: `Ünite sınırı tutmuyor: "${topicTitle}" konusu planda ${lo.code} ile eşleşiyor ama aynı ünitenin önceki konuları plandaki ${known}. üniteye düştü.` };
    }
  }

  const codeByOutcome = new Map<number, string>();
  const links: LinkPlan[] = [];
  const orderByTopic = new Map<number, number>();
  segments.forEach((seg, i) => {
    const lo = los[i];
    const orderNo = (orderByTopic.get(seg.topicId) ?? 0) + 1;
    orderByTopic.set(seg.topicId, orderNo);
    links.push({ topicId: seg.topicId, code: lo.code, title: lo.title || lo.code, orderNo, outcomeIds: seg.outcomes.map((o) => o.id) });
    for (const o of seg.outcomes) codeByOutcome.set(o.id, lo.code);
  });
  return { codeByOutcome, links };
}

export function matchMaarifPlan(units: DbUnit[], plan: MaarifPlan, gradeNo: number | null): MatchResult {
  if (plan.gradeNo != null && gradeNo != null && plan.gradeNo !== gradeNo) {
    return fail(`Plan ${plan.gradeNo}. sınıfa ait, seçili sınıf ${gradeNo}. sınıf.`);
  }
  const topics = units.flatMap((u) => u.topics);
  const allOutcomes = topics.flatMap((t) => t.outcomes);
  if (!allOutcomes.length) return fail('Bu ders/sınıfta hiç kazanım yok — önce içeriği aktarın.');

  const anyLinked = allOutcomes.some((o) => o.learningOutcomeId != null);
  const anyGroups = topics.some((t) => t.learningOutcomes.length > 0);
  if (!anyLinked && anyGroups) {
    return fail("Bu derste öğrenme çıktısı kayıtları var ama kazanımlar bunlara bağlı değil — Kazanım Yönetimi'nden bağlayıp tekrar deneyin.");
  }

  const mode: 'code' | 'sequence' = anyLinked ? 'code' : 'sequence';
  let codeByOutcome = new Map<number, string>();
  let links: LinkPlan[] = [];

  if (mode === 'code') {
    for (const t of topics) {
      const codeByLo = new Map(t.learningOutcomes.map((lo) => [lo.id, lo.code?.trim() || null]));
      for (const o of t.outcomes) {
        const code = o.learningOutcomeId != null ? codeByLo.get(o.learningOutcomeId) : null;
        if (code) codeByOutcome.set(o.id, code);
      }
    }
  } else {
    const aligned = alignBySequence(units, plan);
    if ('error' in aligned) return fail(aligned.error);
    ({ codeByOutcome, links } = aligned);
  }

  const compWeeks = new Map(plan.components.map((c) => [`${c.code}|${c.letter}`, c.weeks]));
  const loWeeks = new Map(plan.learningOutcomes.map((lo) => [lo.code, lo.weeks]));
  const stats = { total: 0, matched: 0, viaLearningOutcome: 0, unmatched: 0, added: 0, changed: 0 };
  const usedCodes = new Set<string>();

  const resultUnits = units.map((unit) => ({
    unitId: unit.id,
    title: unit.title,
    topics: unit.topics.map((topic) => ({
      topicId: topic.id,
      title: topic.title,
      outcomes: sortedOutcomes(topic)
        .map((o): OutcomeMatch => {
          const code = codeByOutcome.get(o.id) ?? null;
          const current = collapse(o.weeks);
          let proposed: WeekRange | null = null;
          let source: OutcomeMatch['source'] = null;
          if (code && o.letter) {
            const cw = compWeeks.get(`${code}|${o.letter}`);
            const lw = loWeeks.get(code);
            if (cw?.length) [proposed, source] = [toRange(cw), 'component'];
            else if (lw?.length) [proposed, source] = [toRange(lw), 'learning-outcome'];
          }
          if (proposed && code) usedCodes.add(code);
          stats.total++;
          if (!proposed) stats.unmatched++;
          else {
            stats.matched++;
            if (source === 'learning-outcome') stats.viaLearningOutcome++;
            if (!current) stats.added++;
            else if (!sameRange(current, proposed) || o.weeks.length > 1) stats.changed++;
          }
          return { outcomeId: o.id, code, letter: o.letter, description: o.description, current, proposed, source };
        })
        .sort((a, b) => (a.code && b.code ? compareCodes(a.code, b.code) : 0) || letterIndex(a.letter ?? '') - letterIndex(b.letter ?? '')),
    })),
  }));

  if (!stats.matched) return fail('Plandaki kodların hiçbiri bu dersin kazanımlarıyla eşleşmedi — yanlış ders/sınıf seçilmiş olabilir.');

  return {
    ok: true,
    mode,
    units: resultUnits,
    links,
    unusedPlanCodes: plan.learningOutcomes.map((lo) => lo.code).filter((c) => !usedCodes.has(c)),
    stats,
  };
}

export function weekRowsToWrite(result: MatchSuccess) {
  return result.units.flatMap((u) =>
    u.topics.flatMap((t) =>
      t.outcomes.filter((o) => o.proposed).map((o) => ({ outcome_id: o.outcomeId, start_week: o.proposed!.start, end_week: o.proposed!.end }))
    )
  );
}
