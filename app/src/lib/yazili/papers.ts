// Yazılı soruları — örnek sınav kağıtları (2026-10-21, docs/yazili-sorulari-plani.md "senaryoya göre
// kağıt"). Kağıt saklanmaz, her seferinde havuzdan aynı kuralla kurulur: MEB senaryosundaki her öğrenme
// çıktısı için istenen sayıda soru, havuz sırasıyla (kolaydan zora, sonra id). A kağıdı baştan, B kağıdı
// A'nın bittiği yerden alır — havuz yetmezse başa sarar (B, A ile kısmen örtüşür). Bir öğrenme çıktısının
// havuzu senaryonun istediğinden azsa kağıt eksiktir ve gösterilmez. Ülke geneli sınavda senaryo yok:
// kapsamdaki her öğrenme çıktısından eşit pay alınır (toplam ~12 soru). Puanlar toplam 100.

export type PaperQuestion = { id: number; loCode: string | null; difficulty: number | null };
export type PaperItem = { questionId: number; points: number };
export type Paper = { scenario: number | null; variant: 1 | 2; items: PaperItem[]; complete: boolean };

const NATIONAL_TOTAL = 12;

// Ülke geneli sınavda öğrenme çıktısı başına kağıttaki soru sayısı (eksik havuz özeti de kullanır).
export function nationalCountPerLo(loCount: number): number {
  return Math.max(2, Math.round(NATIONAL_TOTAL / Math.max(1, loCount)));
}

function distributePoints(n: number): number[] {
  const base = Math.floor(100 / n);
  const rem = 100 - base * n;
  // Artan puan sondaki (daha zor) sorulara.
  return Array.from({ length: n }, (_, i) => base + (i >= n - rem ? 1 : 0));
}

export function buildPapers(opts: {
  questions: PaperQuestion[];
  // Senaryo → öğrenme çıktısı → soru sayısı. Ülke geneli sınavda boş.
  scenarios: Map<number, Map<string, number>>;
  national: boolean;
  scopeLoCodes: string[];
}): Paper[] {
  const pool = new Map<string, PaperQuestion[]>();
  for (const q of [...opts.questions].sort((a, b) => (a.difficulty ?? 3) - (b.difficulty ?? 3) || a.id - b.id)) {
    if (!q.loCode) continue;
    pool.set(q.loCode, [...(pool.get(q.loCode) ?? []), q]);
  }

  const plans: { scenario: number | null; counts: Map<string, number> }[] = opts.national
    ? [{
      scenario: null,
      counts: new Map(opts.scopeLoCodes.map((c) => [c, nationalCountPerLo(opts.scopeLoCodes.length)])),
    }]
    : [...opts.scenarios.entries()].sort(([a], [b]) => a - b).map(([scenario, counts]) => ({ scenario, counts }));

  const papers: Paper[] = [];
  for (const plan of plans) {
    const codes = [...plan.counts.keys()].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
    for (const variant of [1, 2] as const) {
      const picked: PaperQuestion[] = [];
      let complete = true;
      for (const code of codes) {
        const need = plan.counts.get(code) ?? 0;
        const list = pool.get(code) ?? [];
        if (list.length < need) complete = false;
        if (!list.length) continue;
        const start = variant === 1 ? 0 : need;
        for (let i = 0; i < Math.min(need, list.length); i++) picked.push(list[(start + i) % list.length]);
      }
      const points = distributePoints(Math.max(1, picked.length));
      papers.push({ scenario: plan.scenario, variant, complete: complete && picked.length > 0, items: picked.map((q, i) => ({ questionId: q.id, points: points[i] })) });
    }
  }
  // Havuz senaryonun istediği kadarsa B, A ile aynı sorulardan oluşur (yalnız sırası farklı) — sunulmaz.
  return papers.filter((p) => {
    if (p.variant === 1) return true;
    const a = papers.find((x) => x.scenario === p.scenario && x.variant === 1);
    const ids = new Set(a?.items.map((i) => i.questionId));
    return !(a && a.items.length === p.items.length && p.items.every((i) => ids.has(i.questionId)));
  });
}
