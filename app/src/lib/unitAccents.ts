// Ünite vurgu renkleri — müfredat sayfası (Mufredatoverviewclient) ile konu sayfasının
// sidebar'ı (DersClient) AYNI paleti kullansın diye tek yerde (kullanıcının 2026-09-25
// kararı: "her ünite kendi rengi"). İki sayfa da üniteleri aynı sırada listelediği için
// bir ünite her iki sayfada da aynı rengi alır.
export type UnitAccent = {
  /** Müfredat kartının sol şeridi */
  border: string;
  /** Müfredat kartındaki ünite numarası rozeti */
  badge: string;
  /** Müfredat kartının başlık şeridi zemini */
  headerBg: string;
  /** Sidebar'daki ünite noktası */
  dot: string;
  /** Sidebar'daki ünite başlığı metni */
  text: string;
  /** Sidebar'da ünitenin konu bloğunu saran dikey çizgi */
  rail: string;
  /** Sidebar'da açık/aktif ünite satırının zemini */
  activeBg: string;
};

export const UNIT_ACCENTS: UnitAccent[] = [
  { border: 'border-l-4 border-l-indigo-500', badge: 'bg-indigo-100 text-indigo-700', headerBg: 'bg-indigo-50/60', dot: 'bg-indigo-500', text: 'text-indigo-700', rail: 'border-indigo-200', activeBg: 'bg-indigo-50/70' },
  { border: 'border-l-4 border-l-purple-500', badge: 'bg-purple-100 text-purple-700', headerBg: 'bg-purple-50/60', dot: 'bg-purple-500', text: 'text-purple-700', rail: 'border-purple-200', activeBg: 'bg-purple-50/70' },
  { border: 'border-l-4 border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700', headerBg: 'bg-emerald-50/60', dot: 'bg-emerald-500', text: 'text-emerald-700', rail: 'border-emerald-200', activeBg: 'bg-emerald-50/70' },
  { border: 'border-l-4 border-l-amber-500', badge: 'bg-amber-100 text-amber-700', headerBg: 'bg-amber-50/60', dot: 'bg-amber-500', text: 'text-amber-700', rail: 'border-amber-200', activeBg: 'bg-amber-50/70' },
  { border: 'border-l-4 border-l-rose-500', badge: 'bg-rose-100 text-rose-700', headerBg: 'bg-rose-50/60', dot: 'bg-rose-500', text: 'text-rose-700', rail: 'border-rose-200', activeBg: 'bg-rose-50/70' },
  { border: 'border-l-4 border-l-sky-500', badge: 'bg-sky-100 text-sky-700', headerBg: 'bg-sky-50/60', dot: 'bg-sky-500', text: 'text-sky-700', rail: 'border-sky-200', activeBg: 'bg-sky-50/70' },
];

export function unitAccent(index: number): UnitAccent {
  return UNIT_ACCENTS[((index % UNIT_ACCENTS.length) + UNIT_ACCENTS.length) % UNIT_ACCENTS.length];
}
