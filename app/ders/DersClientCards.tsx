'use client';

// DersClient.tsx'in kendi kapalı state'ine bağımlı olmayan, sadece prop alan (veya kendi
// hook'larını çağıran) sunum bileşenleri — dosyanın 2800+ satırını okunur tutmak için ayrıldı
// (kullanıcının 2026-09-05 isteği: "bunu ayrı componentler haline getirsen daha kolay olmaz mı").

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, CheckCircle2, ListChecks, Loader2, MessageCircle, Pencil, Sparkles, Trophy } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { fetchTopicContentProgress, touchTopicContentView, markTopicContentCompleted } from '@/app/src/lib/topicContentProgress';
import { renderLatexInHtml } from '@/app/src/lib/renderLatex';
import { buildBlocks } from './SectionContent';
import type { TopicHighlight } from './dersHelpers';
import type { SoruBankasiTestStatus } from '@/app/src/lib/soruBankasiStatus';
import type { QuizQuestion } from '@/app/src/lib/quizQuestions';
import QuizModal from '@/app/src/components/QuizModal';
import QuizWithAsk from '@/app/src/components/QuizWithAsk';

export function CurriculumWeekCard({ weekRangeLabel, dateRangeLabel }: { weekRangeLabel: string; dateRangeLabel: string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 sm:p-5">
      <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest mb-2">
        <Calendar className="h-4 w-4" /> MEB Müfredat Takvimi
      </div>
      <p className="text-sm font-black text-slate-800">{weekRangeLabel}</p>
      <p className="text-xs text-slate-500 font-medium mt-1">{dateRangeLabel} tarihleri arasında işlenir</p>
      <p className="text-[10px] text-slate-400 font-medium mt-2 leading-snug">
        Tarihler MEB takvimine göre tahminidir, okula göre değişiklik gösterebilir.
      </p>
    </div>
  );
}

export function HighlightCard({ highlight, onEdit }: { highlight: TopicHighlight; onEdit?: () => void }) {
  return (
    <div className={`relative rounded-2xl border border-slate-100 bg-white shadow-sm p-4 flex items-start gap-3 ${onEdit ? 'pr-9' : ''}`}>
      {highlight.icon && <span className="text-2xl leading-none shrink-0">{highlight.icon}</span>}
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-800 leading-snug">{highlight.title}</p>
        <p className="text-xs text-slate-500 font-medium leading-snug mt-0.5">{highlight.description}</p>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Anahtar kavramı düzenle"
          className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// Konu anlatımının en altında, kullanıcının "bitirdim" diyerek kendi işaretlemesini
// sağlayan buton — scroll/süre gibi otomatik bir "okudu" tahmini bilinçli olarak
// YAPILMIYOR (bkz. docs/site-iyilestirme-plani.md tartışması, 2026-09-02): tek
// güvenilir sinyal kullanıcının kendi tıklaması. Misafirde hiç gösterilmez.
export function TopicCompleteButton({ topicId }: { topicId: string | number }) {
  const { user, supabase } = useAuth();
  const [isCompleted, setIsCompleted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoaded(false);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    fetchTopicContentProgress(supabase, user.id, topicId).then((progress) => {
      if (cancelled) return;
      setIsCompleted(!!progress?.isCompleted);
      setLoaded(true);
    });
    // Sayfa ziyaretini pasif olarak kaydeder (last_viewed_at) — is_completed'a dokunmaz.
    touchTopicContentView(supabase, user.id, topicId);
    return () => {
      cancelled = true;
    };
  }, [user, supabase, topicId]);

  if (!user || !loaded) return null;

  if (isCompleted) {
    return (
      <div className="not-prose mt-8 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 sm:px-5">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> Konuyu bitirdin
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={saving}
      onClick={async () => {
        setSaving(true);
        await markTopicContentCompleted(supabase, user.id, topicId);
        setIsCompleted(true);
        setSaving(false);
      }}
      className="not-prose mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-60 sm:px-5"
    >
      <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" /> {saving ? 'Kaydediliyor…' : 'Konuyu Bitirdim'}
    </button>
  );
}

// Ünite Testi kaldırıldı, tek ve öne çıkan "Konu Testi" kartı kaldı (kullanıcının
// 2026-09-22 isteği). Eskiden bu buton Soru Bankası'nın konu sayfasına GİDİYORDU — o
// sayfadaki TestStatusCard da testi kendi client-side modalıyla (QuizModal+QuizWithAsk)
// açıyordu, yani kullanıcı önce bir sayfa değişikliği yaşayıp sonra aynı overlay'i
// görüyordu. Bu kart o ara durağı atlayıp AYNI motoru (aynı /api/soru-bankasi/topic-test
// endpoint'i, aynı QuizModal/QuizWithAsk) doğrudan ders sayfasında açıyor.
//
// TestStatusCard'dan BİLEREK farklı: TestStatusCard misafir kullanıcıda "Teste Başla"yı
// kilitleyip "Giriş yapmanız gerekiyor" gösteriyor (2026-09-06 kararı, Soru Bankası
// bağlamında hâlâ geçerli). Kullanıcı bu ders sayfası için tam tersini istedi: misafir de
// butona basıp teste girebilsin, sadece istatistik/oturum kaydedilmez (QuizClient zaten
// böyle davranıyor — bkz. recordAnswer'daki !user erken dönüşü).
interface TopicTestData {
  gradeId: number;
  lessonId: number;
  unitId: number;
  topicId?: number;
  scopeLabel: string;
  initialQuestions: QuizQuestion[];
  remainingQuestionIds: number[];
  allCaughtUp: boolean;
  conflict: { sessionId: number; scopeLabel: string; href: string; total: number; answeredCount: number } | null;
  resume: { sessionId: number; answers: { questionId: number; isCorrect: boolean }[] } | null;
  reloadEndpoint: string;
  questionBankPathBase?: string;
  secondsPerQuestion?: number | null;
}

export function TopicTestCta({
  gradeSlug,
  lessonSlug,
  unitSlug,
  topicSlug,
  topicId,
  unitId,
}: {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  topicSlug: string;
  topicId: number;
  unitId: number;
}) {
  const [status, setStatus] = useState<SoruBankasiTestStatus | null>(null);
  const [testData, setTestData] = useState<TopicTestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(() => {
    fetch(`/api/soru-bankasi/topic-status?topicId=${topicId}&unitId=${unitId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SoruBankasiTestStatus | null) => setStatus(data))
      .catch(() => setStatus(null));
  }, [topicId, unitId]);

  useEffect(() => {
    setStatus(null);
    fetchStatus();
  }, [fetchStatus]);

  const testHref = `/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}/kavrama-testi`;

  const startTest = useCallback(async (forceNew: boolean) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const base = `/api/soru-bankasi/topic-test?gradeSlug=${gradeSlug}&lessonSlug=${lessonSlug}&unitSlug=${unitSlug}&topicSlug=${topicSlug}`;
      const res = await fetch(forceNew ? `${base}&forceNew=1` : base);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as TopicTestData;
      setTestData(data);
    } catch {
      setError('Test yüklenemedi, tekrar dener misin?');
    } finally {
      setLoading(false);
    }
  }, [gradeSlug, lessonSlug, unitSlug, topicSlug, loading]);

  const closeTest = useCallback(() => {
    setTestData(null);
    fetchStatus();
  }, [fetchStatus]);

  if (status?.poolSize === 0) return null;

  const resumable = status?.resumable ?? null;
  const conflict = testData?.conflict ?? null;

  return (
    <div className="not-prose mt-10 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-5 shadow-sm sm:p-7">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg">
          <Trophy className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black text-slate-800">Konu Testi</p>
          {!status ? (
            <div className="mt-1.5 h-4 w-40 animate-pulse rounded bg-indigo-100" />
          ) : (
            <>
              <p className="text-sm font-medium text-slate-500">
                {resumable
                  ? `Yarım kalan testin var — ${resumable.answeredCount}/${resumable.total} soru çözüldü`
                  : `${status.testSize} soruluk kavrama testi${status.solved > 0 ? ` — ${status.solved}/${status.poolSize} çözüldü` : ''}`}
              </p>
              {!status.loggedIn && (
                <p className="mt-0.5 text-xs font-bold text-indigo-400">Misafir olarak çözebilirsin, istatistiklerin için giriş yapman gerekir.</p>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => startTest(false)}
          disabled={loading || !status}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-md transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{resumable ? 'Teste Devam Et' : 'Teste Başla'} <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>

      {error && <p className="mt-3 text-xs font-bold text-rose-500">{error}</p>}

      {conflict && (
        <div className="mt-4 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-left">
          <p className="text-xs font-bold text-amber-800">
            Bu ünitede yarım kalmış bir testin var: {conflict.scopeLabel} ({conflict.answeredCount}/{conflict.total})
          </p>
          <div className="mt-2.5 flex gap-2">
            <Link
              href={conflict.href}
              className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-center text-xs font-black text-amber-800 transition-colors hover:bg-amber-100"
            >
              Yarım Kalan Teste Git
            </Link>
            <button
              type="button"
              onClick={() => startTest(true)}
              disabled={loading}
              className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-center text-xs font-black text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Yeni Test Başlat'}
            </button>
          </div>
        </div>
      )}

      {testData && !testData.conflict && (
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
          />
        </QuizModal>
      )}
    </div>
  );
}

// Konu sonunda gösterilen TEK toplu özet — bundan sonra üretilen içerikte, eskiden her alt
// başlığın altında ayrı ayrı olan "Defterine Not Al" kutusunun yerine geçiyor (kullanıcının
// 2026-09-15 isteği). NotebookBox'la (SectionContent.tsx) aynı madde/terim render
// pipeline'ını (buildBlocks) paylaşıyor, sadece farklı bir renk ailesinde (yeşil/emerald —
// "tamamlandı, işte çıkarımın" hissi) ve konu geneline ait olduğu için ayrı bir bileşen.
// Kutu artık "defterine yazacağın tam not" — öğrenci deftere geçirdiğinde başlıksız
// kalmasın diye konu başlığı da (kırmızı, tıpkı sayfanın en üstündeki başlık gibi) kutunun
// içinde gösteriliyor; etiket de "Defterine Al" gibi bir eylem değil sade "Konu Özeti"
// (kullanıcının 2026-09-21 isteği).
export function TopicSummaryBox({ topicTitle, summaryHtml }: { topicTitle: string; summaryHtml: string }) {
  const [blocks, setBlocks] = useState<React.ReactNode[] | null>(null);
  const mathHtml = useMemo(() => renderLatexInHtml(summaryHtml), [summaryHtml]);

  useEffect(() => {
    setBlocks(buildBlocks(mathHtml));
  }, [mathHtml]);

  return (
    <div className="not-prose mt-10 border-t-2 border-rose-100 pt-8">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-sm">
        <div className="absolute inset-y-0 left-0 hidden w-12 flex-col items-center justify-evenly py-6 sm:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="h-2 w-2 rounded-full bg-white shadow-inner ring-1 ring-emerald-200" />
          ))}
        </div>
        <div className="absolute inset-y-0 left-12 hidden w-px bg-emerald-200 sm:block" />
        <div className="space-y-2.5 px-5 py-6 sm:py-7 sm:pl-16 sm:pr-7">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Konu Özeti</p>
          <h3 className="font-serif text-lg sm:text-xl font-black text-rose-600 leading-snug">{topicTitle}</h3>
          {blocks ?? <div dangerouslySetInnerHTML={{ __html: mathHtml }} />}
        </div>
      </div>
    </div>
  );
}

// Konu sonundaki "Düşün ve Yorumla" — tek doğrusu olmayan bir kapanış sorusu, var olan
// tartışma bölümüne (UnitDiscussion, #konu-tartisma) bağlanıyor. Yeni bir yorum sistemi
// kurmuyoruz, sadece o bölüme yönlendirip öğrenciyi bir görüş üretmeye teşvik ediyoruz
// (kullanıcının 2026-09-15 isteği). Konu Özeti'nden bilinçli olarak daha hafif/ince —
// sayfayı gereksiz uzatmamak için ayrı bir büyük kart değil, tek satırlık bir şerit.
export function DiscussionPromptBox({ discussionPromptHtml }: { discussionPromptHtml: string }) {
  const mathHtml = useMemo(() => renderLatexInHtml(discussionPromptHtml), [discussionPromptHtml]);

  return (
    <div className="not-prose mt-4 flex flex-col items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-start gap-2.5 min-w-0">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
        <div className="min-w-0 text-sm text-slate-700 sm:text-base [&_p]:m-0 [&_strong]:font-black [&_strong]:text-violet-700" dangerouslySetInnerHTML={{ __html: mathHtml }} />
      </div>
      <button
        type="button"
        onClick={() => document.getElementById('konu-tartisma')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-violet-700"
      >
        Görüşünü Paylaş <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
