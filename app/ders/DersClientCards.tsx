'use client';

// DersClient.tsx'in kendi kapalı state'ine bağımlı olmayan, sadece prop alan (veya kendi
// hook'larını çağıran) sunum bileşenleri — dosyanın 2800+ satırını okunur tutmak için ayrıldı
// (kullanıcının 2026-09-05 isteği: "bunu ayrı componentler haline getirsen daha kolay olmaz mı").

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, CheckCircle2, ChevronRight, Loader2, MessageCircle, Pencil, Trophy } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { fetchTopicContentProgress, touchTopicContentView, markTopicContentCompleted } from '@/app/src/lib/topicContentProgress';
import { renderLatexInHtml } from '@/app/src/lib/renderLatex';
import { buildBlocks } from './SectionContent';
import type { TopicHighlight } from './dersHelpers';
import type { SoruBankasiTestStatus } from '@/app/src/lib/soruBankasiStatus';
import type { QuizQuestion } from '@/app/src/lib/quizQuestions';

export type StudyMode = 'highlights' | 'details' | 'slides' | 'summary' | 'test';

export interface StudyModeOption {
  id: StudyMode;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
  activeClass: string;
  railClass: string;
  badge: string;
  available: boolean;
  // "Konu Kavrama Testi" kartı artık aradaki CTA ekranını atlayıp tıklanır tıklanmaz test
  // verisini çekip direkt soru modalını açıyor (kullanıcının 2026-09-24 isteği) — fetch
  // sürerken kartın kendi sağ ikonunda dönen bir spinner gösteriyoruz.
  loading?: boolean;
}

export function StudyModeSelector({
  options,
  selectedMode,
  onSelect,
}: {
  options: StudyModeOption[];
  selectedMode: StudyMode | null;
  onSelect: (mode: StudyMode) => void;
}) {
  const availableOptions = options.filter((item) => item.available);

  return (
    <div className="space-y-4">
      {/* Orantılı ve Dengeli Grid Yapısı */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {availableOptions.map((item, idx) => {
          const active = selectedMode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              disabled={item.loading}
              aria-pressed={active}
              className={`group relative flex items-center justify-between rounded-xl border p-4 text-left transition-all duration-200 disabled:cursor-wait ${active
                  ? `${item.activeClass} shadow-sm ring-1 ring-indigo-500/20`
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
            >
              {/* Sol Vurgu Şeridi */}
              <span className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${active ? item.railClass : 'bg-transparent group-hover:bg-slate-300'}`} />

              <div className="flex items-center gap-3.5 pl-1.5 min-w-0 flex-1">
                {/* İkon Kapsülü */}
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-semibold shadow-sm ${item.iconClass}`}>
                  {item.icon}
                </span>

                {/* Metin İçeriği - Sıkışmayı Önleyen Tipografi */}
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tracking-tight text-slate-900">
                      {item.title}
                    </span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {item.badge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-normal text-slate-600 leading-snug">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Sağ İkon ve Sıra Numarası */}
              <div className="flex items-center gap-2 shrink-0 border-l border-slate-100 pl-3">
                <span className={`text-xs font-bold tracking-wider ${active ? 'text-slate-900' : 'text-slate-400'}`}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                  {item.loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : active ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CurriculumWeekCard({ weekRangeLabel, dateRangeLabel }: { weekRangeLabel: string; dateRangeLabel: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-indigo-100 bg-white p-4.5 text-center shadow-sm transition-all hover:shadow">
      <div className="mb-2 flex items-center justify-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
          <Calendar className="h-3.5 w-3.5" />
        </span>
        MEB Müfredat Takvimi
      </div>
      <p className="text-sm font-bold text-slate-900">{weekRangeLabel}</p>
      <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-600 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
        {dateRangeLabel} tarihleri arasında işlenir
      </p>
      <p className="text-[11px] text-slate-400 font-normal mt-2.5 leading-relaxed border-t border-slate-100 pt-2">
        Tarihler MEB takvimine göre tahminidir, okula göre değişiklik gösterebilir.
      </p>
    </div>
  );
}

export function HighlightCard({ highlight, onEdit }: { highlight: TopicHighlight; onEdit?: () => void }) {
  return (
    <div className={`group relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow flex items-center gap-3.5 ${onEdit ? 'pr-9' : ''}`}>
      {highlight.icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-lg border border-indigo-100/50">
          {highlight.icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900 leading-tight">{highlight.title}</p>
        <p className="text-xs text-slate-600 font-normal leading-relaxed mt-1">{highlight.description}</p>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Anahtar kavramı düzenle"
          className="absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

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
    touchTopicContentView(supabase, user.id, topicId);
    return () => {
      cancelled = true;
    };
  }, [user, supabase, topicId]);

  if (!user || !loaded) return null;

  if (isCompleted) {
    return (
      <div className="not-prose mt-6 flex items-center justify-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm font-bold text-emerald-800 shadow-sm">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
        <span>Harika! Bu konuyu başarıyla tamamladın.</span>
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
      className="not-prose group mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60"
    >
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-indigo-200 transition-transform group-hover:scale-110" />
      )}
      <span>{saving ? 'Kaydediliyor…' : 'Konuyu Bitirdim Olarak İşaretle'}</span>
    </button>
  );
}

export interface TopicTestData {
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

// "Konu Kavrama Testi" kartına tıklayınca artık ara bir CTA ekranı göstermeden doğrudan
// test verisini çekip soru modalını açıyoruz (kullanıcının 2026-09-24 isteği: "o bilgileri
// anasayfadaki card'da gösterelim, tıklayınca direkt soruları modal'ı açılsın"). Kartın
// kendi açıklaması bu hook'un `status`'una göre doluyor (bkz. DersClient.tsx'teki
// studyModeOptions). Parametreler henüz hazır değilken (slug'lar/id'ler yüklenmeden) de
// React hook kurallarına uyması için hep çağrılabiliyor, sadece `ready` olunca fetch ediyor.
export function useTopicTest({
  gradeSlug,
  lessonSlug,
  unitSlug,
  topicSlug,
  topicId,
  unitId,
}: {
  gradeSlug: string | null | undefined;
  lessonSlug: string | null | undefined;
  unitSlug: string | null | undefined;
  topicSlug: string | null | undefined;
  topicId: number | null | undefined;
  unitId: number | null | undefined;
}) {
  const ready = !!(gradeSlug && lessonSlug && unitSlug && topicSlug && topicId != null && unitId != null);
  const [status, setStatus] = useState<SoruBankasiTestStatus | null>(null);
  const [testData, setTestData] = useState<TopicTestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(() => {
    if (!ready) {
      setStatus(null);
      return;
    }
    fetch(`/api/soru-bankasi/topic-status?topicId=${topicId}&unitId=${unitId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SoruBankasiTestStatus | null) => setStatus(data))
      .catch(() => setStatus(null));
  }, [ready, topicId, unitId]);

  useEffect(() => {
    setStatus(null);
    fetchStatus();
  }, [fetchStatus]);

  const testHref = ready ? `/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}/kavrama-testi` : '';

  const startTest = useCallback(async (forceNew: boolean) => {
    if (!ready) return;
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
  }, [ready, gradeSlug, lessonSlug, unitSlug, topicSlug]);

  const closeTest = useCallback(() => {
    setTestData(null);
    setError(null);
    fetchStatus();
  }, [fetchStatus]);

  return { status, testData, loading, error, startTest, closeTest, testHref };
}

// startTest() bir "conflict" (aynı ünitede yarım kalan BAŞKA bir konunun testi) döndürürse
// soruları direkt açmak yerine bu küçük seçim kutusunu gösteriyoruz.
export function TopicTestConflictModal({
  conflict,
  loading,
  onStartNew,
  onClose,
}: {
  conflict: NonNullable<TopicTestData['conflict']>;
  loading: boolean;
  onStartNew: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <Trophy className="h-5 w-5" />
        </div>
        <h3 className="mt-3 text-sm font-bold text-slate-900">Yarım kalan bir testin var</h3>
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-bold text-slate-700">{conflict.scopeLabel}</span> testinde {conflict.answeredCount}/{conflict.total} soru çözülmüş durumda.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href={conflict.href}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            Yarım Kalan Teste Git
          </Link>
          <button
            type="button"
            onClick={onStartNew}
            disabled={loading}
            className="rounded-lg bg-amber-500 px-3.5 py-2.5 text-center text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {loading ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Bu Konu İçin Yeni Test Başlat'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-center text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}

// startTest() ağ hatasıyla başarısız olursa gösterilen minik mesaj kutusu.
export function TopicTestErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold text-slate-900">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-slate-100 px-3.5 py-2.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-200"
        >
          Tamam
        </button>
      </div>
    </div>
  );
}

export function TopicSummaryBox({ topicTitle, summaryHtml }: { topicTitle: string; summaryHtml: string }) {
  const [blocks, setBlocks] = useState<React.ReactNode[] | null>(null);
  const mathHtml = useMemo(() => renderLatexInHtml(summaryHtml), [summaryHtml]);

  useEffect(() => {
    setBlocks(buildBlocks(mathHtml));
  }, [mathHtml]);

  return (
    <div className="not-prose mt-8 border-t border-slate-200 pt-6">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 sm:p-6 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-700 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
              Konu Özeti
            </span>
          </div>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-rose-700 leading-snug">
            {topicTitle}
          </h3>
          <div className="prose prose-emerald max-w-none text-slate-800 text-sm leading-relaxed font-normal">
            {blocks ?? <div dangerouslySetInnerHTML={{ __html: mathHtml }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DiscussionPromptBox({ discussionPromptHtml }: { discussionPromptHtml: string }) {
  const mathHtml = useMemo(() => renderLatexInHtml(discussionPromptHtml), [discussionPromptHtml]);

  return (
    <div className="not-prose mt-4 flex flex-col items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
      <div className="flex items-start gap-3 min-w-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
          <MessageCircle className="h-4 w-4" />
        </span>
        <div
          className="min-w-0 text-sm text-slate-800 leading-relaxed font-medium [&_p]:m-0 [&_strong]:font-bold [&_strong]:text-violet-900"
          dangerouslySetInnerHTML={{ __html: mathHtml }}
        />
      </div>
      <button
        type="button"
        onClick={() => document.getElementById('konu-tartisma')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="group flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-violet-800 active:scale-95"
      >
        <span>Görüşünü Paylaş</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}