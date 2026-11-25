'use client';

// Ana Ekran: "Atom Keşif Dünyası" Bölüm Seçim Sahnesi (Stage Select Board).
// - Web / Masaüstü (>= 768px): 16:9 yatay oyun ekranına uygun, kaydırmasız tek bakışta görülen,
//   simetrik dikey oyun seviye kartları (01 → 02 → 03 → 04 / 05). 6+ alt konuda dengeli 2 satır (3+3 / 4+4).
// - Mobil Dikey (< 768px): Sağa-sola savrulan zikzak yerine solda düz ilerleme hattı üzerinde hizalı,
//   ferah ve rahat kaydırılan seviye kartları.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
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

const ACCENT_CLASS = [s.portalSky, s.portalAmber, s.portalEmerald, s.portalRose, s.portalViolet];

function getDesktopBoardCols(total: number): number {
  if (total <= 1) return 1;
  if (total <= 5) return total;
  if (total === 6) return 3;
  return 4;
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
  const activeCardRef = useRef<HTMLDivElement | null>(null);

  const totalSections = lesson.sections.length;
  const doneSet = new Set(completedSections);
  const doneCount = lesson.sections.filter((sec) => doneSet.has(sec.sectionId)).length;
  const overallPct = totalSections > 0 ? Math.round((doneCount / totalSections) * 100) : 0;
  const firstPendingIdx = lesson.sections.findIndex((sec) => !doneSet.has(sec.sectionId));
  const boardCols = getDesktopBoardCols(totalSections);

  // Mobilde çok bölümlü derslerde aktif kartı yumuşakça görünür alana getir
  useEffect(() => {
    if (currentSectionIdx <= 0 || !activeCardRef.current) return;
    if (typeof window !== 'undefined' && window.innerWidth >= 768 && totalSections <= 6) return;
    const id = window.requestAnimationFrame(() => {
      activeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [currentSectionIdx, totalSections]);

  return (
    <div className={s.worldRoot}>
      {/* Atmosferik Oyun Sahnesi Arka Planı */}
      <svg
        className={s.worldBackdropSvg}
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hillBack" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#BFD7F2" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#A9C7EB" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="hillFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#9EC1E8" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#84B0E2" stopOpacity="0.92" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="140" r="170" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="6 9" opacity="0.5" />
        <circle cx="1240" cy="150" r="200" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="8 10" opacity="0.42" />
        <g fill="#FFFFFF" opacity="0.52">
          <ellipse cx="320" cy="105" rx="64" ry="20" />
          <ellipse cx="360" cy="94" rx="38" ry="16" />
          <ellipse cx="1100" cy="126" rx="70" ry="22" />
          <ellipse cx="1062" cy="115" rx="40" ry="16" />
        </g>
        <path
          d="M0 660 Q280 595 560 645 T1080 625 T1440 605 L1440 800 L0 800 Z"
          fill="url(#hillBack)"
        />
        <path
          d="M0 715 Q360 660 720 700 T1260 680 T1440 695 L1440 800 L0 800 Z"
          fill="url(#hillFront)"
        />
      </svg>

      <div className={s.worldViewport}>
        <div
          className={s.stageBoardContainer}
          style={{ '--board-cols': boardCols } as CSSProperties}
          data-cols={boardCols}
        >
          {/* Üst Kompakt Konu & İlerleme Şeridi */}
          <div className={s.stageBoardHeader}>
            <div className={s.stageBoardTitleGroup}>
              <span className={s.worldTopicBanner}>
                <Sparkles className="h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
                <span>{lesson.courseLabel}</span>
              </span>
              <h1 className={s.stageBoardHeading}>{lesson.topicTitle}</h1>
            </div>

            <div className={s.stageBoardStatsGroup}>
              {completionCount > 0 && (
                <span
                  className={s.worldCompletionPill}
                  title={`Bu etkileşimli dersi toplam ${completionCount} kez tamamladın`}
                >
                  <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                  <span>{completionCount}× tamamlandı</span>
                </span>
              )}

              <div className={s.stageOverallChip}>
                <div className={s.stageOverallTop}>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
                  <span>
                    {doneCount} / {totalSections} Bölüm
                  </span>
                </div>
                <div className={s.stageOverallTrack} aria-hidden="true">
                  <div
                    className={s.stageOverallFill}
                    style={{ width: `${Math.max(doneCount > 0 ? 12 : 0, overallPct)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bölüm Seçim Kartları (Web: Yan Yana Simetrik Seviye Kartları | Mobil: Düz Dikey Seviye Listesi) */}
          <div className={s.stageCardsGrid}>
            {lesson.sections.map((sec, idx) => {
              const isDone = doneSet.has(sec.sectionId);
              const savedStep = sectionProgress[String(sec.sectionId)] ?? 0;
              const totalSteps = Math.max(1, sectionTotals[String(sec.sectionId)] ?? 1);
              const isInProgress = !isDone && savedStep > 0;
              const isCurrent = idx === currentSectionIdx;
              const isNext = !isDone && !isInProgress && idx === firstPendingIdx;
              const isHighlighted = isInProgress || isCurrent || isNext;

              const accent = ACCENT_CLASS[idx % ACCENT_CLASS.length];
              const codeLabel = String(idx + 1).padStart(2, '0');
              const progressPct = Math.min(95, Math.max(14, Math.round(((savedStep + 1) / totalSteps) * 100)));
              const earnedStars = isDone ? 3 : isInProgress ? (progressPct >= 55 ? 2 : 1) : 0;
              const showDesktopArrow = (idx + 1) % boardCols !== 0 && idx < totalSections - 1;
              const hasMobileNext = idx < totalSections - 1;

              return (
                <div
                  key={sec.sectionId}
                  ref={isCurrent ? activeCardRef : undefined}
                  className={s.stageCardSlot}
                >
                  {/* Mobil sol dikey bağlantı çizgisi */}
                  {hasMobileNext && (
                    <span
                      className={`${s.mobileSpineLine} ${isDone ? s.mobileSpineLineDone : ''}`}
                      aria-hidden="true"
                    />
                  )}

                  {/* Masaüstü kartlar arası yatay ok köprüsü */}
                  {showDesktopArrow && (
                    <span
                      className={`${s.desktopBridgeArrow} ${isDone ? s.desktopBridgeArrowDone : ''}`}
                      aria-hidden="true"
                    >
                      <ArrowRight className="h-4 w-4 stroke-[2.6]" />
                    </span>
                  )}

                  {/* Aktif kartın tepesinde rehber Atom */}
                  {isCurrent && (
                    <div className={s.stageAtomFloating} aria-hidden="true">
                      <RobotGuide mood={isDone ? 'celebrate' : 'happy'} className="w-10 sm:w-12" />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectSection(idx)}
                    className={`${s.stageCard} ${
                      isDone
                        ? s.stageCardDone
                        : isHighlighted
                          ? s.stageCardActive
                          : s.stageCardIdle
                    }`}
                  >
                    {/* Sol (Mobil) / Üst-Orta (Web) 3B Mücevher Rozet */}
                    <div className={s.stageEmblemWrap}>
                      <div
                        className={`${s.worldTile} ${accent} ${
                          isDone
                            ? s.worldTileDone
                            : isHighlighted
                              ? s.worldTileActive
                              : s.worldTileUntouched
                        }`}
                      >
                        <span className={s.worldTileCode}>{codeLabel}</span>
                        <span className={s.worldTileIcon}>
                          {isDone ? (
                            <Check className="h-6 w-6 stroke-[3] md:h-7 md:w-7" aria-hidden="true" />
                          ) : (
                            <Play className="h-6 w-6 translate-x-0.5 fill-current md:h-7 md:w-7" aria-hidden="true" />
                          )}
                        </span>
                      </div>

                      <div className={s.levelStarsRow} aria-hidden="true">
                        {[1, 2, 3].map((starNo) => (
                          <Star
                            key={starNo}
                            className={`${s.levelStarIcon} ${
                              starNo <= earnedStars ? s.levelStarLit : s.levelStarDim
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Kart İçeriği */}
                    <div className={s.stageCardBody}>
                      <div className={s.stageCardTopMeta}>
                        <span className={s.levelStepTag}>BÖLÜM {codeLabel}</span>

                        {isDone ? (
                          <span className={`${s.stationStatusPill} ${s.stationStatusDone}`}>
                            <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                            Tamamlandı
                          </span>
                        ) : isInProgress ? (
                          <span className={`${s.stationStatusPill} ${s.stationStatusActive}`}>
                            {Math.min(savedStep + 1, totalSteps)}/{totalSteps} Adım
                          </span>
                        ) : isNext || isCurrent ? (
                          <span className={`${s.stationStatusPill} ${s.stationStatusNext}`}>
                            Sıradaki
                          </span>
                        ) : (
                          <span className={`${s.stationStatusPill} ${s.stationStatusTodo}`}>
                            Hazır
                          </span>
                        )}
                      </div>

                      <span className={s.stageCardTitle}>{sec.title}</span>

                      {isInProgress && (
                        <span className={s.stationProgressTrack} aria-hidden="true">
                          <span
                            className={s.stationProgressFill}
                            style={{ width: `${progressPct}%` }}
                          />
                        </span>
                      )}

                      <span className={s.stageCardSummary}>
                        {sec.beats.length} sahne •{' '}
                        <Gamepad2 className="inline h-3.5 w-3.5 text-amber-600" aria-hidden="true" /> Kavram Avı •{' '}
                        {sec.checkQuestions.length} soru
                      </span>

                      <span
                        className={`${s.stageCtaBtn} ${
                          isDone
                            ? s.stageCtaDone
                            : isHighlighted
                              ? s.stageCtaPrimary
                              : s.stageCtaIdle
                        }`}
                      >
                        <span>
                          {isDone ? 'Tekrar Oyna' : isInProgress ? 'Devam Et' : 'Başla'}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                      </span>
                    </div>
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
              title="İlerlemeyi sıfırla ve baştan çalış"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className={s.bottomResetLabel}>Sıfırla</span>
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
            <h3 className={s.confirmTitle}>İlerlemeyi Sıfırla ve Yeniden Çalış</h3>
            <p className={s.confirmDesc}>
              Bu dersteki mevcut bölüm işaretlerin ve kaldığın adım temizlenecek, tüm bölümleri baştan
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
                Sıfırla ve Baştan Başla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
