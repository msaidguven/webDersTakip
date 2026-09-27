'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { LessonProgress } from '../models/types';
import { getLessonColor } from '../lib/homeMapping';
import type { LessonsStatus } from '../viewmodels/useDashboardViewModel';

interface LessonProgressCardsProps {
  lessons: LessonProgress[];
  isLoading: boolean;
  gradeName: string | null;
  status: LessonsStatus;
}

// Panel sadeleştirmesi (2026-09-26): üniteler/konular panelde gezilmiyor — her ders tek kartta
// özetleniyor, çözmek için Soru Bankası'na (tek gezinme yeri) yönlendiriliyor. "En çok
// zorlandığın konu" doğrudan o konunun soru bankası sayfasına götürür.
export function LessonProgressCards({ lessons, isLoading, gradeName, status }: LessonProgressCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-44 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  // Boş liste tek başına "sınıf seçilmemiş" demek değil — RPC hatası ve dersi olmayan sınıf
  // ayrı mesaj alır, yoksa sınıfı seçili öğrenciye yanlışlıkla "sınıfını seç" denir.
  if (status === 'no-grade') {
    return (
      <div className="rounded-2xl border border-default bg-surface-elevated p-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">Derslerini görmek için profilinden sınıfını seç.</p>
        <Link href="/profil" className="text-sm font-bold text-indigo-500 hover:text-indigo-400">
          Profile git →
        </Link>
      </div>
    );
  }

  if (status === 'error' || lessons.length === 0) {
    return (
      <div role="status" className="rounded-2xl border border-default bg-surface-elevated p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {status === 'error'
            ? 'Ders ilerlemen şu an yüklenemedi. Biraz sonra tekrar dene.'
            : `${gradeName ?? 'Sınıfın'} için henüz ders eklenmemiş.`}
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="derslerim-title">
      <div className="mb-3 sm:mb-4 flex items-baseline justify-between gap-2">
        <h2 id="derslerim-title" className="text-sm sm:text-base font-semibold text-default">
          Derslerim{gradeName ? <span className="text-muted-foreground font-normal"> · {gradeName}</span> : null}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {lessons.map((lesson, i) => (
          <LessonCard key={lesson.id} lesson={lesson} index={i} />
        ))}
      </div>
    </section>
  );
}

function LessonCard({ lesson, index }: { lesson: LessonProgress; index: number }) {
  const hasQuestions = lesson.totalQuestions > 0;

  return (
    <div className="flex flex-col rounded-2xl border border-default bg-surface-elevated p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl ${getLessonColor(index)}`}>
          <span aria-hidden>{lesson.icon}</span>
        </div>
        <h3 className="min-w-0 flex-1 truncate text-sm sm:text-base font-bold text-default">{lesson.name}</h3>
        {hasQuestions && <span className="text-lg font-black text-default">%{lesson.progress}</span>}
      </div>

      {hasQuestions ? (
        <>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
            role="progressbar"
            aria-valuenow={lesson.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${lesson.name} ilerleme`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
              style={{ width: `${lesson.progress}%` }}
            />
          </div>

          <dl className="mt-3 grid grid-cols-4 gap-1.5 text-center">
            <MiniStat label="Toplam" value={lesson.totalQuestions} />
            <MiniStat label="Çözülen" value={lesson.solvedQuestions} />
            <MiniStat label="Doğru" value={lesson.correctAnswers} tone="text-emerald-500" />
            <MiniStat label="Yanlış" value={lesson.wrongAnswers} tone="text-rose-500" />
          </dl>

          {lesson.weakTopic && (
            <Link
              href={lesson.weakTopic.href}
              className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs transition-colors hover:bg-amber-500/15"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-muted-foreground">En çok zorlandığın konu</span>
                <span className="block truncate font-bold text-default">{lesson.weakTopic.title}</span>
              </span>
              <span className="shrink-0 font-bold text-amber-600 dark:text-amber-400">
                {lesson.weakTopic.wrongCount} yanlış · Çöz →
              </span>
            </Link>
          )}
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Bu derse henüz soru eklenmedi.</p>
      )}

      {hasQuestions && lesson.soruBankasiHref && (
        <Link
          href={lesson.soruBankasiHref}
          className="mt-auto pt-3 inline-flex items-center justify-center gap-1 text-sm font-bold text-indigo-500 transition-colors hover:text-indigo-400"
        >
          {lesson.solvedQuestions > 0 ? "Soru Bankası'nda devam et" : 'Soru çözmeye başla'}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone = 'text-default' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface px-1 py-1.5">
      <dd className={`text-sm font-black ${tone}`}>{value}</dd>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
    </div>
  );
}
