'use client';

// Kıvrımlı yolculuk haritası + görsel parça toplama paneli + süzülen Atom maskotu.
import { useState } from 'react';
import type { HydratedLessonV2 } from '@/app/src/lib/interactiveLesson/typesV2';
import RobotGuide from '../RobotGuide';
import { LockBadgeSvg, PartIconSvg, StarSvg, TrophyBadgeSvg } from './IconsV2';
import { getThemeWorld, ThemeDeviceSvg } from './ThemesV2';
import s from './v2.module.css';

// 4 durak için kıvrımlı harita koordinatları (viewBox 0 0 360 600).
const NODE_POSITIONS: [number, number][] = [
  [92, 500],
  [268, 375],
  [92, 245],
  [222, 108],
];

const ROAD_PATH = 'M92 500C92 435 268 450 268 375C268 305 92 315 92 245C92 175 222 180 222 108';

export function JourneyMap({
  lesson,
  openCount,
  stars,
  totalXp = 0,
  onSelectStop,
  onLockedTap,
  onReset,
}: {
  lesson: HydratedLessonV2;
  openCount: number;
  stars: Record<number, number>;
  totalXp?: number;
  onSelectStop: (index: number) => void;
  onLockedTap: () => void;
  onReset: () => void;
}) {
  const [shakingIdx, setShakingIdx] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const world = getThemeWorld(lesson.themeId);
  const total = lesson.stops.length;
  const collected = Object.keys(stars).length;
  const pct = total ? Math.round((collected / total) * 100) : 0;
  const currentIdx = Math.min(openCount, total) - 1;
  const mascotPos = NODE_POSITIONS[currentIdx] ?? NODE_POSITIONS[0];
  const progressRatio = total > 1 ? currentIdx / (total - 1) : 1;

  const handleStopClick = (idx: number) => {
    if (idx >= openCount) {
      onLockedTap();
      setShakingIdx(idx);
      setHint('Önce önceki durağı tamamla!');
      window.setTimeout(() => setShakingIdx(null), 400);
      return;
    }
    setHint(null);
    onSelectStop(idx);
  };

  return (
    <div className={s.mapWrap}>
      <h1 className={s.mapTitle}>{lesson.adventureTitle}</h1>
      <p className={s.mapSub}>{lesson.subtitle}</p>

      {/* Görsel Parça Toplama Paneli */}
      <section className={s.dock} aria-label="Toplanan parçalar">
        <div className={`${s.dockVis} ${collected >= total ? s.dockVisReady : ''}`}>
          <ThemeDeviceSvg themeId={lesson.themeId} collected={collected} total={total} />
        </div>
        <div className={s.dockInfo}>
          <div className={s.dockTitle}>
            <span>{world.dockLabel}</span>
            <span className="inline-flex items-center gap-1.5">
              {totalXp > 0 && <span className={s.xpPill}>{totalXp} XP</span>}
              <span className={s.dockPct}>%{pct}</span>
            </span>
          </div>
          <div className={s.slots}>
            {lesson.stops.map((stop, i) => {
              const ok = !!stars[i];
              return (
                <div
                  key={stop.sectionId}
                  className={`${s.slot} ${ok ? s.slotFilled : ''}`}
                  title={ok ? stop.part.name : 'Kayıp parça'}
                  aria-label={ok ? `${stop.part.name} toplandı` : `${i + 1}. parça bekleniyor`}
                >
                  {ok ? (
                    <PartIconSvg icon={stop.part.icon} emoji={stop.part.emoji} className="h-7 w-7" />
                  ) : (
                    <span className="text-base font-black opacity-60">?</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Kıvrımlı Harita */}
      <div className={s.mapBox}>
        <svg viewBox="0 0 360 600" className={s.mapSvg} aria-hidden="true">
          <path d={ROAD_PATH} fill="none" stroke="rgba(15, 23, 42, 0.35)" strokeWidth="22" strokeLinecap="round" />
          <path d={ROAD_PATH} fill="none" stroke="#4c46a8" strokeWidth="16" strokeLinecap="round" />
          <path
            d={ROAD_PATH}
            fill="none"
            stroke="#ffd166"
            strokeWidth="10"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={Math.max(0, 100 * (1 - progressRatio))}
          />
        </svg>

        {lesson.stops.map((stop, i) => {
          const pos = NODE_POSITIONS[i] ?? [180, 100];
          const locked = i >= openCount;
          const st = stars[i] ?? 0;
          const isCur = i === currentIdx && !st;
          return (
            <div
              key={stop.sectionId}
              className={s.nodeWrap}
              style={{ left: `${pos[0] / 3.6}%`, top: `${pos[1] / 6}%` }}
            >
              <button
                type="button"
                onClick={() => handleStopClick(i)}
                className={`${s.nodeBtn} ${locked ? s.nodeLock : ''} ${isCur ? s.nodeCur : ''} ${shakingIdx === i ? s.nodeShake : ''}`}
                style={{ '--node-c': stop.color } as React.CSSProperties}
                aria-label={`${i + 1}. Durak: ${stop.title}${locked ? ' (kilitli)' : ''}`}
              >
                {locked ? <LockBadgeSvg className="h-7 w-7" /> : i + 1}
              </button>
              <div className={s.nodeLabel}>
                {stop.title}
                <small>{stop.subtitle}</small>
              </div>
              {st > 0 && (
                <div className="flex items-center justify-center gap-0.5" aria-label={`${st} yıldız`}>
                  {[1, 2, 3].map((n) => (
                    <StarSvg key={n} filled={n <= st} className="h-4 w-4" />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className={s.mapMascot} style={{ left: `${mascotPos[0] / 3.6}%`, top: `${mascotPos[1] / 6}%` }}>
          <RobotGuide mood={collected >= total ? 'celebrate' : 'normal'} upgraded={collected >= total} />
        </div>
      </div>

      <div className={s.mapFoot}>
        <p className={`${s.mapSub} inline-flex items-center justify-center gap-2`} style={{ margin: 0 }}>
          {hint ? (
            hint
          ) : collected >= total ? (
            <>
              <TrophyBadgeSvg className="h-5 w-5 shrink-0" />
              <span>{lesson.badgeTitle} rozetini kazandın! İstediğin durağı tekrar oynayabilirsin.</span>
            </>
          ) : (
            `Sıradaki durak: ${currentIdx + 1}. ${lesson.stops[currentIdx]?.title}`
          )}
        </p>
        {collected > 0 && (
          <button type="button" onClick={onReset} className={s.resetBtn}>
            ↺ Sıfırla
          </button>
        )}
      </div>
    </div>
  );
}
