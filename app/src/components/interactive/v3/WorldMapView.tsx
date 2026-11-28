'use client';

// Ana Ekran: "Atom Keşif Dünyası" Macera Haritası (Adventure Level Map).
// - Web / Masaüstü (>= 768px): 16:9 oyun ekranına tam oturan, ışıklı devre zeminli yatay dalga/yılan yolu
//   (1-5 bölüm tek satır dalga, 6+ bölüm iki satır S-yolu).
// - Mobil Dikey (< 768px): Işıklı S-kıvrımlı dikey seviye yolu, aktif düğümde dönen hedef halkası ve
//   üzerinde süzülen Atom rehberi. Tüm bölümler öğretmen/öğrenci erişimi için doğrudan tıklanabilir.
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Gamepad2,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import type { HydratedLessonV3 } from '@/app/src/lib/interactiveLesson/typesV3';
import { useDismissOnBack } from '@/app/src/hooks/useDismissOnBack';
import RobotGuide from '../RobotGuide';
import s from './v3.module.css';

type Point = { xPct: number; yPx: number };

const ORB_ACCENT = [s.orbSky, s.orbAmber, s.orbEmerald, s.orbRose, s.orbViolet];

// Masaüstü (1000px sanal genişlik): 1-5 bölüm tek satır yumuşak dalga; 6+ bölüm 2 satır S-yılanı.
function buildDesktopLayout(total: number): { width: number; height: number; points: Point[]; twoRows: boolean } {
  const width = 1000;
  if (total <= 1) {
    return { width, height: 340, points: [{ xPct: 50, yPx: 145 }], twoRows: false };
  }
  if (total <= 5) {
    const height = 350;
    const pad = total === 2 ? 26 : total === 3 ? 17 : 12;
    const span = 100 - pad * 2;
    const points: Point[] = Array.from({ length: total }, (_, i) => ({
      xPct: pad + (i / (total - 1)) * span,
      yPx: i % 2 === 0 ? 116 : 168,
    }));
    return { width, height, points, twoRows: false };
  }
  const topCount = Math.ceil(total / 2);
  const botCount = total - topCount;
  const height = 560;
  const padTop = 12;
  const padBot = botCount <= 2 ? 24 : 12;
  const points: Point[] = [];
  for (let i = 0; i < topCount; i++) {
    const xPct = topCount === 1 ? 50 : padTop + (i / (topCount - 1)) * (100 - padTop * 2);
    points.push({ xPct, yPx: i % 2 === 0 ? 105 : 138 });
  }
  for (let j = 0; j < botCount; j++) {
    // Alt satır sağdan sola akarak gerçek bir S-kıvrımı oluşturur
    const rev = botCount - 1 - j;
    const xPct = botCount === 1 ? 50 : padBot + (rev / (botCount - 1)) * (100 - padBot * 2);
    points.push({ xPct, yPx: j % 2 === 0 ? 368 : 400 });
  }
  return { width, height, points, twoRows: true };
}

function desktopSegmentPath(a: Point, b: Point, width: number, isTurn: boolean): string {
  const x1 = (a.xPct / 100) * width;
  const y1 = a.yPx;
  const x2 = (b.xPct / 100) * width;
  const y2 = b.yPx;
  if (isTurn) {
    const ctrlX = Math.min(width - 28, Math.max(x1, x2) + 95);
    return `M ${x1} ${y1} C ${ctrlX} ${y1}, ${ctrlX} ${y2}, ${x2} ${y2}`;
  }
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

// Mobil dikey S-kıvrımı: düğümler sol (%22) ve sağ (%78) arasında kıvrılır; metin kartı karşı tarafta ferahça durur.
const MOBILE_ROW_H = 148;
const MOBILE_TOP_PAD = 76;
const MOBILE_BOT_PAD = 64;

function buildMobileLayout(total: number): { width: number; height: number; points: Point[] } {
  const width = 360;
  const height = Math.max(240, MOBILE_TOP_PAD + Math.max(0, total - 1) * MOBILE_ROW_H + MOBILE_BOT_PAD);
  const points: Point[] = Array.from({ length: total }, (_, i) => ({
    xPct: total === 1 ? 50 : i % 2 === 0 ? 22 : 78,
    yPx: MOBILE_TOP_PAD + i * MOBILE_ROW_H,
  }));
  return { width, height, points };
}

function mobileSegmentPath(a: Point, b: Point, width: number): string {
  const x1 = (a.xPct / 100) * width;
  const y1 = a.yPx;
  const x2 = (b.xPct / 100) * width;
  const y2 = b.yPx;
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

export function WorldMapView({
  lesson,
  currentSectionIdx,
  completedSections,
  sectionProgress,
  sectionTotals,
  completionCount,
  hasActiveProgress,
  onSelectSection,
  onResetProgress,
}: {
  lesson: HydratedLessonV3;
  currentSectionIdx: number;
  completedSections: number[];
  sectionProgress: Record<string, number>;
  sectionTotals: Record<string, number>;
  completionCount: number;
  hasActiveProgress: boolean;
  onSelectSection: (sectionIdx: number) => void;
  onResetProgress: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  useDismissOnBack(confirmReset, () => setConfirmReset(false));
  const activeMobileRef = useRef<HTMLDivElement | null>(null);

  const totalSections = lesson.sections.length;
  const doneSet = new Set(completedSections);
  const doneCount = lesson.sections.filter((sec) => doneSet.has(sec.sectionId)).length;
  const overallPct = totalSections > 0 ? Math.round((doneCount / totalSections) * 100) : 0;
  const firstPendingIdx = lesson.sections.findIndex((sec) => !doneSet.has(sec.sectionId));

  const desktop = buildDesktopLayout(totalSections);
  const mobile = buildMobileLayout(totalSections);
  const topRowCount = Math.ceil(totalSections / 2);

  useEffect(() => {
    if (currentSectionIdx <= 0 || !activeMobileRef.current) return;
    if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
    const id = window.requestAnimationFrame(() => {
      activeMobileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [currentSectionIdx]);

  const getNodeMeta = (idx: number) => {
    const sec = lesson.sections[idx];
    const isDone = doneSet.has(sec.sectionId);
    const savedStep = sectionProgress[String(sec.sectionId)] ?? 0;
    const totalSteps = Math.max(1, sectionTotals[String(sec.sectionId)] ?? 1);
    const isInProgress = !isDone && savedStep > 0;
    const isCurrent = idx === currentSectionIdx;
    const isNext = !isDone && !isInProgress && idx === firstPendingIdx;
    const isActive = isCurrent || isInProgress || isNext;
    const progressPct = Math.min(95, Math.max(14, Math.round(((savedStep + 1) / totalSteps) * 100)));
    const earnedStars = isDone ? 3 : isInProgress ? (progressPct >= 55 ? 2 : 1) : 0;
    return {
      sec,
      isDone,
      savedStep,
      totalSteps,
      isInProgress,
      isCurrent,
      isNext,
      isActive,
      progressPct,
      earnedStars,
    };
  };

  return (
    <div className={s.worldRoot}>
      {/* Bilim-Kurgu Devre & Yıldızlı Uzay Laboratuvarı Arka Planı */}
      <svg
        className={s.worldBackdropSvg}
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="labGlowCyan" cx="18%" cy="22%" r="48%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="labGlowIndigo" cx="84%" cy="76%" r="52%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1440" height="800" fill="url(#labGlowCyan)" />
        <rect width="1440" height="800" fill="url(#labGlowIndigo)" />

        {/* İnce Devre Kartı Hatları ve Düğümleri */}
        <g stroke="#38bdf8" strokeWidth="1.6" fill="none" opacity="0.22">
          <path d="M 0 130 H 190 L 235 175 H 340" />
          <circle cx="344" cy="175" r="4.5" fill="#38bdf8" />
          <path d="M 0 580 H 150 L 205 525 H 320" />
          <circle cx="324" cy="525" r="4.5" fill="#38bdf8" />
          <path d="M 1440 165 H 1245 L 1195 215 H 1090" />
          <circle cx="1086" cy="215" r="4.5" fill="#38bdf8" />
          <path d="M 1440 615 H 1270 L 1220 565 H 1110" />
          <circle cx="1106" cy="565" r="4.5" fill="#38bdf8" />
          <path d="M 520 0 V 76 L 560 116 H 640" />
          <circle cx="644" cy="116" r="4" fill="#38bdf8" />
          <path d="M 940 800 V 715 L 890 665 H 790" />
          <circle cx="786" cy="665" r="4" fill="#38bdf8" />
          {/* Dekoratif Çip Kareleri */}
          <rect x="74" y="295" width="54" height="54" rx="12" />
          <rect x="1312" y="340" width="58" height="58" rx="13" />
          <rect x="690" y="64" width="42" height="42" rx="10" />
        </g>

        {/* Yumuşak Yıldız Parıltıları */}
        <g fill="#bae6fd" opacity="0.45">
          <circle cx="120" cy="84" r="2" />
          <circle cx="420" cy="62" r="1.8" />
          <circle cx="880" cy="92" r="2.2" />
          <circle cx="1310" cy="104" r="2" />
          <circle cx="240" cy="710" r="2" />
          <circle cx="640" cy="740" r="1.8" />
          <circle cx="1180" cy="715" r="2.2" />
        </g>
      </svg>

      <div className={s.worldViewport}>
        <div className={s.adventureContainer}>
          {/* Üst Koyu Cam Görev & İlerleme Şeridi */}
          <div className={s.adventureHeader}>
            <div className={s.stageBoardTitleGroup}>
              <span className={s.adventureCoursePill}>
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-sky-300" aria-hidden="true" />
                <span>{lesson.courseLabel}</span>
              </span>
              <h1 className={s.adventureHeading}>{lesson.topicTitle}</h1>
            </div>

            <div className={s.stageBoardStatsGroup}>
              {completionCount > 0 && (
                <span
                  className={s.adventureDonePill}
                  title={`Bu etkileşimli dersi toplam ${completionCount} kez tamamladın`}
                >
                  <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                  <span>{completionCount}× tamamlandı</span>
                </span>
              )}

              <div className={s.adventureOverallChip}>
                <div className={s.adventureOverallTop}>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                  <span>
                    {doneCount} / {totalSections} Bölüm
                  </span>
                </div>
                <div className={s.adventureOverallTrack} aria-hidden="true">
                  <div
                    className={s.adventureOverallFill}
                    style={{ width: `${Math.max(doneCount > 0 ? 12 : 0, overallPct)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ==================== MASAÜSTÜ / TABLET YATAY MACERA YOLU (>= 768px) ==================== */}
          <div
            className={s.adventureDesktopMap}
            style={{ height: desktop.height }}
            aria-label="Bölüm haritası"
          >
            {/* Parlayan Kıvrımlı Yol SVG Katmanı */}
            <svg
              className={s.adventurePathSvg}
              viewBox={`0 0 ${desktop.width} ${desktop.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {desktop.points.slice(0, -1).map((pt, i) => {
                const next = desktop.points[i + 1];
                const isTurn = desktop.twoRows && i === topRowCount - 1;
                const d = desktopSegmentPath(pt, next, desktop.width, isTurn);
                const segDone = doneSet.has(lesson.sections[i].sectionId);
                return (
                  <g key={i}>
                    {/* Yol dış gövdesi */}
                    <path
                      d={d}
                      fill="none"
                      stroke={segDone ? 'rgba(56, 189, 248, 0.28)' : 'rgba(148, 163, 184, 0.16)'}
                      strokeWidth="22"
                      strokeLinecap="round"
                    />
                    {/* İç yol zemini */}
                    <path
                      d={d}
                      fill="none"
                      stroke={segDone ? '#0284c7' : '#1e3354'}
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                    {/* Enerji / kesikli şerit */}
                    <path
                      d={d}
                      fill="none"
                      stroke={segDone ? '#7dd3fc' : '#47658e'}
                      strokeWidth={segDone ? '3.5' : '2.8'}
                      strokeLinecap="round"
                      strokeDasharray={segDone ? '10 8' : '7 9'}
                      className={segDone ? s.svgFlow : undefined}
                    />
                  </g>
                );
              })}
            </svg>

            {/* İstasyon Düğümleri + Alt Holografik Bilgi Plakaları */}
            {desktop.points.map((pt, idx) => {
              const m = getNodeMeta(idx);
              const orbColor = ORB_ACCENT[idx % ORB_ACCENT.length];
              return (
                <div
                  key={m.sec.sectionId}
                  className={s.adventureNodeAnchor}
                  style={{ left: `${pt.xPct}%`, top: `${pt.yPx}px` }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectSection(idx)}
                    className={`${s.adventureNodeBtn} ${m.isActive ? s.adventureNodeActive : ''}`}
                    aria-label={`Bölüm ${idx + 1}: ${m.sec.title}`}
                  >
                    {/* Aktif istasyonun üstünde süzülen Atom */}
                    {m.isCurrent && (
                      <span className={s.adventureAtomHover} aria-hidden="true">
                        <RobotGuide mood={m.isDone ? 'celebrate' : 'happy'} className="w-11" />
                      </span>
                    )}

                    {/* Yuvarlak Parlayan Mücevher Düğümü */}
                    <span className={s.orbWrap}>
                      {m.isActive && !m.isDone && (
                        <span className={s.orbTargetRing} aria-hidden="true" />
                      )}
                      <span
                        className={`${s.orbCore} ${
                          m.isDone ? s.orbDone : m.isActive ? orbColor : s.orbReady
                        }`}
                      >
                        <span className={s.orbGloss} aria-hidden="true" />
                        <span className={s.orbContent}>
                          {m.isDone ? (
                            <Check className="h-8 w-8 stroke-[3.2]" aria-hidden="true" />
                          ) : (
                            <span className={s.orbNumber}>{idx + 1}</span>
                          )}
                        </span>
                      </span>
                    </span>

                    {/* 3 Yıldız Sırası */}
                    <span className={s.orbStarsRow} aria-hidden="true">
                      {[1, 2, 3].map((starNo) => (
                        <Star
                          key={starNo}
                          className={`${s.orbStar} ${
                            starNo <= m.earnedStars ? s.orbStarLit : s.orbStarDim
                          }`}
                        />
                      ))}
                    </span>

                    {/* Koyu Cam Bilgi Kartı */}
                    <span
                      className={`${s.adventureLabelPlate} ${
                        m.isDone
                          ? s.adventurePlateDone
                          : m.isActive
                            ? s.adventurePlateActive
                            : ''
                      }`}
                    >
                      <span className={s.adventurePlateStatus}>
                        {m.isDone ? (
                          <span className={s.plateBadgeDone}>Tamamlandı</span>
                        ) : m.isInProgress ? (
                          <span className={s.plateBadgeActive}>
                            Devam Et • {Math.min(m.savedStep + 1, m.totalSteps)}/{m.totalSteps}
                          </span>
                        ) : m.isNext || m.isCurrent ? (
                          <span className={s.plateBadgeNext}>
                            <Play className="h-2.5 w-2.5 fill-current" aria-hidden="true" /> Başla
                          </span>
                        ) : (
                          <span className={s.plateBadgeReady}>Bölüm {idx + 1}</span>
                        )}
                      </span>

                      <span className={s.adventurePlateTitle}>{m.sec.title}</span>

                      {m.isInProgress && (
                        <span className={s.plateProgressTrack} aria-hidden="true">
                          <span
                            className={s.plateProgressFill}
                            style={{ width: `${m.progressPct}%` }}
                          />
                        </span>
                      )}

                      <span className={s.adventurePlateMeta}>
                        {m.sec.beats.length} sahne •{' '}
                        <Gamepad2 className="inline h-3 w-3 text-amber-300" aria-hidden="true" />{' '}
                        Kavram Avı • {m.sec.checkQuestions.length} soru
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* ==================== MOBİL DİKEY S-KIVRIMLI MACERA YOLU (< 768px) ==================== */}
          <div
            className={s.adventureMobileMap}
            style={{ height: mobile.height }}
            aria-label="Bölüm haritası"
          >
            <svg
              className={s.adventurePathSvg}
              viewBox={`0 0 ${mobile.width} ${mobile.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {mobile.points.slice(0, -1).map((pt, i) => {
                const next = mobile.points[i + 1];
                const d = mobileSegmentPath(pt, next, mobile.width);
                const segDone = doneSet.has(lesson.sections[i].sectionId);
                return (
                  <g key={i}>
                    <path
                      d={d}
                      fill="none"
                      stroke={segDone ? 'rgba(56, 189, 248, 0.28)' : 'rgba(148, 163, 184, 0.16)'}
                      strokeWidth="22"
                      strokeLinecap="round"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={segDone ? '#0284c7' : '#1e3354'}
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={segDone ? '#7dd3fc' : '#47658e'}
                      strokeWidth={segDone ? '3.5' : '2.8'}
                      strokeLinecap="round"
                      strokeDasharray={segDone ? '10 8' : '7 9'}
                      className={segDone ? s.svgFlow : undefined}
                    />
                  </g>
                );
              })}
            </svg>

            {mobile.points.map((pt, idx) => {
              const m = getNodeMeta(idx);
              const orbColor = ORB_ACCENT[idx % ORB_ACCENT.length];
              const isLeft = pt.xPct < 50;
              return (
                <div
                  key={m.sec.sectionId}
                  ref={m.isCurrent ? activeMobileRef : undefined}
                  className={s.mobileRowSlot}
                  style={{ top: `${pt.yPx}px` }}
                >
                  {/* Düğüm (S-yolu üzerinde) */}
                  <button
                    type="button"
                    onClick={() => onSelectSection(idx)}
                    className={s.mobileOrbAnchor}
                    style={{ left: `${pt.xPct}%` }}
                    aria-label={`Bölüm ${idx + 1}: ${m.sec.title}`}
                  >
                    {m.isCurrent && (
                      <span className={s.adventureAtomHoverMobile} aria-hidden="true">
                        <RobotGuide mood={m.isDone ? 'celebrate' : 'happy'} className="w-10" />
                      </span>
                    )}
                    <span className={s.orbWrapMobile}>
                      {m.isActive && !m.isDone && (
                        <span className={s.orbTargetRing} aria-hidden="true" />
                      )}
                      <span
                        className={`${s.orbCoreMobile} ${
                          m.isDone ? s.orbDone : m.isActive ? orbColor : s.orbReady
                        }`}
                      >
                        <span className={s.orbGloss} aria-hidden="true" />
                        <span className={s.orbContent}>
                          {m.isDone ? (
                            <Check className="h-7 w-7 stroke-[3.2]" aria-hidden="true" />
                          ) : (
                            <span className={s.orbNumberMobile}>{idx + 1}</span>
                          )}
                        </span>
                      </span>
                    </span>
                    <span className={s.orbStarsRow} aria-hidden="true">
                      {[1, 2, 3].map((starNo) => (
                        <Star
                          key={starNo}
                          className={`${s.orbStar} ${
                            starNo <= m.earnedStars ? s.orbStarLit : s.orbStarDim
                          }`}
                        />
                      ))}
                    </span>
                  </button>

                  {/* Karşı Tarafta Ferah Bilgi Kartı */}
                  <button
                    type="button"
                    onClick={() => onSelectSection(idx)}
                    className={`${s.mobileInfoCard} ${
                      isLeft ? s.mobileInfoRight : s.mobileInfoLeft
                    } ${
                      m.isDone
                        ? s.adventurePlateDone
                        : m.isActive
                          ? s.adventurePlateActive
                          : ''
                    }`}
                  >
                    <span className={s.adventurePlateStatus}>
                      {m.isDone ? (
                        <span className={s.plateBadgeDone}>Tamamlandı</span>
                      ) : m.isInProgress ? (
                        <span className={s.plateBadgeActive}>
                          Devam Et • {Math.min(m.savedStep + 1, m.totalSteps)}/{m.totalSteps}
                        </span>
                      ) : m.isNext || m.isCurrent ? (
                        <span className={s.plateBadgeNext}>
                          <Play className="h-2.5 w-2.5 fill-current" aria-hidden="true" /> Başla
                        </span>
                      ) : (
                        <span className={s.plateBadgeReady}>Bölüm {idx + 1}</span>
                      )}
                    </span>
                    <span className={s.mobileInfoTitle}>{m.sec.title}</span>
                    {m.isInProgress && (
                      <span className={s.plateProgressTrack} aria-hidden="true">
                        <span
                          className={s.plateProgressFill}
                          style={{ width: `${m.progressPct}%` }}
                        />
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alt Şık Keşif Barı */}
      <footer className={s.gameBottomBar}>
        <span className={s.bottomTitle}>Keşif Haritası</span>
        <div className={s.bottomSquares} aria-label={`${doneCount} / ${lesson.sections.length} bölüm tamamlandı`}>
          {lesson.sections.map((sec, idx) => {
            const isDone = doneSet.has(sec.sectionId);
            const isInProg = !isDone && (sectionProgress[String(sec.sectionId)] ?? 0) > 0;
            return (
              <button
                key={sec.sectionId}
                type="button"
                onClick={() => onSelectSection(idx)}
                title={sec.title}
                className={`${s.bottomCapsule} ${
                  isDone
                    ? s.bottomCapsuleDone
                    : isInProg || idx === currentSectionIdx
                      ? s.bottomCapsuleActive
                      : ''
                }`}
              />
            );
          })}
        </div>

        <div className={s.bottomRightGroup}>
          {hasActiveProgress && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className={s.bottomResetBtn}
              title="Dersi baştan başlat ve yeniden çalış"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className={s.bottomResetLabel}>Baştan Başla</span>
            </button>
          )}

          <span className={s.bottomStarStat}>
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
            {doneCount} / {lesson.sections.length}
          </span>
        </div>
      </footer>

      {/* Onaylı Sıfırlama / Yeniden Çalışma Penceresi */}
      {confirmReset && (
        <div
          className={s.confirmBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="İlerlemeyi sıfırla"
          onClick={() => setConfirmReset(false)}
        >
          <div className={s.confirmCard} onClick={(e) => e.stopPropagation()}>
            <div className={s.confirmIconWrap}>
              <RotateCcw className="h-6 w-6 text-amber-600" aria-hidden="true" />
            </div>
            <h3 className={s.confirmTitle}>Dersi Baştan Başlat</h3>
            <p className={s.confirmDesc}>
              Bu dersteki mevcut bölüm işaretlerin temizlenecek ve tüm bölümleri en baştan tekrar
              çalışabileceksin.
            </p>
            {completionCount > 0 && (
              <div className={s.confirmKeepNote}>
                <Trophy className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>
                  Bu dersi <strong>{completionCount} kez tamamladığın</strong> kaydı korunacak; tekrar
                  bitirdiğinde <strong>{completionCount + 1}. tamamlama</strong> olarak eklenecek.
                </span>
              </div>
            )}
            <div className={s.confirmActions}>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className={s.confirmCancelBtn}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  onResetProgress();
                }}
                className={s.confirmDangerBtn}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Baştan Başla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
