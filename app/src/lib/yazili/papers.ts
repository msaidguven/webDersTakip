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

export function distributePoints(n: number): number[] {
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

// Öğrencinin seçtiği dağılım (2026-10-28): MEB senaryosundan başlar, öğrenme çıktısı ekleyip çıkarabilir ve
// sayıları değiştirebilir. Her satır en az 1 soru, en çok o çıktının havuzu kadar; toplam en çok CUSTOM_MAX_TOTAL.
export const CUSTOM_MAX_TOTAL = 15;
export type LoOption = { code: string; title: string; topicTitles: string[]; pool: number };

// Geçersizse null. Sıra korunur, kod tekrarı reddedilir.
export function validatePlan(counts: [string, number][], options: LoOption[]): [string, number][] | null {
  const pool = new Map(options.map((o) => [o.code, o.pool]));
  const seen = new Set<string>();
  let total = 0;
  for (const [code, n] of counts) {
    if (seen.has(code) || !Number.isInteger(n) || n < 1 || n > (pool.get(code) ?? 0)) return null;
    seen.add(code);
    total += n;
  }
  return total >= 1 && total <= CUSTOM_MAX_TOTAL ? counts : null;
}

// Senaryo satırları havuza göre kırpılır (havuzu boş çıktı düşer); senaryo yoksa her çıktıdan eşit pay.
export function initialPlan(options: LoOption[], scenarioCounts: Record<string, number> | null): [string, number][] {
  const usable = options.filter((o) => o.pool > 0);
  if (scenarioCounts) return usable.filter((o) => scenarioCounts[o.code]).map((o) => [o.code, Math.min(scenarioCounts[o.code], o.pool)]);
  const each = Math.max(1, Math.floor(CUSTOM_MAX_TOTAL / Math.max(1, usable.length)));
  const plan: [string, number][] = [];
  let total = 0;
  for (const o of usable) {
    const n = Math.min(each, o.pool, CUSTOM_MAX_TOTAL - total);
    if (n < 1) break;
    plan.push([o.code, n]);
    total += n;
  }
  return plan;
}

// Plan → sorular: her çıktıdan istenen sayıda rastgele soru (önce çözülmemişler), çıktı içinde kolaydan zora.
export function buildPlanItems(plan: [string, number][], questions: PaperQuestion[], solved: Set<number> = new Set(), random: () => number = Math.random): PaperItem[] {
  const picked: PaperQuestion[] = [];
  for (const [code, n] of plan) {
    const pool = questions.filter((q) => q.loCode === code);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const shuffled = pool.sort((a, b) => Number(solved.has(a.id)) - Number(solved.has(b.id)));
    picked.push(...shuffled.slice(0, n).sort((a, b) => (a.difficulty ?? 3) - (b.difficulty ?? 3) || a.id - b.id));
  }
  const points = distributePoints(Math.max(1, picked.length));
  return picked.map((q, i) => ({ questionId: q.id, points: points[i] }));
}
