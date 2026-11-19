'use client';

// Harf çemberi: SVG ile çizilir; fare ve dokunma aynı pointer olaylarıyla çalışır
// (pointerdown/move/up + touch-action:none). Seçilen harfler çizgiyle birleştirilir.
// Klavye için harfler odaklanabilir; Enter/Boşluk harfi seçer, "Kontrol et" düğmesi gönderir.
import { useRef, useState } from 'react';
import { Lightbulb, Shuffle } from 'lucide-react';
import type { CemberHarfi } from '@/app/src/lib/kavramAvi';
import r from '../robotic/robotic.module.css';
import s from './kavramAvi.module.css';

const BOYUT = 300; // viewBox kenarı
const MERKEZ = BOYUT / 2;
const YARICAP = 108;

type Props = {
  harfler: CemberHarfi[];
  secim: number[];
  secilenKelime: string;
  yanlis: boolean;
  ipucuBitti: boolean;
  onHarfSec: (sira: number) => void;
  onGonder: () => void;
  onTemizle: () => void;
  onKaristir: () => void;
  onIpucu: () => void;
};

export function HarfCemberi({
  harfler,
  secim,
  secilenKelime,
  yanlis,
  ipucuBitti,
  onHarfSec,
  onGonder,
  onTemizle,
  onKaristir,
  onIpucu,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [parmakta, setParmakta] = useState(false);
  const [imlec, setImlec] = useState<{ x: number; y: number } | null>(null);

  const n = harfler.length;
  const dugumYaricapi = n <= 7 ? 27 : n <= 10 ? 23 : 19;
  const konumlar = harfler.map((_, i) => {
    const aci = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return n === 1
      ? { x: MERKEZ, y: MERKEZ }
      : { x: MERKEZ + YARICAP * Math.cos(aci), y: MERKEZ + YARICAP * Math.sin(aci) };
  });

  function noktaya(e: React.PointerEvent) {
    const kutu = svgRef.current?.getBoundingClientRect();
    if (!kutu || kutu.width === 0) return null;
    return { x: ((e.clientX - kutu.left) * BOYUT) / kutu.width, y: ((e.clientY - kutu.top) * BOYUT) / kutu.height };
  }

  function harfBul(p: { x: number; y: number }) {
    const sinir = dugumYaricapi + 6;
    for (let i = 0; i < konumlar.length; i++) {
      if (Math.hypot(konumlar[i].x - p.x, konumlar[i].y - p.y) <= sinir) return i;
    }
    return -1;
  }

  function surukle(e: React.PointerEvent) {
    const p = noktaya(e);
    if (!p) return;
    setImlec(p);
    const i = harfBul(p);
    if (i >= 0) onHarfSec(i);
  }

  function basla(e: React.PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setParmakta(true);
    surukle(e);
  }

  function birak() {
    if (!parmakta) return;
    setParmakta(false);
    setImlec(null);
    onGonder();
  }

  function iptal() {
    if (!parmakta) return;
    setParmakta(false);
    setImlec(null);
    onTemizle();
  }

  const cizgi = secim.map((i) => `${konumlar[i].x},${konumlar[i].y}`);
  if (parmakta && imlec && secim.length > 0) cizgi.push(`${imlec.x},${imlec.y}`);

  return (
    <div className={s.cemberKap}>
      <div className={s.cemberAlan}>
      {secilenKelime && (
        <div
          className={`${s.secilen} ${yanlis ? s.secilenYanlis : ''}`}
          style={{ fontSize: secilenKelime.length <= 5 ? 22 : secilenKelime.length <= 8 ? 17 : 13 }}
          aria-hidden="true"
        >
          {secilenKelime}
        </div>
      )}
      <svg
        ref={svgRef}
        className={`${s.cember} ${yanlis ? s.sallan : ''}`}
        viewBox={`0 0 ${BOYUT} ${BOYUT}`}
        role="group"
        aria-label="Harf çemberi. Harflerin üzerinden kaydırarak kelimeyi oluştur."
        onPointerDown={basla}
        onPointerMove={(e) => parmakta && surukle(e)}
        onPointerUp={birak}
        onPointerCancel={iptal}
      >
        <circle cx={MERKEZ} cy={MERKEZ} r={YARICAP + dugumYaricapi + 8} className={s.cemberZemin} />
        {cizgi.length > 1 && <polyline points={cizgi.join(' ')} className={s.cizgi} />}
        {harfler.map((h, i) => {
          const secili = secim.includes(i);
          return (
            <g
              key={h.id}
              className={`${s.harf} ${secili ? s.harfSecili : ''}`}
              tabIndex={0}
              role="button"
              aria-label={`${h.harf} harfi${secili ? ', seçili' : ''}`}
              aria-pressed={secili}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onHarfSec(i);
                }
              }}
            >
              <circle cx={konumlar[i].x} cy={konumlar[i].y} r={dugumYaricapi} className={s.harfDaire} />
              <text
                x={konumlar[i].x}
                y={konumlar[i].y}
                className={s.harfYazi}
                style={{ fontSize: dugumYaricapi * 1.15 }}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {h.harf}
              </text>
            </g>
          );
        })}
      </svg>
      </div>

      <div className={s.kontroller}>
        <button type="button" className={`${s.dugme} ${r.btnGhost}`} onClick={onKaristir} aria-label="Harfleri karıştır">
          <Shuffle size={18} aria-hidden="true" /> Karıştır
        </button>
        <button
          type="button"
          className={`${s.dugme} ${r.btnGhost}`}
          onClick={onIpucu}
          disabled={ipucuBitti}
          aria-label="İpucu al: sıradaki harfi göster"
        >
          <Lightbulb size={18} aria-hidden="true" /> İpucu
        </button>
        {secim.length > 0 && !parmakta && (
          <button type="button" className={`${s.dugme} ${r.btnNeon}`} onClick={onGonder} aria-label="Seçilen harflerle kelimeyi kontrol et">
            Kontrol et
          </button>
        )}
      </div>
    </div>
  );
}
