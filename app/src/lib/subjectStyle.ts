// Ders kimliği (anasayfa, 2026-10-02): ders rengi ikon kutusunda, ders kartının çok açık zemininde ve
// ince ilerleme çizgisinde; butonlar tek vurgu renginde (indigo) kalır. Ders adından
// türetilir (DB'de ders rengi alanı yok) — aynı ders sitenin her yerinde aynı görünür.
import {
  Atom,
  BookOpen,
  Brain,
  Calculator,
  Feather,
  FlaskConical,
  Globe,
  Landmark,
  Languages,
  Leaf,
  Map,
  Monitor,
  PenLine,
  TestTube,
  type LucideIcon,
} from 'lucide-react';

export interface SubjectStyle {
  Icon: LucideIcon;
  /** İkon kutusu: açık zemin + ders rengi (koyu tema dahil). */
  chip: string;
  /** İnce ilerleme çizgisi / nokta rengi. */
  bar: string;
  /** Dolgulu ikon kutusu (beyaz ikon) — ders kartlarında. */
  solid: string;
  /** Ders kartının çok açık zemini + çerçevesi. */
  tint: string;
}

const RULES: { match: string[]; style: SubjectStyle }[] = [
  { match: ['matematik'], style: { Icon: Calculator, chip: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300', bar: 'bg-blue-600', solid: 'bg-blue-600 text-white', tint: 'bg-blue-50/70 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20' } },
  { match: ['fen bilimleri', 'fen '], style: { Icon: FlaskConical, chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', bar: 'bg-emerald-600', solid: 'bg-emerald-600 text-white', tint: 'bg-emerald-50/70 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20' } },
  { match: ['sosyal'], style: { Icon: Globe, chip: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300', bar: 'bg-orange-600', solid: 'bg-orange-600 text-white', tint: 'bg-orange-50/70 border-orange-100 dark:bg-orange-500/10 dark:border-orange-500/20' } },
  { match: ['din kültürü', 'din '], style: { Icon: BookOpen, chip: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300', bar: 'bg-teal-600', solid: 'bg-teal-600 text-white', tint: 'bg-teal-50/70 border-teal-100 dark:bg-teal-500/10 dark:border-teal-500/20' } },
  { match: ['bilişim'], style: { Icon: Monitor, chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', bar: 'bg-violet-600', solid: 'bg-violet-600 text-white', tint: 'bg-violet-50/70 border-violet-100 dark:bg-violet-500/10 dark:border-violet-500/20' } },
  { match: ['türkçe', 'türk dili', 'edebiyat'], style: { Icon: PenLine, chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', bar: 'bg-rose-600', solid: 'bg-rose-600 text-white', tint: 'bg-rose-50/70 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20' } },
  { match: ['ingilizce', 'almanca', 'yabancı dil'], style: { Icon: Languages, chip: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', bar: 'bg-sky-600', solid: 'bg-sky-600 text-white', tint: 'bg-sky-50/70 border-sky-100 dark:bg-sky-500/10 dark:border-sky-500/20' } },
  { match: ['tarih', 'inkılap'], style: { Icon: Landmark, chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', bar: 'bg-amber-600', solid: 'bg-amber-600 text-white', tint: 'bg-amber-50/70 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20' } },
  { match: ['coğrafya'], style: { Icon: Map, chip: 'bg-lime-50 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300', bar: 'bg-lime-600', solid: 'bg-lime-600 text-white', tint: 'bg-lime-50/70 border-lime-100 dark:bg-lime-500/10 dark:border-lime-500/20' } },
  { match: ['fizik'], style: { Icon: Atom, chip: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300', bar: 'bg-indigo-600', solid: 'bg-indigo-600 text-white', tint: 'bg-indigo-50/70 border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20' } },
  { match: ['kimya'], style: { Icon: TestTube, chip: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300', bar: 'bg-fuchsia-600', solid: 'bg-fuchsia-600 text-white', tint: 'bg-fuchsia-50/70 border-fuchsia-100 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/20' } },
  { match: ['biyoloji'], style: { Icon: Leaf, chip: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300', bar: 'bg-green-600', solid: 'bg-green-600 text-white', tint: 'bg-green-50/70 border-green-100 dark:bg-green-500/10 dark:border-green-500/20' } },
  { match: ['felsefe', 'psikoloji'], style: { Icon: Brain, chip: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300', bar: 'bg-slate-600', solid: 'bg-slate-600 text-white', tint: 'bg-slate-50/70 border-slate-100 dark:bg-slate-500/10 dark:border-slate-500/20' } },
  { match: ['müzik', 'resim', 'görsel'], style: { Icon: Feather, chip: 'bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300', bar: 'bg-pink-600', solid: 'bg-pink-600 text-white', tint: 'bg-pink-50/70 border-pink-100 dark:bg-pink-500/10 dark:border-pink-500/20' } },
];

const FALLBACK: SubjectStyle = { Icon: BookOpen, chip: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300', bar: 'bg-indigo-600', solid: 'bg-indigo-600 text-white', tint: 'bg-indigo-50/70 border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20' };

export function subjectStyle(lessonName: string): SubjectStyle {
  const name = `${lessonName.toLocaleLowerCase('tr')} `;
  return RULES.find((r) => r.match.some((m) => name.includes(m)))?.style ?? FALLBACK;
}
