// Dersin ikonu robotik neon kutuda (2026-10-25, soru bankası tüm seviyeler): ders rengi yerine tema neonu;
// kart r.item / r.itemHover taşıyorsa üzerine gelince kutu dolar (bkz. robotic.module.css .chipBox).
import { subjectStyle } from '@/app/src/lib/subjectStyle';
import r from './robotic.module.css';

export function NeonSubjectIcon({ lessonName, className, iconClassName = 'h-5 w-5' }: { lessonName: string; className: string; iconClassName?: string }) {
  const { Icon } = subjectStyle(lessonName);
  return (
    <span className={`shrink-0 ${className} ${r.chipBox}`} aria-hidden="true">
      <Icon className={iconClassName} strokeWidth={1.9} />
    </span>
  );
}
