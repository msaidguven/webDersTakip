'use client';

// Hap bilgi örneğinin şekli. DOMPurify DOM gerektirdiği için yalnız istemcide (RecapCardView ssr:false ile yükler);
// SVG kabı koyu temada da açık kalır (diyagramlardaki gibi `light`).
import { useMemo } from 'react';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import s from './DersClientV1.module.css';

export default function RecapFigure({ svg, label }: { svg: string; label: string }) {
  const clean = useMemo(() => sanitizeMathSvg(svg), [svg]);
  if (!clean) return null;
  return <div role="img" aria-label={label} className={`light ${s.recapFigure}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
