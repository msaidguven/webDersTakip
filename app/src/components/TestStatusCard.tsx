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
// sonuç saf React state'te tutulup QuizWithAsk (presentation="player", tam ekran) aynı sayfada
// render edilir. Ayrı kavrama-testi/unite-testi sayfaları 2026-10-24'te kaldırıldı; testin tek
// yeri bu kart. href (orta-tık yeni sekme için) kartın kendi soru bankası sayfasını gösterir —
// düz sol tık preventDefault ile yakalanıp yukarıdaki akışa yönlendiriliyor.
import { useCallback, useEffect, useRef, useState } from 'react';
import { QUESTION_BANK_STATS_REFRESH_EVENT } from '@/app/src/hooks/useQuestionBankViewer';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { SoruBankasiTestStatus } from '@/app/src/lib/soruBankasiStatus';
import { topicTestEndpoint, unitTestEndpoint, useQuizTestLauncher } from '@/app/src/hooks/useQuizTestLauncher';
import { withPublicFlag } from '@/app/src/lib/clientSession';
import r from './robotic/robotic.module.css';

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
  // Misafire gösterilecek özel içerik (ör. konu sayfasındaki kapak + mini test, bkz.
  // GuestTestCover). Verilmezse varsayılan üyelik çağrısı (GuestTestCta).
  guestContent?: React.ReactNode;
}

const COLOR_CLASSES = {
  // indigo: soru bankasında robotik tema neon düğmesi/çubuğu (2026-10-19).
  indigo: { button: r.btnNeon, bar: r.fill },
  emerald: { button: 'bg-emerald-600 hover:bg-emerald-700', bar: 'bg-emerald-500' },
} as const;

// 2026-09-26 sadeleştirmesi: kart eskiden iki ayrı istatistik bloğu (genel 3 kutu + yarım
// kalan test için halka ve 4 kutu) gösteriyordu, "0/10" ile "10 soru · 0 çözülen" aynı şeyi
// iki kez söylüyordu. Artık: tek ilerleme çubuğu + tek satır doğru/yanlış/başarı özeti +
// tek buton; yarım kalan testin durumu butonun alt satırında.
function SolvedProgressBar({ solved, total, barClass }: { solved: number; total: number; barClass: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((solved / total) * 100)) : 0;
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-muted-foreground">
        <span>
          <span className="text-default">{solved}/{total}</span> soru çözüldü
        </span>
        <span className="font-black text-default">%{pct}</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-background"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Çözülen soru oranı"
      >
        <div className={`h-full rounded-full ${barClass} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ResultSummary({ correct, wrong, solved }: { correct: number; wrong: number; solved: number }) {
  if (solved === 0) return null;
  return (
    <p className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
      <span className="text-emerald-600">✓ {correct} doğru</span>
      <span className="text-rose-600">✗ {wrong} yanlış</span>
      <span className="text-muted-foreground">%{Math.round((correct / solved) * 100)} başarı</span>
    </p>
  );
}

export default function TestStatusCard({ scope, gradeSlug, lessonSlug, unitSlug, topicSlug, topicId, unitId, title, color, guestContent }: TestStatusCardProps) {
  const [status, setStatus] = useState<SoruBankasiTestStatus | null>(null);
  const classes = COLOR_CLASSES[color];

  // Ayrı test sayfaları kaldırıldı (2026-10-24) — yedek href artık kartın bulunduğu soru bankası sayfası.
  const testHref = `/soru-bankasi/${gradeSlug}/${lessonSlug}/${unitSlug}${scope === 'topic' ? `/${topicSlug}` : ''}`;

  const fetchStatus = useCallback(
    (onDone: (data: SoruBankasiTestStatus | null) => void) => {
      const url =
        scope === 'topic'
          ? `/api/soru-bankasi/topic-status?topicId=${topicId}&unitId=${unitId}`
          : `/api/soru-bankasi/unit-status?unitId=${unitId}`;
      withPublicFlag(url)
        .then((u) => fetch(u))
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

  // Test kapandığında durumu ve sayfadaki "çözdüğün sorular" listesini (useQuestionBankViewer) tazele.
  const onTestClosed = useCallback(() => {
    refetchStatus();
    window.dispatchEvent(new Event(QUESTION_BANK_STATS_REFRESH_EVENT));
  }, [refetchStatus]);
  const { open, loading: testLoading, error: testError, conflict: conflictInfo, player } = useQuizTestLauncher(onTestClosed);
  const requestTest = useCallback(
    (forceNew: boolean) =>
      open(
        scope === 'topic' ? topicTestEndpoint(gradeSlug, lessonSlug, unitSlug, topicSlug!) : unitTestEndpoint(gradeSlug, lessonSlug, unitSlug),
        testHref,
        forceNew
      ),
    [open, scope, gradeSlug, lessonSlug, unitSlug, topicSlug, testHref]
  );

  const startOrResumeTest = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Orta tık / cmd-tık / ctrl-tık / shift-tık: tarayıcının doğal "yeni sekmede aç"
      // davranışına bırak, sadece düz sol tıkı yakalıyoruz.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      void requestTest(false);
    },
    [requestTest]
  );

  // "Aynı ünitede yarım kalmış testin var" uyarısındaki "Yeni Test Başlat" — eski (çakışan)
  // oturum kapatılıp bu test normal şekilde başlatılır (bkz. quizPageData.ts'teki forceNew).
  const startNewIgnoringConflict = useCallback(() => void requestTest(true), [requestTest]);

  // İlerlemem'deki "devam et" linki ?devam=1 ile gelir: yarım test varsa oynatıcı hemen açılır.
  // window.location ile okunuyor (useSearchParams ISR sayfasını dinamik yapardı); parametre bir
  // kez kullanılıp adresten silinir ki yenilemede/geri gelişte tekrar açılmasın.
  const resumeRequested = useRef(false);
  useEffect(() => {
    if (resumeRequested.current || !status) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('devam') !== '1') return;
    resumeRequested.current = true;
    params.delete('devam');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    if (status.loggedIn && status.resumable) void requestTest(false);
  }, [status, requestTest]);

  const resumable = status?.resumable ?? null;

  return (
    // Robotik tema (2026-10-19): metal panel + teknik başlık.
    <div className={`flex flex-col gap-4 p-5 ${r.panel}`}>
      <p className={`text-lg font-bold uppercase text-default ${r.display}`}>{title}</p>

      {!status ? (
        // Metin yerine iskelet (skeleton) — "Durum yükleniyor…" gibi teknik bir cümle SSR
        // HTML'ine (fetch client'ta tamamlanana kadar) sızmasın diye (kullanıcının 2026-09-06
        // SEO denetimi isteği). Önceki sr-only <span> hâlâ sayfanın metin içeriğinde
        // görünüyordu (denetim araçları öznitelik değil, gerçek metin düğümü arıyor) — bu
        // yüzden etiket artık bir metin DÜĞÜMÜ değil, aria-label ÖZNİTELİĞİ: ekran
        // okuyucular hâlâ duyuruyor ama sayfanın çıkarılan metninde hiç yer almıyor.
        <div className="w-full animate-pulse space-y-2" role="status" aria-label="Durum yükleniyor">
          <div className="h-6 rounded-lg bg-background" />
          <div className="h-5 w-2/3 rounded-lg bg-background" />
          <div className="h-12 rounded-xl bg-background" />
        </div>
      ) : !status.loggedIn ? (
        // Misafir (2026-09-26 sadeleştirmesi): eskiden sıfırlarla dolu istatistikler + gri,
        // tıklanamayan "Teste Başla" gösteriliyordu — yer kaplayıp hiçbir şey yaptırmıyordu.
        // Artık tek bir net çağrı; soruların kendisi zaten aşağıda açık (SEO içeriği).
        guestContent ?? <GuestTestCta questionCount={status.poolSize} />
      ) : (
        <>
          <SolvedProgressBar solved={status.solved} total={status.poolSize} barClass={classes.bar} />
          <ResultSummary correct={status.correct} wrong={status.wrong} solved={status.solved} />

          {resumable ? (
            <a
              href={testHref}
              onClick={startOrResumeTest}
              className={`flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl ${classes.button} px-4 py-2.5 text-white transition-colors ${testLoading ? 'pointer-events-none opacity-60' : ''}`}
            >
              {testLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span className="flex items-center gap-1.5 font-semibold">
                    Teste devam et <ArrowRight className="h-4 w-4" />
                  </span>
                  <span className="text-xs text-white/85">
                    Yarım kalan test: {resumable.answeredCount}/{resumable.total} soru
                    {resumable.answeredCount > 0 ? ` · ${resumable.correctCount} doğru, ${resumable.wrongCount} yanlış` : ''}
                  </span>
                </>
              )}
            </a>
          ) : conflictInfo ? (
            // Aynı ünitede zaten açık, çakışan bir oturum var — sessizce üstüne yazmak
            // yerine kullanıcıya seçim sunuluyor (kullanıcının 2026-09-06 isteği: "önceki
            // testin linkini de verelim, isterse önce onu açabilsin").
            <div className="w-full rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-left">
              <p className="text-xs font-bold text-amber-800">
                Bu ünitede yarım kalmış bir testin var: {conflictInfo.scopeLabel} ({conflictInfo.answeredCount}/{conflictInfo.total})
              </p>
              <div className="mt-2.5 flex gap-2">
                <Link
                  href={conflictInfo.href}
                  className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-center text-xs font-black text-amber-800 transition-colors hover:bg-amber-100"
                >
                  Yarım Kalan Teste Git
                </Link>
                <button
                  type="button"
                  onClick={startNewIgnoringConflict}
                  disabled={testLoading}
                  className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-center text-xs font-black text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                >
                  {testLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Yeni Test Başlat'}
                </button>
              </div>
            </div>
          ) : (
            <a
              href={testHref}
              onClick={startOrResumeTest}
              className={`flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl ${classes.button} px-4 py-2.5 text-white transition-colors ${testLoading ? 'pointer-events-none opacity-60' : ''}`}
            >
              {testLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span className="flex items-center gap-1.5 font-semibold">
                    Teste başla <ArrowRight className="h-4 w-4" />
                  </span>
                  <span className="text-xs text-white/85">{status.testSize} soru</span>
                </>
              )}
            </a>
          )}
        </>
      )}

      {testError && <p className="text-xs font-bold text-rose-500">{testError}</p>}

      {player}
    </div>
  );
}

function GuestTestCta({ questionCount }: { questionCount: number }) {
  const pathname = usePathname();
  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Üye ol, {questionCount} soruluk bu testi çöz — doğru/yanlışların kaydedilsin, eksik konuların sana hatırlatılsın.
      </p>
      <div className="flex w-full flex-col gap-2">
        <Link
          href="/register"
          className={`flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ${r.btnNeon} ${r.btnText}`}
        >
          Ücretsiz üye ol
        </Link>
        <Link
          href={`/login?redirectTo=${encodeURIComponent(pathname || '/')}`}
          className={`flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ${r.btnGhost} ${r.btnText}`}
        >
          Giriş yap
        </Link>
      </div>
    </div>
  );
}
