'use client';

// DersClient.tsx'in kendi kapalı state'ine bağımlı olmayan, sadece prop alan (veya kendi
// hook'larını çağıran) sunum bileşenleri — dosyanın 2800+ satırını okunur tutmak için ayrıldı
// (kullanıcının 2026-09-05 isteği: "bunu ayrı componentler haline getirsen daha kolay olmaz mı").

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, CheckCircle2, Library, ListChecks, Pencil, Trophy } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { fetchTopicContentProgress, touchTopicContentView, markTopicContentCompleted } from '@/app/src/lib/topicContentProgress';
import type { TopicHighlight } from './dersHelpers';

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

// Sayfanın en altında, konu kavrama testi ve ünite testi için yan yana iki kart —
// eskiden tek başına küçük bir "Konu Kavrama Testi" pill'i vardı, "Ünite Testi" ise
// üst app bar'da ayrı bir yerdeydi (bkz. kullanıcının referans görseliyle 2026-09-05
// isteği: ikisi burada, birlikte, daha belirgin olsun). Konu testinin soru sayısı
// client'ta ayrıca çekiliyor (server'da topic bazlı soru sayısı önceden hesaplanmıyor);
// ünite testinin sayısı zaten initialData.units üzerinden (test_question_count) geliyor.
export function QuizCtaCards({
  topicId,
  topicHref,
  questionBankHref,
  unitTitle,
  unitHref,
  showUnitCard,
  unitQuestionCount,
}: {
  topicId: string | number;
  topicHref: string | null;
  questionBankHref: string | null;
  unitTitle: string;
  unitHref: string | null;
  showUnitCard: boolean;
  unitQuestionCount?: number;
}) {
  const [topicCount, setTopicCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTopicCount(null);
    fetch(`/api/topic-test-questions?topicId=${topicId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { questions?: unknown[] } | null) => {
        if (!cancelled) setTopicCount(data?.questions?.length ?? 0);
      })
      .catch(() => {
        if (!cancelled) setTopicCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  const showTopicCard = topicCount !== 0 && !!topicHref;
  const showEmeraldCard = showUnitCard && !!unitHref;
  const showBankCard = topicCount !== 0 && !!questionBankHref;

  if (!showTopicCard && !showEmeraldCard && !showBankCard) return null;

  return (
    <div className="not-prose mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {showTopicCard && (
        <div className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
          <div className="flex items-center gap-2.5 text-sm font-black text-indigo-700">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-sm">
              <ListChecks className="h-4.5 w-4.5" />
            </span>
            Konu Testi
          </div>
          <p className="flex-1 text-xs font-medium leading-relaxed text-indigo-900/70">
            Bu konudaki bilgilerini pekiştirmek için {topicCount ?? ''} soruluk kavrama testi çöz.
          </p>
          <Link
            href={topicHref!}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-indigo-700"
          >
            Teste Başla <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
      {showBankCard && (
        <div className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 sm:p-5">
          <div className="flex items-center gap-2.5 text-sm font-black text-violet-700">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm">
              <Library className="h-4.5 w-4.5" />
            </span>
            Soru Bankası
          </div>
          <p className="flex-1 text-xs font-medium leading-relaxed text-violet-900/70">
            Puansız, cevap anahtarıyla — soruları tek tek incelemek/tekrar etmek için.
          </p>
          <Link
            href={questionBankHref!}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-violet-700"
          >
            İncele <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
      {showEmeraldCard && (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
          <div className="flex items-center gap-2.5 text-sm font-black text-emerald-700">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
              <Trophy className="h-4.5 w-4.5" />
            </span>
            Ünite Testi
          </div>
          <p className="flex-1 text-xs font-medium leading-relaxed text-emerald-900/70">
            {unitTitle} ünitesini{unitQuestionCount ? ` ${unitQuestionCount} soruluk` : ''} test etmek için ünite testini çöz.
          </p>
          <Link
            href={unitHref!}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-emerald-700"
          >
            Teste Başla <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
