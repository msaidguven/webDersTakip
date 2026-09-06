'use client';

// Ünite tanıtım sayfasındaki (/[gradeSlug]/[lessonSlug]/[unitSlug]) Sınıf/Ders/Ünite/Konu
// hızlı değiştirici — kullanıcının 2026-09-06 isteği: "içeriğin gösterildiği sayfadaki
// üstteki açılır menüler de gösterilsin". Görsel olarak DersClient.tsx'teki hiyerarşi
// barının BİREBİR aynısı, ama etkileşim farklı: DersClient sayfadan çıkmadan iç state'i
// günceller (kademeli "pending" seçim), burada ise her seçenek gerçek bir <Link> — bu sayfa
// zaten hafif/SEO'lu bir liste sayfası olduğu için her tıklama basitçe ilgili sayfaya
// gider. Konu dropdown'u bu yüzden hiçbir zaman "seçili" göstermez (bu sayfada açık bir konu
// yok) — DersClient'taki "Konu seçin" placeholder'ıyla aynı görsel dil.
import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown } from 'lucide-react';
import { getLessonColor } from '@/app/src/lib/homeMapping';

interface GradeOption {
  id: number;
  name: string;
  slug: string;
  lessonSlug: string | null;
}
interface LessonOption {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
}
interface UnitOption {
  id: number;
  title: string;
  slug: string;
}
interface TopicOption {
  id: number;
  title: string;
  slug: string;
}

interface UnitHierarchyBarProps {
  gradeName: string;
  gradeSlug: string;
  lessonName: string;
  lessonSlug: string;
  unitTitle: string;
  unitSlug: string;
  allGrades: GradeOption[];
  gradeLessons: LessonOption[];
  units: UnitOption[];
  topics: TopicOption[];
}

type OpenMenu = 'grade' | 'lesson' | 'unit' | 'topic' | null;

export default function UnitHierarchyBar({
  gradeName,
  gradeSlug,
  lessonName,
  lessonSlug,
  unitTitle,
  unitSlug,
  allGrades,
  gradeLessons,
  units,
  topics,
}: UnitHierarchyBarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const toggle = (menu: OpenMenu) => setOpenMenu((v) => (v === menu ? null : menu));

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-2.5 shadow-lg shadow-indigo-500/20 sm:mb-6 sm:p-3">
      <div className="flex items-center gap-2">
        <Link
          href="/"
          title="Anasayfa"
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white transition-colors hover:bg-white/25 sm:flex"
        >
          <BookOpen className="h-4 w-4" />
        </Link>

        {/* Sınıf */}
        <div className="relative min-w-0 flex-none">
          <button
            type="button"
            onClick={() => toggle('grade')}
            className="flex flex-col items-start rounded-xl bg-white/20 px-3 py-1.5 text-left transition-colors hover:bg-white/30"
          >
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">Sınıf</span>
            <span className="flex items-center gap-1.5 text-sm font-black text-white">
              {gradeName} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openMenu === 'grade' ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {openMenu === 'grade' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
              <div className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {allGrades.map((grade) => (
                  <Link
                    key={grade.id}
                    href={grade.lessonSlug ? `/${grade.slug}/${grade.lessonSlug}` : `/${grade.slug}`}
                    onClick={() => setOpenMenu(null)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition-colors ${
                      grade.slug === gradeSlug ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0 truncate">{grade.name}</span>
                  </Link>
                ))}
                {!allGrades.length && <span className="block px-2.5 py-2 text-sm text-slate-400">{gradeName}</span>}
              </div>
            </>
          )}
        </div>

        {/* Ders */}
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => toggle('lesson')}
            className="flex w-full flex-col items-start rounded-xl bg-white/20 px-3 py-1.5 text-left transition-colors hover:bg-white/30"
          >
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">Ders</span>
            <span className="flex w-full items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-sm font-black text-white">{lessonName}</span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform text-white ${openMenu === 'lesson' ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {openMenu === 'lesson' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
              <div className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {gradeLessons.map((lesson, idx) => (
                  <Link
                    key={lesson.id}
                    href={`/${gradeSlug}/${lesson.slug}`}
                    onClick={() => setOpenMenu(null)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition-colors ${
                      lesson.slug === lessonSlug ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${getLessonColor(idx)} text-sm text-white`}>
                      {lesson.icon || '📘'}
                    </span>
                    <span className="min-w-0 truncate">{lesson.name}</span>
                  </Link>
                ))}
                {!gradeLessons.length && <span className="block px-2.5 py-2 text-sm text-slate-400">Bu sınıfta ders yok</span>}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Ünite */}
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => toggle('unit')}
            className="flex w-full flex-col items-start rounded-xl bg-white/20 px-3 py-1.5 text-left transition-colors hover:bg-white/30"
          >
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">Ünite</span>
            <span className="flex w-full items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{unitTitle}</span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform text-white ${openMenu === 'unit' ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {openMenu === 'unit' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
              <div className="absolute right-0 top-full z-50 mt-2 max-h-[60vh] w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {units.map((unit) => (
                  <Link
                    key={unit.id}
                    href={`/${gradeSlug}/${lessonSlug}/${unit.slug}`}
                    onClick={() => setOpenMenu(null)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition-colors ${
                      unit.slug === unitSlug ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0 truncate">{unit.title}</span>
                  </Link>
                ))}
                {!units.length && <span className="block px-2.5 py-2 text-sm text-slate-400">Bu ders + sınıfta ünite yok</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Konu — bu sayfada açık bir konu olmadığı için her zaman "Konu seçin" placeholder'ı;
          bir konuya tıklamak bu sayfadan gerçek konu sayfasına GİDER. */}
      {topics.length > 0 && (
        <div className="relative min-w-0">
          <button
            type="button"
            onClick={() => toggle('topic')}
            className="flex w-full flex-col items-start rounded-xl bg-white/20 px-3 py-1.5 text-left transition-colors hover:bg-white/30"
          >
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">Konu</span>
            <span className="flex w-full items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-sm italic text-white/70">Konu seçin</span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform text-white ${openMenu === 'topic' ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {openMenu === 'topic' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {topics.map((topic, idx) => (
                  <Link
                    key={topic.id}
                    href={`/${gradeSlug}/${lessonSlug}/${unitSlug}/${topic.slug}`}
                    onClick={() => setOpenMenu(null)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <span className="shrink-0 text-xs font-black text-slate-400">{idx + 1}</span>
                    <span className="min-w-0 truncate">{topic.title}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
