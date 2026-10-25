import { createClient } from '@/utils/supabase/server';

// Kazanım haftası tutarlılık uyarısı (bkz. supabase/migrations/admin_week_plan_issues.sql). Standart:
// öğretim haftası (tatiller sayılmaz), içerik en geç 36. hafta, boş hafta yalnız özel hafta olabilir.
const MAX_CONTENT_WEEK = 36;

type Row = { grade_id: number; grade_name: string; lesson_id: number; lesson_name: string; max_week: number; gaps: number[] };

export default async function WeekPlanIssues() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_week_plan_issues');
  if (error) {
    return <p className="mb-6 text-sm text-red-500">Hafta kontrolü yüklenemedi: {error.message}</p>;
  }
  const issues = ((data as Row[] | null) ?? []).filter((r) => r.max_week > MAX_CONTENT_WEEK || r.gaps.length > 0);
  if (issues.length === 0) return null;

  return (
    <section aria-labelledby="hafta-uyari" className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <h2 id="hafta-uyari" className="text-sm font-bold text-foreground">⚠️ Kazanım haftalarında tutarsızlık</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        İçerik en geç {MAX_CONTENT_WEEK}. haftada bitmeli (37 = sosyal etkinlik, tatiller hafta sayılmaz). Boş hafta yalnız
        aşağıdaki listeden tanımlı bir özel hafta olabilir (ör. Okul Temelli Planlama).
      </p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
        {issues.map((r) => (
          <li key={`${r.grade_id}-${r.lesson_id}`} className="text-foreground">
            <b>{r.grade_name} {r.lesson_name}</b>
            {r.max_week > MAX_CONTENT_WEEK && <span> · son hafta {r.max_week}</span>}
            {r.gaps.length > 0 && <span> · boş hafta: {r.gaps.join(', ')}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
