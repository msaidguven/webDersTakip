// AI worker'larının (içerik taslağı, anahtar kavram) çalışma loglarını admin panelinde
// özetlemek için ortak sınıflandırma. Log'larda yapısal bir hata kodu yok, sadece serbest
// metin `reason` var — bu yüzden bilinen kalıplara göre gruplanıyor.
export type FailureKind = 'overloaded' | 'quota' | 'no_topic' | 'race' | 'other';

export type RunSummary = { total: number; generated: number; failures: Record<FailureKind, number> };

type ClassifiableRun = { generated: boolean; reason: string | null; created_at: string };

// Her worker "sırada iş yok" durumunu kendi cümlesiyle yazıyor.
const NO_TOPIC_PREFIXES = ['Uygun konu yok', 'Anahtar kavramı eksik konu yok'];

export function classifyFailure(reason: string | null): FailureKind {
  const r = reason ?? '';
  if (/\b503\b/.test(r)) return 'overloaded';
  if (/\b429\b/.test(r)) return 'quota';
  if (NO_TOPIC_PREFIXES.some((p) => r.startsWith(p))) return 'no_topic';
  if (r.includes('diğer worker')) return 'race';
  return 'other';
}

export function summarizeRuns(rows: ClassifiableRun[]): RunSummary {
  const failures: Record<FailureKind, number> = { overloaded: 0, quota: 0, no_topic: 0, race: 0, other: 0 };
  let generated = 0;
  for (const row of rows) {
    if (row.generated) generated++;
    else failures[classifyFailure(row.reason)]++;
  }
  return { total: rows.length, generated, failures };
}

export const STATS_WINDOW_DAYS = 7;

export function statsWindowStartIso(): string {
  return new Date(Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function summarizeWindows(rows: ClassifiableRun[]): { last24h: RunSummary; last7d: RunSummary } {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return {
    last24h: summarizeRuns(rows.filter((r) => new Date(r.created_at).getTime() >= dayAgo)),
    last7d: summarizeRuns(rows),
  };
}
