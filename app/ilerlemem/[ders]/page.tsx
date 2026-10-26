'use client';

// Ders raporu (İlerlemem altında). Tek dersin: başarı oranı / çözülen / öğrenilen konu, ünite ünite konular
// (doğru/yanlış çubuğu + öğretim haftası), zorlandığın konular, tekrar. Derslere geçiş: geniş ekranda solda
// kenar çubuğu, dar ekranda üstte kaydırılabilir sekmeler. Veri İlerlemem ile aynı SWR önbelleklerinden.
// Görünüm (2026-10-19, kullanıcı isteği): "robotik kontrol paneli" — metal paneller, HUD köşebentleri,
// reaktör göstergesi, LED segmentli çubuklar, neon vurgular (bkz. LessonReport.module.css).
// Konu satırları (2026-10-25, kullanıcı isteği): satır link değil; çubuğun altında "Soru çöz" (konu testi
// sayfa değiştirmeden tam ekran açılır, bkz. useQuizTestLauncher) + "Konu anlatımı" düğmeleri.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { Chakra_Petch, Inter, JetBrains_Mono } from 'next/font/google';
import { BookOpen, ChevronLeft, Loader2, Play } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import { useTopicMastery } from '../../src/hooks/useTopicMastery';
import { useReviewDue } from '../../src/hooks/useReviewDue';
import { useTopicWeekSpans } from '../../src/hooks/useTopicWeekSpans';
import { onQuizModalClosed } from '../../src/lib/panelRefreshBridge';
import { topicTestEndpoint, useQuizTestLauncher, type QuizTestConflict } from '../../src/hooks/useQuizTestLauncher';
import { AuthPrompt } from '../../src/components/AuthPrompt';
import { accuracyTone, lessonHref, totalsOf, unitReports, type Totals, type UnitReport } from '../../src/lib/lessonReports';
import { mergeWeekSpans, weekLabel, type WeekRange } from '../../src/lib/kazanimPlan';
import { MASTERY_RULES, weakestTopics, type LessonMastery, type TopicMastery } from '../../src/lib/topicMastery';
import s from './LessonReport.module.css';

const displayFont = Chakra_Petch({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700'], variable: '--font-r-display', display: 'swap' });
const bodyFont = Inter({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-r-body', display: 'swap' });
const monoFont = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], weight: ['500', '600'], variable: '--font-r-mono', display: 'swap' });

const REFRESH_KEYS = new Set(['topic-mastery', 'review-due']);
const SEGMENTS = 20;
const TONE_CLASS = { good: s.tGood, mid: s.tMid, bad: s.tBad, none: s.tNone } as const;
// Göstergenin renkleri başarı tonuna göre (renk tek başına anlam taşımaz: yüzde yazıyla da var).
const TONE_COLOR = { good: 'var(--good)', mid: 'var(--mid)', bad: 'var(--bad)', none: 'var(--neon)' } as const;

function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(' ');
}

function SectionHead({ id, kicker, title, note }: { id: string; kicker: string; title: string; note?: string }) {
  return (
    <div className={s.sectionHead}>
      <div>
        <p className={s.label}>{kicker}</p>
        <h2 id={id} className={s.h2}>{title}</h2>
      </div>
      {note && <span className={s.note}>{note}</span>}
    </div>
  );
}

// LED segmentli ilerleme çubuğu (oran 0–1). `good` verilirse yanan segmentlerin ilk kısmı doğru, kalanı
// yanlış renginde (anasayfadaki doğru / yanlış / çözülmedi çubuğu gibi).
function Segments({ ratio, good, label }: { ratio: number; good?: number; label: string }) {
  const toSeg = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * SEGMENTS);
  const on = toSeg(ratio);
  const goodOn = good == null ? on : Math.min(on, toSeg(good));
  return (
    <div className={s.segments} role="img" aria-label={label}>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={cx(s.seg, i < on && (good == null ? s.segOn : i < goodOn ? s.segGood : s.segBad))} />
      ))}
    </div>
  );
}

function StatusChip({ totals }: { totals: Totals }) {
  const { solved, accuracy, total } = totals;
  if (total === 0) return <span className={cx(s.chip, s.tNone)}>yakında</span>;
  return (
    <span className={cx(s.chip, TONE_CLASS[accuracyTone(accuracy)])}>
      {solved === 0 ? 'başlanmadı' : accuracy == null ? 'veri az' : `%${accuracy} başarı`}
    </span>
  );
}

// Öğretim haftası: kartın (ünite/konu) sol üst köşesine oturan sekme.
function CornerWeek({ range, className }: { range: WeekRange | null | undefined; className?: string }) {
  if (!range) return null;
  return <span className={cx(s.cornerWeek, className)}>{weekLabel(range)}</span>;
}

function TopicBar({ totals }: { totals: Totals }) {
  const { total, solved, correct } = totals;
  const wrong = solved - correct;
  return (
    <span className={s.bar} role="img" aria-label={total === 0 ? 'Henüz soru yok' : `${total} sorunun ${correct} doğru, ${wrong} yanlış, ${total - solved} çözülmedi`}>
      {total > 0 && (
        <>
          <span className={s.barGood} style={{ width: `${(correct / total) * 100}%` }} />
          <span className={s.barBad} style={{ width: `${(wrong / total) * 100}%` }} />
        </>
      )}
    </span>
  );
}

// Sayfadaki tek test oynatıcısının durumu. `activeKey` hangi düğmeden açıldığını tutar (aynı konu hem
// ünite listesinde hem "Zorlandığın konular"da olabilir): yükleniyor/hata/çakışma yalnız orada görünür.
interface QuizUi {
  activeKey: string | null;
  loading: boolean;
  error: string | null;
  conflict: QuizTestConflict | null;
  solve: (key: string, t: TopicMastery, forceNew?: boolean) => void;
}

// href (orta tık / yeni sekme) konunun soru bankası sayfası; düz sol tık testi bu sayfada açar.
function SolveButton({ placeKey, t, quiz, label, className }: { placeKey: string; t: TopicMastery; quiz: QuizUi; label: React.ReactNode; className: string }) {
  const busy = quiz.loading && quiz.activeKey === placeKey;
  return (
    <a
      href={t.href ?? undefined}
      aria-label={`${t.title} sorularını çöz`}
      aria-busy={busy || undefined}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        quiz.solve(placeKey, t);
      }}
      className={className}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : label}
    </a>
  );
}

function QuizNotice({ placeKey, t, quiz }: { placeKey: string; t: TopicMastery; quiz: QuizUi }) {
  if (quiz.activeKey !== placeKey || quiz.loading) return null;
  if (quiz.error) return <p role="alert" className={cx(s.notice, s.noticeError)}>{quiz.error}</p>;
  const c = quiz.conflict;
  if (!c) return null;
  return (
    <div role="alert" className={s.notice}>
      <span>Bu ünitede yarım kalmış bir testin var: {c.scopeLabel} ({c.answeredCount}/{c.total})</span>
      <span className={s.topicActions}>
        <Link href={`${c.href}?devam=1`} className={cx(s.tag, s.tagMuted)}>Yarım teste git</Link>
        <button type="button" onClick={() => quiz.solve(placeKey, t, true)} className={cx(s.tag, s.tagSolve)}>
          Yeni test başlat
        </button>
      </span>
    </div>
  );
}

function TopicRow({ t, week, quiz }: { t: TopicMastery; week: WeekRange | null | undefined; quiz: QuizUi }) {
  const totals = totalsOf([t]);
  const { total, solved, correct } = totals;
  const placeKey = `unit-${t.id}`;
  return (
    <li className={cx(s.topic, week && s.topicHasWeek)}>
      <CornerWeek range={week} />
      <span className={s.topicName}>{t.title}</span>
      <span className={s.topicData}>
        <TopicBar totals={totals} />
        <span className={s.topicMeta}>
          <span className={s.topicStats}>{total === 0 ? 'Yakında' : `${solved}/${total} çözüldü · ${correct} doğru · ${solved - correct} yanlış`}</span>
          {(t.test || t.contentHref) && (
            <span className={s.topicActions}>
              {t.test && (
                <SolveButton
                  placeKey={placeKey}
                  t={t}
                  quiz={quiz}
                  label={<><Play className={s.tagIcon} aria-hidden="true" />Soru çöz</>}
                  className={cx(s.tag, s.tagSolve)}
                />
              )}
              {t.contentHref && (
                <Link href={t.contentHref} aria-label={`${t.title} konu anlatımı`} className={cx(s.tag, s.tagMuted)}>
                  <BookOpen className={s.tagIcon} aria-hidden="true" />Konu anlatımı
                </Link>
              )}
            </span>
          )}
        </span>
      </span>
      <QuizNotice placeKey={placeKey} t={t} quiz={quiz} />
    </li>
  );
}

function UnitPanels({ units, weekSpans, quiz }: { units: UnitReport[]; weekSpans?: Record<number, WeekRange | null>; quiz: QuizUi }) {
  return (
    <div className={s.units}>
      {units.map((u, i) => {
        const week = mergeWeekSpans(u.topics.map((t) => weekSpans?.[t.id]));
        return (
          <section key={u.key} aria-label={u.title} className={cx(s.panel, s.unit, week && s.unitHasWeek)}>
            <CornerWeek range={week} className={s.cornerWeekUnit} />
            <header className={s.unitHead}>
              <h3 className={s.unitTitle}>
                <span className={s.unitIdx}>{String(i + 1).padStart(2, '0')}</span>
                {u.title}
              </h3>
              <StatusChip totals={u.totals} />
            </header>
            <ul className={cx(s.topics, s.topicList)}>
              {u.topics.map((t) => <TopicRow key={t.id} t={t} week={weekSpans?.[t.id]} quiz={quiz} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// Geniş ekran: solda dersler, her birinde başarı oranı. Sorusu olmayan ders soluk ve tıklanamaz.
function LessonSidebar({ lessons, current }: { lessons: LessonMastery[]; current: string }) {
  return (
    <nav aria-label="Dersler" className={cx(s.panel, s.side)}>
      <p className={cx(s.label, s.sideLabel)}>Dersler</p>
      <ul className={s.sideList}>
        {lessons.map((l) => {
          const t = totalsOf(l.topics);
          const active = l.slug === current;
          if (!l.slug || t.total === 0) {
            return (
              <li key={l.id} className={cx(s.sideItem, s.sideOff)}>
                <span>{l.name}</span>
                <span className={s.sidePct}>hazırlanıyor</span>
              </li>
            );
          }
          return (
            <li key={l.id}>
              <Link href={lessonHref(l.slug)} aria-current={active ? 'page' : undefined} className={cx(s.sideItem, active && s.sideActive)}>
                <span>{l.name}</span>
                <span className={cx(s.sidePct, TONE_CLASS[accuracyTone(t.accuracy)])}>{t.accuracy == null ? '—' : `%${t.accuracy}`}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function LessonReportPage() {
  const { ders } = useParams<{ ders: string }>();
  const { user, loading } = useAuth();
  const { mutate } = useSWRConfig();
  const { data: mastery, error: mErr } = useTopicMastery();
  const { data: reviewDue = 0 } = useReviewDue();

  const refreshProgress = useCallback(
    () => void mutate((key) => Array.isArray(key) && REFRESH_KEYS.has(key[0])),
    [mutate]
  );
  useEffect(() => onQuizModalClosed(refreshProgress), [refreshProgress]);

  const { open: openTest, loading: testLoading, error: testError, conflict: testConflict, player } = useQuizTestLauncher(refreshProgress);
  const [quizKey, setQuizKey] = useState<string | null>(null);
  const quiz: QuizUi = {
    activeKey: quizKey,
    loading: testLoading,
    error: testError,
    conflict: testConflict,
    solve: (key, t, forceNew = false) => {
      if (!t.test || !t.href) return;
      setQuizKey(key);
      const { gradeSlug, lessonSlug, unitSlug, topicSlug } = t.test;
      void openTest(topicTestEndpoint(gradeSlug, lessonSlug, unitSlug, topicSlug), t.href, forceNew);
    },
  };

  const lesson = mastery?.lessons.find((l) => l.slug === ders);
  const totals = useMemo(() => (lesson ? totalsOf(lesson.topics) : null), [lesson]);
  const units = useMemo(() => (lesson ? unitReports(lesson) : []), [lesson]);
  const weak = useMemo(() => (lesson ? weakestTopics([lesson], 5) : []), [lesson]);
  const topicIds = useMemo(() => units.flatMap((u) => u.topics.map((t) => t.id)), [units]);
  const { data: weekSpans } = useTopicWeekSpans(topicIds);
  const tabs = mastery?.lessons.filter((l) => l.slug && l.topics.length > 0) ?? [];
  // Seçili ders sekmesi dar ekranda kaydırma alanının dışında kalmasın.
  const activeTab = useRef<HTMLAnchorElement>(null);
  const tabsReady = tabs.length > 1;
  useEffect(() => {
    activeTab.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [ders, tabsReady]);

  const back = (
    <Link href="/ilerlemem" className={s.back}>
      <ChevronLeft className="h-4 w-4" aria-hidden="true" /> İlerlemem
    </Link>
  );
  const shell = (body: React.ReactNode) => (
    <div className={cx(s.root, displayFont.variable, bodyFont.variable, monoFont.variable)}>
      <div className={s.shell}>
        {mastery ? <LessonSidebar lessons={mastery.lessons} current={ders} /> : <div className={s.side} />}
        <main className={s.main}>{body}</main>
      </div>
    </div>
  );

  if (loading || (user && mastery === undefined && !mErr)) {
    return shell(<div aria-busy="true" aria-label="Ders raporu yükleniyor" className={s.skeleton} />);
  }
  if (!user) return shell(<>{back}<AuthPrompt message="Ders raporunu görmek için giriş yap." /></>);
  if (mErr) {
    return shell(<>{back}<p role="alert" className={s.muted}>Ders raporun şu an yüklenemedi. Sayfayı yenilemeyi dene.</p></>);
  }
  // Sınıfta olmayan ders slug'ı (ör. /ilerlemem/aylik) gerçek bir sayfa değil.
  if (!lesson || !totals) notFound();

  const learned = lesson.counts.learned;
  const topicTotal = lesson.topics.length + lesson.upcoming;
  const tone = accuracyTone(totals.accuracy);
  const pct = totals.accuracy ?? 0;

  return shell(
    <>
      {back}

      {/* KOKPİT: ders adı + reaktör göstergesi */}
      <header className={cx(s.panel, s.hero)}>
        <span className={s.scan} aria-hidden="true" />
        <div>
          <p className={cx(s.label, s.status)}><i className={s.led} aria-hidden="true" />Sistem · Ders raporu</p>
          <h1 className={s.title}>{lesson.name}</h1>
          <p className={s.heroSub}>{units.length} ünite · {topicTotal} konu · {totals.total} soru</p>
        </div>
        <div className={s.gauge}>
          <span className={s.gaugeTicks} aria-hidden="true" />
          <span
            className={s.gaugeRing}
            aria-hidden="true"
            style={{ background: `conic-gradient(${TONE_COLOR[tone]} 0 ${pct}%, var(--track) 0 100%)` }}
          />
          <div className={s.gaugeCore}>
            <div>
              <div className={cx(s.gaugeValue, TONE_CLASS[tone])}>{totals.accuracy == null ? '—' : `%${totals.accuracy}`}</div>
              <div className={s.gaugeLabel}>Başarı oranı</div>
              {totals.accuracy == null && <div className={s.gaugeNote}>en az {MASTERY_RULES.minSolvedToJudge} soru çöz</div>}
            </div>
          </div>
        </div>
      </header>

      {tabs.length > 1 && (
        <nav aria-label="Ders değiştir" className={s.tabs}>
          <ul className={s.tabList}>
            {tabs.map((l) => (
              <li key={l.id}>
                <Link
                  href={lessonHref(l.slug!)}
                  ref={l.slug === ders ? activeTab : undefined}
                  aria-current={l.slug === ders ? 'page' : undefined}
                  className={cx(s.tab, l.slug === ders && s.tabActive)}
                >
                  {l.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className={s.modules}>
        <div className={cx(s.panel, s.module)}>
          <div className={s.moduleTop}>
            <span className={s.label}>Soru çözüldü</span>
            <span className={s.moduleValue}>{totals.solved}<small>/{totals.total}</small></span>
          </div>
          <Segments
            ratio={totals.total ? totals.solved / totals.total : 0}
            good={totals.total ? totals.correct / totals.total : 0}
            label={`${totals.total} sorunun ${totals.correct} doğru, ${totals.solved - totals.correct} yanlış, ${totals.total - totals.solved} çözülmedi`}
          />
        </div>
        <div className={cx(s.panel, s.module)}>
          <div className={s.moduleTop}>
            <span className={s.label}>Konu öğrenildi</span>
            <span className={s.moduleValue}>{learned}<small>/{topicTotal}</small></span>
          </div>
          <Segments ratio={topicTotal ? learned / topicTotal : 0} label={`${topicTotal} konunun ${learned} tanesi öğrenildi`} />
        </div>
      </div>

      {units.length > 0 && (
        <section aria-labelledby="unite-basari" className={s.main}>
          <SectionHead id="unite-basari" kicker="Modüller" title="Ünitelere göre başarı oranı" />
          <div className={s.legend}>
            <span><i className={s.dot} style={{ background: '#10B981' }} aria-hidden="true" />Doğru</span>
            <span><i className={s.dot} style={{ background: '#E11D48' }} aria-hidden="true" />Yanlış</span>
            <span><i className={s.dot} style={{ background: 'var(--track)' }} aria-hidden="true" />Çözülmedi</span>
          </div>
          <UnitPanels units={units} weekSpans={weekSpans} quiz={quiz} />
        </section>
      )}

      {weak.length > 0 && (
        <section aria-labelledby="zorlandigin" className={cx(s.panel, s.alert)}>
          <SectionHead
            id="zorlandigin"
            kicker="Uyarı"
            title="Zorlandığın konular"
            note={`en az ${MASTERY_RULES.minSolvedToJudge} soru, başarı oranı %${MASTERY_RULES.weakAccuracy * 100} altı`}
          />
          <ol className={s.topics}>
            {weak.map((t) => (
              <li key={t.id} className={s.alertRow}>
                <span className={s.alertPct}>%{t.accuracy}</span>
                <span className={s.alertText}>
                  <b>{t.title}</b>
                  <small>{t.solved} soru çözdün · {t.wrong} yanlış</small>
                </span>
                {t.test && <SolveButton placeKey={`weak-${t.id}`} t={t} quiz={quiz} label="Çöz" className={cx(s.btn, s.btnNeon)} />}
                <QuizNotice placeKey={`weak-${t.id}`} t={t} quiz={quiz} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {reviewDue > 0 && (
        <section aria-labelledby="tekrar" className={cx(s.panel, s.review)}>
          <span className={s.alertText}>
            <span className={s.label} id="tekrar">Tekrar</span>
            <b>Tekrar zamanı gelen {reviewDue} soru</b>
            <small>Tekrar testi tüm derslerin zamanı gelen sorularını birlikte açar.</small>
          </span>
          <Link href="/tekrar" className={cx(s.btn, s.btnGhost)}>Tekrar et</Link>
        </section>
      )}

      {player}
    </>
  );
}
