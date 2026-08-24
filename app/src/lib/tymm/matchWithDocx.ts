// app/src/lib/tymm/matchWithDocx.ts
// DOCX yıllık plan satırlarından, seçilen bir ünitenin konu/kazanım sırasını (ve hangi
// haftalarda geçtiğini) çıkarır. assignWeeksFromDocx.ts bunu, DB'de zaten var olan (TYMM'den
// önceden içe aktarılmış) konu/kazanımlara hafta atarken kullanır — metin benzerliğine
// (fuzzy/AI) GÜVENMİYORUZ, ikisinin de aynı resmi müfredatı aynı sırayla listelediği
// varsayımına dayanıyoruz (bkz. proje sohbetindeki tasarım kararı: "sayı eşitliğini bir
// güvenlik kapısı olarak kullan").

import type { ParsedRow } from '@/app/src/lib/yillikPlan/docxParser';

export type DocxTopicOutcome = { letter: string | null; weekNo: number };
export type DocxTopic = { title: string; outcomes: DocxTopicOutcome[] };

const KAZANIM_LETTER_RE = /^([a-zçğıöşü])\)\s*/i;

function splitLetter(line: string): { letter: string | null; text: string } {
  const m = KAZANIM_LETTER_RE.exec(line.trim());
  if (!m) return { letter: null, text: line.trim() };
  return { letter: m[1].toLowerCase(), text: line.slice(m[0].length).trim() };
}

// Seçilen ünitenin DOCX satırlarından, konuları İLK GÖRÜLDÜKLERİ SIRAYLA ve her konunun
// kazanımlarını (birden fazla haftaya yayılmışsa hepsini sırayla birleştirerek) çıkarır.
export function extractDocxTopics(rows: ParsedRow[], uniteName: string): DocxTopic[] {
  const topics: DocxTopic[] = [];
  const indexByTitle = new Map<string, number>();

  for (const row of rows) {
    if (row.ünite.trim() !== uniteName.trim()) continue;
    const konu = row.konu.trim();
    if (!konu) continue;

    let idx = indexByTitle.get(konu);
    if (idx == null) {
      idx = topics.length;
      indexByTitle.set(konu, idx);
      topics.push({ title: konu, outcomes: [] });
    }

    for (const line of row.kazanım) {
      const trimmed = line.trim();
      if (!trimmed || row.week_no == null) continue;
      const { letter } = splitLetter(trimmed);
      topics[idx].outcomes.push({ letter, weekNo: row.week_no });
    }
  }

  return topics;
}
