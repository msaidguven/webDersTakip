// app/ders/Mufredatoverviewclient.tsx

'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { roboticFontVars } from '@/app/src/components/robotic/fonts';
import r from '@/app/src/components/robotic/robotic.module.css';
import { mergeWeekSpans, weekLabel, type WeekRange } from '@/app/src/lib/kazanimPlan';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
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
  heroImageUrl?: string | null;
  weekSpan?: WeekRange | null;
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

// Görünüm: "robotik kontrol paneli" teması (2026-10-20, anasayfa/İlerlemem ile aynı; bkz. robotic).
const FRAME = `rounded-[22px] ${r.panel}`;
const OUTLINE_BUTTON = `inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${r.btnGhost} ${r.btnText}`;
const SORU_BADGE = `relative z-10 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${r.btnGhost}`;
const SELECT = `appearance-none rounded-lg py-1.5 pl-3 pr-7 text-sm font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${r.iconBtn} ${r.ink}`;

function academicYearLabel(): string {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}


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
  // Konu satırı artık akordeon DEĞİL, doğrudan konu anlatımına giden bir link (kullanıcının
  // 2026-09-25 kararı: "ünite ve konular iç içe girmiş"). Eski akordeon konuya ulaşmayı iki
  // tığa çıkarıyor, üstelik üniteyle aynı kartta iki farklı tıklama davranışı oluşturuyordu.
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
    <div className={`${roboticFontVars} ${r.root} antialiased`}>
      <Suspense fallback={null}>
        <SearchParamsSync onChange={setSearchParams} />
      </Suspense>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* Mobil/Tablet Üst Navigasyon */}
        <div className="flex items-center justify-between gap-3 mb-6 lg:hidden">
          <Link
            href={changeLessonsHref}
            className={`flex items-center gap-2 text-sm font-bold transition-colors hover:text-cyan-600 dark:hover:text-cyan-400 ${r.muted}`}
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
                  className={SELECT}
                >
                  {allGrades.filter((g) => g.slug).map((g) => (
                    <option key={g.id} value={g.slug ?? ''}>{g.name}</option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            {showLessonDropdown ? (
              <div className="relative">
                <select
                  value={lessonSlug ?? ''}
                  onChange={handleLessonChange}
                  aria-label="Ders değiştir"
                  className={`max-w-[140px] sm:max-w-[200px] ${SELECT}`}
                >
                  {gradeLessons.filter((l) => l.slug).map((l) => (
                    <option key={l.id} value={l.slug ?? ''}>
                      {l.icon || '📘'} {l.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <Link
                href={changeLessonsHref}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${r.iconBtn}`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Dersleri Değiştir</span>
              </Link>
            )}
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-6 lg:items-start">

          {/* Ana İçerik */}
          <div className="min-w-0">

            {/* Ders başlığı — anasayfadaki kokpit kartı: tarama ışığı, LED etiket, krom başlık. */}
            <div className={`${FRAME} ${r.hero} mb-7 p-6 sm:p-8`}>
              <span className={r.scan} aria-hidden="true" />
              <div className="relative flex items-center gap-5">
                <div className={`h-16 w-16 shrink-0 text-3xl sm:h-[4.5rem] sm:w-[4.5rem] sm:text-4xl ${r.chipBox}`}>
                  {lessonIcon || '📘'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-2 ${r.label}`}>
                      <span className={r.led} aria-hidden="true" /> {gradeName}
                    </span>
                    <span className={`${r.badge}`}>{academicYearLabel()}</span>
                  </div>
                  {/* H1'de sınıf+ders+"Yeni Müfredat" birlikte — kullanıcının 2026-09-06
                      isteği: "her sınıf her ders için bunu yazacağız, SEO için" (insanların
                      arattığı "6. sınıf sosyal bilgiler yeni müfredat" gibi sorgularla
                      birebir eşleşsin diye), dinamik olarak HER sınıf/ders kombinasyonunda
                      aynı şablon. */}
                  <h1 className="text-2xl leading-tight sm:text-3xl">
                    <span className={r.chrome}>{gradeName} {lessonName}</span>{' '}
                    <span className={`${r.display} font-bold uppercase ${r.accent}`}>Yeni Müfredat</span>
                  </h1>
                  <p className={`mt-1 text-xs sm:text-sm ${r.muted}`}>
                    {lessonName} dersi Türkiye Yüzyılı Maarif Modeli&apos;ne (TYMM) uygun konu anlatımları, testler ve sorularla burada.
                  </p>
                </div>
              </div>

              <div className="relative mt-6 grid grid-cols-3 gap-2.5 sm:gap-3">
                {[
                  { icon: Layers, value: units.length, label: 'Ünite' },
                  { icon: BookOpen, value: totalTopics, label: 'Konu' },
                  { icon: ListChecks, value: totalQuestions, label: 'Soru' },
                ].map(({ icon: Icon, value, label }) => (
                  <div key={label} className={`flex flex-col items-center gap-1 py-3 ${r.stat}`}>
                    <Icon className={`h-4 w-4 ${r.accent}`} aria-hidden="true" />
                    <span className={`text-xl ${r.statValue}`}>{value}</span>
                    <span className={`${r.mono} text-[10.5px] font-semibold uppercase tracking-[0.14em] ${r.muted}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ünite Kartları */}
            <div className="space-y-4">
              {units.map((unit, unitIdx) => {
                const displayNo = unitIdx + 1;
                const topics = unit.topics ?? [];
                // Ünitenin kendi haftası yoksa konularının haftaları birleştirilir (İlerlemem ders raporundaki gibi).
                const topicWeeks = mergeWeekSpans(topics.map((t) => t.weekSpan));
                const start = unit.start_week ?? topicWeeks?.start ?? null;
                const end = unit.end_week ?? topicWeeks?.end ?? null;
                const isDraftUnit = unit.is_active === false;

                return (
                  <div
                    key={unit.id}
                    id={unit.slug ?? undefined}
                    className={`scroll-mt-24 ${FRAME} ${isDraftUnit ? '!border-amber-400' : ''}`}
                  >
                    {/* Ünite Başlığı — konu satırlarından AÇIKÇA baskın olmalı: daha büyük
                        punto, versal harf aralığı ve renkli şerit. Başlık ARTIK KESİLMİYOR
                        (eski truncate mobilde "Güneş Sistemi ..." gibi ünite adını yarıda
                        bırakıp konu adlarını tam gösteriyordu — hiyerarşi tersine dönüyordu);
                        "Üniteye Git" dar ekranda kendi satırına iniyor. */}
                    <div className="px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-start gap-x-3 gap-y-3 sm:gap-x-4">
                        <span className={`h-10 w-10 shrink-0 text-base ${r.chipBox}`}>
                          {String(displayNo).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={r.label}>{displayNo}. Ünite</p>
                          <h3 className={`text-lg sm:text-xl font-bold leading-snug text-balance ${r.display} ${r.ink}`}>
                            {unit.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {isDraftUnit && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                Taslak
                              </span>
                            )}
                            <span className={`gap-1.5 ${r.badge}`}>
                              {start != null && end != null && (
                                <>
                                  <Calendar className="h-3 w-3" /> Hafta {start}–{end}
                                  <span>·</span>
                                </>
                              )}
                              <span className="normal-case">
                                {topics.length} konu · {unit.questionCount ?? 0} soru
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Ünitenin kendi tanıtım sayfasına (kapak görseli + konu kartları,
                            bkz. [unitSlug]/page.tsx) link — kullanıcının 2026-09-06 isteği:
                            "konulara link verdiğimiz gibi ünite sayfasına da güzel bi link
                            veren buton ekleyelim". Taslak ünitelerin sayfası olmadığından
                            (getUnitOverviewData is_active filtreliyor) buton gizleniyor.
                            Geniş ekranda başlığın sağında, dar ekranda (flex-wrap ile) alt
                            satırda duruyor — başlığın yerini çalıp kesmesin diye. */}
                        {!isDraftUnit && unit.slug && (
                          // w-full: dar ekranda kendi satırına iner (flex-wrap'i zorlar), böylece
                          // ünite başlığı tüm genişliği kullanır. sm:w-auto ile geniş ekranda
                          // başlığın sağına, aynı satıra geçer.
                          <div className="order-last w-full sm:order-none sm:w-auto sm:shrink-0 sm:self-center">
                            <Link
                              href={`/${gradeSlug}/${lessonSlug}/${unit.slug}`}
                              className={OUTLINE_BUTTON}
                            >
                              Ünite Sayfası <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Konular — ünitenin ALTINDA, girintili ve gri zeminli ayrı bir blok.
                        Girinti + sol dikey ray, "bunlar bu ünitenin içindeki konular"ı
                        tipografiden bağımsız olarak anlatıyor. */}
                    {topics.length === 0 ? (
                      <div className={`border-t px-5 py-4 text-center text-sm ${r.divider} ${r.muted}`}>
                        Henüz konu eklenmemiş.
                      </div>
                    ) : (
                      <div className={`border-t py-2 pl-4 pr-2 sm:pl-6 sm:pr-3 ${r.divider}`}>
                        <div className={`border-l-2 pl-2 sm:pl-3 ${r.divider}`}>
                        {topics.map((topic, idx) => {
                          const hasContent = topic.hasContent !== false;
                          const questionCount = topic.questionCount ?? 0;
                          const topicHref = gradeSlug && lessonSlug && unit.slug && topic.slug
                            ? `/${gradeSlug}/${lessonSlug}/${unit.slug}/${topic.slug}`
                            : null;
                          const bankHref = questionCount > 0 && gradeSlug && lessonSlug && unit.slug && topic.slug
                            ? `/soru-bankasi/${gradeSlug}/${lessonSlug}/${unit.slug}/${topic.slug}`
                            : null;

                          // Satırın TAMAMI konu anlatımına gider (after:inset-0 ile yayılan
                          // link). Soru rozeti onun ÜSTÜNDE ayrı bir link — iç içe <a>
                          // kurmadan iki hedefi aynı satıra sığdırmanın standart yolu.
                          // Konunun öğretim haftası (İlerlemem ders raporundaki etiketle aynı). Başlık line-clamp'li
                          // kendi span'ında; etiket dar ekranda altında, geniş ekranda yanında.
                          const titleBody = (
                            <>
                              <span className="line-clamp-2">{topic.title}</span>
                              {topic.weekSpan && (
                                <span className={`shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${r.mono} ${r.tint}`}>
                                  {weekLabel(topic.weekSpan)}
                                </span>
                              )}
                            </>
                          );
                          const titleLayout = 'flex min-w-0 flex-1 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2';

                          const rowInner = (
                            <>
                              <span className={`w-7 shrink-0 text-[11px] font-semibold ${r.mono} ${r.accent}`}>
                                {displayNo}.{idx + 1}
                              </span>
                              {/* Küçük konu görseli (kullanıcının 2026-09-06 isteği: "bu
                                  sayfalara da küçük resimler eklenebilir mi") — AYNI
                                  topic_contents.hero_image_url, görseli olmayan konularda
                                  hiç gösterilmiyor. */}
                              {topic.heroImageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={topic.heroImageUrl}
                                  alt=""
                                  className="h-6 w-6 shrink-0 rounded-md object-cover"
                                />
                              )}
                            </>
                          );

                          if (!hasContent) {
                            return (
                              <div
                                key={topic.id}
                                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5"
                              >
                                {rowInner}
                                <span className={`${titleLayout} text-sm ${r.muted}`}>{titleBody}</span>
                                <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${r.mono} ${r.divider} ${r.muted}`}>
                                  Yakında
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={topic.id}
                              className={`group relative my-1 flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 ${r.item} ${r.itemHover}`}
                            >
                              {rowInner}
                              {topicHref ? (
                                <Link
                                  href={topicHref}
                                  className={`${titleLayout} text-sm font-bold after:absolute after:inset-0`}
                                >
                                  {titleBody}
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => goToWeek(start ?? effectiveWeek)}
                                  className={`${titleLayout} text-left text-sm font-bold after:absolute after:inset-0`}
                                >
                                  {titleBody}
                                </button>
                              )}
                              {bankHref && (
                                <Link href={bankHref} className={SORU_BADGE}>
                                  <ListChecks className="h-3 w-3" /> {questionCount} soru
                                </Link>
                              )}
                              <ChevronRight className={`h-4 w-4 shrink-0 ${r.accent}`} />
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {units.length === 0 && (
                <div className={`${FRAME} text-center py-12`}>
                  <Sparkles className={`h-8 w-8 mx-auto mb-3 ${r.accent}`} />
                  <p className={`text-sm ${r.muted}`}>Bu ders için henüz ünite bulunamadı.</p>
                </div>
              )}
            </div>

            <p className={`mt-8 text-center text-xs ${r.muted}`}>
              Hafta aralıkları MEB takvimine göredir ve değişiklik gösterebilir.
            </p>

          </div>
          {/* Dersler + Sınıflar (2026-10-03): eskiden ana içeriğin SOLUNDA iki sütundu ve h2'leri
              sayfanın h1'inden önce okunuyordu (SEO/ekran okuyucu başlık sırası). Artık sağda, içerikten
              sonra — soru bankası ve ünite sayfalarıyla aynı yer. */}
          <aside className="hidden lg:flex lg:flex-col lg:gap-4 sticky top-24 self-start" aria-label="Ders gezinmesi">
            <div className={`${FRAME} p-3`}>
              <h2 className={`mb-2 flex items-center gap-2 px-2 ${r.label}`}>
                <BookOpen className="h-4 w-4" /> Dersler
              </h2>
              <nav className="space-y-0.5">
                {gradeLessons.filter((l) => l.slug).map((l) => {
                  const active = l.slug === lessonSlug;
                  return (
                    <Link
                      key={l.id}
                      href={`/${gradeSlug}/${l.slug}`}
                      className={`!flex items-center gap-2.5 px-3 py-2 text-sm font-bold ${r.navLink} !normal-case !tracking-normal !whitespace-normal ${active ? r.navActive : ''}`}
                    >
                      <span className="text-base leading-none shrink-0">{l.icon || '📘'}</span>
                      <span className="truncate">{l.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className={`${FRAME} p-3`}>
              <h2 className={`mb-2 flex items-center gap-2 px-2 ${r.label}`}>
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
                      className={`!flex items-center gap-2.5 px-3 py-2 text-sm font-bold ${r.navLink} !normal-case !tracking-normal !whitespace-normal ${active ? r.navActive : ''}`}
                    >
                      <span className="text-base leading-none shrink-0">{g.icon || '📘'}</span>
                      <span className="truncate">{g.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}