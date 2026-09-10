// app/src/lib/tymm/matchWithDocx.ts
// DOCX yıllık plan satırlarından, seçilen bir ünitenin konu/kazanım sırasını (ve hangi
// haftalarda geçtiğini) çıkarır. assignWeeksFromDocx.ts bunu, DB'de zaten var olan (TYMM'den
// önceden içe aktarılmış) konu/kazanımlara hafta atarken kullanır — metin benzerliğine
// (fuzzy/AI) GÜVENMİYORUZ, ikisinin de aynı resmi müfredatı aynı sırayla listelediği
// varsayımına dayanıyoruz (bkz. proje sohbetindeki tasarım kararı: "sayı eşitliğini bir
// güvenlik kapısı olarak kullan").

import type { ParsedRow } from '@/app/src/lib/yillikPlan/docxParser';

export type DocxTopicOutcome = { letter: string | null; text: string; weekNo: number; weekNoEnd: number };
export type DocxTopic = { title: string; outcomes: DocxTopicOutcome[] };

const KAZANIM_LETTER_RE = /^([a-zçğıöşü])\)\s*/i;

function splitLetter(line: string): { letter: string | null; text: string } {
  const m = KAZANIM_LETTER_RE.exec(line.trim());
  if (!m) return { letter: null, text: line.trim() };
  return { letter: m[1].toLowerCase(), text: line.slice(m[0].length).trim() };
}

function normalizeForCompare(s: string): string {
  return s.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr');
}

// Seçilen ünitenin DOCX/XLSX satırlarından, konuları İLK GÖRÜLDÜKLERİ SIRAYLA ve her konunun
// kazanımlarını (birden fazla haftaya yayılmışsa hepsini sırayla birleştirerek) çıkarır.
//
// Bir konu, pekiştirme/devam amacıyla İKİNCİ bir haftada AYNI (harfiyen özdeş) kazanım
// metniyle tekrar geçebiliyor (ör. XLSX yıllık planda "İletişim Teknolojileri ve Çeşitleri"
// hem 9. hem 10. haftada aynı 3 kazanımla listeleniyor — bkz. xlsxParser.ts'teki benzer
// tekrar tespiti). Bu durumda DB'de gerçekte YENİ bir kazanım YOKTUR, sadece aynı
// kazanımların işlendiği hafta aralığı genişler; tekrarı ayrı bir kazanım gibi eklersek
// DB'deki gerçek sayıdan fazla çıkar ve "sayılar uyuşmuyor" hatasına yol açar (2026-09-10
// kullanıcı bildirimi). Bu yüzden bir haftanın kazanım bloğu, aynı konunun bir ÖNCEKİ
// haftadan gelen SON bloğuyla birebir aynıysa yeni satır eklemek yerine o kazanımların
// bitiş haftasını (weekNoEnd) günceller.
export function extractDocxTopics(rows: ParsedRow[], uniteName: string): DocxTopic[] {
  const topics: DocxTopic[] = [];
  const indexByTitle = new Map<string, number>();

  for (const row of rows) {
    if (row.ünite.trim() !== uniteName.trim()) continue;
    const konu = row.konu.trim();
    if (!konu || row.week_no == null) continue;

    let idx = indexByTitle.get(konu);
    if (idx == null) {
      idx = topics.length;
      indexByTitle.set(konu, idx);
      topics.push({ title: konu, outcomes: [] });
    }

    const lines = row.kazanım.map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const existing = topics[idx].outcomes;
    const tailStart = existing.length - lines.length;
    const isRepeatFromPreviousWeek =
      tailStart >= 0 &&
      lines.every((line, m) => normalizeForCompare(splitLetter(line).text) === normalizeForCompare(existing[tailStart + m].text));

    if (isRepeatFromPreviousWeek) {
      for (let m = 0; m < lines.length; m++) existing[tailStart + m].weekNoEnd = row.week_no;
      continue;
    }

    for (const line of lines) {
      const { letter, text } = splitLetter(line);
      topics[idx].outcomes.push({ letter, text, weekNo: row.week_no, weekNoEnd: row.week_no });
    }
  }

  return topics;
}
