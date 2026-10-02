import { subjectStyle } from '@/app/src/lib/subjectStyle';

// Dersin küçük ikon kutusu (v4 sade tasarım) — renk sadece burada ve ince çizgilerde.
export function SubjectIcon({ lessonName, size = 'md' }: { lessonName: string; size?: 'sm' | 'md' }) {
  const { Icon, chip } = subjectStyle(lessonName);
  const box = size === 'sm' ? 'h-9 w-9 rounded-lg' : 'h-10 w-10 rounded-xl';
  return (
    <span className={`flex shrink-0 items-center justify-center ${box} ${chip}`} aria-hidden="true">
      <Icon className={size === 'sm' ? 'h-[18px] w-[18px]' : 'h-5 w-5'} strokeWidth={1.9} />
    </span>
  );
}
