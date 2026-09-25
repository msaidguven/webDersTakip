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

// Worker log'larından üretilen konunun public sayfasına link — PostgREST FK embedding ile
// gelen `topics(title, slug, units(title, slug, lessons(name, slug), grades(name, slug)))`.
export const TOPIC_LINK_SELECT = 'topics(title, slug, units(title, slug, lessons(name, slug), grades(name, slug)))';

type Slugged = { slug: string | null };
export type EmbeddedTopic = {
  title: string;
  slug: string | null;
  units: (Slugged & { title: string; lessons: (Slugged & { name: string }) | null; grades: (Slugged & { name: string }) | null }) | null;
} | null;

export function describeTopic(t: EmbeddedTopic): { topic_title: string | null; context: string | null; href: string | null } {
  const u = t?.units;
  return {
    topic_title: t?.title ?? null,
    context: u ? [u.grades?.name, u.lessons?.name, u.title].filter(Boolean).join(' · ') : null,
    href: t?.slug && u?.slug && u.lessons?.slug && u.grades?.slug ? `/${u.grades.slug}/${u.lessons.slug}/${u.slug}/${t.slug}` : null,
  };
}
