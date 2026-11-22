'use client';

// Öğrenci konu gelişim karnesi (soru bankası konu sayfası, yalnız girişli öğrenci görünümü):
// Uzun soru listesini hemen dökmek yerine sınav sonucu karnesi gibi SVG dağılım halkası,
// doğruluk/kapsam/öğrenilme özeti ve 4 hızlı erişim kartı sunar:
//   - Yanlış yaptıklarım (son cevabı yanlış) → ilgili soruları altında açar
//   - Doğru yaptıklarım (son cevabı doğru)  → ilgili soruları altında açar
//   - Tüm çözdüklerim                        → çözdüğü tüm soruları açar
//   - Çözmediklerim                          → cevap anahtarı sızdırmadan doğrudan testi başlatır
import { ArrowRight, Award, CheckCircle2, Clock, Layers, Play, XCircle } from 'lucide-react';
import type { QuestionStat } from '@/app/src/hooks/useQuestionBankViewer';
import { START_TOPIC_TEST_EVENT } from '@/app/src/lib/soruBankasiEvents';
import r from '@/app/src/components/robotic/robotic.module.css';

export type StudentQuestionView = 'none' | 'wrong' | 'correct' | 'all';

interface StudentTopicScorecardProps {
  totalQuestions: number;
  stats: Map<number, QuestionStat>;
  activeView: StudentQuestionView;
  onSelectView: (view: StudentQuestionView) => void;
}

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;

export function StudentTopicScorecard({
  totalQuestions,
  stats,
  activeView,
  onSelectView,
}: StudentTopicScorecardProps) {
  const values = [...stats.values()];
  const solvedCount = values.length;
  const unsolvedCount = Math.max(0, totalQuestions - solvedCount);

  // Son cevaba göre soru bazlı dağılım (her soru tek dilime girer → toplam = solvedCount).
  let correctCount = 0;
  let wrongCount = 0;
  let masteredCount = 0;
  let dueReviewCount = 0;
  const now = Date.now();

  for (const st of values) {
    if (st.last_answer_correct === false) wrongCount++;
    else correctCount++;
    if (st.is_mastered) masteredCount++;
    else if (st.next_review_at && new Date(st.next_review_at).getTime() <= now) dueReviewCount++;
  }

  const coveragePct = totalQuestions > 0 ? Math.round((solvedCount / totalQuestions) * 100) : 0;
  const accuracyPct = solvedCount > 0 ? Math.round((correctCount / solvedCount) * 100) : null;

  // Çok dilimli SVG halka (yeşil: doğru, kırmızı: yanlış, taban: çözülmemiş).
  const correctLen = totalQuestions > 0 ? (correctCount / totalQuestions) * RING_C : 0;
  const wrongLen = totalQuestions > 0 ? (wrongCount / totalQuestions) * RING_C : 0;

  const toggle = (view: Exclude<StudentQuestionView, 'none'>) => {
    onSelectView(activeView === view ? 'none' : view);
  };

  const launchTest = () => {
    window.dispatchEvent(new Event(START_TOPIC_TEST_EVENT));
  };

  const tabCardBase =
    'group relative flex flex-col justify-between gap-2 rounded-2xl border p-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45 sm:p-4';

  return (
    <div className={`mb-5 flex flex-col gap-5 rounded-[22px] p-4 sm:p-6 ${r.panel}`}>
      {/* ÜST BÖLÜM: SVG Halka + Performans Özeti */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
        {/* SVG Dağılım Halkası */}
        <div className="relative h-32 w-32 shrink-0" role="img" aria-label={`Kapsam: ${totalQuestions} soruda ${solvedCount} çözüldü (%${coveragePct}). ${correctCount} doğru, ${wrongCount} yanlış.`}>
          <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="56" cy="56" r={RING_R} fill="none" stroke="var(--track)" strokeWidth="10" />
            {correctLen > 0 && (
              <circle
                cx="56"
                cy="56"
                r={RING_R}
                fill="none"
                stroke="#10b981"
                strokeWidth="10"
                strokeLinecap={wrongLen === 0 && correctCount < totalQuestions ? 'round' : 'butt'}
                strokeDasharray={`${correctLen} ${RING_C}`}
                strokeDashoffset="0"
                className="transition-all duration-500"
              />
            )}
            {wrongLen > 0 && (
              <circle
                cx="56"
                cy="56"
                r={RING_R}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="10"
                strokeLinecap="butt"
                strokeDasharray={`${wrongLen} ${RING_C}`}
                strokeDashoffset={-correctLen}
                className="transition-all duration-500"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-2xl leading-none ${r.statValue}`}>%{coveragePct}</span>
            <span className="mt-1 text-[11px] font-semibold text-muted-foreground">
              {solvedCount}/{totalQuestions} soru
            </span>
          </div>
        </div>

        {/* Sağ Metrikler + Yatay Dağılım Çubuğu */}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className={r.label}>Çözülende doğruluk</p>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                <span className={`text-2xl sm:text-3xl ${r.statValue}`}>
                  {accuracyPct != null ? `%${accuracyPct}` : '—'}
                </span>
                {solvedCount > 0 ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    ({solvedCount} soruda{solvedCount < 10 ? ' · henüz az soru çözüldü' : ''})
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">Henüz soru çözülmedi</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {masteredCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                  <Award className="h-3.5 w-3.5" aria-hidden="true" /> {masteredCount} öğrenildi
                </span>
              )}
              {dueReviewCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {dueReviewCount} tekrar bekliyor
                </span>
              )}
            </div>
          </div>

          {/* Yatay Segmentli Dağılım Çubuğu */}
          <div className="flex flex-col gap-1.5">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--track)]" aria-hidden="true">
              {correctCount > 0 && (
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(correctCount / Math.max(1, totalQuestions)) * 100}%` }}
                />
              )}
              {wrongCount > 0 && (
                <div
                  className="h-full bg-rose-500 transition-all duration-500"
                  style={{ width: `${(wrongCount / Math.max(1, totalQuestions)) * 100}%` }}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                Doğru <strong className="text-default">{correctCount}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
                Yanlış <strong className="text-default">{wrongCount}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--track)] ring-1 ring-inset ring-black/10 dark:ring-white/15" aria-hidden="true" />
                Çözülmedi <strong className="text-default">{unsolvedCount}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ALT BÖLÜM: 4 Hızlı İnceleme / Aksiyon Kartı */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="group" aria-label="Soruları duruma göre incele">
        {/* Yanlış Yaptıklarım */}
        <button
          type="button"
          disabled={wrongCount === 0}
          aria-pressed={activeView === 'wrong'}
          onClick={() => toggle('wrong')}
          className={`${tabCardBase} ${
            activeView === 'wrong'
              ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/40'
              : `${r.item} hover:border-rose-500/40`
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <XCircle className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
            <span className={`text-lg leading-none ${r.statValue} text-rose-600 dark:text-rose-400`}>{wrongCount}</span>
          </span>
          <span className="block">
            <span className="block text-xs font-bold text-default sm:text-sm">Yanlışlarım</span>
            <span className="block text-[11px] text-muted-foreground">
              {wrongCount > 0 ? (activeView === 'wrong' ? 'Listeyi gizle' : 'Hataları incele') : 'Yanlışın yok'}
            </span>
          </span>
        </button>

        {/* Doğru Yaptıklarım */}
        <button
          type="button"
          disabled={correctCount === 0}
          aria-pressed={activeView === 'correct'}
          onClick={() => toggle('correct')}
          className={`${tabCardBase} ${
            activeView === 'correct'
              ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40'
              : `${r.item} hover:border-emerald-500/40`
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            <span className={`text-lg leading-none ${r.statValue} text-emerald-600 dark:text-emerald-400`}>{correctCount}</span>
          </span>
          <span className="block">
            <span className="block text-xs font-bold text-default sm:text-sm">Doğrularım</span>
            <span className="block text-[11px] text-muted-foreground">
              {correctCount > 0 ? (activeView === 'correct' ? 'Listeyi gizle' : 'Tekrar göz at') : 'Henüz yok'}
            </span>
          </span>
        </button>

        {/* Tüm Çözdüklerim */}
        <button
          type="button"
          disabled={solvedCount === 0}
          aria-pressed={activeView === 'all'}
          onClick={() => toggle('all')}
          className={`${tabCardBase} ${
            activeView === 'all'
              ? `${r.neonBorder} ${r.tint}`
              : `${r.item} ${r.itemHover}`
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <Layers className={`h-4 w-4 shrink-0 ${r.accent}`} aria-hidden="true" />
            <span className={`text-lg leading-none ${r.statValue}`}>{solvedCount}</span>
          </span>
          <span className="block">
            <span className="block text-xs font-bold text-default sm:text-sm">Çözdüklerim</span>
            <span className="block text-[11px] text-muted-foreground">
              {solvedCount > 0 ? (activeView === 'all' ? 'Listeyi gizle' : 'Tümünü incele') : 'Henüz yok'}
            </span>
          </span>
        </button>

        {/* Çözmediklerim → Testi Başlat */}
        <button
          type="button"
          onClick={launchTest}
          className={`${tabCardBase} ${
            unsolvedCount > 0
              ? `border-transparent text-white ${r.btnNeon}`
              : `${r.item} hover:border-emerald-500/40`
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <Play className={`h-4 w-4 shrink-0 ${unsolvedCount > 0 ? 'text-white' : 'text-emerald-500'}`} aria-hidden="true" />
            <span className={`text-lg leading-none ${r.statValue} ${unsolvedCount > 0 ? '!text-white' : ''}`}>{unsolvedCount}</span>
          </span>
          <span className="block">
            <span className={`flex items-center gap-1 text-xs font-bold sm:text-sm ${unsolvedCount > 0 ? 'text-white' : 'text-default'}`}>
              {unsolvedCount > 0 ? 'Çözmediklerim' : 'Tamamlandı'}
              <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
            <span className={`block text-[11px] ${unsolvedCount > 0 ? 'text-white/85' : 'text-muted-foreground'}`}>
              {unsolvedCount > 0 ? 'Testle çözmeye başla' : 'Tekrar testi çöz'}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
