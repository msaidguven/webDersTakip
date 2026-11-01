// Renkli metalik sınıf kartı (2026-10-31): misafir anasayfası ve soru bankası "Sınıfını seç" ortak kartı.
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import styles from './GradeMetalCard.module.css';

// Sınıf → [açık, doygun, koyu]. Bilinmeyen sınıf gri-çelik.
const PALETTE: Record<number, [string, string, string]> = {
  5: ['#38bdf8', '#2563eb', '#1e3a8a'],
  6: ['#a78bfa', '#7c3aed', '#4c1d95'],
  7: ['#34d399', '#059669', '#064e3b'],
  8: ['#fbbf24', '#ea580c', '#7c2d12'],
  9: ['#fb7185', '#e11d48', '#881337'],
  10: ['#22d3ee', '#0891b2', '#164e63'],
  11: ['#e879f9', '#c026d3', '#701a75'],
  12: ['#cbd5e1', '#64748b', '#1e293b'],
};

export function GradeMetalCard({ href, level, title, children }: { href: string; level: number; title: string; children?: ReactNode }) {
  const [g1, g2, g3] = PALETTE[level] ?? PALETTE[12];
  return (
    <Link href={href} className={styles.card} style={{ '--g1': g1, '--g2': g2, '--g3': g3 } as CSSProperties}>
      <span className="flex items-start justify-between gap-3">
        <span className={styles.num} aria-hidden="true">{level}</span>
        <ArrowRight className={`h-5 w-5 ${styles.arrow}`} aria-hidden="true" />
      </span>
      <span>
        <span className="block text-lg font-black tracking-tight">{title}</span>
        {children && <span className={`mt-1 block text-xs font-bold ${styles.meta}`}>{children}</span>}
      </span>
    </Link>
  );
}
