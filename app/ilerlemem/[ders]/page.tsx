'use client';

// Ders raporu (İlerlemem altında). Tek dersin: başarı oranı / çözülen / öğrenilen konu, ünite ünite konular
// (doğru/yanlış çubuğu + öğretim haftası), zorlandığın konular, tekrar. Derslere geçiş: geniş ekranda solda
// kenar çubuğu, dar ekranda üstte kaydırılabilir sekmeler. Veri İlerlemem ile aynı SWR önbelleklerinden.
// Görünüm (2026-10-19, kullanıcı isteği): "robotik kontrol paneli" — metal paneller, HUD köşebentleri,
// reaktör göstergesi, LED segmentli çubuklar, neon vurgular (bkz. LessonReport.module.css).
// Konu satırları (2026-10-25, kullanıcı isteği): satır link değil; çubuğun altında "Soru çöz" (konu testi
// sayfa değiştirmeden tam ekran açılır, bkz. useQuizTestLauncher) + "Konu anlatımı" düğmeleri.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { Chakra_Petch, Inter, JetBrains_Mono } from 'next/font/google';
import { ArrowLeft, ChevronLeft, Loader2, Play } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import { useTopicMastery } from '../../src/hooks/useTopicMastery';
import { onQuizModalClosed } from '../../src/lib/panelRefreshBridge';
import { topicTestEndpoint, useQuizTestLauncher, type QuizTestConflict } from '../../src/hooks/useQuizTestLauncher';
import { AuthPrompt } from '../../src/components/AuthPrompt';
import { accuracyTone, lessonHref, totalsOf, unitReports, type Totals, type UnitReport } from '../../src/lib/lessonReports';
import { MASTERY_RULES, weakestTopics, type LessonMastery, type TopicMastery } from '../../src/lib/topicMastery';
import s from './LessonReport.module.css';

const displayFont = Chakra_Petch({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700'], variable: '--font-r-display', display: 'swap' });
const bodyFont = Inter({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-r-body', display: 'swap' });
const monoFont = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], weight: ['500', '600'], variable: '--font-r-mono', display: 'swap' });

const REFRESH_KEYS = new Set(['topic-mastery', 'review-due']);
const SEGMENTS = 20;
const TONE_CLASS = { good: s.tGood, mid: s.tMid, bad: s.tBad, none: s.tNone } as const;

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

function TopicRow({ t, quiz }: { t: TopicMastery; quiz: QuizUi }) {
  const totals = totalsOf([t]);
  const { total, solved, correct } = totals;
  const placeKey = `unit-${t.id}`;
  return (
    <li className={s.topic}>
      <span className={s.topicName}>{t.title}</span>
      <div className={s.topicRight}>
        <span className={s.topicData}>
          <TopicBar totals={totals} />
          <span className={s.topicStats}>{total === 0 ? 'Yakında' : `${solved}/${total} çözüldü · ${correct} doğru · ${solved - correct} yanlış`}</span>
        </span>
        {t.test && (
          <SolveButton
            placeKey={placeKey}
            t={t}
            quiz={quiz}
            label={<Play className={s.playIcon} aria-hidden="true" />}
            className={s.playBtn}
          />
        )}
      </div>
      <QuizNotice placeKey={placeKey} t={t} quiz={quiz} />
    </li>
  );
}

// Ünite bazlı başarı oranı sütun grafiği (SVG/CSS, sıfır harici kütüphane).
// Sütuna tıklayınca sayfadaki ilgili ünite kartına kaydırır.
function UnitChart({ units }: { units: UnitReport[] }) {
  return (
    <section aria-labelledby="unite-grafik" className={cx(s.panel, s.chartPanel)}>
      <div className={s.chartHead}>
        <div>
          <p className={s.label}>Grafik</p>
          <h2 id="unite-grafik" className={s.chartTitle}>Ünitelere göre başarı</h2>
        </div>
        <span className={s.note}>üniteye gitmek için sütuna tıkla</span>
      </div>
      <div className={s.barChartScroll}>
        <div className={s.barChartWrap}>
          {/* Yatay kılavuz çizgileri (%100, %50, %0) */}
          <div className={s.barGrid} aria-hidden="true">
            <span className={s.barGridLine}><i>100%</i></span>
            <span className={s.barGridLine}><i>50%</i></span>
            <span className={s.barGridLine}><i>0%</i></span>
          </div>
          <ul className={s.barCols}>
            {units.map((u, i) => {
              const acc = u.totals.accuracy;
              const tone = accuracyTone(acc);
              const pct = acc ?? 0;
              const solvedRatio = u.totals.total > 0 ? Math.round((u.totals.solved / u.totals.total) * 100) : 0;
              return (
                <li key={u.key} className={s.barCol}>
                  <a
                    href={`#unit-${i + 1}`}
                    className={s.barLink}
                    title={`${i + 1}. ${u.title} — ${acc == null ? (u.totals.solved === 0 ? 'Başlanmadı' : 'Veri az') : `%${acc} başarı`} (${u.totals.solved}/${u.totals.total} soru)`}
                  >
                    <span className={cx(s.barVal, TONE_CLASS[tone])}>
                      {acc == null ? '—' : `%${acc}`}
                    </span>
                    <span className={s.barWell}>
                      <span
                        className={cx(s.barFill, tone === 'good' && s.barFillGood, tone === 'mid' && s.barFillMid, tone === 'bad' && s.barFillBad)}
                        style={{ height: `${acc == null ? (u.totals.solved > 0 ? Math.max(8, solvedRatio * 0.35) : 4) : Math.max(8, pct)}%` }}
                      />
                    </span>
                    <span className={s.barIdx}>Ü{i + 1}</span>
                    <span className={s.barSub}>{u.totals.solved}/{u.totals.total}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

// Ders genelinde Doğru / Yanlış / Kalan dağılımı (hafif SVG halka grafik).
function QuestionBreakdownChart({ totals }: { totals: Totals }) {
  const { total, solved, correct } = totals;
  const wrong = Math.max(0, solved - correct);
  const remaining = Math.max(0, total - solved);
  const solvedPct = total > 0 ? Math.round((solved / total) * 100) : 0;

  const rRadius = 42;
  const circ = 2 * Math.PI * rRadius;
  const goodLen = total > 0 ? (correct / total) * circ : 0;
  const badLen = total > 0 ? (wrong / total) * circ : 0;

  return (
    <section aria-labelledby="dagilim-grafik" className={cx(s.panel, s.chartPanel)}>
      <div className={s.chartHead}>
        <div>
          <p className={s.label}>Dağılım</p>
          <h2 id="dagilim-grafik" className={s.chartTitle}>Soru özeti</h2>
        </div>
      </div>
      <div className={s.donutBody}>
        <div className={s.donutWrap}>
          <svg viewBox="0 0 108 108" className={s.donutSvg} role="img" aria-label={`${total} sorudan ${correct} doğru, ${wrong} yanlış, ${remaining} kalan`}>
            <circle cx="54" cy="54" r={rRadius} fill="none" stroke="var(--track)" strokeWidth="12" />
            {goodLen > 0 && (
              <circle
                cx="54"
                cy="54"
                r={rRadius}
                fill="none"
                stroke="#10B981"
                strokeWidth="12"
                strokeDasharray={`${goodLen} ${circ}`}
                strokeDashoffset={0}
                transform="rotate(-90 54 54)"
              />
            )}
            {badLen > 0 && (
              <circle
                cx="54"
                cy="54"
                r={rRadius}
                fill="none"
                stroke="#E11D48"
                strokeWidth="12"
                strokeDasharray={`${badLen} ${circ}`}
                strokeDashoffset={-goodLen}
                transform="rotate(-90 54 54)"
              />
            )}
          </svg>
          <div className={s.donutCenter}>
            <strong>%{solvedPct}</strong>
            <span>çözüldü</span>
          </div>
        </div>
        <dl className={s.donutLegend}>
          <div>
            <dt><i className={s.dot} style={{ background: '#10B981' }} aria-hidden="true" />Doğru</dt>
            <dd>{correct}</dd>
          </div>
          <div>
            <dt><i className={s.dot} style={{ background: '#E11D48' }} aria-hidden="true" />Yanlış</dt>
            <dd>{wrong}</dd>
          </div>
          <div>
            <dt><i className={s.dot} style={{ background: 'var(--track)' }} aria-hidden="true" />Kalan</dt>
            <dd>{remaining}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function UnitPanels({ units, quiz }: { units: UnitReport[]; quiz: QuizUi }) {
  return (
    <div className={s.units}>
      {units.map((u, i) => (
        <section key={u.key} id={`unit-${i + 1}`} aria-label={u.title} className={cx(s.panel, s.unit)}>
          <header className={s.unitHead}>
            <h3 className={s.unitTitle}>
              <span className={s.unitIdx}>{String(i + 1).padStart(2, '0')}</span>
              {u.title}
            </h3>
            <StatusChip totals={u.totals} />
          </header>
          <ul className={cx(s.topics, s.topicList)}>
            {u.topics.map((t) => <TopicRow key={t.id} t={t} quiz={quiz} />)}
          </ul>
        </section>
      ))}
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

  const back = (
    <Link href="/ilerlemem" className={s.back}>
      <ChevronLeft className="h-4 w-4" aria-hidden="true" /> İlerlemem
    </Link>
  );
  const shell = (body: React.ReactNode, mobileTop?: React.ReactNode) => (
    <div className={cx(s.root, displayFont.variable, bodyFont.variable, monoFont.variable)}>
      {mobileTop}
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
  const solvedPct = totals.total > 0 ? Math.round((totals.solved / totals.total) * 100) : 0;
  const wrongTotal = Math.max(0, totals.solved - totals.correct);
  const isEarlySample = totals.accuracy != null && totals.solved < 20;

  const mobileBar = (
    <div className={s.mobileBar}>
      <Link href="/ilerlemem" className={s.mobileBackBtn} aria-label="İlerlemem sayfasına dön">
        <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
      </Link>
      <span className={s.mobileBarTitle}>{lesson.name}</span>
      <span className={s.mobileBarPct}>
        {totals.solved}/{totals.total}
      </span>
    </div>
  );

  return shell(
    <>
      <div className={s.desktopBack}>{back}</div>

      {/* KOKPİT: sade ders başlığı */}
      <header className={cx(s.panel, s.hero)}>
        <span className={s.scan} aria-hidden="true" />
        <div>
          <p className={cx(s.label, s.status)}><i className={s.led} aria-hidden="true" />Sistem · Ders raporu</p>
          <h1 className={s.title}>{lesson.name}</h1>
          <p className={s.heroSub}>{units.length} ünite · {topicTotal} konu · {totals.total} soru</p>
        </div>
      </header>

      <div className={s.modules}>
        <div className={cx(s.panel, s.module)}>
          <div className={s.moduleTop}>
            <span className={s.label}>Soru çözüldü</span>
            <span className={s.moduleValue}>{totals.solved}<small>/{totals.total}</small></span>
          </div>
          <Segments
            ratio={totals.total ? totals.solved / totals.total : 0}
            good={totals.total ? totals.correct / totals.total : 0}
            label={`${totals.total} sorunun ${totals.correct} doğru, ${wrongTotal} yanlış, ${totals.total - totals.solved} çözülmedi`}
          />
          <p className={s.moduleSub}>
            {totals.solved === 0 ? 'Henüz soru çözülmedi' : `Toplamın %${solvedPct}'i çözüldü`}
          </p>
        </div>

        <div className={cx(s.panel, s.module)}>
          <div className={s.moduleTop}>
            <span className={s.label}>Çözülende doğruluk</span>
            <span className={cx(s.moduleValue, TONE_CLASS[tone])}>
              {totals.accuracy == null ? '—' : `%${totals.accuracy}`}
            </span>
          </div>
          <Segments
            ratio={totals.accuracy == null ? 0 : 1}
            good={totals.accuracy == null ? 0 : totals.accuracy / 100}
            label={totals.accuracy == null ? 'Yeterli veri yok' : `Çözülen ${totals.solved} soruda yüzde ${totals.accuracy} doğruluk`}
          />
          <p className={s.moduleSub}>
            {totals.accuracy == null
              ? `Hesaplamak için en az ${MASTERY_RULES.minSolvedToJudge} soru çöz`
              : `${totals.solved} soruda · ${totals.correct} doğru · ${wrongTotal} yanlış${isEarlySample ? ' · erken veri' : ''}`}
          </p>
        </div>

        <div className={cx(s.panel, s.module)}>
          <div className={s.moduleTop}>
            <span className={s.label}>Konu öğrenildi</span>
            <span className={s.moduleValue}>{learned}<small>/{topicTotal}</small></span>
          </div>
          <Segments ratio={topicTotal ? learned / topicTotal : 0} label={`${topicTotal} konunun ${learned} tanesi öğrenildi`} />
          <p className={s.moduleSub}>
            {learned === 0 ? 'Henüz tamamlanan konu yok' : `${topicTotal} konudan ${learned} tanesi öğrenildi`}
          </p>
        </div>
      </div>

      {units.length > 0 && (
        <div className={s.chartsGrid}>
          <UnitChart units={units} />
          <QuestionBreakdownChart totals={totals} />
        </div>
      )}

      {units.length > 0 && (
        <section aria-labelledby="unite-basari" className={s.main}>
          <SectionHead id="unite-basari" kicker="Modüller" title="Ünitelere göre detay" />
          <div className={s.legend}>
            <span><i className={s.dot} style={{ background: '#10B981' }} aria-hidden="true" />Doğru</span>
            <span><i className={s.dot} style={{ background: '#E11D48' }} aria-hidden="true" />Yanlış</span>
            <span><i className={s.dot} style={{ background: 'var(--track)' }} aria-hidden="true" />Çözülmedi</span>
          </div>
          <UnitPanels units={units} quiz={quiz} />
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

      {player}
    </>,
    mobileBar
  );
}
