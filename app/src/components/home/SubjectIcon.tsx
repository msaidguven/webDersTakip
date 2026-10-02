import { subjectStyle } from '@/app/src/lib/subjectStyle';

// Dersin ikon kutusu. "soft": açık zemin + renkli ikon (listeler); "solid": dolgulu renk + beyaz
// ikon (ders kartları, 2026-10-02 — kullanıcının beğendiği referans tasarım).
export function SubjectIcon({ lessonName, size = 'md', variant = 'soft' }: { lessonName: string; size?: 'sm' | 'md' | 'lg'; variant?: 'soft' | 'solid' }) {
  const st = subjectStyle(lessonName);
  const box = size === 'sm' ? 'h-9 w-9 rounded-lg' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl';
  const icon = size === 'sm' ? 'h-[18px] w-[18px]' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  return (
    <span className={`flex shrink-0 items-center justify-center ${box} ${variant === 'solid' ? st.solid : st.chip}`} aria-hidden="true">
      <st.Icon className={icon} strokeWidth={variant === 'solid' ? 2 : 1.9} />
    </span>
  );
}
