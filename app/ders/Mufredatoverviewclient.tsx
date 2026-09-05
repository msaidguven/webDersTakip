// app/ders/Mufredatoverviewclient.tsx

'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronDown,
  GraduationCap,
  Layers,
  ListChecks,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export type UnitTopic = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
  questionCount?: number;
  hasContent?: boolean;
};

export type Unit = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
  is_active?: boolean;
  topicCount?: number | null;
  topics?: UnitTopic[];
  questionCount?: number;
};

export type GradeLessonOption = {
  id: number;
  name: string;
  slug: string | null;
  icon: string | null;
};

export type GradeOption = {
  id: number;
  name: string;
  slug: string | null;
  icon?: string | null;
  // Bu sınıfta gösterilecek ders slug'ı — şu an açık olan ders o sınıfta VARSA aynısı,
  // yoksa o sınıfta gerçekten var olan başka bir ders (server'da hesaplanıyor, bkz.
  // page.tsx). Sınıf değiştirince asla ölü bir "Ders bulunamadı" linkine düşülmesin diye.
  lessonSlug?: string | null;
};

interface MufredatOverviewClientProps {
  gradeName: string;
  lessonName: string;
  lessonIcon?: string | null;
  gradeSlug: string | null;
  lessonSlug: string | null;
  gradeId: string;
  lessonId: string;
  units: Unit[];
  currentWeek: number;
  totalWeeks?: number;
  gradeLessons?: GradeLessonOption[];
  allGrades?: GradeOption[];
}

function academicYearLabel(): string {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

// Her ünite için farklı ama sade vurgu renkleri
const UNIT_ACCENTS = [
  { border: 'border-l-4 border-l-indigo-500', badge: 'bg-indigo-100 text-indigo-700' },
  { border: 'border-l-4 border-l-purple-500', badge: 'bg-purple-100 text-purple-700' },
  { border: 'border-l-4 border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  { border: 'border-l-4 border-l-amber-500', badge: 'bg-amber-100 text-amber-700' },
  { border: 'border-l-4 border-l-rose-500', badge: 'bg-rose-100 text-rose-700' },
  { border: 'border-l-4 border-l-sky-500', badge: 'bg-sky-100 text-sky-700' },
];

// useSearchParams() bir bileşeni statik/ISR render'da Suspense'e sokup client-only render'a
// zorluyor (Next kısıtlaması). Bunu, içeriğin TAMAMINI (bütün konu/ünite listesini) taşıyan
// ana bileşenin dışına, tek satırlık bu yardımcıya izole ediyoruz — böylece sayfa içeriği
// sunucuda/statik olarak tam üretilir, sadece URL'deki ?hafta= parametresi (varsa) hydration
// sonrası bir state güncellemesiyle uygulanır (bkz. page.tsx'teki not).
function SearchParamsSync({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  const searchParams = useSearchParams();
  React.useEffect(() => {
    onChange(new URLSearchParams(searchParams?.toString()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams?.toString()]);
  return null;
}

export default function MufredatOverviewClient({
  gradeName,
  lessonName,
  lessonIcon,
  gradeSlug,
  lessonSlug,
  gradeId,
  lessonId,
  units,
  currentWeek,
  gradeLessons = [],
  allGrades = [],
}: MufredatOverviewClientProps) {
  const router = useRouter();
  // useSearchParams() burada DEĞİL, SearchParamsSync (Suspense'e alınmış küçük bir alt
  // bileşen) içinde çağrılıyor — böylece bu bileşenin asıl içerik render'ı statik/ISR
  // kalabiliyor, sadece bu state hydration sonrası bir kez güncelleniyor (bkz. yukarıdaki
  // SearchParamsSync tanımı). currentWeek prop'u sunucunun hesapladığı VARSAYILAN; URL'de
  // ?hafta= varsa onu tercih ediyoruz.
  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => new URLSearchParams());
  // Konu satırları artık "Konu Anlatımı" + "Soru Bankası" butonlarını her zaman göstermek
  // yerine tek satırlık, tıklanınca açılan bir akordeon — kullanıcının 2026-09-06 isteği:
  // "akordiyon olsun, açılan satırda konu ve soru butonları görünsün". Bir seferde sadece
  // TEK konu açık kalır (id yerine Set kullanmıyoruz, tek elemanlı state yeterli).
  const [expandedTopicId, setExpandedTopicId] = useState<number | null>(null);
  const haftaParam = searchParams.get('hafta');
  const effectiveWeek = haftaParam ? parseInt(haftaParam, 10) || currentWeek : currentWeek;

  const goToWeek = (weekNo: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('hafta', String(weekNo));

    if (gradeSlug && lessonSlug) {
      router.push(`/${gradeSlug}/${lessonSlug}/icerik?${params.toString()}`);
    } else {
      params.set('sinif', gradeId);
      params.set('ders', lessonId);
      router.push(`/ders/icerik?${params.toString()}`);
    }
  };

  const changeLessonsHref = gradeSlug ? `/${gradeSlug}` : '/';

  const handleLessonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSlug = e.target.value;
    if (!gradeSlug || !selectedSlug || selectedSlug === lessonSlug) return;
    router.push(`/${gradeSlug}/${selectedSlug}`);
  };

  const handleGradeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSlug = e.target.value;
    if (!selectedSlug || selectedSlug === gradeSlug) return;
    // Seçilen sınıfta bu ders yoksa server'ın hesapladığı targetLessonSlug (o sınıfta
    // gerçekten var olan bir ders) kullanılır — aynı ders slug'ını körü körüne
    // tekrarlamak "Ders bulunamadı" ölü ucuna düşürüyordu (bkz. GradeOption.lessonSlug).
    const targetGrade = allGrades.find((g) => g.slug === selectedSlug);
    const targetLessonSlug = targetGrade?.lessonSlug ?? lessonSlug;
    router.push(targetLessonSlug ? `/${selectedSlug}/${targetLessonSlug}` : `/${selectedSlug}`);
  };

  const showLessonDropdown = !!gradeSlug && gradeLessons.filter((l) => l.slug).length > 1;
  const showGradeDropdown = allGrades.filter((g) => g.slug).length > 1;

  const totalTopics = units.reduce((sum, u) => sum + (u.topics?.length ?? u.topicCount ?? 0), 0);
  const totalQuestions = units.reduce((sum, u) => sum + (u.questionCount ?? 0), 0);

  return (
    <div className="min-h-screen bg-gray-50/80 text-gray-800 font-sans antialiased">
      <Suspense fallback={null}>
        <SearchParamsSync onChange={setSearchParams} />
      </Suspense>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* Mobil/Tablet Üst Navigasyon */}
        <div className="flex items-center justify-between gap-3 mb-6 lg:hidden">
          <Link
            href={changeLessonsHref}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dersler</span>
          </Link>
          <div className="flex items-center gap-2">
            {showGradeDropdown && (
              <div className="relative">
                <select
                  value={gradeSlug ?? ''}
                  onChange={handleGradeChange}
                  aria-label="Sınıf değiştir"
                  className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer"
                >
                  {allGrades.filter((g) => g.slug).map((g) => (
                    <option key={g.id} value={g.slug ?? ''}>{g.name}</option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            {showLessonDropdown ? (
              <div className="relative">
                <select
                  value={lessonSlug ?? ''}
                  onChange={handleLessonChange}
                  aria-label="Ders değiştir"
                  className="appearance-none max-w-[140px] sm:max-w-[200px] pl-3 pr-7 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer"
                >
                  {gradeLessons.filter((l) => l.slug).map((l) => (
                    <option key={l.id} value={l.slug ?? ''}>
                      {l.icon || '📘'} {l.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <Link
                href={changeLessonsHref}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Dersleri Değiştir</span>
              </Link>
            )}
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[180px_220px_1fr] lg:gap-5 lg:items-start">

          {/* Sınıflar Sidebar - Masaüstü */}
          <aside className="hidden lg:block sticky top-24 self-start">
            <div className="rounded-xl border border-gray-200/70 bg-white/90 backdrop-blur-sm shadow-sm p-3">
              <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2 mb-2">
                <GraduationCap className="h-4 w-4" /> Sınıflar
              </h2>
              <nav className="space-y-0.5">
                {allGrades.filter((g) => g.slug).map((g) => {
                  const active = g.slug === gradeSlug;
                  const targetLessonSlug = g.lessonSlug ?? lessonSlug;
                  return (
                    <Link
                      key={g.id}
                      href={targetLessonSlug ? `/${g.slug}/${targetLessonSlug}` : `/${g.slug}`}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        active
                          ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <span className="text-base leading-none shrink-0">{g.icon || '📘'}</span>
                      <span className="truncate">{g.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Dersler Sidebar - Masaüstü */}
          <aside className="hidden lg:block sticky top-24 self-start">
            <div className="rounded-xl border border-gray-200/70 bg-white/90 backdrop-blur-sm shadow-sm p-3">
              <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2 mb-2">
                <BookOpen className="h-4 w-4" /> Dersler
              </h2>
              <nav className="space-y-0.5">
                {gradeLessons.filter((l) => l.slug).map((l) => {
                  const active = l.slug === lessonSlug;
                  return (
                    <Link
                      key={l.id}
                      href={`/${gradeSlug}/${l.slug}`}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        active
                          ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <span className="text-base leading-none shrink-0">{l.icon || '📘'}</span>
                      <span className="truncate">{l.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Ana İçerik */}
          <div className="min-w-0">

            {/* Ders Başlığı */}
            <div className="bg-white rounded-xl border border-gray-200/70 shadow-sm p-6 sm:p-7 mb-7">
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-indigo-50 flex items-center justify-center text-3xl sm:text-4xl shrink-0 ring-1 ring-indigo-100">
                  {lessonIcon || '📘'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                      <GraduationCap className="h-3 w-3" />
                      {gradeName}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                      <Calendar className="h-3 w-3" />
                      {academicYearLabel()}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                    {lessonName}
                  </h1>
                  <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-gray-400" />
                      {units.length} Ünite
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-gray-400" />
                      {totalTopics} Konu
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <ListChecks className="h-4 w-4 text-gray-400" />
                      {totalQuestions} Soru
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ünite Kartları */}
            <div className="space-y-4">
              {units.map((unit, unitIdx) => {
                const displayNo = unitIdx + 1;
                const topics = unit.topics ?? [];
                const accent = UNIT_ACCENTS[unitIdx % UNIT_ACCENTS.length];
                const start = unit.start_week;
                const end = unit.end_week;
                const isDraftUnit = unit.is_active === false;

                return (
                  <div
                    key={unit.id}
                    id={unit.slug ?? undefined}
                    className={`scroll-mt-4 rounded-xl border bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md ${
                      isDraftUnit
                        ? 'border-amber-200/70 bg-amber-50/30'
                        : `border-gray-200/70 ${accent.border}`
                    }`}
                  >
                    {/* Ünite Başlığı */}
                    <div className={`px-5 py-4 flex items-center gap-4 ${
                      isDraftUnit ? 'bg-amber-50/50' : 'bg-gray-50/50'
                    }`}>
                      <span className={`h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                        isDraftUnit ? 'bg-amber-100 text-amber-700' : accent.badge
                      }`}>
                        {displayNo}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-base font-semibold truncate ${
                          isDraftUnit ? 'text-amber-800' : 'text-gray-900'
                        }`}>
                          {unit.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {isDraftUnit && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                              Taslak
                            </span>
                          )}
                          {start != null && end != null && (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200/70">
                              <Calendar className="h-3 w-3" /> Hafta {start}–{end}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 font-medium">
                            {topics.length} konu
                          </span>
                          <span className="text-xs text-gray-400 font-medium">
                            {unit.questionCount ?? 0} soru
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Konular */}
                    {topics.length === 0 ? (
                      <div className="px-5 py-4 text-center text-sm text-gray-400">
                        Henüz konu eklenmemiş.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {topics.map((topic, idx) => {
                          const hasContent = topic.hasContent !== false;
                          const questionCount = topic.questionCount ?? 0;
                          const topicHref = gradeSlug && lessonSlug && unit.slug && topic.slug
                            ? `/${gradeSlug}/${lessonSlug}/${unit.slug}/${topic.slug}`
                            : null;
                          const bankHref = questionCount > 0 && gradeSlug && lessonSlug && unit.slug && topic.slug
                            ? `/soru-bankasi/${gradeSlug}/${lessonSlug}/${unit.slug}/${topic.slug}`
                            : null;

                          const isExpanded = expandedTopicId === topic.id;

                          return (
                            <div key={topic.id}>
                              {/* Tek satır, tıklanınca akordeon gibi açılır — Konu Anlatımı/Soru
                                  Bankası butonları artık her zaman görünmüyor, sadece açılınca
                                  (kullanıcının 2026-09-06 isteği: "akordiyon olsun, açılan satırda
                                  konu ve soru butonları görünsün"). */}
                              <button
                                type="button"
                                onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                                className="flex w-full items-center gap-2.5 px-5 py-3 text-left transition-colors hover:bg-gray-50"
                              >
                                <span className="text-xs font-mono font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md shrink-0">
                                  {displayNo}.{idx + 1}
                                </span>
                                <span className={`text-sm font-medium truncate flex-1 min-w-0 ${hasContent ? 'text-gray-700' : 'text-gray-400'}`}>
                                  {topic.title}
                                </span>
                                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>

                              {isExpanded && (
                                <div className="flex flex-wrap items-center gap-1.5 px-5 pb-3">
                                  {!hasContent ? (
                                    <span className="text-xs text-gray-300 px-2 py-1">İçerik eklenmemiş</span>
                                  ) : topicHref ? (
                                    <Link
                                      href={topicHref}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                                    >
                                      <BookOpen className="h-3.5 w-3.5" /> Konu Anlatımı
                                    </Link>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => goToWeek(start ?? effectiveWeek)}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                                    >
                                      <BookOpen className="h-3.5 w-3.5" /> Konu Anlatımı
                                    </button>
                                  )}
                                  {bankHref ? (
                                    <Link
                                      href={bankHref}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-md transition-colors"
                                    >
                                      <ListChecks className="h-3.5 w-3.5" /> Soru Bankası · {questionCount}
                                    </Link>
                                  ) : (
                                    <span className="text-xs text-gray-300 px-2 py-1">Soru yok</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {units.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200/70 shadow-sm">
                  <Sparkles className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Bu ders için henüz ünite bulunamadı.</p>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-8 text-center">
              Hafta aralıkları MEB takvimine göredir ve değişiklik gösterebilir.
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}