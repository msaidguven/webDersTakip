'use client';

// Atom maskotu ve konuşma balonu — mevcut RobotGuide bileşenini kullanır.
// <b>...</b> vurgularını güvenli şekilde (HTML enjekte etmeden) <strong> olarak çizer.
import type { ReactNode } from 'react';
import RobotGuide, { type RobotMood } from '../RobotGuide';
import s from './v2.module.css';

function renderBoldText(text: string): ReactNode[] {
  const parts = text.split(/(<b>.*?<\/b>)/gi);
  return parts.map((part, idx) => {
    const m = /^<b>(.*?)<\/b>$/i.exec(part);
    if (m) return <strong key={idx} className="font-black text-slate-950">{m[1]}</strong>;
    return <span key={idx}>{part}</span>;
  });
}

export function AtomDialogue({
  mood,
  talking,
  upgraded = false,
  tone = 'normal',
  text,
  onReplay,
}: {
  mood: RobotMood;
  talking: boolean;
  upgraded?: boolean;
  tone?: 'normal' | 'ok' | 'oops';
  text: string;
  onReplay?: () => void;
}) {
  const toneClass = tone === 'ok' ? s.bubbleOk : tone === 'oops' ? s.bubbleOops : '';
  return (
    <div className={s.dialogueRow}>
      <button
        type="button"
        onClick={onReplay}
        className={s.atomBtn}
        aria-label="Atom'un konuşmasını tekrar dinle"
        title="Tekrar dinle"
      >
        <RobotGuide mood={mood} talking={talking} upgraded={upgraded} />
      </button>
      <div className={`${s.bubble} ${toneClass}`} aria-live="polite">
        {renderBoldText(text)}
      </div>
    </div>
  );
}
