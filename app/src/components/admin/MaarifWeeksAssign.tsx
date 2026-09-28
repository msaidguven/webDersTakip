'use client';

import { useState } from 'react';
import type { MatchSuccess, OutcomeMatch, WeekRange } from '@/app/src/lib/yillikPlan/matchMaarifPlan';

type Props = { file: File; gradeId: number | null; lessonId: number | null };
type Written = { links: number; weeks: number };

const fmt = (w: WeekRange | null) => (!w ? '—' : w.start === w.end ? `${w.start}` : `${w.start}-${w.end}`);
const isChanged = (o: OutcomeMatch) => !!o.proposed && fmt(o.current) !== fmt(o.proposed);
const isNew = (o: OutcomeMatch) => !!o.proposed && !o.current;

// Maarif formatındaki yıllık plandan seçili ders+sınıfın tüm ünitelerine tek seferde hafta
// atar (bkz. app/api/admin/yillik-plan/maarif-weeks). Önizleme = onay ekranı; kaydetme
// sunucuda eşleştirmeyi yeniden yapıp tek transaction'da yazar. Dosya/sınıf/ders değişince
// üst bileşen `key` ile yeniden monte eder (eski önizleme kalmasın).
export default function MaarifWeeksAssign({ file, gradeId, lessonId }: Props) {
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MatchSuccess | null>(null);
  const [written, setWritten] = useState<Written | null>(null);

  async function send(commit: boolean) {
    if (gradeId == null || lessonId == null) return;
    setBusy(commit ? 'commit' : 'preview');
    setError(null);
    if (!commit) setWritten(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('gradeId', String(gradeId));
      fd.append('lessonId', String(lessonId));
      fd.append('commit', String(commit));
      const res = await fetch('/api/admin/yillik-plan/maarif-weeks', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'İstek başarısız');
        if (commit) setPreview(null);
        return;
      }
      setPreview(data.result as MatchSuccess);
      if (commit) setWritten(data.written as Written);
    } catch {
      setError('İstek başarısız (ağ hatası)');
    } finally {
      setBusy(null);
    }
  }

  const noSelection = gradeId == null || lessonId == null;
  const s = preview?.stats;

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        Yüklenen Maarif yıllık planındaki her süreç bileşeni (ör. <span className="font-mono">FB.6.1.2.a</span>) kendi koduyla DB&apos;deki kazanıma
        eşlenir ve seçili ders/sınıfın <strong>tüm ünitelerine</strong> tek seferde hafta atanır. Kazanımları henüz koda bağlı olmayan derslerde sıraya göre
        eşleştirilir; sıra, harf ve ünite sınırları birebir tutmazsa hiçbir şey kaydedilmez, tutarsa kodlar da yazılır.
      </p>

      {noSelection && (
        <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
          ⚠️ Önce yukarıda Sınıf ve Ders seçin.
        </p>
      )}

      <button
        onClick={() => send(false)}
        disabled={noSelection || busy != null}
        className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {busy === 'preview' ? 'Kontrol ediliyor…' : '🔍 Eşleşmeyi Önizle'}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-3">
          ❌ {error}
        </p>
      )}

      {preview && s && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-border bg-surface p-3 text-xs space-y-1.5">
            <p className="font-bold text-foreground">
              {preview.mode === 'code' ? 'Kod eşleştirmesi' : `Sıra eşleştirmesi — ${preview.links.length} öğrenme çıktısı kodu da DB'ye yazılacak`}
            </p>
            <p className="text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {s.matched}/{s.total} eşleşti
              </span>
              {s.added > 0 && ` · ${s.added} kazanıma ilk kez hafta atanacak`}
              {s.changed > 0 && ` · ${s.changed} kazanımın mevcut haftası değişecek`}
              {s.added + s.changed === 0 && ' · haftalar zaten planla aynı'}
              {s.viaLearningOutcome > 0 && ` · ${s.viaLearningOutcome} alt madde planda yazılmamış, öğrenme çıktısının haftası kullanıldı (*)`}
              {s.unmatched > 0 && <span className="text-red-600 dark:text-red-400 font-semibold"> · {s.unmatched} eşleşmedi (dokunulmayacak)</span>}
            </p>
            {preview.unusedPlanCodes.length > 0 && (
              <p className="text-amber-600 dark:text-amber-400">Planda olup DB&apos;de karşılığı olmayan kodlar: {preview.unusedPlanCodes.join(', ')}</p>
            )}
          </div>

          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {preview.units.map((u) => {
              const outcomes = u.topics.flatMap((t) => t.outcomes);
              const added = outcomes.filter(isNew).length;
              const changed = outcomes.filter((o) => isChanged(o) && !isNew(o)).length;
              const unmatched = outcomes.filter((o) => !o.proposed).length;
              return (
                <details key={u.unitId} className="rounded-lg border border-border bg-surface">
                  <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold text-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{u.title}</span>
                    <span className="font-normal text-muted-foreground">
                      {outcomes.length} kazanım{added > 0 && ` · ${added} yeni`}{changed > 0 && ` · ${changed} değişecek`}
                      {unmatched > 0 && <span className="text-red-600 dark:text-red-400"> · {unmatched} eşleşmedi</span>}
                    </span>
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    {u.topics.map((t) => (
                      <div key={t.topicId}>
                        <p className="text-[11px] font-bold text-foreground mt-1">{t.title}</p>
                        <ul className="mt-0.5 space-y-0.5">
                          {t.outcomes.map((o) => (
                            <li key={o.outcomeId} className="text-[11px] text-muted-foreground flex gap-2">
                              <span className="font-mono text-indigo-600 dark:text-indigo-300 shrink-0">
                                {o.code ?? '?'} {o.letter ?? ''})
                              </span>
                              <span className="flex-1 min-w-0 truncate" title={o.description}>
                                {o.description}
                              </span>
                              <span
                                className={`shrink-0 font-mono ${
                                  !o.proposed ? 'text-red-600 dark:text-red-400' : isChanged(o) ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
                                }`}
                              >
                                {!o.proposed ? 'eşleşmedi' : isNew(o) ? `yeni: ${fmt(o.proposed)}` : isChanged(o) ? `${fmt(o.current)} → ${fmt(o.proposed)}` : fmt(o.proposed)}
                                {o.source === 'learning-outcome' && ' *'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
          {s.viaLearningOutcome > 0 && <p className="text-[11px] text-muted-foreground">* Planda bu harf yazılmamış; öğrenme çıktısının haftası kullanıldı.</p>}

          {!written && (
            <button
              onClick={() => send(true)}
              disabled={busy != null}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {busy === 'commit' ? 'Kaydediliyor…' : `💾 ${s.matched} kazanımın haftasını kaydet`}
            </button>
          )}
          {written && (
            <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
              ✅ {written.weeks} hafta kaydı yazıldı{written.links > 0 && `, ${written.links} öğrenme çıktısı kodu bağlandı`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
