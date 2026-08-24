// app/src/lib/tymm/assignWeeksFromDocx.ts
// İkinci, BAĞIMSIZ adım: TYMM'den önceden içe aktarılmış (DB'de zaten var olan) bir
// ünitenin konu/kazanımlarına, yıllık plan DOCX'ünden çıkan hafta sırasını atar.
// TYMM içeriğinin kendisi bu adıma hiç ihtiyaç duymaz — DOCX'te hafta eşleşmesi
// tutmasa bile TYMM'den gelen kazanım metni zaten kaydedilmiş olur (bkz. proje
// sohbetindeki tasarım kararı: önce içerik, sonra ayrı ve elle onaylanan hafta ataması).
//
// Eşleştirme mantığı matchWithDocx.ts ile aynı (sıra + sayı eşitliği, metin
// benzerliğine güvenmiyoruz) — tek fark, "hedef" tarafın taze TYMM verisi değil,
// DB'deki mevcut topic/outcome kayıtları (id'leriyle) olması.

import type { ParsedRow } from '@/app/src/lib/yillikPlan/docxParser';
import { extractDocxTopics } from './matchWithDocx';

export type DbTopic = { topicId: number; topicTitle: string; outcomeIds: number[] };

export type WeekAssignment = { outcomeId: number; startWeek: number; endWeek: number };

export type WeekAssignResult =
  | { ok: true; assignments: WeekAssignment[] }
  | { ok: false; reason: 'no-docx-rows'; uniteName: string }
  | { ok: false; reason: 'topic-count-mismatch'; tymmCount: number; docxCount: number; dbTopicTitles: string[]; docxTitles: string[] }
  | {
      ok: false;
      reason: 'outcome-count-mismatch';
      topicIndex: number;
      dbTopicTitle: string;
      dbCount: number;
      docxTopicTitle: string;
      docxCount: number;
    };

export function assignWeeksFromDocx(dbTopics: DbTopic[], docxRows: ParsedRow[], uniteName: string): WeekAssignResult {
  const docxTopics = extractDocxTopics(docxRows, uniteName);
  if (!docxTopics.length) {
    return { ok: false, reason: 'no-docx-rows', uniteName };
  }

  if (dbTopics.length !== docxTopics.length) {
    return {
      ok: false,
      reason: 'topic-count-mismatch',
      tymmCount: dbTopics.length,
      docxCount: docxTopics.length,
      dbTopicTitles: dbTopics.map((t) => t.topicTitle),
      docxTitles: docxTopics.map((t) => t.title),
    };
  }

  const assignments: WeekAssignment[] = [];
  for (let i = 0; i < dbTopics.length; i++) {
    const dbTopic = dbTopics[i];
    const docxTopic = docxTopics[i];
    if (dbTopic.outcomeIds.length !== docxTopic.outcomes.length) {
      return {
        ok: false,
        reason: 'outcome-count-mismatch',
        topicIndex: i,
        dbTopicTitle: dbTopic.topicTitle,
        dbCount: dbTopic.outcomeIds.length,
        docxTopicTitle: docxTopic.title,
        docxCount: docxTopic.outcomes.length,
      };
    }

    for (let j = 0; j < dbTopic.outcomeIds.length; j++) {
      const weekNo = docxTopic.outcomes[j].weekNo;
      assignments.push({ outcomeId: dbTopic.outcomeIds[j], startWeek: weekNo, endWeek: weekNo });
    }
  }

  return { ok: true, assignments };
}
