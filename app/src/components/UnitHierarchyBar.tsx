'use client';

// Ünite tanıtım sayfasındaki (/[gradeSlug]/[lessonSlug]/[unitSlug]) Sınıf/Ders/Ünite/Konu
// hızlı değiştirici — DersClient.tsx'teki hiyerarşi barıyla AYNI zincir mantığı: Sınıf ve
// Ders seçimi "bekleyen" (pending) bir seçimdir, sayfadan AYRILMAZ, sadece bir alt
// seviyenin dropdown içeriğini günceller (kullanıcının 2026-09-06 isteği: "sınıf ve ders
// seçince bu sayfadan ayrılmasın, sadece açılır menülerin içeriği güncellensin"). Ünite
// seçimi ise commit'tir — o ünitenin (muhtemelen farklı sınıf/ders altındaki) tanıtım
// sayfasına GERÇEKTEN gider. Konu, sadece zincir hâlâ bu sayfanın kendi
// sınıf/ders/ünitesiyle aynıyken (yani Sınıf/Ders'te başka bir şeye tıklanmadıysa)
// gösterilir — aksi halde hangi konuların listeleneceği belirsizleşir.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, ChevronDown, Loader2 } from 'lucide-react';
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
  gradeId: number;
  gradeName: string;
  gradeSlug: string;
  lessonId: number;
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

async function fetchLessonsForGrade(gradeId: number): Promise<LessonOption[]> {
  try {
    const res = await fetch(`/api/grade-lessons?gradeId=${gradeId}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { lessons?: LessonOption[] };
    return data.lessons || [];
  } catch {
    return [];
  }
}

async function fetchUnitsForLesson(gradeId: number, lessonId: number): Promise<UnitOption[]> {
  try {
    const res = await fetch(`/api/lesson-units?gradeId=${gradeId}&lessonId=${lessonId}&publicOnly=1`);
    if (!res.ok) return [];
    const data = (await res.json()) as { units?: { id: number; title: string; slug: string | null }[] };
    return (data.units || []).filter((u): u is { id: number; title: string; slug: string } => !!u.slug);
  } catch {
    return [];
  }
}

export default function UnitHierarchyBar({
  gradeId,
  gradeName,
  gradeSlug,
  lessonId,
  lessonName,
  lessonSlug,
  unitTitle,
  unitSlug,
  allGrades,
  gradeLessons,
  units,
  topics,
}: UnitHierarchyBarProps) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const toggle = (menu: OpenMenu) => setOpenMenu((v) => (v === menu ? null : menu));

  // Bekleyen (henüz commit edilmemiş) Sınıf/Ders seçimi — sayfanın kendi (URL'deki)
  // sınıf/ders/ünitesinden farklı olabilir, Ünite'ye tıklanana kadar sayfa değişmez.
  const [pendingGrade, setPendingGrade] = useState({ id: gradeId, name: gradeName, slug: gradeSlug });
  const [pendingLesson, setPendingLesson] = useState<{ id: number; name: string; slug: string } | null>({ id: lessonId, name: lessonName, slug: lessonSlug });
  const [pendingLessons, setPendingLessons] = useState<LessonOption[]>(gradeLessons);
  const [pendingUnits, setPendingUnits] = useState<UnitOption[]>(units);
  const [pendingLoading, setPendingLoading] = useState(false);
  const requestIdRef = useRef(0);

  // Zincir hâlâ bu sayfanın kendi sınıf/dersiyle aynıysa (Sınıf/Ders'te başka bir şeye
  // tıklanmadıysa) Konu dropdown'u bu ünitenin konularını gösterebilir — aksi halde hangi
  // ünitenin konuları gösterileceği belirsiz olurdu, o yüzden gizleniyor.
  const isOnOwnUnit = pendingGrade.id === gradeId && pendingLesson?.id === lessonId;

  const handleGradeSelect = async (grade: GradeOption) => {
    setOpenMenu(null);
    if (grade.id === pendingGrade.id) return;
    const requestId = ++requestIdRef.current;

    setPendingGrade({ id: grade.id, name: grade.name, slug: grade.slug });
    setPendingLesson(null);
    setPendingUnits([]);
    setPendingLoading(true);
    try {
      const lessons = grade.id === gradeId ? gradeLessons : await fetchLessonsForGrade(grade.id);
      if (requestIdRef.current !== requestId) return;
      setPendingLessons(lessons);
    } finally {
      if (requestIdRef.current === requestId) setPendingLoading(false);
    }
  };

  const handleLessonSelect = async (lesson: LessonOption) => {
    setOpenMenu(null);
    if (lesson.id === pendingLesson?.id) return;
    const requestId = ++requestIdRef.current;

    setPendingLesson({ id: lesson.id, name: lesson.name, slug: lesson.slug });
    setPendingUnits([]);
    setPendingLoading(true);
    try {
      const nextUnits = pendingGrade.id === gradeId && lesson.id === lessonId ? units : await fetchUnitsForLesson(pendingGrade.id, lesson.id);
      if (requestIdRef.current !== requestId) return;
      setPendingUnits(nextUnits);
    } finally {
      if (requestIdRef.current === requestId) setPendingLoading(false);
    }
  };

  // Ünite seçimi commit'tir — o ünitenin tanıtım sayfasına gerçekten gider.
  const handleUnitSelect = (unit: UnitOption) => {
    setOpenMenu(null);
    if (!pendingLesson) return;
    router.push(`/${pendingGrade.slug}/${pendingLesson.slug}/${unit.slug}`);
  };

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
              {pendingGrade.name} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openMenu === 'grade' ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {openMenu === 'grade' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
              <div className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {allGrades.map((grade) => (
                  <button
                    key={grade.id}
                    type="button"
                    onClick={() => void handleGradeSelect(grade)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition-colors ${
                      grade.id === pendingGrade.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0 truncate">{grade.name}</span>
                  </button>
                ))}
                {!allGrades.length && <span className="block px-2.5 py-2 text-sm text-slate-400">{pendingGrade.name}</span>}
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
              <span className={`min-w-0 flex-1 truncate text-sm text-white ${pendingLesson ? 'font-black' : 'italic text-white/70'}`}>
                {pendingLesson ? pendingLesson.name : 'Ders seçin'}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform text-white ${openMenu === 'lesson' ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {openMenu === 'lesson' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
              <div className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {pendingLessons.map((lesson, idx) => (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => void handleLessonSelect(lesson)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition-colors ${
                      lesson.id === pendingLesson?.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${getLessonColor(idx)} text-sm text-white`}>
                      {lesson.icon || '📘'}
                    </span>
                    <span className="min-w-0 truncate">{lesson.name}</span>
                  </button>
                ))}
                {!pendingLessons.length && (
                  <span className="block px-2.5 py-2 text-sm text-slate-400">{pendingLoading ? 'Yükleniyor…' : 'Bu sınıfta ders yok'}</span>
                )}
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
              <span className={`min-w-0 flex-1 truncate text-sm text-white ${isOnOwnUnit ? 'font-bold' : 'italic text-white/70'}`}>
                {isOnOwnUnit ? unitTitle : 'Ünite seçin'}
              </span>
              {pendingLoading ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white" />
              ) : (
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform text-white ${openMenu === 'unit' ? 'rotate-180' : ''}`} />
              )}
            </span>
          </button>
          {openMenu === 'unit' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
              <div className="absolute right-0 top-full z-50 mt-2 max-h-[60vh] w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {pendingUnits.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => handleUnitSelect(unit)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition-colors ${
                      isOnOwnUnit && unit.slug === unitSlug ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0 truncate">{unit.title}</span>
                  </button>
                ))}
                {!pendingUnits.length && (
                  <span className="block px-2.5 py-2 text-sm text-slate-400">
                    {!pendingLesson ? 'Önce ders seçin' : pendingLoading ? 'Yükleniyor…' : 'Bu ders + sınıfta ünite yok'}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Konu — sadece zincir hâlâ bu sayfanın kendi sınıf/dersiyle aynıyken (isOnOwnUnit)
          gösterilir; bu sayfada açık bir konu olmadığı için hep "Konu seçin" placeholder'ı,
          bir konuya tıklamak gerçek konu sayfasına GİDER. */}
      {isOnOwnUnit && topics.length > 0 && (
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
