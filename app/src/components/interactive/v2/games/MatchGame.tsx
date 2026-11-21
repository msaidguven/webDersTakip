'use client';

// Eşleştirme Laboratuvarı: Hem parmakla/fareyle enerji kablosu sürükle-bırak, hem dokun-eşleştir!
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { V2MatchStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { GameCallbacks } from './KavramAviGame';
import s from '../v2.module.css';

function shuffleIndices(n: number, salt: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  let seed = (n * 9301 + salt * 49297 + 233280) % 233280;
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = seed % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const CABLE_COLORS = ['#15b8d9', '#f59e0b', '#22c55e', '#a855f7', '#ec4899'];

type LineSeg = { idx: number; x1: number; y1: number; x2: number; y2: number };
type DragWire = { leftIdx: number; x1: number; y1: number; x2: number; y2: number; moved: boolean; hoverRight: number | null };

export function MatchGame({ step, onReact, onMiss, onComplete }: { step: V2MatchStep } & GameCallbacks) {
  const leftOrder = useMemo(() => shuffleIndices(step.pairs.length, 17), [step.pairs.length]);
  const rightOrder = useMemo(() => shuffleIndices(step.pairs.length, 53), [step.pairs.length]);

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [badRight, setBadRight] = useState<number | null>(null);
  const [lines, setLines] = useState<LineSeg[]>([]);
  const [dragWire, setDragWire] = useState<DragWire | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const leftRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const rightRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const dragStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const missedOnce = useRef(false);

  const allDone = matched.size === step.pairs.length;

  const computeLines = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const br = board.getBoundingClientRect();
    const next: LineSeg[] = [];
    matched.forEach((idx) => {
      const lEl = leftRefs.current[idx];
      const rEl = rightRefs.current[idx];
      if (!lEl || !rEl) return;
      const lr = lEl.getBoundingClientRect();
      const rr = rEl.getBoundingClientRect();
      next.push({
        idx,
        x1: lr.right - br.left - 4,
        y1: lr.top - br.top + lr.height / 2,
        x2: rr.left - br.left + 4,
        y2: rr.top - br.top + rr.height / 2,
      });
    });
    setLines(next);
  }, [matched]);

  useEffect(() => {
    computeLines();
    window.addEventListener('resize', computeLines);
    return () => window.removeEventListener('resize', computeLines);
  }, [computeLines]);

  const attemptMatch = useCallback(
    (leftIdx: number, rightIdx: number) => {
      if (matched.has(leftIdx) || matched.has(rightIdx)) return;
      if (leftIdx === rightIdx) {
        const next = new Set(matched);
        next.add(leftIdx);
        setMatched(next);
        setSelectedLeft(null);
        if (next.size === step.pairs.length) {
          onReact('celebrate', step.feedback ?? 'Harika! Tüm bağlantıları başarıyla kurdun.', 'ok', 'combo', next.size);
        } else {
          onReact('happy', 'Bağlantı kuruldu! Sıradaki çifti eşleştir.', 'ok', 'link', next.size + 2);
        }
        return;
      }
      if (!missedOnce.current) {
        missedOnce.current = true;
        onMiss();
      }
      setBadRight(rightIdx);
      onReact('oops', 'Bu ikisi eşleşmiyor, başka bir sağ kart dene!', 'oops', 'retry');
      window.setTimeout(() => setBadRight(null), 420);
    },
    [matched, onMiss, onReact, step.feedback, step.pairs.length],
  );

  const pickLeft = (idx: number) => {
    setSelectedLeft(idx);
    onReact('normal', step.say, 'normal', 'tap');
  };

  const pickRight = (idx: number) => {
    if (selectedLeft === null) {
      onReact('oops', 'Önce sol sütundan bir kart seç veya kablo sürükle!', 'oops', 'retry');
      return;
    }
    attemptMatch(selectedLeft, idx);
  };

  const findRightUnderPoint = (clientX: number, clientY: number): number | null => {
    for (const rIdx of rightOrder) {
      if (matched.has(rIdx)) continue;
      const el = rightRefs.current[rIdx];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left - 8 && clientX <= rect.right + 8 && clientY >= rect.top - 6 && clientY <= rect.bottom + 6) {
        return rIdx;
      }
    }
    return null;
  };

  const handleLeftPointerDown = (e: React.PointerEvent<HTMLButtonElement>, idx: number) => {
    if (matched.has(idx)) return;
    const board = boardRef.current;
    if (!board) return;
    const br = board.getBoundingClientRect();
    const lr = e.currentTarget.getBoundingClientRect();
    dragStart.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedLeft(idx);
    setDragWire({
      leftIdx: idx,
      x1: lr.right - br.left - 4,
      y1: lr.top - br.top + lr.height / 2,
      x2: e.clientX - br.left,
      y2: e.clientY - br.top,
      moved: false,
      hoverRight: null,
    });
  };

  const handleLeftPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragWire || !dragStart.current) return;
    const board = boardRef.current;
    if (!board) return;
    const dist = Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
    if (dist > 10) dragStart.current.moved = true;
    const isMoved = dragStart.current.moved;
    const br = board.getBoundingClientRect();
    const hoverRight = findRightUnderPoint(e.clientX, e.clientY);
    setDragWire((prev) =>
      prev
        ? {
            ...prev,
            x2: e.clientX - br.left,
            y2: e.clientY - br.top,
            moved: isMoved,
            hoverRight,
          }
        : null,
    );
  };

  const handleLeftPointerUp = (e: React.PointerEvent<HTMLButtonElement>, idx: number) => {
    const start = dragStart.current;
    const activeWire = dragWire;
    dragStart.current = null;
    setDragWire(null);
    if (start?.moved && activeWire) {
      const target = findRightUnderPoint(e.clientX, e.clientY);
      if (target !== null) {
        attemptMatch(idx, target);
      }
      return;
    }
    pickLeft(idx);
  };

  const curvePath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.max(24, Math.abs(x2 - x1) * 0.45);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div ref={boardRef} className={s.matchBoard}>
        {/* SVG Enerji Kablo Katmanı */}
        <svg className={s.matchSvg} aria-hidden="true">
          {lines.map((ln) => {
            const color = CABLE_COLORS[ln.idx % CABLE_COLORS.length];
            return (
              <g key={ln.idx}>
                <path d={curvePath(ln.x1, ln.y1, ln.x2, ln.y2)} stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.28" />
                <path d={curvePath(ln.x1, ln.y1, ln.x2, ln.y2)} stroke={color} strokeWidth="2.8" fill="none" strokeLinecap="round" />
                <circle cx={ln.x1} cy={ln.y1} r="4.5" fill={color} stroke="#fff" strokeWidth="1.5" />
                <circle cx={ln.x2} cy={ln.y2} r="4.5" fill={color} stroke="#fff" strokeWidth="1.5" />
              </g>
            );
          })}
          {dragWire?.moved && (
            <g>
              <path
                d={curvePath(dragWire.x1, dragWire.y1, dragWire.x2, dragWire.y2)}
                stroke="#7c5cff"
                strokeWidth="3.2"
                strokeDasharray="6 4"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx={dragWire.x2} cy={dragWire.y2} r="6" fill="#7c5cff" stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>

        <div className="relative z-10 grid grid-cols-2 gap-6 sm:gap-8">
          <div className="flex flex-col gap-2.5">
            {leftOrder.map((idx) => {
              const done = matched.has(idx);
              const sel = selectedLeft === idx;
              return (
                <button
                  key={`l-${idx}`}
                  ref={(el) => {
                    leftRefs.current[idx] = el;
                  }}
                  type="button"
                  disabled={done}
                  onPointerDown={(e) => handleLeftPointerDown(e, idx)}
                  onPointerMove={handleLeftPointerMove}
                  onPointerUp={(e) => handleLeftPointerUp(e, idx)}
                  onPointerCancel={() => {
                    dragStart.current = null;
                    setDragWire(null);
                  }}
                  style={{ touchAction: 'none' }}
                  className={`${s.tileBtn} relative pr-6 text-center !text-sm ${done ? `${s.tileOk} opacity-90` : sel ? s.tileSel : ''}`}
                >
                  <span>{step.pairs[idx][0]}</span>
                  <span
                    className={`${s.matchPort} ${s.matchPortRight} ${done ? s.matchPortDone : sel ? s.matchPortActive : ''}`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2.5">
            {rightOrder.map((idx) => {
              const done = matched.has(idx);
              const bad = badRight === idx;
              const hovered = dragWire?.hoverRight === idx;
              return (
                <button
                  key={`r-${idx}`}
                  ref={(el) => {
                    rightRefs.current[idx] = el;
                  }}
                  type="button"
                  disabled={done}
                  onClick={() => pickRight(idx)}
                  className={`${s.tileBtn} relative pl-6 text-center !text-sm ${
                    done ? `${s.tileOk} opacity-90` : bad ? s.tileBad : hovered ? s.tileSel : ''
                  }`}
                >
                  <span
                    className={`${s.matchPort} ${s.matchPortLeft} ${done ? s.matchPortDone : hovered ? s.matchPortActive : ''}`}
                    aria-hidden="true"
                  />
                  <span>{step.pairs[idx][1]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!allDone && (
        <p className="text-center text-xs font-bold text-slate-500">
          Soldan sağa kablo sürükle veya iki karta sırayla dokun
        </p>
      )}

      {allDone && (
        <button type="button" onClick={onComplete} className={s.goBtn}>
          Devam →
        </button>
      )}
    </div>
  );
}
