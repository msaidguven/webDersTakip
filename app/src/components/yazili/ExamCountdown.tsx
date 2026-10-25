'use client';

// Yazılı tarihine geri sayım. Sayfa ISR ile haftalarca önbellekte kalabildiği için "kaç gün kaldı"
// sunucuda değil tarayıcıda hesaplanır; sunucu HTML'inde yalnız tarihin kendisi yazar.
import { useEffect, useState } from 'react';
import { istanbulToday } from '@/app/src/lib/progressActivity';

export function formatExamDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00+03:00`).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', timeZone: 'Europe/Istanbul',
  });
}

export function daysUntil(isoDate: string, today: string): number {
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function ExamCountdown({ examDate, className }: { examDate: string; className?: string }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    setDays(daysUntil(examDate, istanbulToday()));
  }, [examDate]);

  const label = days == null ? null : days > 1 ? `Sınava ${days} gün kaldı` : days === 1 ? 'Sınav yarın' : days === 0 ? 'Sınav bugün' : 'Sınav yapıldı';
  return (
    <span className={className}>
      <time dateTime={examDate}>{formatExamDate(examDate)}</time>
      {label && <b className="ml-2">· {label}</b>}
    </span>
  );
}
