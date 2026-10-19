export const PERIODS = [
  { days: 1, label: 'Son 24 saat' },
  { days: 7, label: 'Son 7 gün' },
  { days: 30, label: 'Son 30 gün' },
  { days: 90, label: 'Son 90 gün' },
];

export const ROLE_LABELS: Record<string, string> = { student: 'Öğrenci', teacher: 'Öğretmen', admin: 'Admin' };

export function safeDecode(path: string): string {
  try { return decodeURIComponent(path); } catch { return path; }
}

export function memberLabel(m: { full_name: string | null; username: string | null }): string {
  return m.full_name || (m.username ? `@${m.username}` : 'İsimsiz üye');
}

export function relativeTime(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'az önce';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function percent(correct: number, answered: number): string {
  return answered > 0 ? `%${Math.round((correct / answered) * 100)}` : '—';
}
