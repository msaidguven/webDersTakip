'use client';

// Öğretmen anasayfası (2026-11-24 sadeleştirildi): link dizini yerine çalışma masası.
// 1) Kompakt üst şerit (selamlama + hafta + Yazılı hazırla)
// 2) Kayıtlı yazılı taslakları + branşta yaklaşan yazılılar (yalnız veri varsa görünür)
// 3) Derslerim (tek birleşik kart: sınıf satırında bu haftanın konusu + üniteler)
// 4) Altta ince yardımcı bağlantılar (Yıllık plan, Ders takip çizelgesi, Yazılı soruları).
import Link from 'next/link';
import useSWR from 'swr';
import { useState, useSyncExternalStore } from 'react';
import { CalendarClock, ChevronRight, FileText, MessageSquareHeart, X } from 'lucide-react';
import { TeacherVerifiedBadge } from '@/app/src/components/teacher/TeacherVerifiedBadge';
import { FeedbackSheet } from '@/app/src/components/feedback/FeedbackSheet';
import { istanbulToday } from '@/app/src/lib/progressActivity';
import { daysUntil, formatExamDate } from '@/app/src/components/yazili/ExamCountdown';
import r from '@/app/src/components/robotic/robotic.module.css';
import { TeacherLessonsQuick } from './TeacherLessonsQuick';
import type { ThisWeekTopicItem } from '@/app/src/lib/homeHighlights';

type TeacherDraftItem = {
  examId: number;
  gradeName: string;
  lessonName: string;
  label: string;
  title: string;
  itemCount: number;
  updatedAt: string;
};

type BranchUpcomingExam = {
  id: number;
  gradeName: string;
  lessonName: string;
  label: string;
  examDate: string;
};

type TeacherHomeSummary = {
  drafts: TeacherDraftItem[];
  upcomingExams: BranchUpcomingExam[];
};

const QUICK_LINKS = [
  { href: '/yillik-plan', label: 'Yıllık plan' },
  { href: '/ders-takip-cizelgesi', label: 'Ders takip çizelgesi' },
  { href: '/yazili-sorulari', label: 'Yazılı soruları' },
] as const;

const fetchTeacherSummary = async (): Promise<TeacherHomeSummary> => {
  const res = await fetch('/api/ogretmen/yazili/taslak?list=1');
  if (!res.ok) return { drafts: [], upcomingExams: [] };
  return (await res.json()) as TeacherHomeSummary;
};

const FOUNDER_NOTE_DISMISS_KEY = 'dt-teacher-founder-note-v1';
const noopSubscribe = () => () => {};

export function TeacherHome({
  firstName,
  isVerified,
  grades,
  thisWeek,
}: {
  firstName: string | null;
  isVerified: boolean;
  grades: { id: string; slug?: string; name: string }[];
  thisWeek: { week: number; byGradeId: Record<string, ThisWeekTopicItem[]> };
}) {
  const { data: summary } = useSWR<TeacherHomeSummary>('teacher-home-summary', fetchTeacherSummary, {
    revalidateOnFocus: false,
  });

  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const today = isClient ? istanbulToday() : null;
  const [dismissedInSession, setDismissedInSession] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const noteDismissed =
    !isClient ||
    dismissedInSession ||
    (() => {
      try {
        return localStorage.getItem(FOUNDER_NOTE_DISMISS_KEY) === '1';
      } catch {
        return false;
      }
    })();

  const dismissNote = () => {
    setDismissedInSession(true);
    try {
      localStorage.setItem(FOUNDER_NOTE_DISMISS_KEY, '1');
    } catch {
      /* yok say */
    }
  };

  const drafts = summary?.drafts.slice(0, 3) ?? [];
  const upcoming = today
    ? (summary?.upcomingExams ?? [])
      .map((e) => ({ ...e, days: daysUntil(e.examDate, today) }))
      .filter((e) => e.days >= 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 3)
    : [];

  return (
    <section aria-labelledby="ogretmen-baslik" className="flex flex-col gap-6">
      <div className={`flex flex-col gap-4 rounded-[22px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7 ${r.panel} ${r.hero}`}>
        <span className={r.scan} aria-hidden="true" />
        <div>
          <p className={r.label}>Öğretmen paneli · {thisWeek.week}. öğretim haftası</p>
          <h1 id="ogretmen-baslik" className={`mt-1 text-[26px] leading-tight sm:text-3xl ${r.chrome}`}>
            {firstName ? `Merhaba, ${firstName} Hocam` : 'Merhaba Hocam'}
          </h1>
          {isVerified && <div className="mt-2"><TeacherVerifiedBadge verified /></div>}
        </div>
        <Link href="/ogretmen/yazili" className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-bold ${r.btnNeon} ${r.btnText}`}>
          Yazılı hazırla <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>

      {(drafts.length > 0 || upcoming.length > 0) && (
        <div className={`grid grid-cols-1 items-start gap-4 ${drafts.length > 0 && upcoming.length > 0 ? 'lg:grid-cols-2' : ''}`}>
          {drafts.length > 0 && (
            <section aria-labelledby="taslaklar-baslik" className={`flex flex-col gap-3 rounded-[22px] p-5 ${r.panel}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 id="taslaklar-baslik" className={r.label}>Kaldığın yerden devam et</h2>
                <Link href="/ogretmen/yazili" className={`text-xs font-semibold hover:underline ${r.accent}`}>
                  Yazılı paneli
                </Link>
              </div>
              <ul className="flex flex-col gap-2">
                {drafts.map((d) => (
                  <li key={d.examId}>
                    <Link href={`/ogretmen/yazili?yazili=${d.examId}`} className={`group flex min-h-12 items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 ${r.item}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${r.chipBox}`} aria-hidden="true">
                          <FileText className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-default">{d.gradeName} {d.lessonName} · {d.label}</span>
                          <span className="block text-xs text-muted-foreground">{d.itemCount} soru seçili</span>
                        </span>
                      </span>
                      <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground ${r.groupHoverAccent}`} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {upcoming.length > 0 && (
            <section aria-labelledby="brans-yazililar" className={`flex flex-col gap-3 rounded-[22px] p-5 ${r.panel}`}>
              <h2 id="brans-yazililar" className="flex items-center gap-2 text-sm font-bold text-default">
                <CalendarClock className={`h-4 w-4 ${r.accent}`} aria-hidden="true" />
                Branşında yaklaşan yazılılar
              </h2>
              <ul className="flex flex-col gap-2">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <Link href={`/ogretmen/yazili?yazili=${e.id}`} className={`group flex min-h-12 items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 ${r.item}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center leading-none ${r.chipBox}`} aria-hidden="true">
                          <b className="text-sm">{e.days}</b>
                          <span className="text-[10px]">gün</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-default">{e.gradeName} {e.lessonName} · {e.label}</span>
                          <span className="block text-xs text-muted-foreground">{formatExamDate(e.examDate)} · Kağıdını hazırla</span>
                        </span>
                      </span>
                      <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground ${r.groupHoverAccent}`} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <TeacherLessonsQuick grades={grades} thisWeek={thisWeek} />

      {!noteDismissed && (
        <aside
          aria-label="Kurucu notu"
          className={`flex flex-col gap-3 rounded-[22px] p-5 sm:flex-row sm:items-center sm:justify-between ${r.panel}`}
        >
          <div className="flex items-start gap-3.5">
            <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${r.chipBox}`} aria-hidden="true">
              <MessageSquareHeart className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className={r.label}>Kurucu notu · Birlikte geliştirelim</p>
              <p className="text-sm leading-relaxed text-default">
                {firstName ? `Merhaba ${firstName} Hocam — ` : 'Merhaba Hocam — '}
                Ders Takip henüz yeni ve siteyi doğrudan öğretmenlerimizin gözüyle şekillendirmek istiyorum. Yazılı aracında, kazanım uyumunda veya konu anlatımlarında{' '}
                <span className="font-semibold">“keşke şu da olsa”</span> ya da{' '}
                <span className="font-semibold">“burası eksik/hatalı”</span> dediğiniz ne varsa tek tıkla yazabilirsiniz; her mesajı bizzat okuyorum.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold sm:text-sm ${r.btnGhost}`}
            >
              Görüş / Öneri Yaz
            </button>
            <button
              type="button"
              onClick={dismissNote}
              aria-label="Kurucu notunu gizle"
              title="Gizle"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:text-default"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </aside>
      )}

      <nav aria-label="Hızlı bağlantılar" className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-sm text-muted-foreground">
        {QUICK_LINKS.map(({ href, label }) => (
          <Link key={href} href={href} className={`font-semibold transition-colors hover:text-default hover:underline ${r.accent}`}>
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className={`inline-flex items-center gap-1.5 font-semibold transition-colors hover:text-default hover:underline ${r.accent}`}
        >
          <MessageSquareHeart className="h-3.5 w-3.5" aria-hidden="true" />
          Görüş / Öneri İlet
        </button>
      </nav>

      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        variant="teacher"
        source="teacher_home"
        isAuthenticated
        onSubmitted={dismissNote}
      />
    </section>
  );
}
