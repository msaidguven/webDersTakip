'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, X } from 'lucide-react';
import { buildTopicHref, type Content, type GradeLesson, type GradeOption, type Unit } from '../dersHelpers';
import s from './DersClientV2.module.css';

// v2 "Konu değiştir" penceresi (kullanıcı isteği, 2026-09-27): sınıf ve ders seçimi artık
// başka sayfaya götürmüyor, pencere içinde sırayla sınıf → ders → ünite → konu açılıyor;
// sayfa sadece bir konuya tıklanınca değişiyor. Bulunulan
// sınıf/ders/ünite sayfa verisinden hazır gelir; diğerleri ilk seçildiğinde çekilip
// pencere açık kaldıkça önbellekte tutulur.

type TreeTopic = { id: number; title: string; slug: string | null };
type TreeUnit = { id: number; title: string; slug: string | null; topics?: TreeTopic[] };
// Kayıt yoksa (undefined) yükleniyor demektir — ayrı bir 'loading' durumu tutulmuyor.
type Loadable<T> = { status: 'error' } | { status: 'ready'; data: T };

type Props = {
  className?: string;
  grades: GradeOption[];
  gradeLessons: GradeLesson[];
  units: Unit[];
  contents: Content[];
  current: { gradeId: number; lessonId: number; unitId: number | null; topicId: number | null };
  onClose: () => void;
};

const treeKey = (gradeId: number, lessonId: number) => `${gradeId}:${lessonId}`;

async function requestLessons(gradeId: number): Promise<GradeLesson[]> {
  const res = await fetch(`/api/grade-lessons?gradeId=${gradeId}`);
  if (!res.ok) throw new Error(`grade-lessons ${res.status}`);
  return ((await res.json()) as { lessons: GradeLesson[] }).lessons;
}

async function requestTree(gradeId: number, lessonId: number): Promise<TreeUnit[]> {
  const res = await fetch(`/api/lesson-units?gradeId=${gradeId}&lessonId=${lessonId}&publicOnly=1&includeTopics=1`);
  if (!res.ok) throw new Error(`lesson-units ${res.status}`);
  return ((await res.json()) as { units: TreeUnit[] }).units.map((u) => ({ ...u, topics: u.topics ?? [] }));
}

export default function TopicSwitcher({ className, grades, gradeLessons, units, contents, current, onClose }: Props) {
  const [gradeId, setGradeId] = useState(current.gradeId);
  const [lessonId, setLessonId] = useState<number | null>(current.lessonId);
  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(current.unitId);
  const [lessonsByGrade, setLessonsByGrade] = useState<Record<number, Loadable<GradeLesson[]>>>(() => ({
    [current.gradeId]: { status: 'ready', data: gradeLessons },
  }));
  // Bulunulan ders: üniteler ve bulunulan ünitenin konuları sayfa verisinden hemen hazır;
  // diğer ünitelerin konuları aşağıdaki ilk yüklemeyle tamamlanır.
  const [treeByLesson, setTreeByLesson] = useState<Record<string, Loadable<TreeUnit[]>>>(() => ({
    [treeKey(current.gradeId, current.lessonId)]: {
      status: 'ready',
      data: units.map((u) => ({
        id: u.id,
        title: u.title,
        slug: u.slug,
        topics: u.id === current.unitId ? contents.map((c) => ({ id: Number(c.id), title: c.title, slug: c.slug ?? null })) : undefined,
      })),
    },
  }));
  const inFlight = useRef(new Set<string>());

  const fetchLessons = useCallback((g: number) => {
    const key = `lessons:${g}`;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    requestLessons(g)
      .then((data) => setLessonsByGrade((prev) => ({ ...prev, [g]: { status: 'ready', data } })))
      .catch(() => setLessonsByGrade((prev) => ({ ...prev, [g]: { status: 'error' } })))
      .finally(() => inFlight.current.delete(key));
  }, []);

  const fetchTree = useCallback((g: number, l: number) => {
    const key = treeKey(g, l);
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    requestTree(g, l)
      .then((data) => setTreeByLesson((prev) => ({ ...prev, [key]: { status: 'ready', data } })))
      .catch(() => setTreeByLesson((prev) => ({ ...prev, [key]: { status: 'error' } })))
      .finally(() => inFlight.current.delete(key));
  }, []);

  // Bulunulan dersin kısmi ağacını (diğer ünitelerin konuları) tamamlar; hata olursa kısmi
  // ağaç olduğu gibi kalır.
  useEffect(() => {
    const key = treeKey(current.gradeId, current.lessonId);
    requestTree(current.gradeId, current.lessonId)
      .then((data) => setTreeByLesson((prev) => ({ ...prev, [key]: { status: 'ready', data } })))
      .catch(() => {});
  }, [current.gradeId, current.lessonId]);

  const lessonsState = lessonsByGrade[gradeId];
  const lessons = useMemo(() => (lessonsState?.status === 'ready' ? lessonsState.data : []), [lessonsState]);
  // Tek dersli sınıfta ders adımını atla.
  const activeLessonId = lessonId ?? (lessons.length === 1 ? lessons[0].id : null);
  const activeLesson = lessons.find((l) => l.id === activeLessonId) ?? null;
  const treeState = activeLessonId != null ? treeByLesson[treeKey(gradeId, activeLessonId)] : undefined;
  const gradeSlug = grades.find((g) => g.id === gradeId)?.slug ?? null;
  const lessonSlug = activeLesson?.slug ?? null;

  function selectGrade(g: number) {
    if (g === gradeId) return;
    setGradeId(g);
    // Bulunulan sınıfa geri dönünce bulunulan ders/ünite yine seçili gelsin.
    const back = g === current.gradeId;
    setLessonId(back ? current.lessonId : null);
    setExpandedUnitId(back ? current.unitId : null);
    if (lessonsByGrade[g]?.status !== 'ready') retryLessons(g);
  }

  // Hata kaydını silip (→ yükleniyor) yeniden çeker.
  function retryLessons(g: number) {
    setLessonsByGrade((prev) => {
      const next = { ...prev };
      delete next[g];
      return next;
    });
    void fetchLessons(g);
  }

  function retryTree(g: number, l: number) {
    setTreeByLesson((prev) => {
      const next = { ...prev };
      delete next[treeKey(g, l)];
      return next;
    });
    void fetchTree(g, l);
  }

  function selectLesson(l: number) {
    setLessonId(l);
    setExpandedUnitId(null);
    if (treeByLesson[treeKey(gradeId, l)]?.status !== 'ready') retryTree(gradeId, l);
  }

  // Tek dersli bir sınıfın dersleri yeni geldiyse ağacını da hemen çek.
  const soleLessonId = lessonId == null && lessons.length === 1 ? lessons[0].id : null;
  const soleLessonLoaded = soleLessonId != null && !!treeByLesson[treeKey(gradeId, soleLessonId)];
  useEffect(() => {
    if (soleLessonId == null || soleLessonLoaded) return;
    const key = treeKey(gradeId, soleLessonId);
    requestTree(gradeId, soleLessonId)
      .then((data) => setTreeByLesson((prev) => ({ ...prev, [key]: { status: 'ready', data } })))
      .catch(() => setTreeByLesson((prev) => ({ ...prev, [key]: { status: 'error' } })));
  }, [gradeId, soleLessonId, soleLessonLoaded]);

  const isCurrentLesson = gradeId === current.gradeId && activeLessonId === current.lessonId;

  return (
    <div className={s.switcher} role="dialog" aria-modal="true" aria-label="Konu değiştir">
      <div className={s.switcherShade} onClick={onClose} />
      <div className={[s.switcherPanel, className].filter(Boolean).join(' ')}>
        <div className={s.switcherHead}>
          <h2>Konu değiştir</h2>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Kapat"><X size={16} /></button>
        </div>

        {grades.length > 1 && (
          <>
            <p className={s.switcherLabel}>Sınıf</p>
            <div className={s.pillRow}>
              {grades.map((g) => (
                <button key={g.id} type="button" className={g.id === gradeId ? s.pillActive : s.pill} aria-pressed={g.id === gradeId} onClick={() => selectGrade(g.id)}>
                  {g.name}
                </button>
              ))}
            </div>
          </>
        )}

        <p className={s.switcherLabel}>Ders</p>
        {!lessonsState ? (
          <p className={s.switcherNote}>Dersler yükleniyor…</p>
        ) : lessonsState.status === 'error' ? (
          <p className={s.switcherNote}>Dersler yüklenemedi. <button type="button" className={s.switcherRetry} onClick={() => retryLessons(gradeId)}>Tekrar dene</button></p>
        ) : lessons.length === 0 ? (
          <p className={s.switcherNote}>Bu sınıfta henüz ders yok.</p>
        ) : (
          <div className={s.pillRow}>
            {lessons.map((l) => (
              <button key={l.id} type="button" className={l.id === activeLessonId ? s.pillActive : s.pill} aria-pressed={l.id === activeLessonId} onClick={() => selectLesson(l.id)}>
                {l.name}
              </button>
            ))}
          </div>
        )}

        {activeLessonId != null && (
          <>
            <p className={s.switcherLabel}>Üniteler ve konular</p>
            {!treeState ? (
              <p className={s.switcherNote}>Üniteler yükleniyor…</p>
            ) : treeState.status === 'error' ? (
              <p className={s.switcherNote}>Üniteler yüklenemedi. <button type="button" className={s.switcherRetry} onClick={() => retryTree(gradeId, activeLessonId)}>Tekrar dene</button></p>
            ) : treeState.data.length === 0 ? (
              <p className={s.switcherNote}>Bu derste henüz ünite yok.</p>
            ) : (
              <ul className={s.unitList}>
                {treeState.data.map((u, i) => {
                  const expanded = expandedUnitId === u.id;
                  const isCurrentUnit = isCurrentLesson && u.id === current.unitId;
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        className={isCurrentUnit ? s.unitToggleActive : s.unitToggle}
                        aria-expanded={expanded}
                        onClick={() => setExpandedUnitId(expanded ? null : u.id)}
                      >
                        <span>{i + 1}. {u.title}</span>
                        <ChevronDown size={16} className={expanded ? s.chevronOpen : s.chevron} aria-hidden="true" />
                      </button>
                      {expanded && (
                        <ul className={s.topicList}>
                          {!u.topics ? (
                            <li className={s.switcherNote}>Konular yükleniyor…</li>
                          ) : u.topics.length === 0 ? (
                            <li className={s.switcherNote}>Bu ünitede henüz konu yok.</li>
                          ) : (
                            u.topics.map((t) => {
                              const href = buildTopicHref(gradeSlug, lessonSlug, u.slug, t.slug);
                              const isCurrentTopic = isCurrentUnit && t.id === current.topicId;
                              return href && (
                                <li key={t.id}>
                                  <Link href={href} className={isCurrentTopic ? s.topicLinkActive : s.topicLink} aria-current={isCurrentTopic ? 'page' : undefined} onClick={onClose}>
                                    {t.title}
                                  </Link>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
