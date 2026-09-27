'use client';

import type { CSSProperties, ReactNode } from 'react';
import { BookOpenCheck, CheckCircle2, Eye, Lightbulb, MessagesSquare, Sparkles, Target } from 'lucide-react';
import type { SlideDeckSlide } from '@/app/src/lib/topicSlideDeck';
import type { SlideAccent } from '@/app/src/components/questionPlayer/QuestionPlayerParts';

// Kapak ve alt başlık (section) slaytları dışındaki sınıf-içi slayt tiplerinin görünümü
// (kazanımlar, kavramlar, etkinlik, konu özeti, tartışma) — bkz. topicSlideDeck.ts.
// Adım adım açılma SlidePlayer'ın revealedCount'u ile yönetiliyor (İleri/→ bir adım açar).

type TextStyle = (baseRem: number, lineHeight?: number) => CSSProperties | undefined;

type ViewProps = {
  slide: SlideDeckSlide;
  accent: SlideAccent;
  revealedCount: number;
  onReveal: (step: number) => void;
  textStyle: TextStyle;
};

// "İleri"ye basınca slayt değişmeden önce kaç açılma adımı kaldığı. revealedCount slayta
// girilince 1'dir: section/summary'de ilk madde açık başlar, concepts'te açıklamalar kapalı
// başlar (önce sınıfa "bunu bilen var mı?" diye sorulsun), activity'de örnek kapalı başlar.
export function revealStepsLeft(slide: SlideDeckSlide, revealedCount: number): number {
  switch (slide.kind) {
    case 'section':
      return Math.max(0, slide.bullets.length - revealedCount);
    case 'summary':
      return Math.max(0, (slide.items?.length ?? slide.bullets.length) - revealedCount);
    case 'concepts':
      return Math.max(0, (slide.items?.length ?? 0) - (revealedCount - 1));
    case 'activity':
      return slide.reveal ? Math.max(0, 2 - revealedCount) : 0;
    default:
      return 0;
  }
}

function SlideTitle({ icon, accent, textStyle, children }: { icon: ReactNode; accent: SlideAccent; textStyle: TextStyle; children: ReactNode }) {
  return (
    <div className="mb-3 sm:mb-5 flex shrink-0 items-center gap-2.5">
      <span
        className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-white shadow"
        style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
      >
        {icon}
      </span>
      <h2 className="text-lg sm:text-2xl font-black text-slate-800" style={textStyle(1.5, 1.25)}>{children}</h2>
    </div>
  );
}

const SHELL = 'relative flex flex-1 min-h-0 flex-col px-4 sm:px-8 pt-2 pb-4 sm:pb-8';

function ObjectivesView({ slide, accent, textStyle }: ViewProps) {
  return (
    <div className={SHELL}>
      <SlideTitle icon={<Target className="h-4 w-4 sm:h-5 sm:w-5" />} accent={accent} textStyle={textStyle}>{slide.heading}</SlideTitle>
      <div className="relative z-[1] flex-1 min-h-0 overflow-y-auto py-1">
      <ul className="flex flex-col gap-2.5 sm:gap-3">
        {slide.bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3 rounded-2xl border bg-white/80 px-4 py-2.5 shadow-sm" style={{ borderColor: `${accent.bar}26` }}>
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent.bar }} />
            <span className="text-sm sm:text-base font-semibold leading-snug text-slate-700" style={textStyle(1, 1.4)}>{b}</span>
          </li>
        ))}
      </ul>
      </div>
      {slide.subtitle && <p className="relative z-[1] mt-2 shrink-0 text-xs font-bold text-slate-400">{slide.subtitle}</p>}
    </div>
  );
}

function ConceptsView({ slide, accent, revealedCount, onReveal, textStyle }: ViewProps) {
  const items = slide.items ?? [];
  const shown = revealedCount - 1;
  return (
    <div className={SHELL}>
      <SlideTitle icon={<Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />} accent={accent} textStyle={textStyle}>{slide.heading}</SlideTitle>
      <p className="relative z-[1] -mt-2 mb-3 shrink-0 text-xs font-bold text-slate-400">Önce tahmin edin, sonra kavrama dokunup açıklamasını açın.</p>
      <div className="relative z-[1] grid flex-1 min-h-0 auto-rows-min grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto py-1">
        {items.map((item, i) => {
          const open = i < shown;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onReveal(i + 2)}
              disabled={open}
              className={`rounded-2xl border px-4 py-2.5 text-left transition-all duration-300 ${open ? 'shadow-sm' : 'cursor-pointer hover:shadow-sm'}`}
              style={{
                borderColor: open ? `${accent.bar}33` : 'rgb(226 232 240)',
                background: open ? `linear-gradient(90deg, ${accent.soft}, white)` : 'white',
              }}
            >
              <span className="block text-sm sm:text-base font-black text-slate-800" style={textStyle(1, 1.3)}>{item.term}</span>
              {open ? (
                <span className="mt-1 block text-xs sm:text-sm font-medium leading-snug text-slate-600" style={textStyle(0.875, 1.4)}>{item.description}</span>
              ) : (
                <span className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-400"><Eye className="h-3 w-3" /> Açıklamayı göster</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActivityView({ slide, accent, revealedCount, onReveal, textStyle }: ViewProps) {
  const text = slide.bullets[0]?.replace(`${slide.label}: `, '') ?? '';
  const open = revealedCount >= 2;
  return (
    <div className="relative flex flex-1 min-h-0 flex-col items-center justify-center gap-4 sm:gap-5 overflow-y-auto px-5 sm:px-12 py-4 text-center" style={{ background: `linear-gradient(135deg, ${accent.from}1a, white 60%)` }}>
      <p className="relative z-[1] max-w-2xl truncate text-[11px] font-black uppercase tracking-wide text-slate-400">{slide.heading}</p>
      <span
        className="relative z-[1] inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-black text-white shadow"
        style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, ...textStyle(0.875, 1.2) }}
      >
        <Lightbulb className="h-4 w-4" /> {slide.label}
      </span>
      <p className="relative z-[1] max-w-3xl text-lg sm:text-2xl font-bold leading-snug text-slate-800" style={textStyle(1.5, 1.35)}>{text}</p>
      {slide.reveal && (open ? (
        <div className="relative z-[1] max-w-3xl rounded-2xl border bg-white px-5 py-3 text-left shadow-sm" style={{ borderColor: `${accent.bar}33` }}>
          <p className="mb-1 text-[11px] font-black uppercase tracking-wide" style={{ color: accent.bar }}>Örnek yaklaşım</p>
          <p className="text-sm sm:text-base font-medium leading-relaxed text-slate-600" style={textStyle(1, 1.5)}>{slide.reveal}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onReveal(2)}
          className="relative z-[1] inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-black text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Eye className="h-4 w-4" /> Örnek yaklaşımı göster
        </button>
      ))}
    </div>
  );
}

function SummaryView({ slide, accent, revealedCount, onReveal, textStyle }: ViewProps) {
  const rows = slide.items ?? slide.bullets.map((b) => ({ term: '', description: b }));
  return (
    <div className={SHELL}>
      <SlideTitle icon={<BookOpenCheck className="h-4 w-4 sm:h-5 sm:w-5" />} accent={accent} textStyle={textStyle}>{slide.heading}</SlideTitle>
      <div className="relative z-[1] flex flex-1 min-h-0 flex-col gap-2.5 overflow-y-auto py-1">
        {rows.map((row, i) => {
          const revealed = i < revealedCount;
          const isNextUp = i === revealedCount;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onReveal(i + 1)}
              disabled={revealed}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-2.5 text-left transition-all duration-300 ${
                revealed ? 'shadow-sm' : isNextUp ? 'opacity-40 cursor-pointer hover:opacity-70' : 'opacity-0 pointer-events-none'
              }`}
              style={{
                borderColor: revealed ? `${accent.bar}33` : 'transparent',
                background: revealed ? `linear-gradient(90deg, ${accent.soft}, white)` : 'transparent',
              }}
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent.bar }} />
              <span className="text-sm sm:text-base leading-snug text-slate-700" style={textStyle(1, 1.4)}>
                {row.term && <strong className="font-black text-slate-800">{row.term}: </strong>}
                {row.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DiscussionView({ slide, accent, textStyle }: ViewProps) {
  return (
    <div className="relative flex flex-1 min-h-0 flex-col items-center justify-center gap-4 sm:gap-5 overflow-y-auto px-5 sm:px-12 py-4 text-center" style={{ background: `linear-gradient(135deg, ${accent.from}1a, white 60%)` }}>
      <span
        className="relative z-[1] flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
      >
        <MessagesSquare className="h-7 w-7 sm:h-8 sm:w-8" />
      </span>
      <h2 className="relative z-[1] text-xl sm:text-3xl font-black text-slate-800" style={textStyle(1.875, 1.2)}>{slide.heading}</h2>
      <p className="relative z-[1] max-w-3xl text-base sm:text-xl font-bold leading-snug text-slate-700" style={textStyle(1.25, 1.4)}>{slide.bullets[0]}</p>
      <p className="relative z-[1] text-xs font-bold text-slate-400">Fikirlerinizi gerekçesiyle sınıfla paylaşın.</p>
    </div>
  );
}

export function ClassroomSlideView(props: ViewProps) {
  switch (props.slide.kind) {
    case 'objectives':
      return <ObjectivesView {...props} />;
    case 'concepts':
      return <ConceptsView {...props} />;
    case 'activity':
      return <ActivityView {...props} />;
    case 'summary':
      return <SummaryView {...props} />;
    case 'discussion':
      return <DiscussionView {...props} />;
    default:
      return null;
  }
}
