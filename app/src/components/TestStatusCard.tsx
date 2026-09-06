'use client';

// Soru bankası sayfalarındaki (konu ve ünite seviyesi) "Teste Başla"/"Teste Devam Et" kartı.
// Sayfanın geri kalanı (SEO içeriği, İncele modu) statik/ISR kalsın diye bu kart kendi
// durumunu (topic-status/unit-status) client'ta ayrıca çeker (DersClientCards.tsx'teki
// topicCount fetch'iyle aynı desen) — sonuca göre ya "Teste Başla" (+ bu konuda/ünitede
// bugüne kadarki doğru/yanlış) ya da "Teste Devam Et" (+ yarım kalan oturumun ilerlemesi,
// dairesel gösterge ile) gösterir.
//
// ÖNEMLİ (kullanıcının 2026-09-05 isteği, sertçe tekrarlandı): tıklama URL'İ HİÇ
// DEĞİŞTİRMEZ. Önceki sürüm Next.js intercepting route (app/soru-bankasi/@modal) ile
// /.../kavrama-testi URL'ine "sanal" geçiş yapıyordu — bu teknik olarak doğru çalışıyordu
// (adres çubuğu değişse de görsel olarak modal açılıyordu) ama kullanıcı adres çubuğunun
// değişmesini istemiyor, özellikle ?soru=ID gibi bir konuma deep-link'lenmişken o URL'de
// kalınmasını istiyor. Bu yüzden artık HİÇ navigasyon yok: tıklanınca /api/soru-bankasi/
// topic-test veya unit-test'ten QuizWithAsk'ın ihtiyaç duyduğu HER ŞEY tek istekte çekilir,
// sonuç saf React state'te tutulup QuizModal + QuizWithAsk aynı sayfada (gerçek
// kavrama-testi/unite-testi sayfasıyla AYNI motor, AYNI veri fonksiyonları) render edilir.
// href yine de gerçek test sayfasına işaret ediyor (JS kapalıyken / orta-tık yeni sekmede
// açmak için progressive enhancement) — düz sol tık preventDefault ile yakalanıp yukarıdaki
// akışa yönlendiriliyor.
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { SoruBankasiTestStatus } from '@/app/src/lib/soruBankasiStatus';
import type { QuizQuestion } from '@/app/src/lib/quizQuestions';
import QuizModal from '@/app/src/components/QuizModal';
import QuizWithAsk from '@/app/src/components/QuizWithAsk';

interface TestData {
  gradeId: number;
  lessonId: number;
  unitId: number;
  topicId?: number;
  scopeLabel: string;
  initialQuestions: QuizQuestion[];
  remainingQuestionIds: number[];
  allCaughtUp: boolean;
  resume: { sessionId: number; answers: { questionId: number; isCorrect: boolean }[] } | null;
  reloadEndpoint: string;
  questionBankPathBase?: string;
  secondsPerQuestion?: number | null;
  intro?: { subLabel: string; description: string | null; topicCount: number | null; questionCount: number | null };
}

interface TestStatusCardProps {
  scope: 'topic' | 'unit';
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  topicSlug?: string;
  topicId?: number;
  unitId: number;
  title: string;
  color: 'indigo' | 'emerald';
}

const COLOR_CLASSES = {
  indigo: { ring: 'text-indigo-500', button: 'bg-indigo-600 hover:bg-indigo-700' },
  emerald: { ring: 'text-emerald-500', button: 'bg-emerald-600 hover:bg-emerald-700' },
} as const;

// r=40, çevre = 2*pi*40 ≈ 251.33 — yüzdeye göre strokeDashoffset hesaplanıyor,
// -rotate-90 ile başlangıç 12 yönüne (saat başı) çekiliyor. Yarım kalan test bölümü
// (compact) daha küçük bir halka kullanıyor (kullanıcının 2026-09-06 isteği).
const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_RADIUS_COMPACT = 30;
const RING_CIRCUMFERENCE_COMPACT = 2 * Math.PI * RING_RADIUS_COMPACT;

// Kartın en üst satırındaki küçük istatistik kutucukları (Soru/Çözülen/Doğru/Yanlış) —
// kullanıcının 2026-09-06 isteği: "soru sayısı, çözülen, doğru, yanlış bilgisini card'lar
// ekleyerek güzelleştirelim", eskiden burası sadece "10 soruluk test" düz metniydi.
// `compact`, yarım kalan test bölümü (kullanıcının 2026-09-06 isteği: "genel bilgiler
// üstte normal boyut, yarım kalan test verileri altta biraz daha küçük") için.
function StatTile({ value, label, tone, compact }: { value: number; label: string; tone?: 'emerald' | 'rose'; compact?: boolean }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : 'text-default';
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-0.5 rounded-lg bg-surface px-1.5 py-1.5">
        <span className={`text-sm font-black ${toneClass}`}>{value}</span>
        <span className="text-[8px] font-black uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-surface px-2 py-2.5">
      <span className={`text-lg font-black sm:text-xl ${toneClass}`}>{value}</span>
      <span className="text-[9px] font-black uppercase tracking-wide text-muted-foreground sm:text-[10px]">{label}</span>
    </div>
  );
}

function ProgressRing({
  percent,
  ringClass,
  label,
  sublabel,
  compact,
}: {
  percent: number;
  ringClass: string;
  label: string;
  sublabel: string;
  compact?: boolean;
}) {
  const radius = compact ? RING_RADIUS_COMPACT : RING_RADIUS;
  const circumference = compact ? RING_CIRCUMFERENCE_COMPACT : RING_CIRCUMFERENCE;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);
  return (
    <div className={`relative flex shrink-0 items-center justify-center ${compact ? 'h-20 w-20' : 'h-28 w-28'}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth={compact ? '7' : '9'} style={{ stroke: 'var(--border)' }} />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth={compact ? '7' : '9'}
          strokeLinecap="round"
          className={ringClass}
          style={{ stroke: 'currentColor', strokeDasharray: circumference, strokeDashoffset: offset, transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-black text-default ${compact ? 'text-sm' : 'text-xl'}`}>{label}</span>
        <span className="text-[9px] font-black uppercase tracking-wide text-muted-foreground">{sublabel}</span>
      </div>
    </div>
  );
}

export default function TestStatusCard({ scope, gradeSlug, lessonSlug, unitSlug, topicSlug, topicId, unitId, title, color }: TestStatusCardProps) {
  const [status, setStatus] = useState<SoruBankasiTestStatus | null>(null);
  const [testData, setTestData] = useState<TestData | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const classes = COLOR_CLASSES[color];

  const testHref =
    scope === 'topic' ? `/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}/kavrama-testi` : `/${gradeSlug}/${lessonSlug}/${unitSlug}/unite-testi`;

  const fetchStatus = useCallback(
    (onDone: (data: SoruBankasiTestStatus | null) => void) => {
      const url =
        scope === 'topic'
          ? `/api/soru-bankasi/topic-status?topicId=${topicId}&unitId=${unitId}`
          : `/api/soru-bankasi/unit-status?unitId=${unitId}`;
      fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then(onDone)
        .catch(() => onDone(null));
    },
    [scope, topicId, unitId]
  );

  // Test kapandığında (bkz. closeTest) durumu tazelemek için — bir sonraki soru/oturum
  // için "kaç çözüldü" sayısı güncel kalsın diye. Kasıtlı olarak eski cevabı hemen
  // sıfırlamıyor (setStatus(null)) — kapanış anında kısa bir "yükleniyor" flaşı yerine
  // yeni veri gelene kadar eski sayılar görünmeye devam etsin diye.
  const refetchStatus = useCallback(() => fetchStatus(setStatus), [fetchStatus]);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    fetchStatus((data) => {
      if (!cancelled) setStatus(data);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchStatus]);

  const startOrResumeTest = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Orta tık / cmd-tık / ctrl-tık / shift-tık: tarayıcının doğal "yeni sekmede aç"
      // davranışına bırak, sadece düz sol tıkı yakalıyoruz.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (testLoading) return;

      setTestLoading(true);
      setTestError(null);
      try {
        const url =
          scope === 'topic'
            ? `/api/soru-bankasi/topic-test?gradeSlug=${gradeSlug}&lessonSlug=${lessonSlug}&unitSlug=${unitSlug}&topicSlug=${topicSlug}`
            : `/api/soru-bankasi/unit-test?gradeSlug=${gradeSlug}&lessonSlug=${lessonSlug}&unitSlug=${unitSlug}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('failed');
        const data = (await res.json()) as TestData;
        setTestData(data);
      } catch {
        setTestError('Test yüklenemedi, tekrar dener misin?');
      } finally {
        setTestLoading(false);
      }
    },
    [scope, gradeSlug, lessonSlug, unitSlug, topicSlug, testLoading]
  );

  const closeTest = useCallback(() => {
    setTestData(null);
    refetchStatus();
  }, [refetchStatus]);

  const resumable = status?.resumable ?? null;

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-default bg-surface-elevated p-4 text-center sm:p-6">
      <p className="text-base font-black text-default sm:text-lg">{title}</p>

      {!status ? (
        <div className="flex items-center gap-2 py-4 text-xs font-bold text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Durum yükleniyor…
        </div>
      ) : (
        <>
          {/* Genel bilgiler HER ZAMAN üstte, normal boyutta — yarım kalan bir test olsa
              bile bu konuda/ünitede bugüne kadarki toplam durum kaybolmasın (kullanıcının
              2026-09-06 isteği: "ünite sayfasındaki gibi tamamını da göstersin, genel
              bilgileri üstte, yarım kalan testle ilgili verileri altta göstersin"). */}
          <div className="grid w-full grid-cols-4 gap-2">
            <StatTile value={status.poolSize} label="Soru" />
            <StatTile value={status.solved} label="Çözülen" />
            <StatTile value={status.correct} label="Doğru" tone="emerald" />
            <StatTile value={status.wrong} label="Yanlış" tone="rose" />
          </div>

          {!status.loggedIn && !resumable && (
            <p className="-mt-1 text-xs font-bold text-muted-foreground">
              İstatistiklerin tutulması için giriş yapmanız gerekmektedir
            </p>
          )}

          {/* Yarım kalan test varsa ALTTA, daha küçük bir blokta — genel bilgilerle
              karışmasın diye kendi çerçevesi var. */}
          {resumable && (
            <div className="flex w-full flex-col items-center gap-2.5 rounded-xl border border-default/60 bg-surface/60 p-3">
              <p className="text-[11px] font-bold text-muted-foreground">Tamamlanmamış bir testiniz var</p>

              <ProgressRing
                compact
                percent={resumable.total ? (resumable.answeredCount / resumable.total) * 100 : 0}
                ringClass={classes.ring}
                label={`${resumable.answeredCount}/${resumable.total}`}
                sublabel="Soru"
              />

              <div className="grid w-full grid-cols-4 gap-1.5">
                <StatTile compact value={resumable.total} label="Soru" />
                <StatTile compact value={resumable.answeredCount} label="Çözülen" />
                <StatTile compact value={resumable.correctCount} label="Doğru" tone="emerald" />
                <StatTile compact value={resumable.wrongCount} label="Yanlış" tone="rose" />
              </div>
            </div>
          )}

          {/* Giriş yapılmamışsa "Teste Başla" devre dışı — kaydedilmeyen bir test açmanın
              anlamı yok, giriş yapması için yönlendiriliyor (kullanıcının 2026-09-06 isteği).
              Soru Bankası (cevap anahtarlı, tam liste) bölümü ise misafirde hâlâ açık kalıyor
              (bkz. SoruBankasiBrowseSection.tsx) — en azından o içerikten faydalansın. */}
          {resumable ? (
            <a
              href={testHref}
              onClick={startOrResumeTest}
              className={`flex w-full items-center justify-center gap-1.5 rounded-xl ${classes.button} px-4 py-3 text-sm font-black text-white transition-colors ${testLoading ? 'pointer-events-none opacity-60' : ''}`}
            >
              {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Teste Devam Et <ArrowRight className="h-4 w-4" /></>}
            </a>
          ) : status.loggedIn ? (
            <a
              href={testHref}
              onClick={startOrResumeTest}
              className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-xl ${classes.button} px-4 py-3 text-white transition-colors ${testLoading ? 'pointer-events-none opacity-60' : ''}`}
            >
              {testLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span className="flex items-center gap-1.5 text-sm font-black">
                    Teste Başla <ArrowRight className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-bold text-white/80">{status.testSize} Soru Çöz</span>
                </>
              )}
            </a>
          ) : (
            <div
              aria-disabled="true"
              className="flex w-full cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-xl bg-gray-200 px-4 py-3 text-gray-400"
            >
              <span className="text-sm font-black">Teste Başla</span>
              <span className="text-[11px] font-bold">Giriş yapmanız gerekiyor</span>
            </div>
          )}
        </>
      )}

      {testError && <p className="text-xs font-bold text-rose-500">{testError}</p>}

      {testData && (
        <QuizModal onClose={closeTest}>
          <QuizWithAsk
            key={testData.resume?.sessionId ?? 'new'}
            gradeId={testData.gradeId}
            lessonId={testData.lessonId}
            unitId={testData.unitId}
            topicId={testData.topicId}
            scopeLabel={testData.scopeLabel}
            exitHref={testHref}
            exitLabel="Kapat"
            onExit={closeTest}
            initialQuestions={testData.initialQuestions}
            remainingQuestionIds={testData.remainingQuestionIds}
            allCaughtUp={testData.allCaughtUp}
            reloadEndpoint={testData.reloadEndpoint}
            secondsPerQuestion={testData.secondsPerQuestion ?? undefined}
            resume={testData.resume}
            questionBankPathBase={testData.questionBankPathBase}
            // intro BİLEREK verilmiyor: kullanıcı zaten bu karttaki "Teste Başla/Devam Et"
            // butonuna tıklayarak testi başlatmayı onaylamış oluyor — modal içinde ayrıca bir
            // "kapak sayfası" (intro) gösterip ikinci kez "Başla" dedirtmek gereksiz bir adım
            // (kullanıcının 2026-09-06 bildirdiği bug).
          />
        </QuizModal>
      )}
    </div>
  );
}
