// ÖDSGM "Ortak Yazılı Sınavlar Konu Soru Dağılım Tablosu" Excel'lerini okur (2026-10-20). Her sayfa bir
// sınıf: başlıkta "6.SINIF MATEMATİK DERSİ" ve "1. DÖNEM ORTAK YAZILI SINAVLAR"; başlık satırında
// "1. Dönem 1. Ortak Yazılı Sınav" / "… 2. Ortak Yazılı Sınav" birleşik hücreleri, altında "Senaryo k"
// sütunları; veri satırlarında öğrenme çıktısı kodu (MAT.6.1.1, "SB 7.1.1", T.O.6.5) ve senaryo başına
// soru sayısı. Bazı satırlarda kod hücresi boş kalmış (birleşik hücre hatası) — o zaman konu adı döner,
// sunucu konu başlığından kodu çözer. Ülke geneli sınavda senaryo yerine "Ülke Geneli…" metni yazar.
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import { LO_CODE_RE as CODE_RE, normalizeLoCode } from '@/app/src/lib/yazili/common';

export type MebTarget = { scenario: number; loCode: string | null; konu: string; count: number };
// national: ülke geneli sınav — senaryo/sayı yok, kapsam (konular) admin'de elle seçilir. "Hiçbir
// senaryoda sayısı olmayan kodlar" sezgisi denendi ama güvenilmez (7. Türkçe'de alakasız kodlar topluyor).
export type MebExam = { examNo: 1 | 2; national: boolean; scenarioCount: number; targets: MebTarget[] };
// outcomes: tablodaki tüm öğrenme çıktısı satırları (sayısı olmayanlar dahil) — kodu eksik konulara
// resmî kod + metin eklemek için (bkz. yazili/import).
export type MebOutcomeRow = { konu: string; loCode: string; loTitle: string };
export type MebSheet = { sheetName: string; gradeNo: number; lessonTitle: string; term: 1 | 2; exams: MebExam[]; outcomes: MebOutcomeRow[] };


const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

export function parseMebDistribution(buffer: Buffer): MebSheet[] {
  const wb = xlsxRead(buffer, { type: 'buffer' });
  const result: MebSheet[] = [];

  for (const sheetName of wb.SheetNames) {
    const rows = xlsxUtils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: '', raw: false }).map((r) => r.map(clean));
    const title = rows.find((r) => /SINIF .* DERSİ/i.test(r[0] ?? ''))?.[0];
    const titleMatch = title?.match(/(\d+)\.\s*SINIF\s+(.+?)\s+DERSİ/i);
    const termMatch = rows.find((r) => /DÖNEM ORTAK YAZILI/i.test(r[0] ?? ''))?.[0]?.match(/(\d)\.\s*DÖNEM/i);
    if (!titleMatch || !termMatch) continue;

    // Sütun → yazılı numarası: başlık hücresi birleşik, değeri yalnız ilk sütunda; sağa doğru geçerli.
    const headerIdx = rows.findIndex((r) => r.some((c) => /Dönem\s*\d\.\s*Ortak Yazılı/i.test(c)));
    if (headerIdx < 0) continue;
    const examStarts: { col: number; examNo: 1 | 2 }[] = [];
    rows[headerIdx].forEach((c, col) => {
      const m = c.match(/Dönem\s*(\d)\.\s*Ortak Yazılı/i);
      if (m && (m[1] === '1' || m[1] === '2')) examStarts.push({ col, examNo: Number(m[1]) as 1 | 2 });
    });
    const examAt = (col: number) => [...examStarts].reverse().find((s) => s.col <= col)?.examNo ?? null;

    const scenarioRow = rows[headerIdx + 1] ?? [];
    const scenarioCols = new Map<number, { examNo: 1 | 2; scenario: number }>();
    const national = new Set<1 | 2>();
    scenarioRow.forEach((c, col) => {
      const examNo = examAt(col);
      if (!examNo) return;
      const m = c.match(/Senaryo\s*(\d+)/i);
      if (m) scenarioCols.set(col, { examNo, scenario: Number(m[1]) });
      else if (/Ülke Geneli/i.test(c)) national.add(examNo);
    });

    const exams = new Map<1 | 2, MebExam>(
      examStarts.map(({ examNo }) => [examNo, { examNo, national: national.has(examNo), scenarioCount: 0, targets: [] }])
    );
    for (const { examNo, scenario } of scenarioCols.values()) {
      const e = exams.get(examNo)!;
      e.scenarioCount = Math.max(e.scenarioCount, scenario);
    }

    const firstDataCol = Math.min(...examStarts.map((s) => s.col));
    let lastKonu = '';
    const outcomes: MebOutcomeRow[] = [];
    for (const row of rows.slice(headerIdx + 2)) {
      const labelCells = row.slice(0, firstDataCol);
      // Konu sütunu (kod sütunundan bir önceki) birleşik olabilir: boşsa üstteki konu geçerli.
      const codeCellIdx = labelCells.findIndex((c) => normalizeLoCode(c));
      const loCode = codeCellIdx >= 0 ? normalizeLoCode(labelCells[codeCellIdx]) : null;
      const konuCell = labelCells[firstDataCol - 2] ?? '';
      if (konuCell && !normalizeLoCode(konuCell)) lastKonu = konuCell;
      if (loCode) {
        const loTitle = labelCells[codeCellIdx].replace(CODE_RE, '').replace(/^[\s.]+/, '').trim();
        outcomes.push({ konu: lastKonu, loCode, loTitle });
      }

      for (const [col, { examNo, scenario }] of scenarioCols) {
        const n = Number(row[col]);
        if (!Number.isInteger(n) || n <= 0) continue;
        exams.get(examNo)!.targets.push({ scenario, loCode, konu: lastKonu, count: n });
      }
    }

    result.push({
      sheetName,
      gradeNo: Number(titleMatch[1]),
      lessonTitle: titleMatch[2],
      term: Number(termMatch[1]) as 1 | 2,
      exams: [...exams.values()],
      outcomes,
    });
  }
  return result;
}
